# J-WIN Phase 4 — 경품·소재·결과화면 탭 + 상태 전환 · 설계

> 작성일: 2026-08-23 · 브랜치: `j-win`
> 선행: `docs/jwin/MVP_PLAN.md` §3.3(탭 3~6·상태 전환) · `DECISIONS.md` D-12(미디어 업로드) D-13(브랜드 계정)
> 완료 기준: **화면만으로 캠페인을 `ACTIVE`까지 올릴 수 있다** (= 실제 자동 포스팅 시작 가능)

---

## 1. 배경

Phase 3에서 캠페인 목록(S1)과 편집 화면의 기본·연동 탭(S2)이 완성됐다. 지금은 캠페인을 만들고 브랜드 계정을 붙이는 것까지만 화면으로 되고, **경품·소재·결과화면을 등록할 수단이 없어** 캠페인을 `ACTIVE`로 올릴 수 없다. 스케줄러는 소재가 없으면 `FAILED('no template')`, 캠페인이 `ACTIVE`가 아니면 `SKIPPED` 처리한다(`services/scheduler.ts`). 즉 이 Phase가 끝나야 J-WIN이 실제로 동작한다.

**백엔드는 전부 존재한다.** 이 Phase는 순수 프론트 작업이다.

| 기능 | 기구현 API |
|---|---|
| 경품 | `GET /admin/campaigns/:id/prizes` · `POST /admin/prizes` · `POST /admin/prizes/:id/codes` · `PATCH /admin/prizes/:id` |
| 소재 | `GET /admin/campaigns/:id/post-templates` · `POST /admin/post-templates` · `DELETE /admin/post-templates/:id` |
| 결과화면·상태 | `PATCH /admin/campaigns/:id` |
| 미디어 | `POST /admin/uploads/jwin-media/presign` (대시보드 `@jsure/api`) |

## 2. 목표 · 비목표

**목표**

- 캠페인 편집(S2)에 **경품 / 소재 / 결과화면** 탭 추가
- 화면 우상단에 **상태 전환** + 발행 전 체크리스트
- 미디어는 **파일 업로드**(presign → R2 → 만료 없는 공개 URL)
- 운영 사고를 저장 전에 잡는 3가지 안전장치: 코드 개수 불일치 / 소재 기간 빈틈 / `{{CODE}}` 누락

**비목표(YAGNI — 이번에 안 함)**

- 통계 탭(Phase 5) · 당첨자 관리(Phase 5)
- 경품 삭제, 소재 수정(잘못 등록 시 재등록으로 대체 — MVP_PLAN §1)
- 소재 기간 자동 제안·자동 채우기
- 미디어 갤러리·재사용 라이브러리 (업로드 후 URL만 보관)
- 드래그 앤 드롭 업로드(파일 선택 버튼으로 충분)

## 3. 탭 설계

### 탭 3 — 경품

**목록**: 이름 / 유형(PHYSICAL·CODE) / 티어 / 수량(잔여/전체) / 확률 / CODE 재고(`availableCodeCount`)

**추가 폼**(다이얼로그): `type` · `name` · `tier` · `totalQty` · `winProbability` · `codesText`

- `codesText`는 `type=CODE`일 때만 노출하는 textarea. **엑셀에서 열을 그대로 복사해 붙여넣는 것을 전제**(F-7.3).
- 파싱 규칙은 서버 `parseCodesInput`과 **동일**해야 한다: `split(/[\r\n\t,]+/)` → `trim` → 빈 문자열 제거. 프론트는 같은 규칙의 순수 함수를 따로 두고, 붙여넣는 즉시 `입력 12건 / 수량 12` 형태로 개수를 보여준다. 서버도 같은 검증을 하므로 화면 검증은 **저장 전에 알려주기 위한 편의**다.
- **확률 합계 경고**: 등록된 경품들의 `winProbability` 합이 1을 넘으면 목록 위에 경고를 띄운다. **막지는 않는다** — 티어 순차 판정이라 합이 1을 넘어도 동작 자체는 한다.

**수정**: `PATCH /admin/prizes/:id`로 확률·수량·이름·티어 정정. 단 **CODE 경품의 수량은 서버가 PATCH를 거부**한다(코드 등록으로만 변경 — 유령 재고 방지, 커밋 `d1bed06`). 화면에서도 CODE 경품의 수량 입력을 비활성화한다.

### 탭 4 — 소재

**소재란**: 매일 자동 게시할 트윗의 내용물. 한 캠페인에 여러 개를 두고 기간으로 나눠 쓸 수 있다(REQUIREMENTS.md:87 "주 단위 교체 가능", F-2.2 "활성 PostTemplate 기준"). **여러 개는 옵션이지 필수가 아니다** — 전 기간을 덮는 1개로도 운영된다.

**목록**: `activeFrom` 오름차순. label / 본문 요약 / 기간 / 미디어 유무 / 삭제 버튼(이미 게시에 사용된 소재는 `used=true`라 서버가 삭제를 거부 → 화면에서도 버튼 비활성화)

**추가 폼**: `label` · `bodyText`(최대 500자, 잔여 글자 수 표시) · 미디어 업로드 · `activeFrom` ~ `activeTo`

**커버리지 경고(이 탭의 핵심)**: 캠페인 `startsAt`~`endsAt` 중 **어떤 소재의 유효기간에도 안 걸리는 날**은 그날 게시가 통째로 건너뛰어진다. 에러도 안 나고 아무 데도 안 보여서, 운영자는 브랜드가 항의할 때까지 모른다. 목록 위에 문장으로 명시한다:

```
⚠ 소재가 없는 날: 9/8 ~ 9/10 (이 날은 게시가 건너뜁니다)
```

빈틈이 없으면 아무것도 표시하지 않는다. 계산은 순수 함수 `postTemplateCoverage.ts`로 분리한다.

**`{{LP_URL}}` 경고**: `bodyText`에 `{{LP_URL}}`이 없으면 저장은 되되 경고를 띄운다. (없어도 스케줄러가 본문 끝에 LP 링크를 붙이므로 치명적이지 않다 — `scheduler.ts:102-104`.)

### 탭 5 — 결과화면 / DM

| 필드 | 용도 | 입력 |
|---|---|---|
| `winMediaUrl` | 당첨 결과 화면 이미지·동영상 | 파일 업로드 |
| `loseMediaUrl` | 낙첨 결과 화면 이미지·동영상 | 파일 업로드 |
| `prUrl` | 결과 화면의 브랜드 사이트 유도 버튼 | URL 입력 |
| `dmTemplate` | 당첨 DM 문구 (최대 1000자) | textarea |

**플레이스홀더란**: `dmTemplate`은 당첨자에게 **X DM으로 자동 발송**되는 문구다. `{{CODE}}` 같은 이중 중괄호 토큰은 발송 직전 `renderDmText()`([fulfillment.ts](../../../apps/jwin-api/src/services/fulfillment.ts))가 실제 값으로 치환한다.

| 토큰 | 치환되는 값 |
|---|---|
| `{{CODE}}` | 재고에서 원자적으로 할당된 **기프트코드** (예: `ABCD-1234-EFGH`) |
| `{{PRIZE_NAME}}` | 경품 이름 |
| `{{USERNAME}}` | 당첨자 X 핸들 |
| `{{BRAND_NAME}}` | 브랜드 이름 |

운영자 입력 → 실제 발송 예시:

```
【{{BRAND_NAME}}】ご当選おめでとうございます！      →  【コカ・コーラ】ご当選おめでとうございます！
賞品: {{PRIZE_NAME}}                              →  賞品: スターバックスカード
ギフトコード: {{CODE}}                             →  ギフトコード: ABCD-1234-EFGH
```

`dmTemplate`을 **비워두면** `fulfillment.ts`의 `DEFAULT_DM_TEMPLATE`(일본어, `{{CODE}}` 포함)이 쓰이므로 안전하다. 위험한 것은 "직접 쓰다가 `{{CODE}}`만 빠뜨린" 경우다.

**DM 미리보기**: `dmTemplate` 아래에 치환 예시를 **실시간 렌더**한다. 코드가 실제로 들어갈 자리를 눈으로 확인하지 않으면 `{{CODE}}`가 빠진 DM을 발송하는 사고가 난다.

**저장 차단**: CODE 경품이 하나라도 있는데 `dmTemplate`에 `{{CODE}}`가 없으면 **저장을 막는다**. 코드 없는 DM이 나가면 당첨자는 "축하합니다"만 받고 경품을 받을 수 없다. DM은 자동 발송이라 운영자가 알아채기 전에 수십~수백 건이 나가고 되돌릴 수 없다. PHYSICAL 경품만 있는 캠페인은 DM이 아니라 배송지 수집 흐름이므로 이 검사를 걸지 않는다.

### 상태 전환 (탭 바깥, 화면 우상단)

현재 상태 배지 옆에 전환 버튼을 둔다.

**`SETUP → ACTIVE`**: 발행 전 체크리스트를 보여주고 **4항목 전부 충족해야 버튼 활성화**. 미충족 항목은 무엇이 부족한지 함께 표시한다.

| # | 조건 | 판정 근거 |
|---|---|---|
| ① | X 계정 연동됨 | `brandAccountId != null && brandAccount.status === 'CONNECTED'` |
| ② | 경품 1건 이상 | 경품 목록 길이 > 0 |
| ③ | 기간 전체를 덮는 소재 | `postTemplateCoverage`의 빈틈이 0 |
| ④ | CODE 경품 있으면 `dmTemplate`에 `{{CODE}}` | 경품 유형 + `dmTemplate` 검사 |

**`ACTIVE ↔ PAUSED`**: 확인 다이얼로그 후 즉시 전환.

**`→ ENDED`**: 확인 다이얼로그. **되돌릴 수 없고 배송지 입력이 즉시 잠긴다**는 점을 문구로 명시한다.

## 4. 미디어 업로드

D-12에 따라 대시보드 R2를 재사용한다. 계약(`packages/shared/src/types/uploads.ts`):

- 요청: `{ contentType: 'image/png'|'image/jpeg'|'image/webp'|'video/mp4', sizeBytes: number }` (최대 100MB)
- 응답: `{ objectKey, uploadUrl, viewUrl, expiresInSec }` — **`viewUrl`이 만료 없는 공개 URL**

**흐름**: 파일 선택 → 타입·크기 검증(허용 목록 밖이면 업로드 시도 없이 한국어 에러) → presign 요청 → `uploadUrl`로 PUT → 성공 시 **`viewUrl`을 폼 필드에 자동 입력**. 업로드 중 진행 표시, 실패 시 에러 노출 + 재시도 가능.

**`viewUrl`만 저장한다.** jwin-api가 게시 시각마다 이 URL을 fetch하므로 만료되는 presigned URL을 저장하면 캠페인 후반 게시가 조용히 실패한다(D-12가 경계한 사고).

소재 탭과 결과화면 탭이 같은 업로드 컴포넌트를 공유한다.

## 5. 파일 구조 (CODE_RULES §7)

기존 `apps/admin-web/src/components/JwinCampaignForm/`에 이어붙인다. 탭마다 데이터 훅 / 순수 변환 / presentational / 다이얼로그를 분리한다.

```
JwinCampaignForm/
  # 경품
  useJwinPrizes.ts               목록 fetch + 추가/수정 mutation
  jwinCodeInput.ts               코드 파싱 (순수, 서버 parseCodesInput과 동일 규칙)
  prizeProbability.ts            확률 합계 판정 (순수)
  PrizeTab.tsx                   presentational
  PrizeAddDialog.tsx             입력 상태는 다이얼로그 내부

  # 소재
  useJwinPostTemplates.ts        목록 fetch + 추가/삭제 mutation
  postTemplateCoverage.ts        기간 빈틈 계산 (순수) ★
  PostTemplateTab.tsx
  PostTemplateAddDialog.tsx

  # 결과화면
  dmTemplatePreview.ts           플레이스홀더 치환 (순수)
  ResultTab.tsx

  # 미디어 (두 탭 공용)
  useJwinMediaUpload.ts          presign + PUT 업로드
  JwinMediaUpload.tsx            파일 선택·진행·에러 UI

  # 상태 전환
  activationChecklist.ts         ACTIVE 전환 가능 판정 (순수) ★
  StatusTransition.tsx           배지 + 전환 버튼 + 체크리스트
  StatusConfirmDialog.tsx        PAUSED/ENDED 확인 (액션별 분리 — 사용자 규칙)
```

**액션마다 독립 다이얼로그**: `type` 분기로 한 다이얼로그를 재사용하지 않는다(사용자 규칙). PAUSED 전환과 ENDED 전환은 문구·위험도가 달라 별도 컴포넌트로 둔다.

**페이지(`CampaignEdit.tsx`)는 조립만 한다.** 탭이 6개로 늘어나므로 탭 정의는 배열로 두고, 신규 생성 모드에서는 기본 탭만 활성(캠페인 id가 있어야 경품·소재를 붙일 수 있다).

## 6. 테스트

**admin-web에 vitest를 신설한다.** 이 Phase의 순수 함수 4개는 틀리면 **조용히 운영 사고로 이어지는** 로직이라 테스트가 필요하다:

| 함수 | 틀렸을 때 |
|---|---|
| `postTemplateCoverage` ★ | 빈틈을 못 잡아 그날 게시가 통째로 누락 |
| `activationChecklist` ★ | 미비된 캠페인이 ACTIVE로 올라가 게시 실패 반복 |
| `jwinCodeInput` | 코드 개수 오판 → 수량 불일치 |
| `prizeProbability` | 확률 합계 경고 오작동 |

`packages/jwin-shared`의 vitest 설정을 그대로 따른다(`vitest run`). **UI 컴포넌트 테스트는 하지 않는다** — 러너는 순수 함수 전용이고, jsdom·testing-library는 도입하지 않는다(YAGNI).

## 7. 검증 계획

- **유닛**: 위 순수 함수 4개. 특히 커버리지는 경계 케이스(소재 0개 / 1개가 전 기간 / 중간 빈틈 / 앞뒤 빈틈 / 기간 겹침)를 덮는다.
- **정적**: `pnpm --filter @jsure/admin-web typecheck && lint` green.
- **라이브 e2e(핵심)**: 이미 연동된 `@devsure5` 계정을 사용해, **화면만으로** 캠페인 하나를 다음 순서로 `ACTIVE`까지 올린다 — 캠페인 생성 → 계정 선택 → 경품 등록(CODE 포함, 코드 붙여넣기) → 소재 등록(미디어 업로드 포함) → 결과화면·DM 등록 → 체크리스트 4항목 충족 확인 → ACTIVE 전환. 그리고 **체크리스트가 미충족 상태에서 ACTIVE를 막는지**도 확인한다.

## 8. 작업 순서(플랜에서 상세화)

1. admin-web vitest 설정 + 순수 함수 4개(테스트 우선)
2. 미디어 업로드 훅·컴포넌트
3. 경품 탭
4. 소재 탭(커버리지 경고 포함)
5. 결과화면 탭(DM 미리보기·저장 차단)
6. 상태 전환 + 체크리스트
7. 라이브 e2e 검증
