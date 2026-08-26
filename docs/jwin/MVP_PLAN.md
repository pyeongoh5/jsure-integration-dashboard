# J-WIN MVP 실행 계획 · 어드민 설계 (인수인계 문서)

> 최종 갱신: 2026-07-26
> 대상 브랜치: `j-win`
> 관련 문서: `REQUIREMENTS.md`(요구사항 v1) · `DECISIONS.md`(D-1~D-10) · `DEPLOY.md`(배포)
>
> 이 문서는 **다른 세션/다른 사람이 이어받아 바로 작업을 시작할 수 있도록** 쓴 것이다.
> "무엇이 이미 됐고, MVP를 끝내려면 정확히 무엇을 더 만들어야 하는가"만 다룬다.
> 요구사항의 근거·배경은 반복하지 않고 원문 문서를 가리킨다.

---

## 1. MVP의 정의

**J-WIN MVP = 캠페인 1건을 등록해서 종료까지 전 과정을 어드민 화면만으로 완주할 수 있는 상태.**

완주해야 하는 전 과정은 다음 11단계다. 이 중 하나라도 화면이나 API가 없어서 DB를 직접 만져야 한다면 MVP가 아니다.

| # | 단계 | 주체 | 현재 상태 |
|---|------|------|----------|
| 1 | 캠페인 등록 (기간·slug·게시시각) | 어드민 | API ○ / 화면 ✕ |
| 2 | 브랜드 X 계정 연동 링크 발급·전달 | 어드민 → 브랜드 | API △ (생성 응답에만 존재) / 화면 ✕ |
| 3 | 경품 + 기프트코드 등록 | 어드민 | API ○ / 화면 ✕ |
| 4 | 포스트 소재 등록 (본문·미디어·유효기간) | 어드민 | API △ (조회 불가) / 화면 ✕ |
| 5 | 결과 화면 소재·PR URL·DM 문구 등록 | 어드민 | API ○ (캠페인 PATCH) / 화면 ✕ |
| 6 | `ACTIVE` 전환 | 어드민 | API ○ / 화면 ✕ |
| 7 | 매일 자동 포스팅 | 시스템 | ○ |
| 8 | 유저 응모 → 즉시 추첨 | 유저 | ○ |
| 9 | 당첨 후보 검증 (팔로우·리포스트) | 유저 | ○ |
| 10 | 코드 DM 자동 발송 / 현물 배송지 수집 | 시스템·유저 | ○ |
| 11 | 어드민 통계 확인 · 현물 발송 처리 · 종료 | 어드민 | API △ (배송지 열람·발송완료 불가) / 화면 ✕ |

즉 **백엔드와 유저 LP는 사실상 완성돼 있고, 남은 것은 어드민 화면과 그 화면이 요구하는 API 보강뿐이다.**

### MVP에 넣지 않는 것

아래는 "있으면 좋지만 없어도 캠페인 1건이 돌아간다". 명시적으로 뒤로 미룬다.

- 감사 로그 열람 화면 (`AuditLog`는 쌓이고 있음, 조회는 DB로)
- 경품 수정·삭제, 소재 수정 (잘못 등록 시 재등록으로 대체 — 단 확률 수정만 예외로 포함, §4 참조)
- 캠페인 삭제 (상태를 `ENDED`로 두는 것으로 갈음)
- 전 캠페인 통합 대시보드, 기간 비교·차트
- 응모자 원장 조회 (통계 집계만 제공)
- 다국어 — 어드민은 한국어 전용 (LP만 일본어)

---

## 2. 현재 완성도

### 완료

| 영역 | 내용 |
|------|------|
| DB | `packages/jwin-db` 스키마 + 마이그레이션 2건 (`20260726065726_init`, `20260726072338_drop_admin_user`) 커밋됨 |
| API | `apps/jwin-api` — OAuth(브랜드·유저), 응모·추첨, 검증, 이행(DM/배송지), 스케줄러, 어드민 엔드포인트 9종 (`routes/admin.ts`) |
| LP | `apps/jwin-web` — `/c/{slug}`, `/campaigns`, 배송지 입력, 연동 결과 페이지 |
| 어드민 인증 | D-10 공유 JWT. `jwinApi` axios 인스턴스 + 401 리프레시 인터셉터 + vite `/jwin-api` 프록시 |
| 어드민 셸 | 최상단 제품 스위처(인플루언서 ↔ J-WIN), `/jwin/*` 라우트, 사이드바 제품별 분기 |

### 미완

| 영역 | 내용 |
|------|------|
| 어드민 화면 | `/jwin/*` 4개 페이지가 전부 "준비 중" 플레이스홀더 |
| 어드민 API | §4의 8개 항목 (상세 조회·경품/소재 목록·연동 링크 재발급·배송지 열람·발송 처리 등) |
| G0 스파이크 | `apps/jwin-api/spikes/` 5종 미실측 (`spikes/README.md`) |
| 배포 | Railway·Vercel 프로젝트 미생성 |

---

## 3. 어드민 설계

### 3.1 정보 구조

기존 인플루언서 경로는 건드리지 않고 J-WIN만 `/jwin` prefix 아래에 둔다. 네비게이션 정의는 `apps/admin-web/src/lib/navigation.ts` 한 곳에만 있다.

```
/jwin/campaigns              S1  캠페인 목록
/jwin/campaigns/new          S2  캠페인 생성
/jwin/campaigns/:id          S2  캠페인 편집 (탭: 기본 / 연동 / 경품 / 소재 / 결과화면 / 통계)
/jwin/winners                S3  당첨자 관리 (캠페인 필터)
```

**현재 코드와의 차이**: 지금 사이드바에는 `경품·기프트코드(/jwin/prizes)`와 `통계(/jwin/stats)`가 독립 메뉴로 들어가 있다. 둘 다 캠페인에 종속된 개념이라 단독 화면으로 두면 "어느 캠페인의 경품인지" 선택하는 UI가 한 겹 더 필요해진다. **Phase 2에서 이 두 메뉴와 라우트를 제거하고 S2의 탭으로 흡수한다.** MVP 사이드바는 `캠페인 관리`, `당첨자 관리` 두 개뿐이다.

### 3.2 S1 — 캠페인 목록 (`/jwin/campaigns`)

캠페인이 많아야 수십 건이므로 페이지네이션·검색 없이 전건 나열한다.

**열**: 브랜드명 / slug / 상태 배지 / 기간(JST) / 연동 계정(`@handle` 또는 "미연동") / 응모 수 / 경고

**경고 아이콘 노출 조건** — 운영자가 목록만 보고 사고를 감지할 수 있어야 한다.

1. `needsReconnect = true` → "브랜드 재연동 필요" (브랜드가 앱 연동을 끊음. 이 상태면 포스팅이 전부 실패한다)
2. `status = ACTIVE`인데 `xUserId = null` → "계정 미연동" (게시 불가)
3. `failedPosts > 0` → "게시 실패 N건"

**액션**: 행 클릭 → S2 편집, 우상단 `캠페인 생성` → S2 생성

**API**: `GET /admin/campaigns`

### 3.3 S2 — 캠페인 생성·편집 (`/jwin/campaigns/new`, `/jwin/campaigns/:id`)

Atatter의 5-step 위저드(`docs/jwin/reference/Atatter - 캠페인 만들기.pdf`)를 레퍼런스로 삼되, **위저드가 아니라 탭 방식으로 만든다.** 이유는 두 가지다. 첫째, 우리 운영은 브랜드 연동 링크를 보내고 회신을 기다리는 등 비동기 대기가 끼어들어 한 번에 끝나지 않는다. 둘째, 편집 화면을 생성 화면과 같은 컴포넌트로 재사용할 수 있다.

생성 시에는 **기본 탭만 활성**이고 나머지는 잠긴다. 캠페인 id가 있어야 경품·소재를 붙일 수 있기 때문이다. 저장하면 `/jwin/campaigns/:id`로 이동하며 전 탭이 열린다.

#### 탭 1 — 기본 정보

| 필드 | 입력 | 검증 |
|------|------|------|
| `brandName` | 텍스트 | 필수 |
| `slug` | 텍스트 | 필수, `^[a-z0-9-]+$`, 중복 시 서버 409/400 |
| `startsAt` / `endsAt` | 날짜시각 (JST 입력 → UTC 전송) | `endsAt > startsAt` |
| `dailyPostTime` | `HH:mm` | 필수, 기본 `11:00` |
| `dailyWinCap` | 숫자 또는 비움 | 비우면 무제한 |

`slug`는 게시된 포스트의 LP 링크에 박히므로 **`ACTIVE` 전환 이후에는 입력 비활성화**한다(서버는 여전히 허용하지만 화면에서 막는다). 이미 나간 포스트의 링크가 깨지는 사고를 방지하기 위함이다.

**API**: `POST /admin/campaigns` / `PATCH /admin/campaigns/:id`

#### 탭 2 — 브랜드 연동

브랜드 X 계정은 캠페인과 독립된 엔티티(`BrandXAccount`, 계정 1 : 캠페인 N, D-13)다. 이 탭은 **연동된 계정을 고르는 드롭다운**이며, 계정 자체의 추가·재연동은 어드민 `/jwin/accounts` 페이지에서 한다. 선택한 계정의 연동 상태(`xUsername`, `needsReconnect`)를 함께 보여준다.

연동 URL 형식은 `{API_BASE_URL}/oauth/brand/start?accountId={계정id}` 로 고정이며, `/jwin/accounts` 화면에서 계정별로 복사할 수 있다.

#### 탭 3 — 경품

목록 + 추가 폼. 등록된 경품은 이름·유형·티어·수량(잔여/전체)·확률을 표로 보여준다.

추가 폼 필드: `type`(PHYSICAL/CODE) · `name` · `tier` · `totalQty` · `winProbability` · `codesText`

`codesText`는 `type = CODE`일 때만 노출하는 textarea다. **엑셀에서 열을 그대로 복사해 붙여넣는 것을 전제로 한다** (F-7.3). 개행·탭·쉼표로 분리되며, 파싱 함수는 서버의 `parseCodesInput`(`apps/jwin-api/src/routes/admin.ts`)에 이미 있다. 화면에서는 붙여넣는 즉시 파싱된 개수를 `입력 12건 / 수량 12` 형태로 보여줘 수량 불일치를 저장 전에 알려준다. 서버도 같은 검증을 하므로 화면 검증은 편의용이다.

확률 합계가 1을 넘으면 경고를 띄운다(막지는 않는다 — 티어 순차 판정이라 합이 1을 넘어도 동작 자체는 한다).

**API**: `GET /admin/campaigns/:id/prizes`(신규) · `POST /admin/prizes` · `POST /admin/prizes/:id/codes` · `PATCH /admin/prizes/:id`(신규, 확률·수량 정정용)

#### 탭 4 — 포스트 소재

목록 + 추가 폼. 목록은 `activeFrom`~`activeTo` 순으로 나열한다.

추가 폼 필드: `label` · `bodyText`(최대 500자) · `mediaUrl` · `activeFrom` · `activeTo`

이 탭의 핵심은 **기간 커버리지 검사**다. 캠페인 `startsAt`~`endsAt` 구간 중 유효한 소재가 하나도 없는 날은 그날 게시가 통째로 건너뛰어진다. 운영 사고 1순위이므로 화면에서 날짜 막대(또는 "커버 안 되는 날: 8/3~8/5" 텍스트)로 빈틈을 명시한다. 계산은 순수 함수로 분리한다(`postTemplateCoverage.ts`).

`bodyText`에 `{{LP_URL}}` 플레이스홀더가 들어가야 LP 링크가 삽입된다. 없으면 저장은 되지만 경고를 띄운다.

**미디어 URL 주의**: `mediaUrl`은 게시 시각에 **jwin-api 서버가 직접 fetch**해서 X에 업로드한다(`uploadMediaFromUrl`). 따라서 **만료되는 presigned URL을 쓰면 캠페인 후반부 게시가 실패한다.** 업로드 경로는 §4-⑧ 참조.

**API**: `GET /admin/campaigns/:id/post-templates`(신규) · `POST /admin/post-templates` · `DELETE /admin/post-templates/:id`(신규)

#### 탭 5 — 결과 화면 / DM

| 필드 | 용도 |
|------|------|
| `winMediaUrl` | 당첨 결과 화면 이미지·동영상 |
| `loseMediaUrl` | 낙첨 결과 화면 이미지·동영상 |
| `prUrl` | 결과 화면의 브랜드 사이트 유도 버튼 |
| `dmTemplate` | 당첨 DM 문구 (최대 1000자) |

`dmTemplate`은 플레이스홀더 `{{CODE}}` `{{PRIZE_NAME}}` `{{USERNAME}}` `{{BRAND_NAME}}`를 지원한다. 입력 아래에 치환 예시를 실시간 렌더해 보여준다 — 코드가 실제로 들어갈 자리를 눈으로 확인하지 않으면 `{{CODE}}`가 빠진 DM을 발송하는 사고가 난다. **`{{CODE}}`가 없으면 저장을 막는다** (CODE 경품이 하나라도 있는 경우).

**API**: `PATCH /admin/campaigns/:id`

#### 탭 6 — 통계

`GET /admin/campaigns/:id/stats` 응답을 카드로 나열한다: 응모 수 · 당첨 확정 · 당일 검증 대기 · 미이행 종료 · 경품별 잔여 재고 · 게시 실패 건수 · 재연동 필요 여부.

"미이행 종료"(`unfulfilledWins`)는 당첨됐지만 당일 내 검증을 못 끝낸 건이다(D-2 개정으로 회수하지 않음). 재고는 이미 차감된 상태이므로 **운영자가 이 숫자를 보고 재고를 보충할지 판단**해야 한다. 화면에 그 의미를 한 줄로 적어둔다.

#### 상태 전환

탭 바깥(화면 우상단)에 상태 배지와 전환 버튼을 둔다.

- `SETUP → ACTIVE`: **발행 전 체크를 통과해야만 활성화**한다. ① X 계정 연동됨 ② 경품 1건 이상 ③ 기간 전체를 덮는 소재 ④ CODE 경품이 있으면 `dmTemplate`에 `{{CODE}}` 포함. 미충족 항목을 체크리스트로 보여주고 버튼을 비활성화한다.
- `ACTIVE ↔ PAUSED`: 즉시 전환, 확인 다이얼로그
- `→ ENDED`: 확인 다이얼로그. **되돌릴 수 없고 배송지 입력이 즉시 잠긴다**는 점을 문구로 명시

### 3.4 S3 — 당첨자 관리 (`/jwin/winners`)

캠페인 선택 드롭다운 + 당첨자 표.

**열**: 일자(JST) / 유저 `@handle` / 경품명 / 유형 / 검증 상태 / 이행 상태 / 액션

**필터**: 검증 상태, 이행 상태, 경품 유형

**액션 두 가지**

1. **배송지 열람** (PHYSICAL): 다이얼로그로 복호화된 배송지 표시. 개인정보이므로 **열람 자체를 AuditLog에 남긴다.** 목록 응답에 평문을 섞어 내리지 않고 별도 엔드포인트로 분리하는 이유가 이것이다.
2. **발송 완료 처리** (PHYSICAL): `fulfillment`을 `SHIPPED`로 변경. 이게 없으면 현물 경품 프로세스가 닫히지 않는다.

CODE 경품은 DM 자동 발송이라 액션이 없고, `dmSentAt` / `dmError`만 표시한다.

**CSV 내보내기**: 배송 실무에 필요하다. 프론트에서 생성한다 — `apps/admin-web/src/domains/application/buildApprovedApplicantsCsv.ts`에 동일한 전례가 있으니 그 패턴을 따른다. CSV에 배송지가 들어가므로 내보내기도 감사 로그 대상이다.

**API**: `GET /admin/campaigns/:id/winners` · `GET /admin/winners/:id/shipping`(신규) · `PATCH /admin/winners/:id/fulfillment`(신규)

### 3.5 컴포넌트 구조

`.claude/CODE_RULES.md` §7을 그대로 따른다. 페이지 파일은 조립만 하고, fetch·mutation·변환은 각각 다른 파일에 둔다. 레퍼런스는 기존 `src/components/Applicants/` + `src/pages/Applicants/index.tsx`.

```
src/domains/jwin/
  api.ts                      jwinApi 래핑 + 응답 파싱 (도메인 진입점)
  types.ts                    zod 스키마 + z.infer 타입
  index.ts

src/components/JwinCampaigns/
  useJwinCampaignsData.ts     목록 fetch + reload
  jwinCampaignTransform.ts    API 모델 → view 모델 (순수 함수, 경고 판정 포함)
  JwinCampaignTable.tsx       presentational

src/components/JwinCampaignForm/
  useJwinCampaignForm.ts      단건 fetch + 저장 mutation
  useJwinPrizes.ts            경품 목록 + 추가/수정
  useJwinPostTemplates.ts     소재 목록 + 추가/삭제
  postTemplateCoverage.ts     기간 빈틈 계산 (순수 함수)
  activationChecklist.ts      ACTIVE 전환 가능 여부 판정 (순수 함수)
  BasicTab.tsx / ConnectTab.tsx / PrizeTab.tsx / PostTemplateTab.tsx / ResultTab.tsx / StatsTab.tsx
  PrizeAddDialog.tsx          입력 상태는 다이얼로그 내부에서 관리 (부모로 끌어올리지 말 것)

src/components/JwinWinners/
  useJwinWinnersData.ts
  useJwinWinnerMutations.ts   배송지 열람 · 발송 완료
  JwinWinnerTable.tsx
  ShippingDialog.tsx
  buildJwinWinnersCsv.ts      순수 함수

src/components/composites/JwinStatusBadge/    캠페인 상태 배지 (목록·편집 공용, CODE_RULES §8)

src/pages/Jwin/
  Campaigns.tsx               S1 조립
  CampaignEdit.tsx            S2 조립 (생성/편집 겸용)
  Winners.tsx                 S3 조립
```

기존 화면들이 `@tanstack/react-query`를 쓰고 있으므로 데이터 훅도 `useQuery`/`useMutation` 기반으로 맞춘다.

### 3.6 API 계약 처리 방침 (결정 필요 — D-11 후보)

현재 jwin-api의 어드민 엔드포인트는 **Prisma 모델을 그대로 반환**한다. 이는 `CODE_RULES.md` §2의 "Prisma 모델을 그대로 응답으로 반환 금지"에 어긋난다. `GET /admin/campaigns/:id/winners`가 `encryptedShipping` 암호문까지 그대로 내려주는 것이 대표적이다.

또 대시보드는 `@jsure/shared`(zod)를 계약의 단일 소스로 쓰는데, J-WIN은 `@jsure/jwin-shared`에 **zod 없는 순수 interface**만 두고 있다.

**권장안**: `packages/jwin-shared`에 어드민 응답 zod 스키마를 추가하고, jwin-api는 그 모양으로 매핑해 반환, admin-web은 `Schema.parse()`로 받는다. admin-web의 `package.json`에 `@jsure/jwin-shared`를 의존으로 추가한다(앱→패키지 방향이라 모노레포 경계 위반 아님).

**최소안**: admin-web `src/domains/jwin/types.ts`에만 zod 스키마를 두고 프론트에서 파싱한다. 서버 응답 모양은 그대로 둔다.

Phase 1 시작 전에 둘 중 하나를 정하고 `DECISIONS.md`에 D-11로 기록할 것. 권장안이 옳지만 작업량이 늘어난다. **최소한 `winners` 응답에서 `encryptedShipping`을 제거하는 것만은 어느 쪽을 택하든 반드시 한다.**

---

## 4. 보강해야 할 어드민 API

§3의 화면이 요구하는데 지금 없는 것들. 전부 `apps/jwin-api/src/routes/admin.ts`에 추가한다.

| # | 엔드포인트 | 용도 | 비고 |
|---|-----------|------|------|
| ① | `GET /admin/campaigns/:id` | S2 편집 폼 초기값 | `brandAccountId`·연동된 계정 정보(`brandAccount`) 포함. 지금은 목록에서 find해야 함 |
| ② | `GET /admin/campaigns/:id/prizes` | 탭 3 목록 | `stats`에는 name/total/remaining만 있어 id·확률·유형이 없다 |
| ③ | `PATCH /admin/prizes/:id` | 확률·수량 정정 | 잘못 등록 시 되돌릴 방법이 현재 전무 |
| ④ | `GET /admin/campaigns/:id/post-templates` | 탭 4 목록·커버리지 검사 | |
| ⑤ | `DELETE /admin/post-templates/:id` | 잘못 등록한 소재 제거 | 이미 게시에 사용된 소재는 거부(`CampaignPost.templateId` 참조) |
| ⑥ | `GET /admin/winners/:id/shipping` | 배송지 복호화 열람 | **열람을 AuditLog에 기록.** 목록 응답에서는 `encryptedShipping` 제거 |
| ⑦ | `PATCH /admin/winners/:id/fulfillment` | `SHIPPED` 처리 | 허용 전이만: `READY → SHIPPED`, `AWAITING_INFO → READY` |
| ⑧ | 미디어 업로드 경로 확정 | `mediaUrl` 채우기 | 아래 참조 |

**⑧에 대하여** — 대시보드에 R2 presign 업로드가 이미 있다(`apps/api/src/uploads/admin-uploads.controller.ts`). J-WIN 미디어를 여기에 얹으면 업로더를 새로 만들 필요가 없다. 다만 `UploadsService`는 `R2_PUBLIC_BASE_URL`이 없으면 **만료되는 presigned GET URL로 fallback**한다. jwin-api가 게시 시각마다 이 URL을 fetch하므로 만료되면 캠페인 후반 게시가 조용히 실패한다. 선택지는 셋이다.

1. 대시보드 R2에 `R2_PUBLIC_BASE_URL`을 설정하고 J-WIN용 presign 엔드포인트를 추가 — **권장**. 만료 없는 공개 URL이 나온다.
2. jwin-api에 자체 업로드를 만든다 — 스토리지를 하나 더 운영하게 된다.
3. MVP는 URL 직접 입력만 지원 — 운영자가 어딘가에 올린 공개 URL을 붙여넣는다. 가장 싸지만 운영 부담이 크다.

Phase 3 시작 전에 결정할 것.

---

## 5. 작업 순서

각 Phase는 독립적으로 커밋 가능하고, 끝날 때마다 `pnpm typecheck` + `pnpm lint`가 통과해야 한다.

### Phase 0 — 환경 정상화 (작업 시작 전 필수)

1. `pnpm install` — bcryptjs 제거 후 `pnpm-lock.yaml`이 아직 갱신되지 않았다. 갱신분은 별도 커밋
2. `.env` 확인 — `apps/api/.env`와 `apps/jwin-api/.env`의 `JWT_SECRET`이 **동일**해야 한다 (D-10). 현재 로컬은 플레이스홀더 `replace-me-with-a-long-random-string`
3. `pnpm dev:admin` + `pnpm dev:jwin-api` 기동 후, 대시보드 로그인 → 브라우저 콘솔에서 `/jwin-api/admin/me`가 200인지 확인. **이게 200이 아니면 이후 모든 화면이 401이다**

### Phase 1 — API 계약 정리 + 백엔드 보강

1. D-11 결정 (§3.6) 후 `DECISIONS.md` 기록
2. `winners` 응답에서 `encryptedShipping` 제거
3. §4의 ①~⑦ 구현 + `draw.test.ts` 옆에 `admin.test.ts`로 권한·검증 테스트 추가
4. 완료 기준: `curl`로 7개 엔드포인트 200/401 확인

### Phase 2 — 어드민 셸 정리

1. `navigation.ts`에서 `/jwin/prizes`, `/jwin/stats` 제거 (§3.1)
2. `App.tsx`에서 해당 라우트 제거, `pages/Jwin/Prizes.tsx`·`Stats.tsx` 삭제
3. `/jwin/campaigns/new`, `/jwin/campaigns/:id` 라우트 추가
4. `src/domains/jwin/` 신설 (api.ts, types.ts)

### Phase 3 — S1 캠페인 목록 + S2 기본·연동 탭

1. `useJwinCampaignsData` + `JwinCampaignTable` + 경고 판정 순수 함수
2. `JwinStatusBadge` composite
3. S2 기본 탭 (생성 → 편집 이동까지)
4. S2 연동 탭 (연동된 브랜드 계정을 고르는 드롭다운, 연동 상태 표시)
5. 완료 기준: **화면만으로 캠페인을 만들고 브랜드 연동 링크를 뽑을 수 있다** (전 과정 1~2단계)

### Phase 4 — S2 경품·소재·결과화면 탭 + 상태 전환 ✅ 완료 (2026-08-23)

1. ~~미디어 업로드 방식 결정 (§4-⑧)~~ → 파일 업로드. 대시보드 R2 presign 재사용(D-12), `viewUrl`만 저장
2. ~~경품 탭~~ (코드 붙여넣기 파싱·개수 표시·중복 검출, CODE 경품 수량 PATCH 차단)
3. ~~소재 탭~~ (커버리지 검사 — 스케줄러의 **00:05 JST 판정 시각** 기준)
4. ~~결과 화면 탭~~ (`dmTemplate` 미리보기 + CODE 경품 있을 때 `{{CODE}}` 누락 시 저장 차단)
5. ~~상태 전환 + 발행 전 체크리스트~~ (4항목 충족 전까지 ACTIVE 버튼 비활성화)
6. ~~완료 기준: **화면만으로 캠페인을 `ACTIVE`까지 올릴 수 있다**~~ — 라이브 e2e로 확인

**함께 처리한 것**

- **어드민 다국어화 (ko/en/ja).** J-WIN 화면 문구를 `i18n/admin/messages.ts`의 `jwin` 네임스페이스로 통합했다. Phase 3에서 하드코딩으로 남아 있던 문구도 함께 이관해, 한 화면에 두 언어가 섞이지 않는다. 순수 판정 함수(`activationChecklist` 등)는 문자열이 아니라 **번역 키**를 반환해 테스트가 언어에 묶이지 않는다.
- **admin-web에 vitest 신설.** 조용한 운영 사고로 이어지는 순수 함수 4종을 테스트한다(커버리지·체크리스트·코드 파싱·확률 합계). UI 컴포넌트 테스트는 도입하지 않았다.
- **jwin-api 에러 메시지 노출.** 서버가 주는 한국어 메시지(`코드 수(3)가 수량(5)과 일치하지 않습니다` 등)가 화면에 닿도록 `jwinErrorMessage`를 도입했다. 이전에는 axios의 `Request failed with status code 400`에 묻혀 있었다.

**발행 전 검증 서버 이관 (D-14, 2026-08-26)**

화면 체크리스트만으로는 화면 버그나 API 직접 호출로 미비된 캠페인이 `ACTIVE`가 될 수 있었다. 이제 `PATCH /admin/campaigns/:id`가 `SETUP → ACTIVE` 전환을 서버에서 다시 검증한다(`apps/jwin-api/src/routes/campaignActivation.ts`) — 계정 연동 · 경품 1건 이상 · 소재가 기간 전체를 덮는지 · CODE 경품이 있을 때 `{{CODE}}` 포함 여부, 네 가지를 모두 통과해야 하고 실패하면 400과 한국어 미충족 사유를 돌려준다. `PAUSED → ACTIVE` 재개는 의도적으로 재검증하지 않는다. 판정에 쓰는 소재 커버리지·`{{CODE}}` 판정 함수는 `packages/jwin-shared/src/campaignReadiness.ts`로 옮겨 화면(`activationChecklist.ts`)과 서버가 **같은 함수**를 쓰도록 통합했다. 화면 체크리스트는 그대로 남아 있다 — 이건 UX 이고 서버가 최종 방어선이다.

**아직 통합 안 된 중복**: DM 문구 렌더링(`renderDmText`, `DEFAULT_DM_TEMPLATE`)은 이번에 합치지 않았다. `apps/jwin-api/src/services/fulfillment.ts`(실제 DM 발송 경로)와 `apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts`(화면 미리보기)에 각각 남아 있다. 발송 경로는 위험도가 높아 이번 판정 함수 통합 범위에서 의도적으로 제외했다 — 후속 작업 대상.

**배포 전 필요한 환경 설정**

- `R2_PUBLIC_BASE_URL` — 없으면 J-WIN 미디어 presign이 500으로 거부된다(D-12: 만료 URL을 저장하면 캠페인 후반 게시가 조용히 실패하므로 의도된 가드). 로컬 dev에 미설정이라 미디어 업로드는 라이브 e2e로 검증하지 못했다.

### Phase 5 — S2 통계 탭 + S3 당첨자 관리 ← 다음

1. 통계 탭
2. 당첨자 목록·필터
3. 배송지 열람 다이얼로그 + 발송 완료 처리
4. CSV 내보내기
5. 완료 기준: **화면만으로 캠페인을 종료하고 현물 발송까지 닫을 수 있다** (전 과정 11단계)

### Phase 6 — 배포 전

`DEPLOY.md` §6 운영 체크리스트를 따른다. 그 전에 G0 스파이크 5종 실측(`apps/jwin-api/spikes/README.md`)이 선행돼야 한다 — 특히 **DM 발송이 실제로 열려 있는지**는 실측 전까지 가정일 뿐이고, 막혀 있으면 CODE 경품 이행 방식(D-4) 자체를 다시 설계해야 한다.

---

## 6. 알려진 이슈 · 기술 부채

| 심각도 | 항목 | 내용 |
|--------|------|------|
| 높음 | 스케줄러 TZ 결합 | `apps/jwin-api/src/services/scheduler.ts:29`의 `cron.schedule('5 15 * * *')`는 프로세스 시간이 UTC라는 전제로 JST 00:05를 표현한 것이다. Railway에 `TZ=Asia/Tokyo`를 설정하면 당일분 생성이 15시간 밀린다. 올바른 형태는 `cron.schedule('5 0 * * *', fn, { timezone: 'Asia/Tokyo' })`. 현재는 "TZ를 설정하지 않는다"는 운영 규칙으로 우회 중이며 `DEPLOY.md` §2-3에 경고가 있다 |
| 높음 | `JWT_SECRET` 플레이스홀더 | 두 서비스 모두 로컬이 `replace-me-with-a-long-random-string`. 운영 배포 시 반드시 교체하고 **동시에** 반영 |
| 중간 | Prisma 모델 직접 반환 | §3.6. `encryptedShipping` 노출 포함 |
| 중간 | 단일 레플리카 강제 | 인프로세스 스케줄러라 2대 이상 뜨면 중복 게시. v2에서 잡 잠금 도입 전까지 replica 1 고정 |
| 낮음 | `pnpm-lock.yaml` 미갱신 | Phase 0-1 |
| 낮음 | 어드민 라우트 무권한 | `getAdminIdentity`는 토큰 유효성만 본다. 대시보드의 `role`(GUEST/ADMIN/OWNER)을 J-WIN에서 구분하지 않으므로 **GUEST도 캠페인을 만들 수 있다.** 운영자가 소수라 MVP에서는 허용하되, 권한 분리가 필요해지면 `requireAdmin`에서 `role` 검사를 추가한다 |

---

## 7. 사람이 해야 하는 사전 준비

코드로 해결되지 않는 것들. 병렬로 진행해두지 않으면 Phase 6에서 막힌다.

1. **X Developer Console** — 앱 생성, 콜백 URL 등록, 크레딧 충전, 지출 한도 설정 (`DEPLOY.md` §5)
2. **G0 스파이크 5종 실측** — 특히 DM 발송 가능 여부
3. **배송지 보관 기간·삭제 정책** — 일본 APPI. J-sure와 합의 필요 (`REQUIREMENTS.md` §8-3)
4. **LP 디자인 에셋** — 당첨/낙첨 이미지, 캠페인 포스트 소재 (`REQUIREMENTS.md` §8-4)
5. **Railway·Vercel·Neon 프로젝트 생성** (`DEPLOY.md` §1~3)
6. **요건정의서 §5.2 이후 원문 수령** — 미수령 상태 (`REQUIREMENTS.md` §8-6)

---

## 8. 다음 세션 시작 가이드

이어받는 사람이 읽어야 할 순서:

1. 이 문서 §1(MVP 정의)과 §5(작업 순서)
2. `REQUIREMENTS.md` §4 기능 요구사항 — 화면을 만들다 "이 필드가 왜 있지?" 싶으면 여기
3. `DECISIONS.md` — 특히 D-2(홀드 폐지), D-8(캠페인 기간 단위), D-10(어드민 인증)
4. `.claude/CODE_RULES.md` §7·§8 — 컴포넌트 구조 규칙. 이걸 어기면 리뷰에서 되돌아온다
5. `apps/admin-web/src/components/Applicants/` — 따라야 할 구조의 실물 예시

첫 작업은 **Phase 0**이다. 환경이 정상인지 확인하지 않고 화면부터 만들면 401을 디버깅하느라 시간을 버린다.
