# 단순 리뷰(SIMPLE_REVIEW) 캠페인 타입 도입 — 설계 문서

**상태**: Draft
**작성일**: 2026-07-12

## 목적

LIPS · @cosme(ATCOSME) 사이트를 대상으로 하는 **단순 리뷰(SIMPLE_REVIEW)** 캠페인 타입을 신설한다. 상품 발송/수령 단계 없이 응모 → 승인 → 리뷰 URL 제출 → 검수 → 정산 의 5단계로 진행하고, 인플루언서는 LIPS · ATCOSME 중 하나 또는 둘 다에 응모할 수 있다.

부가적으로, 인플웹(client-web) 브라우즈 화면의 상단 필터를 **서브타입 기준 → 카테고리 기준** 으로 변경한다.

## 배경

현재 캠페인 카테고리는 `SNS`, `FAKE_PURCHASE` 두 종류다. LIPS · @cosme 는 지금까지 FAKE_PURCHASE(QOO10) 응모의 부가 리뷰 채널(`CampaignRecruit.subTypeOptions`)로만 존재해 왔다. 별개의 캠페인 유형으로 분리해 달라는 요구가 생겼고, 흐름이 간단(발송 없음, 리뷰 URL 만 제출)해 SNS · FAKE_PURCHASE 재사용은 부적절하다.

## 전체 프로세스 (5스텝)

| # | 스텝 | 라벨 (jp / kr) | 트리거 주체 |
|---|---|---|---|
| 1 | 応募 / 응모 | `APPLIED` | 인플루언서 신청 |
| 2 | 承認 / 승인 | `APPROVED` | 어드민 승인 (반려는 리젝트로 종료) |
| 3 | レビュー提出 / 리뷰 제출 | `REVIEW_SUBMITTED` | 인플루언서 URL 제출 |
| 4 | 検査 / 검수 | 검수 승인·반려 | 어드민. 반려 시 재제출 가능 |
| 5 | 精算待ち → キャンペーン終了 / 정산 대기 → 캠페인 종료 | `COMPLETED` → `SETTLED` | 어드민 정산 완료 |

## 참여 구조

- `CampaignRecruit` 는 subType(`LIPS` / `ATCOSME`) 별로 만든다. 캠페인 등록 시 두 subType 중 어느 것을 열지 선택.
- 인플루언서는 LIPS · ATCOSME 중 하나만, 또는 둘 다 응모 가능. subType 별로 별개의 `CampaignApplication` row 생성.
- 승인 · 리뷰 제출 · 검수 · 정산은 subType 별로 독립 진행 (SNS 다중 트랙 패턴 재사용).

## Prisma 스키마 변경

### enum 확장
- `CampaignCategory` : **+ `SIMPLE_REVIEW`**
- `CampaignSubType` : **+ `LIPS`, `ATCOSME`**
- `LineTriggerKey` : + 10개 (아래 LINE 트리거 절 참고)

### 기존 테이블/컬럼 재사용
- `Campaign` — 카테고리·기간·보수 등 기존 필드 그대로
- `CampaignRecruit` — subType(LIPS/ATCOSME), minFollowers, recruitCount 사용. `productPriceJpy`/`productUrl` 은 미사용(null)
- `CampaignApplication` — `status` 흐름: `APPLIED → APPROVED → REVIEW_SUBMITTED → COMPLETED` (`SHIPPED`/`DELIVERED` 스킵)
- `SubmittedPost` — `url` = 리뷰 URL. `submissionData` / `insight*` 필드는 미사용
- `Settlement` — 리뷰 승인 시 PENDING 생성. `amountJpy = campaign.rewardJpy`, `productRefundJpy = 0`

### 마이그레이션
```sql
ALTER TYPE "CampaignCategory" ADD VALUE 'SIMPLE_REVIEW';
ALTER TYPE "CampaignSubType" ADD VALUE 'LIPS';
ALTER TYPE "CampaignSubType" ADD VALUE 'ATCOSME';
-- LineTriggerKey 는 아래 10개 값 각각 ADD VALUE
```

## LINE 트리거 (10개)

`LineTriggerKey` enum 에 SIMPLE_REVIEW 시리즈 10개 신설:

```
SIMPLE_REVIEW_APPLICATION_APPLIED
SIMPLE_REVIEW_APPLICATION_APPROVED
SIMPLE_REVIEW_APPLICATION_REJECTED
SIMPLE_REVIEW_SUBMITTED
SIMPLE_REVIEW_APPROVED
SIMPLE_REVIEW_REJECTED
SIMPLE_REVIEW_DEADLINE_REMINDER
SIMPLE_REVIEW_REJECTION_REMINDER
SIMPLE_REVIEW_SETTLEMENT_COMPLETED
SIMPLE_REVIEW_CAMPAIGN_COMPLETED
```

- `trigger-meta.ts` 에 category=`SIMPLE_REVIEW` 로 10개 entry 추가 (variables 는 기존 SNS 시리즈와 동일 세트 기반)
- 시드(`line-templates.seed.ts`) 에는 모두 `enabled: false, body: ""` 로 초기화. 어드민이 이후 활성화·본문 작성.

## API 변경

### `apps/api/src/influencer-applications/influencer-applications.service.ts`
- `apply()` : SIMPLE_REVIEW 분기 추가. SNS 다중 트랙 로직 재활용해 선택된 subType 각각에 대해 `CampaignApplication` 생성. 트리거 `SIMPLE_REVIEW_APPLICATION_APPLIED` 발송.
- **신규 메서드** `submitSimpleReview(influencerId, applicationId, subType, url)` :
  - 카테고리 검증 (SIMPLE_REVIEW 만 허용)
  - `SubmittedPost.url` 저장 (`submissionData`/`insight*` null)
  - `CampaignApplication.status = REVIEW_SUBMITTED`
  - 트리거 `SIMPLE_REVIEW_SUBMITTED` 발송
- 기존 `submitReview`(FAKE_PURCHASE 전용, 스크린샷 필수) 와는 별도 메서드로 분리.
- 컨트롤러 라우트 신설: `POST /influencer/applications/:id/simple-review` (또는 기존 `submit-review` 라우트를 카테고리 인지로 분기 — 컨트롤러 스코프에서 결정)

### `apps/api/src/admin-applications/admin-applications.service.ts`
- `approveSubmittedPost` : 카테고리에 SIMPLE_REVIEW 를 추가해 트리거 `SIMPLE_REVIEW_APPROVED` 발송 분기 확장. `ensureSettlementForPost` 는 그대로 호출 → SIMPLE_REVIEW 케이스에서 PENDING 정산 생성.
- `rejectSubmittedPost` : 카테고리별 `SIMPLE_REVIEW_REJECTED` 발송 분기 확장.
- `completeSettlements` : 카테고리별 `SIMPLE_REVIEW_SETTLEMENT_COMPLETED` + `SIMPLE_REVIEW_CAMPAIGN_COMPLETED` 발송 분기 확장.

### `apps/api/src/influencer-campaigns/display-stage.ts`
- **신규 함수** `deriveSimpleReviewStage(input)` :
  - `status === "APPLIED"` → `APPLIED`
  - `status === "REJECTED"` → `REJECTED`
  - `status === "CANCELLED"` → `CANCELLED`
  - `status === "APPROVED"` → `AWAITING_REVIEW` (리뷰 제출 대기 — 기존 enum 값 재사용)
  - `status === "REVIEW_SUBMITTED"` :
    - `post.reviewStatus === "REJECTED"` → `REVIEW_REJECTED`
    - `post.reviewStatus === "PENDING"` → `REVIEW_PENDING`
    - `post.settlementStatus === "COMPLETED"` → `SETTLED`
    - `post.reviewStatus === "APPROVED"` → `COMPLETED` (정산 대기)
  - `status === "COMPLETED"` : 정산 완료 여부에 따라 `SETTLED` / `COMPLETED`
- `deriveDisplayStage` 진입점에서 카테고리별로 라우팅.

### `apps/api/src/settlements/ensure-settlement.ts`
- SIMPLE_REVIEW 케이스 추가. FAKE_PURCHASE 와 유사하되:
  - `productRefundJpy = 0`
  - `amountJpy = campaign.rewardJpy`
  - 인사이트 요구 없음 → 리뷰 승인만 되면 즉시 PENDING 정산 생성

### `apps/api/src/line-templates/line-reminders.service.ts`
- SIMPLE_REVIEW 대상 두 종류 리마인더 추가:
  - `runSimpleReviewDeadlineReminders()` — `status = APPROVED` 이고 승인일 + `postingPeriodDays` 임박한 응모에 `SIMPLE_REVIEW_DEADLINE_REMINDER` 발송
  - `runSimpleReviewRejectionReminders()` — 리뷰가 `REJECTED` 상태로 재제출 지연된 응모에 `SIMPLE_REVIEW_REJECTION_REMINDER` 발송

### `apps/api/src/influencer-campaigns/influencer-campaigns.service.ts` (필터)
- 기존 `list(args: { influencerId, sns?: CampaignSubType })` 시그니처 → **`list(args: { influencerId, category?: CampaignCategory })`** 로 변경
- 컨트롤러 쿼리 파라미터도 `sns` → `category` 로 변경

## Shared 스키마 (`packages/shared`)

- `CampaignCategorySchema` : `SIMPLE_REVIEW` 추가
- `CampaignSubTypeSchema` : `LIPS`, `ATCOSME` 추가
- `LineTriggerKeySchema` : SIMPLE_REVIEW 10개 추가
- `SUB_TYPE_LABEL` : `LIPS` = "LIPS", `ATCOSME` = "@cosme"
- `SIMPLE_REVIEW_SUB_TYPES` 상수 배열 export (`["LIPS", "ATCOSME"]`)
- 인플루언서 캠페인 응답 스키마의 subType/카테고리 관련 코드 검토 후 확장

## Admin-web

### `CampaignForm`
- 카테고리 선택에 "단순 리뷰" 옵션 추가
- SIMPLE_REVIEW 선택 시 recruit 편집 UI: LIPS 슬롯 + ATCOSME 슬롯 (SNS 다중 트랙 UI 재활용). 각 슬롯은 recruitCount / minFollowers 만 편집. `productPriceJpy` / `productUrl` / `subTypeOptions` 비노출.
- 유효성: 최소 1개 이상의 subType recruit 필요

### Applicants / Drafts / MessageTemplates 페이지
- 카테고리 필터·탭에 "단순 리뷰" 추가
- Drafts 페이지의 리뷰 URL 표시는 SNS URL 컬럼과 동일하게 처리 (별도 컴포넌트 불필요)
- MessageTemplates 카테고리 탭에 "단순 리뷰" 추가 → SIMPLE_REVIEW 10개 트리거 목록 노출

## Client-web (인플웹)

**규칙**: 모든 문자열 `i18n/messages.ts` 등록 + 신규/수정 property 라인에 `// new` 주석 (project rule).

### Browse 페이지 필터 변경 (별도 변경사항)
- 현재 상단 필터: 서브타입 별 (`SnsTabBar` — INSTAGRAM/TIKTOK/X/YOUTUBE/QOO10)
- **변경**: 카테고리 별 3탭 (`SNS` / `買取レビュー` / `単純レビュー`)
- `SnsTabBar.tsx` 를 `CategoryTabBar.tsx` 로 리네임 · 재구성
- `useCampaignList(category)` 훅 시그니처 변경
- API 쿼리 파라미터 `?category=SNS` 형태로 변경

### Apply 페이지
- SIMPLE_REVIEW 캠페인이면 subType 선택 UI 를 LIPS 체크박스 + @cosme 체크박스 로 렌더 (SNS 다중 선택 컴포넌트 재활용)
- 응모 확정 시 선택된 subType 각각에 대해 `CampaignApplication` 생성

### CampaignDetail
- SIMPLE_REVIEW 카테고리 뱃지 및 subType 뱃지 표시. 기존 카드 컴포넌트 확장으로 충분.

### Applications Detail (응모 상세)
- **신규 컴포넌트** `SimpleReviewSubmitForm.tsx` — URL input 하나만. 제출 시 `POST /influencer/applications/:id/simple-review` 호출.
- `ApplicationStepper` : `category` prop 추가. category 별 STEPS 배열 분기:
  - `SNS` → 기존 8스텝
  - `FAKE_PURCHASE` → 별개 배열(이번 스코프 아님; 기존 8스텝 유지)
  - `SIMPLE_REVIEW` → 5스텝 (`応募 / 承認 / レビュー提出 / 検査 / 精算待ち → キャンペーン終了`)
- STAGE_PROGRESS 도 카테고리별 매핑을 갖도록 함수형(`stageProgressFor(category, stage)`) 으로 재구성 or SIMPLE_REVIEW 만 별개 매핑 상수로 유지

### i18n 신설 키
- `campaign.category.simpleReview`
- `campaign.subType.lips`, `campaign.subType.atcosme`
- `application.stepper.simpleReview.step1` ~ `step5`
- `application.stageLabel.SIMPLE_REVIEW_*` (필요 시)
- `application.stage.simpleReviewSubmit.heading` 등 상세 페이지 카피

## 마이그레이션 파일 계획

`apps/api/prisma/migrations/20260712120000_add_simple_review_category/migration.sql` (신규):

```sql
ALTER TYPE "CampaignCategory" ADD VALUE 'SIMPLE_REVIEW';
ALTER TYPE "CampaignSubType" ADD VALUE 'LIPS';
ALTER TYPE "CampaignSubType" ADD VALUE 'ATCOSME';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_APPLICATION_APPLIED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_APPLICATION_APPROVED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_APPLICATION_REJECTED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_SUBMITTED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_APPROVED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_REJECTED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_DEADLINE_REMINDER';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_REJECTION_REMINDER';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_SETTLEMENT_COMPLETED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_CAMPAIGN_COMPLETED';
```

## 시드 변경

`apps/api/prisma/seeds/line-templates.seed.ts` :

```ts
type SimpleReviewTriggerKey =
  | "SIMPLE_REVIEW_APPLICATION_APPLIED"
  | "SIMPLE_REVIEW_APPLICATION_APPROVED"
  | "SIMPLE_REVIEW_APPLICATION_REJECTED"
  | "SIMPLE_REVIEW_SUBMITTED"
  | "SIMPLE_REVIEW_APPROVED"
  | "SIMPLE_REVIEW_REJECTED"
  | "SIMPLE_REVIEW_DEADLINE_REMINDER"
  | "SIMPLE_REVIEW_REJECTION_REMINDER"
  | "SIMPLE_REVIEW_SETTLEMENT_COMPLETED"
  | "SIMPLE_REVIEW_CAMPAIGN_COMPLETED";

const SR_SEED_ROWS: { triggerKey: SimpleReviewTriggerKey; enabled: boolean; body: string }[] = [
  { triggerKey: "SIMPLE_REVIEW_APPLICATION_APPLIED", enabled: false, body: "" },
  // ... 나머지 9개, 모두 enabled:false, body:""
];

// main() 에서 각 SR row 를 category=SIMPLE_REVIEW 로 upsert
```

## 테스트 전략

- `display-stage.spec.ts` 에 SIMPLE_REVIEW 케이스 케이스별 테스트 추가 (APPLIED / APPROVED → AWAITING_REVIEW / REVIEW_PENDING / REVIEW_REJECTED / COMPLETED / SETTLED)
- `influencer-applications.service.spec.ts` 에 `apply()` 의 SIMPLE_REVIEW 분기, `submitSimpleReview()` 케이스 추가
- `ensure-settlement` 의 SIMPLE_REVIEW 분기 unit test

## 리스크 / 트레이드오프

- **카테고리별 스텝퍼 분기** — 3방향으로 늘어남. 향후 카테고리가 더 추가되면 `stepsByCategory` 룩업 테이블이 커짐. 단순 구조라 유지보수는 감당 가능.
- **`ensureSettlementForPost` 분기 확장** — 이미 SNS / FAKE_PURCHASE 두 케이스 존재. SIMPLE_REVIEW 추가로 3케이스가 됨.
- **`display-stage` 확장** — 카테고리별 `derive*Stage` 함수가 3개로 늘어남. 각 함수는 상태 → displayStage 매핑에 집중해 단일 책임 유지.
- **필터 변경의 하위 호환** — 인플웹의 URL 이나 저장된 상태에 `?sns=INSTAGRAM` 같은 파라미터가 남아있을 수 있으나, 신규 배포와 함께 자연 마이그레이션 (사용자가 새로 필터 선택). 별도 리다이렉트 불필요.

## 스코프 밖

- FAKE_PURCHASE 스텝퍼 별도 분리 — 이번 스코프 아님. 현재 SNS 8스텝 매핑을 그대로 재사용.
- SIMPLE_REVIEW 캠페인 검색·정렬 개선 — 별도 안건.
- SIMPLE_REVIEW 리뷰 URL 유효성 검사(LIPS/@cosme 도메인 whitelist) — 초기 스코프에서는 자유 텍스트로 저장. 필요 시 후속 스펙.

## 배포 순서

1. shared 스키마 + Prisma 마이그레이션 → `pnpm --filter @jsure/shared build`
2. 백엔드 서비스·리마인더·display-stage → typecheck + spec 실행
3. 시드 실행 (신규 트리거 10개 row 생성)
4. admin-web (캠페인 폼·필터·템플릿 페이지)
5. client-web (필터·apply·submit form·stepper·i18n)
6. Railway 재배포 → `prisma migrate deploy` 자동 실행 → seed 는 별도 실행 필요 (수동)
