# 캠페인 임시저장 + 복사 설계

작성일: 2026-07-28

## 배경

어드민 캠페인 생성 화면은 입력량이 많은데(카테고리·보수·모집·가이드라인·주의사항) 중간 저장 수단이 없다.
작성 중 이탈하면 처음부터 다시 입력해야 한다. 또한 매달 조건이 거의 같은 캠페인을 반복 등록하는데
기존 캠페인을 재사용할 방법이 없다.

## 결정 사항 (확정)

- 임시저장은 **서버 저장 + 팀 전체 공유**. 다른 기기·다른 운영자가 이어서 작성할 수 있다.
- 저장 시점은 **수동 "임시저장" 버튼만**. 자동저장 없음.
- **제목 1자 이상**이면 나머지가 전부 미입력이어도 저장된다.
- 임시저장 캠페인은 **캠페인 관리 페이지에서만** 보인다. 상태 필터칩(`모집중` / `완료` / `임시저장`)으로 조회.
- 복사는 **폼 프리필만** 하고 저장하지 않는다. 모집 시작·종료일만 비우고 나머지는 전부 복사.

## 데이터 모델

`Campaign` 테이블에 발행 상태 컬럼 하나를 추가한다. 별도 임시저장 테이블을 두지 않는다 —
조회 경로가 둘로 갈라지고, 나중에 캠페인 목록에 페이지네이션을 붙일 때 두 소스를 병합해야 한다.

```prisma
enum CampaignPublishState { DRAFT PUBLISHED }

model Campaign {
  ...
  publishState CampaignPublishState @default(PUBLISHED)
}
```

- 컬럼명은 `status`가 아니라 `publishState`. admin-web에 파생 타입 `CampaignStatus = "recruit" | "done"`이 이미 있다.
- 마이그레이션은 컬럼 추가뿐이며 기존 행은 전부 `PUBLISHED`가 된다 (하위 호환 안전).
- 인덱스는 추가하지 않는다. 현재 규모에서 불필요하고, 페이지네이션 도입 시 함께 판단한다.

### DRAFT 행의 미입력 필드

NOT NULL 컬럼을 nullable로 바꾸지 않는다. 대신 미입력 필드는 DB 기본값 성격의 값으로 채운다.

| 필드 | DRAFT 저장값 |
|---|---|
| `rewardJpy` | 미입력 시 `0` |
| `recruitStartAt` / `recruitEndAt` | 미입력 시 저장 시각 |
| `postingPeriodDays` | 미입력 시 `14` |
| `productSummary` / `guideline` / `cautions` | 미입력 시 `""` |
| `recruits` | 입력된 행만 저장, 0개 허용. `recruitCount`/`minFollowers` 미입력 시 `0` |

DRAFT 상태에서 이 값을 읽는 경로가 없고, 발행 시점에 기존 엄격 스키마로 다시 검증하므로 무해하다.

### 응답 스키마 완화 (3곳)

admin-web은 `CampaignResponseSchema`로 응답을 파싱한다. DRAFT를 그대로 왕복시키기 위해 세 필드를 완화한다.

- `recruits[].recruitCount`: `positive` → `nonnegative`
- `productDetailUrls`: `array(url)` → `array(string)` (작성 중인 URL 조각 보존)
- `thumbnailUrl`: `url().nullable()` → `string().nullable()`

이 스키마는 어드민 응답 파싱 가드일 뿐이다. 생성·발행 시 검증은 `CampaignFormSchema`(=`CreateCampaignRequestSchema`)가
그대로 담당하므로 실제 캠페인의 엄격성은 변하지 않는다. 인플루언서 응답 스키마는 손대지 않는다.

## API

### 신규 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/campaign-drafts` | 느슨한 스키마(`CampaignDraftRequestSchema`)로 DRAFT 생성 |
| PATCH | `/campaign-drafts/:id` | 임시저장 갱신. DRAFT가 아니면 400 |
| POST | `/campaign-drafts/:id/publish` | 엄격 검증 통과 시 `publishState=PUBLISHED` |
| DELETE | `/campaign-drafts/:id` | DRAFT 삭제. DRAFT가 아니면 400 |

- 서비스 본체(recruits 동기화, 제외관계 처리, 썸네일/본문 이미지 해석)는 기존 create/update 코드를 재사용한다.
  달라지는 것은 검증 스키마와 `publishState`뿐이다.
- publish 는 요청 본문(완성된 폼)을 `CreateCampaignRequestSchema`로 검증한 뒤 기존 update 경로로 반영하고
  `publishState`를 전환한다. 검증 실패 시 400이고 `publishState`는 DRAFT로 유지된다.
- 기존 `POST /campaigns`, `PATCH /campaigns/:id`는 변경하지 않는다.

### 기존 엔드포인트 변경

- `GET /campaigns` : **기본적으로 DRAFT 제외**. `?includeDrafts=1` 일 때만 포함.
  기본값이 안전한 쪽이므로 새 소비처가 생겨도 DRAFT가 새지 않는다.
- `POST /campaigns/:id/close` : DRAFT면 400.

### 노출 차단

`PUBLISHED_CAMPAIGN_WHERE = { publishState: "PUBLISHED" }` 상수를 만들어 아래에 적용한다.

- 인플루언서: 캠페인 목록, 캠페인 상세, 응모 검증
- 어드민: 통계 카운트(admin-overview), 리포트(admin-reports), 제외 대상 캠페인 검증

admin-web에서 `GET /campaigns`를 소비하는 곳 중 캠페인 관리 목록 외의 3곳
(`useCampaignOptions` → 응모자 페이지·승인자 다이얼로그·원고검수 페이지, `CampaignForm`의 제외캠페인 피커)은
`includeDrafts` 를 붙이지 않으므로 자동으로 DRAFT가 제외된다.

## 어드민 UI

### 캠페인 관리 목록

- 상태 필터칩에 `임시저장` 옵션 추가. 파생 타입 `CampaignStatus`에 `"draft"` 추가.
  `deriveStatus`는 `publishState === "DRAFT"`를 최우선으로 판정한다(종료/모집기간 판정보다 앞).
- 카드에 `임시저장` 배지. DRAFT 카드는 D-day·응모자 수가 의미 없으므로 그 자리에 최종 수정 시각을 표시한다.
- 액션 메뉴: DRAFT 카드는 `[수정] [복사] [삭제]`, PUBLISHED 카드는 기존 항목 + `[복사]`.

### 폼 화면

| 진입 | 버튼 |
|---|---|
| 신규 생성 | `[취소] [임시저장] [생성]` |
| DRAFT 수정 | `[취소] [임시저장] [생성]` (생성 = publish) |
| PUBLISHED 수정 | `[취소] [수정 저장]` (기존과 동일) |

- `임시저장` 버튼은 제목 1자 이상이면 활성. 신규 화면에서 누르면 DRAFT 생성 후 `/campaigns/:id/edit`로 이동한다.
- 폼 유효성 검사는 `생성` 버튼에만 적용된다.

### 복사

`/campaigns/new?copyFrom=<id>` 로 진입해 `getCampaign` 결과를 프리필한다.

- 비우는 것: `recruitStartDate`, `recruitEndDate`
- 제목: 원본 뒤에 ` (복사)` 접미사 — 목록에서 원본과 구분되지 않으면 사고가 난다
- 복사하는 것: 카테고리, 보수 체계·금액, `recruits` 전체(옵션별 정원·보수 포함), 게시기간, 상품 정보,
  가이드라인, 참고 미디어, 주의사항, 썸네일, 제외 캠페인 목록
- 저장하지 않는다. 운영자가 확인 후 `생성` 또는 `임시저장`을 누른다. DRAFT도 복사 원본이 될 수 있다.

`New.tsx`가 비동기 초기값을 갖게 되면서 `Edit.tsx`의 로딩·에러 처리와 겹치므로 그 부분만
`useCampaignFormInitial(source)` 훅으로 공유한다. 그 외 리팩토링은 하지 않는다.

## 테스트

1. 인플루언서 캠페인 목록·상세·응모에서 DRAFT가 제외된다.
2. `GET /campaigns` 기본 응답에 DRAFT가 없고, `includeDrafts=1`이면 포함된다.
3. publish 검증 실패 시 400이고 `publishState`는 DRAFT로 유지된다.
4. DRAFT는 `close` 할 수 없다(400).

## 미포함 (YAGNI)

- 자동저장(주기적 전송)
- 낙관적 락 / 동시 편집 경고 — 마지막 저장이 이긴다
- 최종 수정자 이름 표시 (시각만 표시)
- 임시저장 개수 제한

## 배포

`packages/shared` 빌드 → **api(Railway, 마이그레이션 포함)** → **admin-web(Vercel)**.
client-web은 변경 없음.

사이드이펙트: `CampaignResponseSchema` 완화 3곳은 admin-web 전용 파싱 가드라 회귀 위험이 낮다.
`GET /campaigns` 기본 응답이 DRAFT를 제외하도록 바뀌지만 기존 데이터는 전부 PUBLISHED라 동작 변화가 없다.
