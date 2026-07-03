# 가구매 캠페인 UI (Plan C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin-web (캠페인 폼, 응모자, 게시물 검토, 정산) 과 client-web (캠페인 목록, 상세, 응모 상세) UI 를 가구매 카테고리까지 확장한다.

**Architecture:** 백엔드는 Plan B 에서 완료(`SNS_APPLICATION_APPLIED` 등 dispatch 트리거, `submitOrder`/`submitReview` 엔드포인트, 통합 presign, TRIGGER_META 등). Plan C 는 프론트만 다룬다. `category === "FAKE_PURCHASE"` 를 기본 분기 축으로 사용하며, admin-web 은 한국어 하드코딩, client-web 은 i18n 키를 사용한다.

**Tech Stack:** React 18.3 + Vite + CSS Modules + Zod, 커스텀 i18n (`i18n/t.ts`), design tokens.

---

## 실행 규칙

1. **admin-web 하드코딩 한국어**, **client-web 은 i18n 키 필수**.
2. **차별 함의 식별자 금지** (`blacklist` 등), **약어 금지** (`req/mut` 등 풀어 쓰기).
3. **`git add -A` 금지** — 명시 경로만.
4. **커밋 메시지 한글**.
5. **디자인 토큰 사용** (`var(--color-*)`, `var(--space-*)`); 임의 색상/크기 금지.
6. 대다이얼로그는 액션별로 분리 (기존 [[feedback_dialogs]] 규칙).
7. `submitOrder`/`submitReview` 는 REST 호출로만 확인 가능하므로 각 Task 는 typecheck + build 로 검증.

---

## 사전 확인

- 브랜치: `feat/fake-purchase-ui` (main `53a3166` 기반, worktree 는 사용하지 않음)
- Plan B 완료 상태 (백엔드 API 및 shared 스키마 준비)
- `@jsure/shared` 에 이미 `ApplicationDisplayStage`, `AttachmentSchema`, `SubmitOrderRequestSchema`, `SubmitReviewRequestSchema`, `InfluencerAttachmentPresignRequestSchema` export

---

## Task 1: shared — UI 라벨/enum 상수 정리

**Files:**
- Create: `packages/shared/src/ui/labels.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 라벨 헬퍼 상수 추가**

`packages/shared/src/ui/labels.ts` 신규:

```ts
import type { CampaignCategory, CampaignSubType } from "../types/campaign";

export const CATEGORY_LABEL_JA: Record<CampaignCategory, string> = {
  SNS: "SNS",
  FAKE_PURCHASE: "買取レビュー",
};

export const SUB_TYPE_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  QOO10: "Qoo10",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

export const SNS_SUB_TYPES = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"] as const;
export const FAKE_PURCHASE_SUB_TYPES = ["QOO10", "LIPS", "ATCOSME"] as const;

export function subTypesForCategory(
  category: CampaignCategory,
): readonly CampaignSubType[] {
  return category === "FAKE_PURCHASE" ? FAKE_PURCHASE_SUB_TYPES : SNS_SUB_TYPES;
}
```

- [ ] **Step 2: index.ts re-export**

`packages/shared/src/index.ts` 하단:

```ts
export * from "./ui/labels";
```

- [ ] **Step 3: typecheck 및 커밋**

```bash
pnpm --filter @jsure/shared exec tsc --noEmit
git add packages/shared/src/ui/labels.ts packages/shared/src/index.ts
git commit -m "feat(shared): 카테고리/서브타입 UI 라벨 및 헬퍼 추가"
```

---

## Task 2: admin-web CampaignForm — 카테고리 라디오 필드 추가

**Files:**
- Modify: `apps/admin-web/src/domains/campaign/components/CampaignForm.tsx`
- Modify: `apps/admin-web/src/domains/campaign/schema.ts` (또는 form 스키마 파일)

- [ ] **Step 1: form 스키마에 category 필드 추가**

`CampaignFormSchema` 에 category union 필드 추가:

```ts
category: z.enum(["SNS", "FAKE_PURCHASE"]),
```

기본값: `SNS`. 편집 모드에서는 초기값을 서버 응답의 category 로 세팅.

- [ ] **Step 2: CampaignForm 상단에 카테고리 라디오 렌더**

`CampaignForm.tsx` 최상단 (title 위) 에 카테고리 선택 라디오 그룹 추가:

```tsx
<div className={styles.field}>
  <label className={styles.label}>카테고리</label>
  <div className={styles.radioGroup}>
    <label className={styles.radioOption}>
      <input
        type="radio"
        name="category"
        value="SNS"
        checked={values.category === "SNS"}
        disabled={mode === "edit"}
        onChange={() => onChange({ category: "SNS", recruits: [] })}
      />
      SNS
    </label>
    <label className={styles.radioOption}>
      <input
        type="radio"
        name="category"
        value="FAKE_PURCHASE"
        checked={values.category === "FAKE_PURCHASE"}
        disabled={mode === "edit"}
        onChange={() => onChange({ category: "FAKE_PURCHASE", recruits: [] })}
      />
      가구매
    </label>
  </div>
  {mode === "edit" && (
    <p className={styles.hint}>카테고리는 생성 후 변경할 수 없습니다.</p>
  )}
</div>
```

- [ ] **Step 3: CSS 모듈에 스타일 추가**

`CampaignForm.module.css` 에 `.radioGroup`, `.radioOption`, `.hint` 스타일 추가 (design tokens 사용).

- [ ] **Step 4: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/admin-web exec tsc -b --noEmit
pnpm --filter @jsure/admin-web build
git add apps/admin-web/src/domains/campaign/components/CampaignForm.tsx apps/admin-web/src/domains/campaign/components/CampaignForm.module.css apps/admin-web/src/domains/campaign/schema.ts
git commit -m "feat(admin-web): CampaignForm 카테고리 라디오 및 편집 잠금"
```

---

## Task 3: admin-web RecruitList — 카테고리별 분기

**Files:**
- Modify: `apps/admin-web/src/domains/campaign/components/SnsRecruitList.tsx` → rename `RecruitList.tsx`
- Modify: `apps/admin-web/src/domains/campaign/components/CampaignForm.tsx`

- [ ] **Step 1: 파일 rename 및 props 확장**

`SnsRecruitList.tsx` → `RecruitList.tsx`. props 에 `category: CampaignCategory` 추가. 내부에서 카테고리에 따라 서브타입 후보/각 슬롯 필드 분기.

- [ ] **Step 2: 서브타입 선택 UI 분기**

`subTypesForCategory(category)` 를 이용하여 SNS 는 4개 (Instagram/TikTok/X/YouTube), FAKE_PURCHASE 는 3개 (Qoo10/LIPS/@cosme) 체크박스 렌더.

- [ ] **Step 3: 슬롯별 필드 분기**

각 recruit slot 카드 내부:

**SNS**:
- `minFollowers` (number)
- `recruitCount` (number)
- `insightRequired` (checkbox)
- `instagramPostTypes` (Instagram 서브타입에서만)

**FAKE_PURCHASE**:
- `recruitCount` (number)
- `productPriceJpy` (number, > 0)
- `productUrl` (text, https URL)

SNS 필드는 FAKE_PURCHASE 슬롯에서 안 보이고 반대도 마찬가지. 데이터 shape 은 `RecruitSlot` 하나로 유지하되 필드는 nullable — form submit 시 카테고리별 검증.

- [ ] **Step 4: CampaignForm 에서 import 경로 갱신**

`import { SnsRecruitList }` → `import { RecruitList }`. `<RecruitList category={values.category} recruits={values.recruits} onChange={...} />`.

- [ ] **Step 5: form 검증 (client-side)**

form submit 전에 아래 검증:
- FAKE_PURCHASE 슬롯 → `productPriceJpy > 0`, `productUrl` 필수, `minFollowers` 표시하지 않으니 0 로 강제, `insightRequired = false`
- SNS 슬롯 → 기존 검증 유지

- [ ] **Step 6: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/admin-web exec tsc -b --noEmit
pnpm --filter @jsure/admin-web build
git add apps/admin-web/src/domains/campaign/components/RecruitList.tsx apps/admin-web/src/domains/campaign/components/CampaignForm.tsx
git rm apps/admin-web/src/domains/campaign/components/SnsRecruitList.tsx
git commit -m "feat(admin-web): RecruitList 카테고리별 분기 (SNS/가구매 서브타입 및 필드)"
```

---

## Task 4: admin-web Applicants — 카테고리 컬럼 및 필터

**Files:**
- Modify: `apps/admin-web/src/pages/Applicants/index.tsx`
- Modify: `apps/admin-web/src/pages/Applicants/ApplicantTable.tsx`
- Modify: `apps/admin-web/src/pages/Applicants/ApplicantFilters.tsx`

- [ ] **Step 1: 테이블에 카테고리 컬럼 추가**

`ApplicantTable.tsx` 헤더/바디에 "카테고리" 컬럼 (SNS / 가구매 뱃지). `CATEGORY_LABEL_JA` 재사용하되 admin-web 은 한국어 라벨 별도 (`"SNS"`, `"가구매"`) 로 표시.

- [ ] **Step 2: 필터에 카테고리 셀렉트 추가**

`ApplicantFilters.tsx` 에 카테고리 필터 (전체/SNS/가구매). 상태 관리는 부모 `Applicants/index.tsx` 에 위임.

- [ ] **Step 3: 액션 버튼 카테고리 가드**

`ship`, `deliver` 액션 버튼은 category === "SNS" 인 경우만 렌더. 그 외에는 disabled 또는 숨김.

- [ ] **Step 4: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/admin-web exec tsc -b --noEmit
pnpm --filter @jsure/admin-web build
git add apps/admin-web/src/pages/Applicants/index.tsx apps/admin-web/src/pages/Applicants/ApplicantTable.tsx apps/admin-web/src/pages/Applicants/ApplicantFilters.tsx
git commit -m "feat(admin-web): 응모자 목록 카테고리 컬럼/필터 및 SNS 전용 액션 가드"
```

---

## Task 5: admin-web Applicants 상세 — 가구매 진행 데이터 표시

**Files:**
- Modify: `apps/admin-web/src/pages/Applicants/ApplicantDetailDialog.tsx` (또는 상세 렌더 컴포넌트)

- [ ] **Step 1: 카테고리 분기 뷰 추가**

상세 다이얼로그/사이드 패널에 category === "FAKE_PURCHASE" 인 경우 아래 섹션 표시:

- 주문번호 (`application.orderNumber`)
- 주문 명세서 첨부 (`Attachment[]` where `kind === "ORDER_RECEIPT"`) — 썸네일 그리드
- 리뷰 URL (`submittedPost.url`)
- 리뷰 스크린샷 (`Attachment[]` where `kind === "REVIEW_SCREENSHOT"`) — 썸네일 그리드
- 리뷰 상태 (PENDING / APPROVED / REJECTED)

첨부 조회는 기존 `fetchSubmittedPostAttachments` 재사용하되 kind 로 분리. 서버가 kind 필터를 지원하지 않는다면 클라이언트에서 필터링.

- [ ] **Step 2: 라이트박스 재사용**

`InsightDetailDialog` 의 라이트박스 컴포넌트를 별도 `Lightbox.tsx` 로 추출하여 재사용 (선택). 아니면 로컬 state 로 처리.

- [ ] **Step 3: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/admin-web exec tsc -b --noEmit
pnpm --filter @jsure/admin-web build
git add apps/admin-web/src/pages/Applicants/ApplicantDetailDialog.tsx
git commit -m "feat(admin-web): 응모자 상세 가구매 주문/리뷰 데이터 뷰"
```

---

## Task 6: admin-web Drafts — 가구매 리뷰 통합 및 필터

**Files:**
- Modify: `apps/admin-web/src/pages/Drafts/index.tsx`
- Modify: `apps/admin-web/src/pages/Drafts/DraftTable.tsx`
- Modify: `apps/admin-web/src/pages/Drafts/DraftStatusFilter.tsx` (있다면 category 필터 추가)

- [ ] **Step 1: 목록 쿼리 확장**

Drafts 페이지가 SNS 게시물만 반환하도록 필터링되어 있다면, 백엔드가 이미 통합된 SubmittedPost 를 반환하므로 클라이언트 필터를 제거하거나 category 파라미터 추가. 실제 API 응답에 `application.campaign.category` 를 포함시켜야 하면 admin-web/lib API 조정.

- [ ] **Step 2: 테이블 컬럼**

카테고리 컬럼 추가. 승인/반려 액션은 category 무관 동일 동작 (백엔드는 이미 카테고리 분기 dispatch).

- [ ] **Step 3: 첨부 표시 분기**

Drafts 상세 렌더 시 kind 필터:
- SNS: `INSIGHT_SCREENSHOT`
- FAKE_PURCHASE: `REVIEW_SCREENSHOT`

`InsightDetailDialog` 명칭이 SNS 편향적이면 `PostReviewDialog` 로 rename 하고 category 분기 (선택 — 큰 파괴적 변경이면 별도 커밋).

- [ ] **Step 4: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/admin-web exec tsc -b --noEmit
pnpm --filter @jsure/admin-web build
git add apps/admin-web/src/pages/Drafts/
git commit -m "feat(admin-web): Drafts 카테고리 컬럼/필터 및 리뷰 첨부 분기"
```

---

## Task 7: admin-web Payouts — reward/productRefund 컬럼

**Files:**
- Modify: `apps/admin-web/src/pages/Payouts/index.tsx`
- Modify: `apps/admin-web/src/pages/Payouts/PayoutsTable.tsx` (있다면)

- [ ] **Step 1: 컬럼 추가**

기존 "정산금액" 컬럼 옆에 다음 컬럼 추가:
- 보수 (`rewardAmountJpy`, `formatJpy`)
- 상품환급 (`productRefundJpy`, `formatJpy` — 0 이면 "—" 표시)
- 합계 (`amountJpy`)

`Settlement` shared 타입에 이미 추가되어 있음 (Plan A). API 응답에서 필드 노출 확인 후 사용.

- [ ] **Step 2: 카테고리 필터**

기존 필터에 카테고리 셀렉트 추가 (SNS / 가구매 / 전체).

- [ ] **Step 3: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/admin-web exec tsc -b --noEmit
pnpm --filter @jsure/admin-web build
git add apps/admin-web/src/pages/Payouts/
git commit -m "feat(admin-web): Payouts 보수/상품환급 컬럼 및 카테고리 필터"
```

---

## Task 8: client-web i18n — 가구매 키 추가

**Files:**
- Modify: `i18n/messages.ts`

- [ ] **Step 1: 신규 키 정의**

`i18n/messages.ts` 의 계층 객체에 다음 키를 추가 (기본 ja + 필요 시 kr):

```ts
// campaign.category
sns: { ja: "SNS", kr: "SNS" },
fakePurchase: { ja: "買取レビュー", kr: "가구매" },

// subType (가구매)
qoo10: { ja: "Qoo10", kr: "Qoo10" },
lips: { ja: "LIPS", kr: "LIPS" },
atcosme: { ja: "@cosme", kr: "@cosme" },

// application.stage.awaitingOrder
"awaitingOrder.heading": { ja: "ご注文をお願いいたします", kr: "주문을 진행해 주세요" },
"awaitingOrder.description": { ja: "商品をご購入後、注文番号と注文明細のスクリーンショットをご提出ください", kr: "..." },
"awaitingOrder.orderNumber.label": { ja: "注文番号", kr: "주문번호" },
"awaitingOrder.receipts.label": { ja: "注文明細のスクリーンショット (1枚以上)", kr: "주문 명세서 스크린샷 (1장 이상)" },
"awaitingOrder.submit": { ja: "提出する", kr: "제출" },

// application.stage.awaitingReview
"awaitingReview.heading": { ja: "レビューの投稿をお願いいたします", kr: "리뷰를 작성해 주세요" },
"awaitingReview.description": { ja: "各プラットフォームでレビューを投稿後、URLとスクリーンショットをご提出ください", kr: "..." },
"awaitingReview.url.label": { ja: "レビューURL", kr: "리뷰 URL" },
"awaitingReview.screenshots.label": { ja: "レビューのスクリーンショット (2枚以上)", kr: "리뷰 스크린샷 (2장 이상)" },
"awaitingReview.deadlineDays": { ja: "投稿期限まであと{days}日", kr: "리뷰 마감까지 {days}일" },
"awaitingReview.submit": { ja: "提出する", kr: "제출" },

// application.stage.reviewPending
"reviewPending.description": { ja: "提出いただいたレビューを審査中です", kr: "제출한 리뷰를 검토 중입니다" },

// application.stage.reviewRejected
"reviewRejected.heading": { ja: "レビューの再提出をお願いいたします", kr: "리뷰 재제출이 필요합니다" },
"reviewRejected.reasonLabel": { ja: "修正の理由", kr: "반려 사유" },
"reviewRejected.description": { ja: "ガイドラインに沿ってレビューを修正し、URLとスクリーンショットを再度ご提出ください", kr: "..." },

// campaign.detail
"campaign.detail.productUrl": { ja: "商品ページ", kr: "상품 페이지" },
"campaign.detail.expectedSettlement": { ja: "予定精算金額", kr: "예상 정산액" },
"campaign.detail.productPrice": { ja: "商品価格", kr: "상품 가격" },
```

정확한 키 이름/구조는 기존 `messages.ts` 컨벤션 (dot path vs nested object) 에 맞춰 조정.

- [ ] **Step 2: validate-i18n 실행**

```bash
pnpm --filter @jsure/client-web exec tsx ../../i18n/scripts/validate-i18n.ts
```

Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add i18n/messages.ts
git commit -m "feat(client-web): 가구매 캠페인 i18n 키 추가"
```

---

## Task 9: client-web Browse — 카테고리 뱃지

**Files:**
- Modify: `apps/client-web/src/domains/campaign/CampaignCard.tsx` (또는 카드 컴포넌트)

- [ ] **Step 1: 카드에 category 뱃지**

카드 상단 또는 title 옆에 카테고리 뱃지:

```tsx
<span className={styles.categoryBadge} data-category={campaign.category}>
  {t(`campaign.category.${campaign.category === "FAKE_PURCHASE" ? "fakePurchase" : "sns"}`)}
</span>
```

CSS 로 `[data-category="FAKE_PURCHASE"]` 배경색을 design token 으로 지정.

- [ ] **Step 2: subType 아이콘/라벨 확장**

기존 SNS 아이콘 매핑 (`SNS_ROW_CLASS` 등) 에 QOO10/LIPS/ATCOSME 추가. 아이콘이 없으면 텍스트 라벨 (`SUB_TYPE_LABEL` 재사용).

- [ ] **Step 3: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src/domains/campaign/
git commit -m "feat(client-web): 캠페인 카드 카테고리 뱃지 및 가구매 서브타입 라벨"
```

---

## Task 10: client-web CampaignDetail — 가구매 필드 표시

**Files:**
- Modify: `apps/client-web/src/pages/CampaignDetail/index.tsx`

- [ ] **Step 1: recruits 렌더 분기**

category === "FAKE_PURCHASE" 인 경우 각 recruit 슬롯에 다음 표시:
- 서브타입 라벨
- 상품 가격 (`productPriceJpy`, formatJpy)
- 상품 URL 링크 (외부 링크, `target="_blank"`)
- 예상 정산액 (`reward + productPriceJpy`)

SNS 카테고리는 기존 표시 유지.

- [ ] **Step 2: i18n 적용**

`t("campaign.detail.productUrl")`, `t("campaign.detail.expectedSettlement")` 등 사용.

- [ ] **Step 3: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src/pages/CampaignDetail/index.tsx
git commit -m "feat(client-web): CampaignDetail 가구매 상품가격/URL/예상 정산액 표시"
```

---

## Task 11: client-web Apply — 카테고리별 서브타입 필터

**Files:**
- Modify: `apps/client-web/src/pages/Apply/index.tsx`

- [ ] **Step 1: 서브타입 후보 분기**

기존 SNS 팔로워 조건 검사는 SNS 카테고리에서만 실행. FAKE_PURCHASE 는 팔로워 조건 스킵, subType 후보는 3개 (QOO10/LIPS/ATCOSME) 로 제한.

- [ ] **Step 2: instagramPostTypes 렌더 조건**

FAKE_PURCHASE 는 `instagramPostTypes` 관련 UI 숨김.

- [ ] **Step 3: 동의 항목 분기**

가구매는 INSIGHTS 동의를 표시하지 않음 (또는 문구를 카테고리별로 스와핑). 필요 시 새 동의 키 (`consent.purchaseNotice` 등) 추가.

- [ ] **Step 4: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src/pages/Apply/index.tsx
git commit -m "feat(client-web): Apply 가구매 서브타입 후보 및 조건 분기"
```

---

## Task 12: client-web — OrderSubmitForm 신규 컴포넌트

**Files:**
- Create: `apps/client-web/src/pages/Applications/OrderSubmitForm.tsx`
- Create: `apps/client-web/src/pages/Applications/OrderSubmitForm.module.css`
- Modify: `apps/client-web/src/lib/api/applications.ts` (또는 API 모듈)

- [ ] **Step 1: API 함수 추가**

`lib/api/applications.ts` 에:

```ts
export async function submitOrder(
  applicationId: string,
  orderNumber: string,
  receipts: AttachmentUploadInput[],
): Promise<InfluencerApplicationDetail> {
  return apiClient.post(`/influencer/applications/${applicationId}/order`, {
    orderNumber,
    receipts,
  });
}
```

- [ ] **Step 2: OrderSubmitForm 컴포넌트**

폼 필드:
- orderNumber (text input, 필수, trim ≥ 1)
- receipts: 파일 업로드 (kind="ORDER_RECEIPT", 1장 이상 5장 이하)

업로드 흐름:
1. 파일 선택
2. `presignInfluencerAttachment({applicationId, kind: "ORDER_RECEIPT", contentType, sizeBytes})` 호출
3. PUT presign.uploadUrl
4. 로컬 state 에 `{objectKey, contentType, sizeBytes}` 추가
5. submit 버튼 → `submitOrder(applicationId, orderNumber, receipts)`

에러 처리: 서버 응답 code (CATEGORY_MISMATCH, INVALID_TRANSITION 등) 에 따라 i18n 메시지 표시.

- [ ] **Step 3: i18n 사용**

`t("application.stage.awaitingOrder.heading")` 등 Task 8 에서 정의한 키 사용.

- [ ] **Step 4: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src/pages/Applications/OrderSubmitForm.tsx apps/client-web/src/pages/Applications/OrderSubmitForm.module.css apps/client-web/src/lib/api/applications.ts
git commit -m "feat(client-web): 가구매 주문 제출 폼 (orderNumber + receipts) 컴포넌트"
```

---

## Task 13: client-web — ReviewSubmitForm 신규 컴포넌트

**Files:**
- Create: `apps/client-web/src/pages/Applications/ReviewSubmitForm.tsx`
- Create: `apps/client-web/src/pages/Applications/ReviewSubmitForm.module.css`
- Modify: `apps/client-web/src/lib/api/applications.ts`

- [ ] **Step 1: API 함수 추가**

```ts
export async function submitReview(
  applicationId: string,
  reviewUrl: string,
  screenshots: AttachmentUploadInput[],
): Promise<InfluencerApplicationDetail> {
  return apiClient.post(`/influencer/applications/${applicationId}/review`, {
    reviewUrl,
    screenshots,
  });
}
```

- [ ] **Step 2: ReviewSubmitForm 컴포넌트**

폼 필드:
- reviewUrl (text input, 필수, https URL)
- screenshots (kind="REVIEW_SCREENSHOT", 2장 이상 10장 이하)

업로드는 Task 12 와 동일 패턴 (kind 만 다름). 마감 D-day 표시:

```tsx
<p className={styles.deadline}>
  {t("application.stage.awaitingReview.deadlineDays", { days: remainingDays })}
</p>
```

`remainingDays` 는 `orderSubmittedAt + postingPeriodDays - today` 로 계산.

- [ ] **Step 3: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src/pages/Applications/ReviewSubmitForm.tsx apps/client-web/src/pages/Applications/ReviewSubmitForm.module.css apps/client-web/src/lib/api/applications.ts
git commit -m "feat(client-web): 가구매 리뷰 제출 폼 (URL + screenshots + D-day) 컴포넌트"
```

---

## Task 14: client-web Applications/Detail — 가구매 stage 분기

**Files:**
- Modify: `apps/client-web/src/pages/Applications/Detail.tsx`

- [ ] **Step 1: displayStage switch 확장**

기존 SNS stage 분기 (APPLIED/APPROVED/SHIPPED/AWAITING_RECEIPT/POSTING/POSTED/INSIGHT_DUE/REVIEWING/SETTLED) 에 다음 케이스 추가:

- `APPLIED` (공통) — 심사 중 안내
- `AWAITING_ORDER` — `OrderSubmitForm` 렌더 + 안내
- `AWAITING_REVIEW` — `ReviewSubmitForm` 렌더 + D-day
- `REVIEW_PENDING` — 관리자 검토 중 안내 + 제출된 URL/스크린샷 읽기전용
- `REVIEW_REJECTED` — 반려 사유 표시 + `ReviewSubmitForm` (재제출)
- `REVIEWING` — 정산 진행 중 안내
- `SETTLED` — 정산 완료 안내

카테고리는 `application.campaign.category` 또는 stage 자체 (AWAITING_ORDER 등이 FAKE_PURCHASE 만 발생) 로 분기.

- [ ] **Step 2: 재제출 시 이전 값 초기화**

`REVIEW_REJECTED` 재제출 폼은 이전 값을 초기값으로 채우지 않고 새로 입력 (스펙 §4-3).

- [ ] **Step 3: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src/pages/Applications/Detail.tsx
git commit -m "feat(client-web): 응모 상세 가구매 stage 분기 (order/review/pending/rejected)"
```

---

## Task 15: client-web uploads — 통합 presign 이관

**Files:**
- Modify: `apps/client-web/src/lib/api/uploads.ts`

- [ ] **Step 1: `presignInfluencerAttachment` 함수 추가**

```ts
export async function presignInfluencerAttachment(
  body: InfluencerAttachmentPresignRequest,
): Promise<InfluencerAttachmentPresignResponse> {
  return apiClient.post("/uploads/influencer/attachment/presign", body);
}
```

- [ ] **Step 2: 기존 `presignInsight`/`uploadInsightImage` 는 유지 (하위 호환)**

Task 12/13 신규 폼은 통합 endpoint 사용, 기존 InsightSubmitForm 은 그대로 두어 SNS 인사이트 흐름 유지.

- [ ] **Step 3: typecheck / build 및 커밋**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src/lib/api/uploads.ts
git commit -m "feat(client-web): 인플루언서 통합 presign 헬퍼 추가"
```

---

## Task 16: 최종 회귀 및 통합 검증

**Files:** (변경 없음)

- [ ] **Step 1: 전체 typecheck**

```bash
pnpm typecheck
```

Expected: 모든 패키지 통과.

- [ ] **Step 2: 전체 build**

```bash
pnpm --filter @jsure/admin-web build
pnpm --filter @jsure/client-web build
```

Expected: 통과.

- [ ] **Step 3: 로컬 수동 스모크**

`pnpm dev` 로 기동 후:

1. **admin-web**: 캠페인 신규 → 카테고리 가구매 선택 → QOO10 recruit (productPriceJpy=3000, productUrl=...) 저장.
2. **client-web**: Browse 에서 가구매 뱃지 확인 → CampaignDetail 에서 상품가격/URL 확인 → 응모.
3. **admin-web**: Applicants 에서 승인.
4. **client-web**: Applications/Detail → AWAITING_ORDER stage 로 이동 → 주문번호 + 명세서 업로드 → ORDER_SUBMITTED.
5. **client-web**: AWAITING_REVIEW → 리뷰 URL + 스크린샷 2장 이상 → REVIEW_SUBMITTED.
6. **admin-web**: Drafts → 리뷰 승인 → 정산 PENDING 생성 확인.
7. **admin-web**: Payouts → 보수/상품환급 컬럼 확인 → 정산 완료.

- [ ] **Step 4: 회귀 확인 — SNS 흐름 무결성**

기존 SNS 응모 → 배송 → 투고 → 인사이트 → 정산 흐름이 그대로 동작하는지 확인.

- [ ] **Step 5: 최종 커밋 (필요 시)**

회귀 수정이 발견되면:

```bash
git add <touched-files>
git commit -m "fix: Plan C 회귀 검증에서 발견된 문제 수정"
```

---

## 완료 조건

- admin-web / client-web 전체 typecheck 통과
- 전체 build 통과
- 가구매 캠페인 생성 → 응모 → 승인 → 주문 → 리뷰 → 승인 → 정산 흐름 UI 로 종단 확인
- SNS 흐름 회귀 없음
- 커밋 수 대략 12~15개 (Task 별 1커밋 + 필요 시 fix)

이 Plan C 완료 후 스펙 §8 (향후) 항목 (자동 종료, 정책 세부 등) 은 별도 스펙/플랜 필요.

## 오픈 이슈 / 후속

- `InsightDetailDialog` → `PostReviewDialog` rename 은 Task 6 에서 선택 사항 (파괴적이면 별도 커밋).
- 가구매 정책 상세 (당첨 후 미주문 처리, 리뷰 반려 시 재제출 마감) 는 스펙 §8 로 보류.
- `presignInsightUpload` 엔드포인트 제거는 client-web 이 완전 이관된 후 별도 PR.
