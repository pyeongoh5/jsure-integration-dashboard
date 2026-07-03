# 가구매 캠페인 Plan B — 백엔드 서비스 & 메시지 템플릿

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan A(스키마) 위에 가구매 캠페인의 백엔드 로직을 완성한다. 인플루언서 `submitOrder`/`submitReview` 서비스, 관리자 승인/반려의 카테고리별 분기, `ensureSettlementForPost` 확장, `deriveDisplayStage` 확장, 통합 presign 엔드포인트, LINE 트리거 메타/디스패처/리마인더/시드 확장. UI(client-web / admin-web) 는 Plan C 에서 다룬다.

**Architecture:**
- NestJS 서비스는 카테고리(SNS / FAKE_PURCHASE) 별로 진입 가드 후 분기. 상태 전이는 단일 `ApplicationStatus` enum 위에 카테고리별 유효 전이를 서비스에서 강제
- `SubmittedPost` 하나가 SNS 게시물/가구매 리뷰 양쪽을 표현. `Attachment(kind)` 로 첨부 타입 분리
- LINE 트리거 메타는 record 형태, 카테고리+subType+key 로 템플릿 lookup. `DispatchContext` 에 `recruit?` 추가하여 가구매 전용 변수(productPriceJpy, productUrl 등) 해결
- TDD: display-stage / ensure-settlement / submitOrder / submitReview 는 spec 먼저 작성 후 구현

**Tech Stack:** NestJS 10, Prisma 5, Zod, Jest (unit + integration), pnpm 모노레포, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-07-03-fake-purchase-campaign-design.md` (§3-2 ~ §3-7, §4-5, §5, §7)

**Predecessor:** `docs/superpowers/plans/2026-07-03-fake-purchase-plan-a-schema.md` (완료됨 — 스키마/rename 반영됨, dev DB 마이그레이션 배포됨)

---

## 실행 규칙

- 커밋 메시지는 **한글** (CLAUDE.md)
- `git add -A` 금지 — 항상 파일 명시 add
- 각 Task 종료 시 `pnpm --filter @jsure/api exec tsc --noEmit` 통과 및 관련 jest 통과 후 커밋
- Task 간 의존성 있음 (특히 shared 스키마 → api 서비스). 순서대로 진행
- 신규 코드에서 약어 금지 (`a`, `e`, `req`, `mut`). `application`, `event`, `request`, `mutation` 등 풀어서
- 신규 필드/식별자에 `blacklist` 같은 차별 함의 단어 금지

## 사전 확인

- [ ] **Step 1: 현재 브랜치와 baseline 확인**

```bash
git branch --show-current
pnpm typecheck
pnpm --filter @jsure/api exec jest --listTests | wc -l
```

Expected: 브랜치 `feat/fake-purchase-schema`. typecheck 통과. 기존 jest 상태 기억.

---

## Task 1: shared — 업로드 스키마 정리 및 통합 presign 요청/응답 추가

**Files:**
- Modify: `packages/shared/src/types/uploads.ts`
- Modify: `packages/shared/src/index.ts` (필요 시 재-export 확인)

- [ ] **Step 1: `SubmittedPostAttachmentSchema` → `AttachmentSchema` 로 rename**

`packages/shared/src/types/uploads.ts` 의 `SubmittedPostAttachmentSchema` 블록을 다음으로 교체:

```ts
export const AttachmentKindSchema = z.enum([
  "INSIGHT_SCREENSHOT",
  "ORDER_RECEIPT",
  "REVIEW_SCREENSHOT",
]);
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;

export const AttachmentSchema = z.object({
  id: z.string(),
  kind: AttachmentKindSchema,
  objectKey: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.string().datetime(),
  viewUrl: z.string().url().nullable(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const AttachmentListResponseSchema = z.object({
  attachments: z.array(AttachmentSchema),
});
export type AttachmentListResponse = z.infer<typeof AttachmentListResponseSchema>;
```

`SubmittedPostAttachmentSchema`, `SubmittedPostAttachmentListResponseSchema`, 그 타입 export 는 제거.

- [ ] **Step 2: 통합 presign 요청/응답 스키마 추가**

같은 파일 끝에 추가:

```ts
/**
 * 인플루언서 첨부(가구매 주문 명세서/리뷰 스크린샷/SNS 인사이트) 통합 presign.
 * kind 에 따라 objectKey prefix 를 결정하고, 서버는 applicationId 소유권 및
 * kind–카테고리 매칭을 검증한다.
 */
export const InfluencerAttachmentPresignRequestSchema = z.object({
  applicationId: z.string().min(1),
  kind: AttachmentKindSchema,
  contentType: UploadContentTypeSchema,
  sizeBytes: z.number().int().positive().max(UPLOAD_MAX_BYTES),
});
export type InfluencerAttachmentPresignRequest = z.infer<
  typeof InfluencerAttachmentPresignRequestSchema
>;

export const InfluencerAttachmentPresignResponseSchema = z.object({
  objectKey: z.string(),
  uploadUrl: z.string().url(),
  expiresInSec: z.number().int().positive(),
});
export type InfluencerAttachmentPresignResponse = z.infer<
  typeof InfluencerAttachmentPresignResponseSchema
>;
```

- [ ] **Step 3: `InsightUploadPresignRequestSchema.subType` 를 공통 enum 참조로 정리 (Plan A 유산)**

같은 파일에서 `InsightUploadPresignRequestSchema.subType` 하드코딩 `z.enum([...])` 를 다음으로 교체 — 상단에서 `import { EnabledSnsTypeSchema } from "./influencer.js";` 추가 후:

```ts
export const InsightUploadPresignRequestSchema = z.object({
  applicationId: z.string().min(1),
  subType: EnabledSnsTypeSchema,
  contentType: UploadContentTypeSchema,
  sizeBytes: z.number().int().positive().max(UPLOAD_MAX_BYTES),
});
```

- [ ] **Step 4: `packages/shared/src/index.ts` 재-export 정리**

`SubmittedPostAttachment*` export 제거, `Attachment*` / `AttachmentKind*` / `InfluencerAttachmentPresign*` export 추가. 파일 열어 기존 export 라인 정확한 위치 확인 후 편집.

- [ ] **Step 5: 빌드**

```bash
pnpm --filter @jsure/shared build
```

Expected: 통과.

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/types/uploads.ts packages/shared/src/index.ts
git commit -m "feat(shared): Attachment 통합 스키마 및 인플루언서 통합 presign 요청/응답 추가"
```

---

## Task 2: shared — submitOrder / submitReview 요청 스키마

**Files:**
- Modify: `packages/shared/src/types/application.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: `ApplicationDisplayStageSchema` 에 가구매 stage 4개 추가**

`packages/shared/src/types/application.ts` 의 `ApplicationDisplayStageSchema` 값 배열에 다음을 추가 (기존 값 뒤):

```ts
export const ApplicationDisplayStageSchema = z.enum([
  "APPLIED",
  "APPROVED",
  "SHIPPED",
  "AWAITING_RECEIPT",
  "POSTING",
  "POSTED",
  "POST_REJECTED",
  "INSIGHT_DUE",
  "REVIEWING",
  "COMPLETED",
  "SETTLED",
  "REJECTED",
  "CANCELLED",
  "AWAITING_ORDER",
  "AWAITING_REVIEW",
  "REVIEW_PENDING",
  "REVIEW_REJECTED",
]);
```

- [ ] **Step 2: 요청 스키마 정의**

같은 파일에 첨부 입력 재사용용 alias + submitOrder / submitReview 요청 스키마 추가. 기존 `SubmitInsightRequestSchema` 아래에 배치:

```ts
export const AttachmentUploadInputSchema = z.object({
  objectKey: z.string().min(1),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sizeBytes: z.number().int().positive(),
});
export type AttachmentUploadInput = z.infer<typeof AttachmentUploadInputSchema>;

export const SubmitOrderRequestSchema = z.object({
  orderNumber: z.string().min(1, "注文番号を入力してください").max(200),
  receipts: z
    .array(AttachmentUploadInputSchema)
    .min(1, "注文明細のスクリーンショットを1枚以上ご提出ください")
    .max(10),
});
export type SubmitOrderRequest = z.infer<typeof SubmitOrderRequestSchema>;

export const SubmitReviewRequestSchema = z.object({
  reviewUrl: z.string().url("有効なURLを入力してください"),
  screenshots: z
    .array(AttachmentUploadInputSchema)
    .min(2, "レビューのスクリーンショットを2枚以上ご提出ください")
    .max(10),
});
export type SubmitReviewRequest = z.infer<typeof SubmitReviewRequestSchema>;
```

- [ ] **Step 3: `packages/shared/src/index.ts` 에 신규 export 추가**

`SubmitOrderRequestSchema`, `SubmitOrderRequest`, `SubmitReviewRequestSchema`, `SubmitReviewRequest`, `AttachmentUploadInputSchema`, `AttachmentUploadInput` 재-export.

- [ ] **Step 4: 빌드 및 커밋**

```bash
pnpm --filter @jsure/shared build
git add packages/shared/src/types/application.ts packages/shared/src/index.ts
git commit -m "feat(shared): 가구매 submitOrder/submitReview 요청 스키마 및 display stage 확장"
```

---

## Task 3: display-stage — 가구매 케이스 spec 작성 (RED)

**Files:**
- Modify: `apps/api/src/influencer-campaigns/display-stage.spec.ts`

- [ ] **Step 1: 기존 spec 파일에 가구매 describe 블록 추가**

파일 하단에 다음 블록 추가:

```ts
describe("deriveDisplayStage — 가구매 카테고리", () => {
  const base = { receivedAt: null, posts: [] as never[] };

  it("APPROVED → AWAITING_ORDER (가구매 flag 는 status 만으로는 결정 불가하므로 카테고리 파라미터로 분기)", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "APPROVED",
        category: "FAKE_PURCHASE",
      }),
    ).toBe("AWAITING_ORDER");
  });

  it("ORDER_SUBMITTED → AWAITING_REVIEW", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "ORDER_SUBMITTED",
        category: "FAKE_PURCHASE",
      }),
    ).toBe("AWAITING_REVIEW");
  });

  it("REVIEW_SUBMITTED + post PENDING → REVIEW_PENDING", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          {
            submittedAt: new Date(),
            insightSubmittedAt: null,
            reviewStatus: "PENDING",
          },
        ],
      }),
    ).toBe("REVIEW_PENDING");
  });

  it("REVIEW_SUBMITTED + post REJECTED → REVIEW_REJECTED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          {
            submittedAt: new Date(),
            insightSubmittedAt: null,
            reviewStatus: "REJECTED",
          },
        ],
      }),
    ).toBe("REVIEW_REJECTED");
  });

  it("REVIEW_SUBMITTED + post APPROVED + settlement PENDING → REVIEWING", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          {
            submittedAt: new Date(),
            insightSubmittedAt: null,
            reviewStatus: "APPROVED",
            settlementStatus: "PENDING",
          },
        ],
      }),
    ).toBe("REVIEWING");
  });

  it("REVIEW_SUBMITTED + post APPROVED + settlement COMPLETED → SETTLED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          {
            submittedAt: new Date(),
            insightSubmittedAt: null,
            reviewStatus: "APPROVED",
            settlementStatus: "COMPLETED",
          },
        ],
      }),
    ).toBe("SETTLED");
  });

  it("COMPLETED (settlement COMPLETED) → SETTLED", () => {
    expect(
      deriveDisplayStage({
        status: "COMPLETED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          {
            submittedAt: new Date(),
            insightSubmittedAt: null,
            reviewStatus: "APPROVED",
            settlementStatus: "COMPLETED",
          },
        ],
      }),
    ).toBe("SETTLED");
  });
});
```

- [ ] **Step 2: SNS 기존 케이스에 `category: "SNS"` 파라미터 추가**

파일 상단의 기존 describe 블록의 각 `deriveDisplayStage({...})` 호출에도 `category: "SNS"` 를 추가한다 (파라미터 타입 필수화 대응). grep 으로 파일 내 모든 호출부 확인 후 일괄 추가.

- [ ] **Step 3: 스펙 실패 확인**

```bash
pnpm --filter @jsure/api exec jest src/influencer-campaigns/display-stage.spec.ts
```

Expected: RED — `category` 프로퍼티 타입 에러 또는 새 케이스 미구현으로 fail.

---

## Task 4: display-stage — 구현 (GREEN)

**Files:**
- Modify: `apps/api/src/influencer-campaigns/display-stage.ts`
- Modify: `apps/api/src/influencer-campaigns/influencer-campaigns.service.ts` (호출부 category 전달)

- [ ] **Step 1: `DisplayStageInput` 확장 및 가구매 분기 추가**

`apps/api/src/influencer-campaigns/display-stage.ts` 를 다음과 같이 편집:

```ts
import type {
  ApplicationDisplayStage,
  ApplicationStatus,
  CampaignCategory,
} from "@jsure/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const INSIGHT_DUE_DAYS = 0;

function startOfJstDay(d: Date): number {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const shifted = d.getTime() + jstOffsetMs;
  const dayStartUtcShifted = shifted - (shifted % DAY_MS);
  return dayStartUtcShifted - jstOffsetMs;
}

interface DisplayStageInput {
  status: ApplicationStatus;
  category: CampaignCategory;
  receivedAt: Date | null;
  posts: {
    submittedAt: Date;
    insightSubmittedAt: Date | null;
    reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
    settlementStatus?: "PENDING" | "COMPLETED" | null;
    insightRequired?: boolean;
  }[];
  now?: Date;
}

export function deriveDisplayStage(input: DisplayStageInput): ApplicationDisplayStage {
  if (input.category === "FAKE_PURCHASE") {
    return deriveFakePurchaseStage(input);
  }
  return deriveSnsStage(input);
}

function deriveFakePurchaseStage(input: DisplayStageInput): ApplicationDisplayStage {
  const { status, posts } = input;
  if (status === "APPLIED") return "APPLIED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "APPROVED") return "AWAITING_ORDER";
  if (status === "ORDER_SUBMITTED") return "AWAITING_REVIEW";
  if (status === "REVIEW_SUBMITTED") {
    const post = posts[0];
    if (!post) return "AWAITING_REVIEW";
    if (post.reviewStatus === "REJECTED") return "REVIEW_REJECTED";
    if (post.reviewStatus === "PENDING") return "REVIEW_PENDING";
    // APPROVED
    if (post.settlementStatus === "COMPLETED") return "SETTLED";
    return "REVIEWING";
  }
  if (status === "COMPLETED") {
    const anySettled = posts.some((p) => p.settlementStatus === "COMPLETED");
    return anySettled ? "SETTLED" : "COMPLETED";
  }
  return "APPLIED";
}

function deriveSnsStage(input: DisplayStageInput): ApplicationDisplayStage {
  // 기존 로직을 그대로 이 함수 내부로 이동
  const { status, receivedAt, posts } = input;
  const now = input.now ?? new Date();

  if (status === "APPLIED") return "APPLIED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") {
    const anySettled = posts.some((p) => p.settlementStatus === "COMPLETED");
    return anySettled ? "SETTLED" : "COMPLETED";
  }

  if (status === "SHIPPED" || status === "DELIVERED") {
    if (posts.some((p) => p.settlementStatus === "COMPLETED")) return "SETTLED";
    if (!receivedAt) return "AWAITING_RECEIPT";
    if (posts.length === 0) return "POSTING";
    if (posts.some((p) => p.reviewStatus === "REJECTED")) return "POST_REJECTED";

    const allInsightsSatisfied = posts.every(
      (p) => p.insightRequired === false || p.insightSubmittedAt !== null,
    );
    if (allInsightsSatisfied) {
      const anySettled = posts.some((p) => p.settlementStatus === "COMPLETED");
      return anySettled ? "SETTLED" : "REVIEWING";
    }

    const first = posts[0]!.submittedAt;
    const earliest = posts.reduce(
      (acc, p) => (p.submittedAt < acc ? p.submittedAt : acc),
      first,
    );
    const daysPassed = Math.round(
      (startOfJstDay(now) - startOfJstDay(earliest)) / DAY_MS,
    );
    return daysPassed >= INSIGHT_DUE_DAYS ? "INSIGHT_DUE" : "POSTED";
  }
  return "APPLIED";
}

export function postingDeadline(
  anchor: Date | null,
  postingPeriodDays: number,
): Date | null {
  if (!anchor) return null;
  return new Date(anchor.getTime() + postingPeriodDays * DAY_MS);
}
```

- [ ] **Step 2: 호출부에 `category` 전달**

`apps/api/src/influencer-campaigns/influencer-campaigns.service.ts` 와 `apps/api/src/influencer-applications/influencer-applications.service.ts` 에서 `deriveDisplayStage(...)` 호출부를 grep 후 `category: campaign.category` 추가.

```bash
grep -rn "deriveDisplayStage(" apps/api/src
```

각 호출부에서 include/select 에 `campaign.category` 포함 여부 확인 후 없으면 추가.

또한 `postingDeadline` 계산 시 카테고리 분기 필요:
- SNS: `postingDeadline(app.receivedAt, campaign.postingPeriodDays)`
- FAKE_PURCHASE: `postingDeadline(app.orderSubmittedAt, campaign.postingPeriodDays)`

호출부에서 카테고리에 따라 anchor 를 결정하여 전달.

- [ ] **Step 3: 테스트 GREEN 확인**

```bash
pnpm --filter @jsure/api exec jest src/influencer-campaigns/display-stage.spec.ts
pnpm --filter @jsure/api exec tsc --noEmit
```

Expected: 모두 통과.

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/influencer-campaigns/display-stage.ts apps/api/src/influencer-campaigns/display-stage.spec.ts apps/api/src/influencer-campaigns/influencer-campaigns.service.ts apps/api/src/influencer-applications/influencer-applications.service.ts
git commit -m "feat(api): deriveDisplayStage 가구매 카테고리 분기 및 postingDeadline anchor 확장"
```

---

## Task 5: ensureSettlementForPost — 가구매 분기 (TDD)

**Files:**
- Create: `apps/api/src/settlements/ensure-settlement.spec.ts`
- Modify: `apps/api/src/settlements/ensure-settlement.ts`

- [ ] **Step 1: Spec 작성 (RED)**

`apps/api/src/settlements/ensure-settlement.spec.ts` 신규 파일:

```ts
import { ensureSettlementForPost } from "./ensure-settlement";

type PostSelect = {
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  insightSubmittedAt: Date | null;
  subType: string;
  applicationId: string;
  application: {
    campaignId: string;
    campaign: {
      category: "SNS" | "FAKE_PURCHASE";
      rewardJpy: number;
      recruits: { subType: string; insightRequired: boolean; productPriceJpy: number | null }[];
    };
  };
};

function makeStubPrisma(post: PostSelect | null) {
  const upserts: unknown[] = [];
  const prisma = {
    submittedPost: { findUnique: async () => post },
    settlement: {
      upsert: async (args: unknown) => {
        upserts.push(args);
        return null;
      },
    },
  } as never;
  return { prisma, upserts };
}

describe("ensureSettlementForPost — FAKE_PURCHASE", () => {
  it("승인된 가구매 리뷰: reward + productPriceJpy 합계로 settlement upsert", async () => {
    const { prisma, upserts } = makeStubPrisma({
      reviewStatus: "APPROVED",
      insightSubmittedAt: null,
      subType: "QOO10",
      applicationId: "app-1",
      application: {
        campaignId: "c-1",
        campaign: {
          category: "FAKE_PURCHASE",
          rewardJpy: 5000,
          recruits: [
            { subType: "QOO10", insightRequired: false, productPriceJpy: 3000 },
          ],
        },
      },
    });
    await ensureSettlementForPost(prisma, "post-1");
    expect(upserts).toHaveLength(1);
    const args = upserts[0] as { create: { amountJpy: number; rewardAmountJpy: number; productRefundJpy: number } };
    expect(args.create.amountJpy).toBe(8000);
    expect(args.create.rewardAmountJpy).toBe(5000);
    expect(args.create.productRefundJpy).toBe(3000);
  });

  it("가구매 리뷰가 아직 PENDING 이면 settlement 미생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      reviewStatus: "PENDING",
      insightSubmittedAt: null,
      subType: "QOO10",
      applicationId: "app-1",
      application: {
        campaignId: "c-1",
        campaign: {
          category: "FAKE_PURCHASE",
          rewardJpy: 5000,
          recruits: [
            { subType: "QOO10", insightRequired: false, productPriceJpy: 3000 },
          ],
        },
      },
    });
    await ensureSettlementForPost(prisma, "post-1");
    expect(upserts).toHaveLength(0);
  });
});

describe("ensureSettlementForPost — SNS (기존 동작 유지)", () => {
  it("insightRequired=true 이고 인사이트 미제출이면 미생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      reviewStatus: "APPROVED",
      insightSubmittedAt: null,
      subType: "INSTAGRAM",
      applicationId: "app-1",
      application: {
        campaignId: "c-1",
        campaign: {
          category: "SNS",
          rewardJpy: 5000,
          recruits: [
            { subType: "INSTAGRAM", insightRequired: true, productPriceJpy: null },
          ],
        },
      },
    });
    await ensureSettlementForPost(prisma, "post-1");
    expect(upserts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 구현 편집**

`apps/api/src/settlements/ensure-settlement.ts` 전체 교체:

```ts
import type { PrismaService } from "../prisma/prisma.service";

/**
 * SubmittedPost 가 승인(APPROVED) 되고 정산 가능 상태가 되면 Settlement(PENDING)
 * 를 멱등하게 생성한다.
 *
 * 카테고리별 조건:
 * - SNS: insightRequired=true 이면 승인 + 인사이트 제출 둘 다 필요. false 면 승인만.
 *        정산액 = campaign.rewardJpy (productRefundJpy=0)
 * - FAKE_PURCHASE: 승인만 되면 즉시 생성.
 *        정산액 = campaign.rewardJpy + recruit.productPriceJpy
 */
export async function ensureSettlementForPost(
  prisma: PrismaService,
  postId: string,
): Promise<void> {
  const post = await prisma.submittedPost.findUnique({
    where: { id: postId },
    select: {
      reviewStatus: true,
      insightSubmittedAt: true,
      subType: true,
      applicationId: true,
      application: {
        select: {
          campaignId: true,
          campaign: {
            select: {
              category: true,
              rewardJpy: true,
              recruits: {
                select: {
                  subType: true,
                  insightRequired: true,
                  productPriceJpy: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!post) return;
  if (post.reviewStatus !== "APPROVED") return;

  const category = post.application.campaign.category;
  const recruit = post.application.campaign.recruits.find(
    (r) => r.subType === post.subType,
  );

  if (category === "FAKE_PURCHASE") {
    const productRefundJpy = recruit?.productPriceJpy ?? 0;
    const rewardAmountJpy = post.application.campaign.rewardJpy;
    const amountJpy = rewardAmountJpy + productRefundJpy;
    await prisma.settlement.upsert({
      where: { postId },
      create: {
        postId,
        amountJpy,
        rewardAmountJpy,
        productRefundJpy,
        status: "PENDING",
      },
      update: {},
    });
    return;
  }

  // SNS
  const insightRequired = recruit?.insightRequired ?? true;
  if (insightRequired && post.insightSubmittedAt === null) return;
  const rewardAmountJpy = post.application.campaign.rewardJpy;
  await prisma.settlement.upsert({
    where: { postId },
    create: {
      postId,
      amountJpy: rewardAmountJpy,
      rewardAmountJpy,
      productRefundJpy: 0,
      status: "PENDING",
    },
    update: {},
  });
}
```

- [ ] **Step 3: 테스트 및 커밋**

```bash
pnpm --filter @jsure/api exec jest src/settlements
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/settlements/ensure-settlement.ts apps/api/src/settlements/ensure-settlement.spec.ts
git commit -m "feat(api): ensureSettlementForPost 가구매 분기(reward + productRefund) 추가"
```

---

## Task 6: InfluencerApplicationsService.submitOrder (TDD)

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts`
- Create: `apps/api/src/influencer-applications/influencer-applications.service.spec.ts` (또는 기존 spec 파일 재사용)

- [ ] **Step 1: 서비스 spec 파일 확인/신규 생성**

기존 파일 여부 확인:

```bash
ls apps/api/src/influencer-applications/*.spec.ts 2>/dev/null || echo "none"
```

없으면 새 파일 `influencer-applications.service.spec.ts` 신규 생성. Prisma / LineDispatcherService / UploadsService 는 mock (jest.fn) 로 스텁.

기본 shell:

```ts
import { InfluencerApplicationsService } from "./influencer-applications.service";

function makeService(overrides?: Partial<{ prisma: unknown; uploads: unknown; dispatcher: unknown; r2: unknown }>) {
  const prisma = overrides?.prisma ?? {};
  const uploads = overrides?.uploads ?? {};
  const dispatcher = overrides?.dispatcher ?? { dispatch: jest.fn() };
  const r2 = overrides?.r2 ?? {};
  return new InfluencerApplicationsService(
    prisma as never,
    uploads as never,
    dispatcher as never,
    r2 as never,
  );
}
```

(생성자 시그니처는 실제 서비스와 맞춰 조정)

- [ ] **Step 2: submitOrder spec 작성 (RED)**

```ts
describe("submitOrder", () => {
  it("SNS 카테고리 응모는 400 반환", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "APPROVED",
          subType: "INSTAGRAM",
          campaign: { category: "SNS" },
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitOrder("inf-1", "app-1", "ORDER-1", [
        { objectKey: "attachments/app-1/ORDER_RECEIPT/x.png", contentType: "image/png", sizeBytes: 100 },
      ]),
    ).rejects.toThrow(/CATEGORY_MISMATCH|가구매/);
  });

  it("APPROVED → ORDER_SUBMITTED 성공: attachments 생성, dispatch 호출", async () => {
    const dispatch = jest.fn();
    const createMany = jest.fn(async () => ({ count: 1 }));
    const deleteMany = jest.fn(async () => ({ count: 0 }));
    const update = jest.fn(async () => ({
      id: "app-1",
      status: "ORDER_SUBMITTED",
      orderNumber: "ORDER-1",
    }));
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "APPROVED",
          subType: "QOO10",
          campaign: { category: "FAKE_PURCHASE" },
        })),
        update,
      },
      attachment: { createMany, deleteMany },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
    };
    const svc = makeService({ prisma, dispatcher: { dispatch } });
    // getForInfluencer 호출 부분은 stub 필요 (findUnique 재사용)
    // ... 실제 구현시 추가 stub
    // await svc.submitOrder(...)
    // expect(update).toHaveBeenCalledWith(objectContaining({ data: objectContaining({ status: "ORDER_SUBMITTED", orderNumber: "ORDER-1" }) }));
    // expect(createMany).toHaveBeenCalled();
    // expect(dispatch).toHaveBeenCalledWith("FAKE_PURCHASE_ORDER_SUBMITTED", expect.any(Object));
  });

  it("ORDER_SUBMITTED 재제출: 기존 첨부 삭제 후 재생성", async () => {
    // deleteMany 가 kind=ORDER_RECEIPT 로 호출됨을 검증
  });

  it("REVIEW_SUBMITTED 이후 상태에서는 400", async () => {
    // ...
  });

  it("receipts 배열이 비어있으면 400", async () => {
    // Zod 검증은 controller 에서, 서비스는 신뢰 가정. 배열 길이 방어 검증 케이스 별도.
  });
});
```

**주의**: getForInfluencer 등 응답 재조회 로직이 있으므로 mock 이 복잡할 수 있음. 필요 시 실제 로직에 맞춰 stub 확장. 이 spec 은 unit 성격이며 integration 케이스는 Task 18 e2e 에서 다룸.

- [ ] **Step 3: `submitOrder` 구현**

`influencer-applications.service.ts` 파일 하단 (assertOwned 위) 에 다음 메서드 추가:

```ts
async submitOrder(
  influencerId: string,
  applicationId: string,
  orderNumber: string,
  receipts: {
    objectKey: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    sizeBytes: number;
  }[],
): Promise<InfluencerApplication> {
  const application = await this.prisma.campaignApplication.findUnique({
    where: { id: applicationId },
    include: { campaign: { select: { category: true } } },
  });
  if (!application) throw new NotFoundException("Application not found");
  if (application.influencerId !== influencerId) throw new ForbiddenException();
  if (application.campaign.category !== "FAKE_PURCHASE") {
    throw new BadRequestException({
      code: "CATEGORY_MISMATCH",
      message: "買取レビューキャンペーンのみ対応しています",
    });
  }
  if (application.status !== "APPROVED" && application.status !== "ORDER_SUBMITTED") {
    throw new BadRequestException({
      code: "INVALID_TRANSITION",
      message: "この状態では注文情報を提出できません",
    });
  }
  const trimmedOrderNumber = orderNumber.trim();
  if (trimmedOrderNumber.length === 0) {
    throw new BadRequestException({
      code: "ORDER_NUMBER_REQUIRED",
      message: "注文番号を入力してください",
    });
  }
  if (receipts.length < 1) {
    throw new BadRequestException({
      code: "RECEIPT_REQUIRED",
      message: "注文明細のスクリーンショットを1枚以上ご提出ください",
    });
  }

  // R2 HEAD 로 업로드 검증 (uploads.service 재사용)
  await this.uploads.verifyAttachmentUploads(receipts, "attachments/");

  const now = new Date();
  await this.prisma.$transaction(async (tx) => {
    await tx.attachment.deleteMany({
      where: { applicationId, kind: "ORDER_RECEIPT" },
    });
    await tx.attachment.createMany({
      data: receipts.map((receipt) => ({
        kind: "ORDER_RECEIPT" as const,
        applicationId,
        postId: null,
        objectKey: receipt.objectKey,
        contentType: receipt.contentType,
        sizeBytes: receipt.sizeBytes,
      })),
      skipDuplicates: true,
    });
    await tx.campaignApplication.update({
      where: { id: applicationId },
      data: {
        orderNumber: trimmedOrderNumber,
        orderSubmittedAt: now,
        status: "ORDER_SUBMITTED",
      },
    });
  });

  const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: DISPATCH_APPLICATION_INCLUDE,
  });
  void this.dispatcher.dispatch("FAKE_PURCHASE_ORDER_SUBMITTED", {
    application: refreshed,
  });
  return this.getForInfluencer(influencerId, applicationId);
}
```

- [ ] **Step 4: `UploadsService.verifyAttachmentUploads` 헬퍼 추가**

`apps/api/src/uploads/uploads.service.ts` 에 다음 메서드 추가:

```ts
/**
 * 인플루언서 첨부 업로드 검증 — R2 HEAD 로 실제 업로드 여부 및 크기 확인.
 * objectKey 는 지정된 prefix 로 시작해야 한다.
 */
async verifyAttachmentUploads(
  attachments: { objectKey: string; sizeBytes: number }[],
  requiredPrefix: string,
): Promise<void> {
  for (const attachment of attachments) {
    if (!attachment.objectKey.startsWith(requiredPrefix)) {
      throw new BadRequestException("잘못된 객체 경로입니다");
    }
    const head = await this.r2.headObject(attachment.objectKey).catch(() => null);
    if (!head) {
      throw new BadRequestException(
        `업로드 객체를 찾을 수 없습니다: ${attachment.objectKey}`,
      );
    }
    if (head.contentLength !== null && head.contentLength > UPLOAD_MAX_BYTES) {
      throw new BadRequestException("파일 크기 한도를 초과했습니다");
    }
  }
}
```

- [ ] **Step 5: 테스트 GREEN 확인 및 커밋**

```bash
pnpm --filter @jsure/api exec jest src/influencer-applications
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/influencer-applications/influencer-applications.service.ts apps/api/src/influencer-applications/influencer-applications.service.spec.ts apps/api/src/uploads/uploads.service.ts
git commit -m "feat(api): 가구매 submitOrder 서비스 (재제출 지원, 첨부 검증)"
```

---

## Task 7: submitOrder 컨트롤러 엔드포인트

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.controller.ts`

- [ ] **Step 1: 엔드포인트 추가**

`influencer-applications.controller.ts` 에 import 추가:

```ts
import {
  SubmitOrderRequestSchema,
  type SubmitOrderRequest,
} from "@jsure/shared";
```

컨트롤러 클래스 내부에 추가:

```ts
@Post(":id/order")
@HttpCode(200)
submitOrder(
  @Request() req: { user: AuthenticatedInfluencer },
  @Param("id") id: string,
  @Body(new ZodValidationPipe(SubmitOrderRequestSchema))
  dto: SubmitOrderRequest,
) {
  return this.svc.submitOrder(req.user.id, id, dto.orderNumber, dto.receipts);
}
```

- [ ] **Step 2: typecheck 및 커밋**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/influencer-applications/influencer-applications.controller.ts
git commit -m "feat(api): POST /influencer/applications/:id/order 엔드포인트 추가"
```

---

## Task 8: InfluencerApplicationsService.submitReview (TDD)

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts`
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.spec.ts`

- [ ] **Step 1: submitReview spec 추가 (RED)**

Task 6 의 spec 파일에 describe 블록 추가:

```ts
describe("submitReview", () => {
  it("ORDER_SUBMITTED → REVIEW_SUBMITTED 첫 제출: SubmittedPost + REVIEW_SCREENSHOT 첨부 생성", async () => {
    // ...
  });

  it("REVIEW_SUBMITTED + post REJECTED 재제출: 기존 첨부 삭제 + post update", async () => {
    // ...
  });

  it("REVIEW_SUBMITTED + post PENDING 재제출 시도는 400", async () => {
    // ...
  });

  it("SNS 카테고리는 400 (CATEGORY_MISMATCH)", async () => {
    // ...
  });

  it("screenshots 2장 미만은 400 (서비스 방어)", async () => {
    // ...
  });
});
```

- [ ] **Step 2: `submitReview` 구현**

`influencer-applications.service.ts` submitOrder 아래에 추가:

```ts
async submitReview(
  influencerId: string,
  applicationId: string,
  reviewUrl: string,
  screenshots: {
    objectKey: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    sizeBytes: number;
  }[],
): Promise<InfluencerApplication> {
  const application = await this.prisma.campaignApplication.findUnique({
    where: { id: applicationId },
    include: {
      campaign: { select: { category: true } },
      posts: {
        select: { id: true, reviewStatus: true },
      },
    },
  });
  if (!application) throw new NotFoundException("Application not found");
  if (application.influencerId !== influencerId) throw new ForbiddenException();
  if (application.campaign.category !== "FAKE_PURCHASE") {
    throw new BadRequestException({
      code: "CATEGORY_MISMATCH",
      message: "買取レビューキャンペーンのみ対応しています",
    });
  }

  const existingPost = application.posts[0] ?? null;
  const isResubmission =
    application.status === "REVIEW_SUBMITTED" && existingPost?.reviewStatus === "REJECTED";
  const isFirstSubmission = application.status === "ORDER_SUBMITTED";

  if (!isFirstSubmission && !isResubmission) {
    throw new BadRequestException({
      code: "INVALID_TRANSITION",
      message: "この状態ではレビューを提出できません",
    });
  }

  const trimmedUrl = reviewUrl.trim();
  if (trimmedUrl.length === 0) {
    throw new BadRequestException({
      code: "REVIEW_URL_REQUIRED",
      message: "レビューURLを入力してください",
    });
  }
  if (screenshots.length < 2) {
    throw new BadRequestException({
      code: "REVIEW_SCREENSHOTS_REQUIRED",
      message: "レビューのスクリーンショットを2枚以上ご提出ください",
    });
  }

  await this.uploads.verifyAttachmentUploads(screenshots, "attachments/");

  const now = new Date();
  const subType = application.subType;

  const postId = await this.prisma.$transaction(async (tx) => {
    let currentPostId: string;
    if (existingPost) {
      await tx.submittedPost.update({
        where: { id: existingPost.id },
        data: {
          url: trimmedUrl,
          submittedAt: now,
          reviewStatus: "PENDING",
          reviewedAt: null,
          reviewedById: null,
        },
      });
      await tx.attachment.deleteMany({
        where: { postId: existingPost.id, kind: "REVIEW_SCREENSHOT" },
      });
      currentPostId = existingPost.id;
    } else {
      const created = await tx.submittedPost.create({
        data: {
          applicationId,
          subType,
          url: trimmedUrl,
          submittedAt: now,
          reviewStatus: "PENDING",
        },
      });
      currentPostId = created.id;
    }
    await tx.attachment.createMany({
      data: screenshots.map((screenshot) => ({
        kind: "REVIEW_SCREENSHOT" as const,
        applicationId,
        postId: currentPostId,
        objectKey: screenshot.objectKey,
        contentType: screenshot.contentType,
        sizeBytes: screenshot.sizeBytes,
      })),
      skipDuplicates: true,
    });
    await tx.campaignApplication.update({
      where: { id: applicationId },
      data: {
        reviewSubmittedAt: now,
        status: "REVIEW_SUBMITTED",
      },
    });
    return currentPostId;
  });

  const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: DISPATCH_APPLICATION_INCLUDE,
  });
  const post = await this.prisma.submittedPost.findUnique({
    where: { id: postId },
  });
  void this.dispatcher.dispatch("FAKE_PURCHASE_REVIEW_SUBMITTED", {
    application: refreshed,
    post,
  });
  return this.getForInfluencer(influencerId, applicationId);
}
```

- [ ] **Step 3: 테스트 및 커밋**

```bash
pnpm --filter @jsure/api exec jest src/influencer-applications
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/influencer-applications/influencer-applications.service.ts apps/api/src/influencer-applications/influencer-applications.service.spec.ts
git commit -m "feat(api): 가구매 submitReview 서비스 (첫 제출 + 반려 후 재제출)"
```

---

## Task 9: submitReview 컨트롤러 엔드포인트

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.controller.ts`

- [ ] **Step 1: 엔드포인트 추가**

```ts
import {
  SubmitReviewRequestSchema,
  type SubmitReviewRequest,
} from "@jsure/shared";
```

컨트롤러 내부:

```ts
@Post(":id/review")
@HttpCode(200)
submitReview(
  @Request() req: { user: AuthenticatedInfluencer },
  @Param("id") id: string,
  @Body(new ZodValidationPipe(SubmitReviewRequestSchema))
  dto: SubmitReviewRequest,
) {
  return this.svc.submitReview(req.user.id, id, dto.reviewUrl, dto.screenshots);
}
```

- [ ] **Step 2: typecheck 및 커밋**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/influencer-applications/influencer-applications.controller.ts
git commit -m "feat(api): POST /influencer/applications/:id/review 엔드포인트 추가"
```

---

## Task 10: 기존 인플루언서 액션에 카테고리 가드 추가

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts`

- [ ] **Step 1: `confirmReceipt` / `upsertPost` / `upsertInsight` 에 SNS-only 가드**

각 메서드 진입부에서 assertOwned 대신 application + campaign.category 조회 후 검증:

```ts
async confirmReceipt(influencerId: string, applicationId: string): Promise<InfluencerApplication> {
  const application = await this.assertOwnedWithCampaign(influencerId, applicationId);
  if (application.campaign.category !== "SNS") {
    throw new BadRequestException({
      code: "CATEGORY_MISMATCH",
      message: "SNSキャンペーンのみ対応しています",
    });
  }
  // 기존 검증 유지
  if (application.status !== "SHIPPED" && application.status !== "DELIVERED") { ... }
  // ...
}
```

`upsertPost`, `upsertInsight` 도 같은 방식.

- [ ] **Step 2: `assertOwnedWithCampaign` 헬퍼 추가**

기존 `assertOwned` 아래에:

```ts
private async assertOwnedWithCampaign(influencerId: string, applicationId: string) {
  const application = await this.prisma.campaignApplication.findUnique({
    where: { id: applicationId },
    include: { campaign: { select: { category: true } } },
  });
  if (!application) throw new NotFoundException("Application not found");
  if (application.influencerId !== influencerId) throw new ForbiddenException();
  return application;
}
```

- [ ] **Step 3: 신청 생성(`create`) 시 카테고리 유효성**

`create` 진입부에서 `campaign.category` 를 이미 include 하므로, 서브타입 유효성 검증 추가:

```ts
const SNS_SUB_TYPES: CampaignSubType[] = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"];
const FAKE_PURCHASE_SUB_TYPES: CampaignSubType[] = ["QOO10", "LIPS", "ATCOSME"];

// subTypes 검증
const allowed = campaign.category === "SNS" ? SNS_SUB_TYPES : FAKE_PURCHASE_SUB_TYPES;
const invalidSubTypes = subTypes.filter((s) => !allowed.includes(s));
if (invalidSubTypes.length > 0) {
  throw new BadRequestException({
    code: "SUBTYPE_CATEGORY_MISMATCH",
    message: "選択したSNSはこのキャンペーンで募集していません",
  });
}
```

FAKE_PURCHASE 는 팔로워 검증 스킵 (`if (campaign.category === "SNS") { ... 팔로워 검증 ... }` 로 감싸기).

FAKE_PURCHASE 응모 dispatch: `SNS_APPLICATION_APPLIED` 가 아니라 `FAKE_PURCHASE_APPLICATION_APPLIED`.

```ts
const triggerKey = campaign.category === "FAKE_PURCHASE"
  ? "FAKE_PURCHASE_APPLICATION_APPLIED"
  : "SNS_APPLICATION_APPLIED";
for (const application of createdApplications) {
  void this.dispatcher.dispatch(triggerKey, { application });
}
```

- [ ] **Step 4: typecheck / jest 및 커밋**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
pnpm --filter @jsure/api exec jest src/influencer-applications
git add apps/api/src/influencer-applications/influencer-applications.service.ts
git commit -m "feat(api): 인플루언서 액션 카테고리 가드 및 create 카테고리별 dispatch 분기"
```

---

## Task 11: 관리자 액션 (approve/reject/undo/ship/deliver) 카테고리 분기

**Files:**
- Modify: `apps/api/src/admin-applications/admin-applications.service.ts`

- [ ] **Step 1: `approve` — 카테고리별 dispatch 트리거 분기**

`approve` 메서드에서 `SNS_APPLICATION_APPROVED` 하드코딩을 카테고리 분기로 교체:

```ts
const triggerKey = existing.campaign.category === "FAKE_PURCHASE"
  ? "FAKE_PURCHASE_APPLICATION_APPROVED"
  : "SNS_APPLICATION_APPROVED";
void this.dispatcher.dispatch(triggerKey, { application: existing });
```

`existing` 조회 시 campaign.category 를 include 하도록 select 확장.

- [ ] **Step 2: `reject` — 동일 분기**

```ts
const triggerKey = existing.campaign.category === "FAKE_PURCHASE"
  ? "FAKE_PURCHASE_APPLICATION_REJECTED"
  : "SNS_APPLICATION_REJECTED";
```

- [ ] **Step 3: `ship` / `deliver` — SNS-only 가드**

각 메서드 진입부에서:

```ts
if (existing.campaign.category !== "SNS") {
  throw new BadRequestException("買取レビューキャンペーンでは発送/配達操作は使用できません");
}
```

- [ ] **Step 4: `approveSubmittedPost` — 카테고리별 dispatch + settlement**

기존은 SNS 만 존재했으나 스펙상 dispatch 를 추가로 보낸다. `existing` 조회에 `application.campaign.category` include 후:

```ts
await ensureSettlementForPost(this.prisma, postId);
// 리뷰 승인 알림 (양 카테고리 공통)
const refreshed = await this.prisma.submittedPost.findUnique({
  where: { id: postId },
  include: {
    application: { include: DISPATCH_APPLICATION_INCLUDE },
    settlement: true,
  },
});
if (refreshed) {
  const triggerKey = refreshed.application.campaign.category === "FAKE_PURCHASE"
    ? "FAKE_PURCHASE_REVIEW_APPROVED"
    : "SNS_POST_APPROVED";
  void this.dispatcher.dispatch(triggerKey, {
    application: refreshed.application,
    post: refreshed,
    settlement: refreshed.settlement,
  });
}
```

(SNS_POST_APPROVED 는 seed disabled=false 이므로 실제 발송 없음. 코드 상 통합 처리.)

- [ ] **Step 5: `rejectSubmittedPost` — 카테고리별 dispatch**

```ts
const triggerKey = existing.application.campaign.category === "FAKE_PURCHASE"
  ? "FAKE_PURCHASE_REVIEW_REJECTED"
  : "SNS_POST_REJECTED";
void this.dispatcher.dispatch(triggerKey, {
  application: existing.application,
  rejection: { comment } as never,
  extra: { resubmitDeadlineAt },
});
```

`existing` include 에 `application.campaign.select.category` 추가.

- [ ] **Step 6: `undoSubmittedPostReview` — 카테고리 무관 (그대로 유지)**

특별한 변경 없음. 다만 가구매의 경우 status 를 REVIEW_SUBMITTED 로 유지하면서 post reviewStatus 만 PENDING 으로 되돌린다는 스펙과 일치하는지 확인. 기존 코드가 그렇게 동작하므로 OK.

- [ ] **Step 7: `completeSettlements` — 카테고리별 dispatch**

기존 `SNS_SETTLEMENT_COMPLETED` 발송 지점에서 category 분기:

```ts
const triggerKey = application.campaign.category === "FAKE_PURCHASE"
  ? "FAKE_PURCHASE_SETTLEMENT_COMPLETED"
  : "SNS_SETTLEMENT_COMPLETED";
```

- [ ] **Step 8: typecheck / jest 및 커밋**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
pnpm --filter @jsure/api exec jest src/admin-applications
git add apps/api/src/admin-applications/admin-applications.service.ts
git commit -m "feat(api): 관리자 액션 카테고리 분기 (approve/reject/settle dispatch, ship/deliver SNS-only)"
```

---

## Task 12: 통합 presign 엔드포인트

**Files:**
- Modify: `apps/api/src/uploads/uploads.service.ts`
- Modify: `apps/api/src/uploads/uploads.controller.ts`

- [ ] **Step 1: `UploadsService.presignInfluencerAttachment` 추가**

`uploads.service.ts` 에 import 추가:

```ts
import {
  ...,
  type InfluencerAttachmentPresignRequest,
  type InfluencerAttachmentPresignResponse,
} from "@jsure/shared";
```

메서드 추가:

```ts
async presignInfluencerAttachment(
  influencerId: string,
  body: InfluencerAttachmentPresignRequest,
): Promise<InfluencerAttachmentPresignResponse> {
  if (body.sizeBytes > UPLOAD_MAX_BYTES) {
    throw new BadRequestException("파일 크기 한도를 초과했습니다");
  }
  const application = await this.prisma.campaignApplication.findUnique({
    where: { id: body.applicationId },
    select: {
      influencerId: true,
      campaign: { select: { category: true } },
    },
  });
  if (!application) throw new NotFoundException("Application not found");
  if (application.influencerId !== influencerId) throw new ForbiddenException();

  const category = application.campaign.category;
  if (body.kind === "ORDER_RECEIPT" || body.kind === "REVIEW_SCREENSHOT") {
    if (category !== "FAKE_PURCHASE") {
      throw new BadRequestException("この添付タイプは買取レビューキャンペーンでのみ使用できます");
    }
  }
  if (body.kind === "INSIGHT_SCREENSHOT" && category !== "SNS") {
    throw new BadRequestException("この添付タイプはSNSキャンペーンでのみ使用できます");
  }

  const objectKey =
    `attachments/${body.applicationId}/${body.kind}/` +
    `${randomUUID()}.${extOf(body.contentType)}`;
  const uploadUrl = await this.r2.presignPut(
    {
      objectKey,
      contentType: body.contentType,
      contentLength: body.sizeBytes,
    },
    PRESIGN_EXPIRES_SEC,
  );
  return { objectKey, uploadUrl, expiresInSec: PRESIGN_EXPIRES_SEC };
}
```

- [ ] **Step 2: 컨트롤러 엔드포인트 추가**

`uploads.controller.ts` 편집:

```ts
import {
  InsightUploadPresignRequestSchema,
  InfluencerAttachmentPresignRequestSchema,
  type InsightUploadPresignRequest,
  type InsightUploadPresignResponse,
  type InfluencerAttachmentPresignRequest,
  type InfluencerAttachmentPresignResponse,
} from "@jsure/shared";
```

컨트롤러 내부:

```ts
@Post("influencer/attachment/presign")
presignInfluencerAttachment(
  @Req() req: { user: { id: string } },
  @Body(new ZodValidationPipe(InfluencerAttachmentPresignRequestSchema))
  body: InfluencerAttachmentPresignRequest,
): Promise<InfluencerAttachmentPresignResponse> {
  return this.svc.presignInfluencerAttachment(req.user.id, body);
}
```

**주의**: 기존 `presignInsight` 엔드포인트는 이번 Plan B 에서 제거하지 않고 유지 (Plan C 에서 client-web 이 통합 엔드포인트로 이전한 뒤 제거). 하위 호환 유지가 목표는 아니지만, 다른 pain 없이 병렬 배치.

- [ ] **Step 3: `UploadsService.attachInsightUploads` — objectKey prefix 완화**

`attachInsightUploads` 에서 `insights/` prefix 하드코딩이 있다. 통합 후에는 `attachments/` prefix 도 허용해야 하므로 조건 확장:

```ts
if (
  !attachment.objectKey.startsWith("insights/") &&
  !attachment.objectKey.startsWith("attachments/")
) {
  throw new BadRequestException("잘못된 객체 경로입니다");
}
```

- [ ] **Step 4: typecheck 및 커밋**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
pnpm --filter @jsure/api exec jest src/uploads
git add apps/api/src/uploads/uploads.service.ts apps/api/src/uploads/uploads.controller.ts
git commit -m "feat(api): 인플루언서 통합 presign 엔드포인트 (kind 기반)"
```

---

## Task 13: TRIGGER_META 확장 — 가구매 변수 리졸버

**Files:**
- Modify: `apps/api/src/line-templates/trigger-meta.ts`

- [ ] **Step 1: `DispatchContext` 에 `recruit` 추가**

파일 상단 타입 import 에 `CampaignRecruit` 추가:

```ts
import type {
  CampaignApplication,
  Campaign,
  CampaignRecruit,
  Influencer,
  Settlement,
  SubmittedPost,
  SubmittedPostRejection,
} from "@prisma/client";
```

`DispatchContext` 확장:

```ts
export type DispatchContext = {
  application: ApplicationWithRels;
  post?: SubmittedPost | null;
  rejection?: SubmittedPostRejection | null;
  settlement?: Settlement | null;
  recruit?: CampaignRecruit | null;
  extra?: {
    resubmitDeadlineAt?: Date;
    finalDeadlineAt?: Date;
    remainingDays?: number;
  };
};
```

- [ ] **Step 2: 가구매 변수 리졸버 8개 추가**

기존 `rewardJpy` 리졸버 아래에:

```ts
function subTypeLabel(subType: string): string {
  switch (subType) {
    case "INSTAGRAM": return "Instagram";
    case "TIKTOK": return "TikTok";
    case "X": return "X";
    case "YOUTUBE": return "YouTube";
    case "QOO10": return "Qoo10";
    case "LIPS": return "LIPS";
    case "ATCOSME": return "@cosme";
    default: return subType;
  }
}

const subType: TriggerVariableWithResolver = {
  key: "subType",
  label: "서브타입",
  description: "応募したプラットフォームの表示ラベル",
  sample: "Qoo10",
  resolver: (ctx) => subTypeLabel(ctx.application.subType),
};

const productPriceJpy: TriggerVariableWithResolver = {
  key: "productPriceJpy",
  label: "상품가격(엔)",
  description: "サブタイプごとの商品価格 (エン、カンマ入り)",
  sample: "3,000",
  resolver: (ctx) =>
    ctx.recruit?.productPriceJpy != null ? formatJpy(ctx.recruit.productPriceJpy) : "",
};

const productUrl: TriggerVariableWithResolver = {
  key: "productUrl",
  label: "상품 URL",
  description: "商品ページのリンク",
  sample: "https://qoo10.jp/g/...",
  resolver: (ctx) => ctx.recruit?.productUrl ?? "",
};

const totalSettlementJpy: TriggerVariableWithResolver = {
  key: "totalSettlementJpy",
  label: "정산 예상액(엔)",
  description: "報酬 + 商品価格 の合計 (エン、カンマ入り)",
  sample: "8,000",
  resolver: (ctx) => {
    const price = ctx.recruit?.productPriceJpy ?? 0;
    return formatJpy(ctx.application.campaign.rewardJpy + price);
  },
};

const orderNumber: TriggerVariableWithResolver = {
  key: "orderNumber",
  label: "주문번호",
  description: "インフルエンサーが提出した注文番号",
  sample: "ORD-20260703-0001",
  resolver: (ctx) => ctx.application.orderNumber ?? "",
};

const orderSubmittedDate: TriggerVariableWithResolver = {
  key: "orderSubmittedDate",
  label: "주문 제출일",
  description: "注文情報を提出した日 (JST 月日)",
  sample: "7月3日",
  resolver: (ctx) =>
    ctx.application.orderSubmittedAt
      ? formatJstMonthDay(ctx.application.orderSubmittedAt)
      : "",
};

const reviewDeadline: TriggerVariableWithResolver = {
  key: "reviewDeadline",
  label: "리뷰 마감일",
  description: "レビュー提出期限 (orderSubmittedAt + postingPeriodDays)",
  sample: "7月17日",
  resolver: (ctx) => {
    if (!ctx.application.orderSubmittedAt) return "";
    const deadline = new Date(
      ctx.application.orderSubmittedAt.getTime() +
        ctx.application.campaign.postingPeriodDays * DAY_MS,
    );
    return formatJstMonthDay(deadline);
  },
};

const reviewUrl: TriggerVariableWithResolver = {
  key: "reviewUrl",
  label: "리뷰 URL",
  description: "提出されたレビューURL",
  sample: "https://www.cosme.net/...",
  resolver: (ctx) => ctx.post?.url ?? "",
};
```

- [ ] **Step 2: `ApplicationWithRels` 에 신규 필드 노출 확인**

`ApplicationWithRels` 는 `CampaignApplication & { campaign: Pick<...> }` 이므로 `orderNumber`, `orderSubmittedAt` 는 Prisma 자동 포함. 별도 조정 불필요.

`campaign` 의 `Pick` 은 이미 `postingPeriodDays`, `rewardJpy` 를 포함하므로 그대로 사용 가능. 별도 확장 불필요.

- [ ] **Step 3: `TRIGGER_META` 의 FAKE_PURCHASE_* 엔트리를 스펙 §5-3 매핑으로 교체**

기존 스텁을 다음으로 교체:

```ts
FAKE_PURCHASE_APPLICATION_APPLIED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(subType, productPriceJpy, productUrl, totalSettlementJpy),
},
FAKE_PURCHASE_APPLICATION_APPROVED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(subType, productPriceJpy, productUrl, totalSettlementJpy),
},
FAKE_PURCHASE_APPLICATION_REJECTED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(rejectReason),
},
FAKE_PURCHASE_ORDER_SUBMITTED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(subType, orderNumber, orderSubmittedDate, reviewDeadline),
},
FAKE_PURCHASE_REVIEW_SUBMITTED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(subType, reviewUrl),
},
FAKE_PURCHASE_REVIEW_APPROVED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(subType, reviewUrl, totalSettlementJpy),
},
FAKE_PURCHASE_REVIEW_REJECTED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(subType, reviewUrl, rejectReason),
},
FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(subType, reviewDeadline, remainingDays),
},
FAKE_PURCHASE_SETTLEMENT_COMPLETED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(subType, totalSettlementJpy),
},
FAKE_PURCHASE_CAMPAIGN_COMPLETED: {
  category: "FAKE_PURCHASE",
  requiresSubType: true,
  variables: withBase(),
},
```

- [ ] **Step 4: typecheck 및 커밋**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/line-templates/trigger-meta.ts
git commit -m "feat(api): TRIGGER_META 가구매 변수 8종 및 매핑 확장"
```

---

## Task 14: LineDispatcherService — recruit 컨텍스트 주입

**Files:**
- Modify: `apps/api/src/line-templates/line-dispatcher.service.ts`

- [ ] **Step 1: dispatch 진입부에서 recruit 조회**

`dispatch` 메서드에서 template 조회 이전에 recruit 로드:

```ts
async dispatch(triggerKey: LineTriggerKey, context: DispatchContext): Promise<void> {
  const meta = getMeta(triggerKey);
  const subType = meta.requiresSubType
    ? campaignSubTypeToTriggerSubType(context.application.subType)
    : null;
  const category = meta.category;

  // 가구매 트리거만 recruit 필요. SNS 는 recruit 참조 변수가 없으므로 스킵.
  let recruit = context.recruit ?? null;
  if (category === "FAKE_PURCHASE" && !recruit) {
    recruit = await this.prisma.campaignRecruit.findUnique({
      where: {
        campaignId_subType: {
          campaignId: context.application.campaignId,
          subType: context.application.subType,
        },
      },
    });
  }
  const enrichedContext: DispatchContext = { ...context, recruit };

  const toLineUserId = context.application.influencer.lineUserId ?? "";
  const applicationId = context.application.id;

  const template = await this.prisma.lineMessageTemplate.findFirst({
    where: { category, subType, triggerKey },
  });

  // 이후 renderTemplate 호출 시 enrichedContext 전달
  const renderedBody = renderTemplate(template.body, meta.variables, enrichedContext);
  // 이하 기존 로직 유지 (log/push)
}
```

전체 함수 흐름을 유지하되 `context` 대신 `enrichedContext` 를 renderTemplate 및 이후 참조에 사용.

- [ ] **Step 2: 관련 테스트**

`line-dispatcher.service.spec.ts` 에 가구매 dispatch 시 recruit 조회 여부 케이스 추가 (mock prisma.campaignRecruit.findUnique 호출 확인).

- [ ] **Step 3: typecheck / jest 및 커밋**

```bash
pnpm --filter @jsure/api exec jest src/line-templates
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/line-templates/line-dispatcher.service.ts apps/api/src/line-templates/line-dispatcher.service.spec.ts
git commit -m "feat(api): LineDispatcher 가구매 recruit 컨텍스트 자동 로드"
```

---

## Task 15: LineRemindersService — 가구매 리뷰 마감 리마인더

**Files:**
- Modify: `apps/api/src/line-templates/line-reminders.service.ts`

- [ ] **Step 1: `runFakePurchaseReviewReminders` 메서드 추가**

기존 `runInsightReminders` 아래에 추가:

```ts
private async runFakePurchaseReviewReminders(): Promise<void> {
  const todayStart = startOfJstDay(new Date());
  const applications = await this.prisma.campaignApplication.findMany({
    where: {
      status: "ORDER_SUBMITTED",
      orderSubmittedAt: { not: null },
      campaign: { category: "FAKE_PURCHASE" },
    },
    include: {
      ...DISPATCH_APPLICATION_INCLUDE,
      posts: { select: { id: true } },
    },
  });

  for (const application of applications) {
    if (!application.orderSubmittedAt) continue;
    if (application.posts.length > 0) continue;

    const deadlineMs =
      application.orderSubmittedAt.getTime() +
      application.campaign.postingPeriodDays * DAY_MS;
    const deadlineDayStart = startOfJstDay(new Date(deadlineMs));
    const remainingDays = Math.round((deadlineDayStart - todayStart) / DAY_MS);
    if (!POSTING_REMINDER_DAYS.includes(remainingDays)) continue;

    await this.dispatcher.dispatch("FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER", {
      application,
      extra: { remainingDays },
    });
  }
}
```

- [ ] **Step 2: `runDaily` 에 새 잡 등록**

```ts
async runDaily(): Promise<void> {
  try {
    await this.runPostingReminders();
    await this.runInsightReminders();
    await this.runPostRejectionReminders();
    await this.runFakePurchaseReviewReminders();
  } catch (err) {
    this.logger.error("Reminder daily run failed", err as Error);
  }
}
```

- [ ] **Step 3: DISPATCH_APPLICATION_INCLUDE 에 category 포함 확인**

`trigger-meta.ts` 의 `DISPATCH_APPLICATION_INCLUDE` 의 campaign.select 에 `category: true` 를 추가 (없다면). 리마인더 쿼리에서 category 매칭에 필요.

`ApplicationWithRels.campaign` 의 `Pick` 도 `category` 추가:

```ts
export type ApplicationWithRels = CampaignApplication & {
  campaign: Pick<
    Campaign,
    "id" | "title" | "postingPeriodDays" | "rewardJpy" | "productSummary" | "category"
  >;
  influencer: Pick<Influencer, "id" | "name" | "lineUserId">;
};
```

- [ ] **Step 4: typecheck / jest 및 커밋**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
pnpm --filter @jsure/api exec jest src/line-templates
git add apps/api/src/line-templates/line-reminders.service.ts apps/api/src/line-templates/trigger-meta.ts
git commit -m "feat(api): 가구매 리뷰 마감 리마인더 크론 추가 (3일/1일 전 JST 09:00)"
```

---

## Task 16: 메시지 템플릿 시드 — 가구매 30 row 추가

**Files:**
- Modify: `apps/api/prisma/seeds/line-templates.seed.ts`

- [ ] **Step 1: `SeedRow` union 확장 및 FAKE_PURCHASE 상수 추가**

파일 상단 `SeedRow` 타입에 10개 트리거 추가:

```ts
type FakePurchaseTriggerKey =
  | "FAKE_PURCHASE_APPLICATION_APPLIED"
  | "FAKE_PURCHASE_APPLICATION_APPROVED"
  | "FAKE_PURCHASE_APPLICATION_REJECTED"
  | "FAKE_PURCHASE_ORDER_SUBMITTED"
  | "FAKE_PURCHASE_REVIEW_SUBMITTED"
  | "FAKE_PURCHASE_REVIEW_APPROVED"
  | "FAKE_PURCHASE_REVIEW_REJECTED"
  | "FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER"
  | "FAKE_PURCHASE_SETTLEMENT_COMPLETED"
  | "FAKE_PURCHASE_CAMPAIGN_COMPLETED";
```

일본어 초안 본문 상수 5개 추가 (enabled 트리거만):

```ts
const FP_APPLIED = `✨【応募受付】買取レビュー キャンペーン ✨

「{{campaignTitle}}」へのご応募ありがとうございます！
下記の内容で受付が完了いたしました。

📦 プラットフォーム: {{subType}}
💰 商品価格: {{productPriceJpy}} 円
🔗 商品ページ: {{productUrl}}
💴 予定精算金額: {{totalSettlementJpy}} 円

💌 選考について
🔹 発表: 応募後1週間前後
🔹 方法: 当選者様へ個別にご連絡

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const FP_APPROVED = `🎉【当選】買取レビュー キャンペーンのご案内 🎉

「{{campaignTitle}}」の当選者に選出されました！

📦 プラットフォーム: {{subType}}
💰 商品価格: {{productPriceJpy}} 円 (立替後、精算にて全額返金)
🔗 商品ページ: {{productUrl}}
💴 予定精算金額: {{totalSettlementJpy}} 円

✨ お願い
1️⃣ 商品ページよりご自身でご購入ください
2️⃣ 注文番号と注文明細のスクリーンショットを【応募履歴 - 注文情報提出】よりご登録ください

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const FP_REVIEW_REJECTED = `⚠️【要確認】レビュー修正・再提出のお願い ⚠️

「{{campaignTitle}}」({{subType}}) のレビューをご提出いただき、誠にありがとうございます。
運営事務局にて確認いたしましたところ、下記の修正をお願いすることとなりました。

📝 修正のご依頼
- 修正の理由: {{rejectReason}}
- 提出されたレビュー: {{reviewUrl}}

ガイドラインに沿ってレビューを修正いただき、URLとスクリーンショットの再提出をお願いいたします。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const FP_REVIEW_REMINDER = `⏰【期限間近】レビュー提出期限まであと{{remainingDays}}日 ⏰

「{{campaignTitle}}」({{subType}}) のレビュー提出期限まで、あと{{remainingDays}}日 ({{reviewDeadline}} まで) となりました。

期限までにレビューの投稿およびシステムへの提出をお願いいたします。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;

const FP_SETTLEMENT = `💰【お振込完了】買取レビュー キャンペーン精算のお知らせ 💰

「{{campaignTitle}}」({{subType}}) の精算が完了いたしました。

💳 お振込情報
- お振込金額: {{totalSettlementJpy}} 円 (報酬 + 商品価格返金)

複数キャンペーン同時参加の場合、合算して一括でお振込いたします。

ご参加誠にありがとうございました。またのご参加をお待ちしております！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
🕐 運営：平日 10:00〜20:00`;
```

- [ ] **Step 2: 가구매 SEED_ROWS 추가**

기존 `SEED_ROWS` 배열 뒤에 별도 배열 정의:

```ts
type SeedRowFakePurchase = {
  triggerKey: FakePurchaseTriggerKey;
  enabled: boolean;
  body: string;
};

const FP_SEED_ROWS: SeedRowFakePurchase[] = [
  { triggerKey: "FAKE_PURCHASE_APPLICATION_APPLIED", enabled: true, body: FP_APPLIED },
  { triggerKey: "FAKE_PURCHASE_APPLICATION_APPROVED", enabled: true, body: FP_APPROVED },
  { triggerKey: "FAKE_PURCHASE_APPLICATION_REJECTED", enabled: false, body: "" },
  { triggerKey: "FAKE_PURCHASE_ORDER_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "FAKE_PURCHASE_REVIEW_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "FAKE_PURCHASE_REVIEW_APPROVED", enabled: false, body: "" },
  { triggerKey: "FAKE_PURCHASE_REVIEW_REJECTED", enabled: true, body: FP_REVIEW_REJECTED },
  { triggerKey: "FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER", enabled: true, body: FP_REVIEW_REMINDER },
  { triggerKey: "FAKE_PURCHASE_SETTLEMENT_COMPLETED", enabled: true, body: FP_SETTLEMENT },
  { triggerKey: "FAKE_PURCHASE_CAMPAIGN_COMPLETED", enabled: false, body: "" },
];
```

- [ ] **Step 3: main() 확장**

```ts
async function main(): Promise<void> {
  for (const row of SEED_ROWS) {
    for (const subType of ["INSTAGRAM", "X"] as const) {
      await prisma.lineMessageTemplate.upsert({
        where: { category_subType_triggerKey: { category: "SNS", subType, triggerKey: row.triggerKey } },
        create: { category: "SNS", subType, triggerKey: row.triggerKey, enabled: row.enabled, body: row.body },
        update: {},
      });
    }
  }
  for (const row of FP_SEED_ROWS) {
    for (const subType of ["QOO10", "LIPS", "ATCOSME"] as const) {
      await prisma.lineMessageTemplate.upsert({
        where: { category_subType_triggerKey: { category: "FAKE_PURCHASE", subType, triggerKey: row.triggerKey } },
        create: { category: "FAKE_PURCHASE", subType, triggerKey: row.triggerKey, enabled: row.enabled, body: row.body },
        update: {},
      });
    }
  }
  const count = await prisma.lineMessageTemplate.count();
  console.log(`Seed complete. Total templates: ${count}`);
}
```

- [ ] **Step 4: 시드 실행 및 검증**

```bash
pnpm --filter @jsure/api exec ts-node prisma/seeds/line-templates.seed.ts
```

Expected: 기존 30 row + 신규 30 row = **60** (또는 SNS INSTAGRAM/X × 15 = 30 + FAKE_PURCHASE QOO10/LIPS/ATCOSME × 10 = 30 = 60).

DB 확인:

```bash
pnpm --filter @jsure/api exec prisma db execute --stdin <<< "SELECT category, COUNT(*) FROM line_message_templates GROUP BY category;"
```

- [ ] **Step 5: 커밋**

```bash
git add apps/api/prisma/seeds/line-templates.seed.ts
git commit -m "feat(api): 가구매 LINE 메시지 템플릿 시드 30 row 추가"
```

---

## Task 17: campaigns.service — 카테고리별 recruit 검증

**Files:**
- Modify: `apps/api/src/campaigns/campaigns.service.ts`

- [ ] **Step 1: 검증 헬퍼 추가**

`campaigns.service.ts` 에 helper:

```ts
const SNS_SUB_TYPES = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"] as const;
const FAKE_PURCHASE_SUB_TYPES = ["QOO10", "LIPS", "ATCOSME"] as const;

function validateRecruitsForCategory(
  category: "SNS" | "FAKE_PURCHASE",
  recruits: {
    subType: string;
    minFollowers?: number | null;
    insightRequired?: boolean;
    productPriceJpy: number | null;
    productUrl: string | null;
    instagramPostTypes?: string[];
  }[],
): void {
  for (const recruit of recruits) {
    if (category === "SNS") {
      if (!SNS_SUB_TYPES.includes(recruit.subType as (typeof SNS_SUB_TYPES)[number])) {
        throw new BadRequestException(
          `SNSキャンペーンでは ${recruit.subType} を募集できません`,
        );
      }
      if (recruit.productPriceJpy !== null || recruit.productUrl !== null) {
        throw new BadRequestException(
          "SNSキャンペーンでは productPriceJpy/productUrl を指定できません",
        );
      }
    } else {
      if (!FAKE_PURCHASE_SUB_TYPES.includes(recruit.subType as (typeof FAKE_PURCHASE_SUB_TYPES)[number])) {
        throw new BadRequestException(
          `買取レビューキャンペーンでは ${recruit.subType} を募集できません`,
        );
      }
      if (recruit.productPriceJpy == null || recruit.productPriceJpy <= 0) {
        throw new BadRequestException("productPriceJpy は正の整数を指定してください");
      }
      if (!recruit.productUrl || recruit.productUrl.trim().length === 0) {
        throw new BadRequestException("productUrl を入力してください");
      }
      if ((recruit.minFollowers ?? 0) !== 0) {
        throw new BadRequestException(
          "買取レビューキャンペーンの minFollowers は 0 にしてください",
        );
      }
      if (recruit.insightRequired === true) {
        throw new BadRequestException(
          "買取レビューキャンペーンでは insightRequired=false のみサポートします",
        );
      }
      if (recruit.instagramPostTypes && recruit.instagramPostTypes.length > 0) {
        throw new BadRequestException(
          "買取レビューキャンペーンでは instagramPostTypes を指定できません",
        );
      }
    }
  }
}
```

- [ ] **Step 2: create / update 진입부에서 호출**

`create` 에서 `normalizeCampaignRecruitsInput` 호출 이후:

```ts
const recruits = this.normalizeCampaignRecruitsInput(input.recruits);
validateRecruitsForCategory(input.category, recruits);
```

`update` 에서 recruits 정의가 있을 때 마찬가지로 검증. 이때 category 는 편집 불가 (기존 캠페인의 category 재조회) — DB 에서 fetch 후 검증.

```ts
if (input.recruits !== undefined) {
  const existingCampaign = await this.prisma.campaign.findUniqueOrThrow({
    where: { id },
    select: { category: true },
  });
  const normalized = this.normalizeCampaignRecruitsInput(input.recruits);
  validateRecruitsForCategory(existingCampaign.category, normalized);
  // ... 이후 기존 로직
}
```

- [ ] **Step 3: 스펙 테스트 추가**

`apps/api/src/campaigns/campaigns.service.spec.ts` 에 카테고리별 검증 케이스 추가:
- SNS 캠페인이 QOO10 recruit 를 넣으면 400
- FAKE_PURCHASE 캠페인이 productPriceJpy=0 을 넣으면 400
- FAKE_PURCHASE 캠페인이 productUrl 없이 넣으면 400
- FAKE_PURCHASE 캠페인이 minFollowers=100 이면 400

- [ ] **Step 4: 테스트 및 커밋**

```bash
pnpm --filter @jsure/api exec jest src/campaigns
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/campaigns/campaigns.service.ts apps/api/src/campaigns/campaigns.service.spec.ts
git commit -m "feat(api): campaigns 카테고리별 recruit 필드 검증"
```

---

## Task 18: 최종 회귀 및 통합 검증

**Files:** (변경 없음)

- [ ] **Step 1: 전체 typecheck**

```bash
pnpm typecheck
```

Expected: 모든 패키지 통과.

- [ ] **Step 2: 전체 jest**

```bash
pnpm --filter @jsure/api exec jest
```

Expected: 신규 추가한 케이스 포함 전부 통과. Plan A 에서 유지된 pre-existing 실패 (있다면) 만 제외.

- [ ] **Step 3: admin-web / client-web build (rename 회귀 확인)**

```bash
pnpm --filter @jsure/admin-web build
pnpm --filter @jsure/client-web build
```

Expected: 통과.

- [ ] **Step 4: 로컬 수동 스모크 테스트**

`pnpm dev` 로 기동 후:

1. 어드민에서 가구매 카테고리 캠페인 생성 (Plan C UI 이전이므로 API 로만 확인 가능. curl 또는 admin-web 폼이 SNS 만 지원하면 skip 하고 DB 수동 insert 로 진행):

```bash
# 예시 curl
curl -sX POST http://localhost:3000/admin/campaigns \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"category":"FAKE_PURCHASE","title":"テスト買取","rewardJpy":5000,"postingPeriodDays":14,"recruits":[{"subType":"QOO10","minFollowers":0,"recruitCount":5,"insightRequired":false,"instagramPostTypes":[],"productPriceJpy":3000,"productUrl":"https://qoo10.jp/g/test"}],"recruitStartAt":"2026-07-01","recruitEndAt":"2026-08-01"}'
```

2. 인플루언서로 신청 → APPROVED (관리자) → submitOrder → submitReview → approveSubmittedPost → Settlement PENDING → completeSettlements 순 진행. 각 단계 DB 상태 및 dispatch 로그 확인:

```sql
SELECT trigger_key, status FROM line_dispatch_log ORDER BY created_at DESC LIMIT 20;
```

- [ ] **Step 5: DB 검증 쿼리**

```sql
-- 가구매 seed 완료
SELECT category, COUNT(*) FROM line_message_templates GROUP BY category;
-- Expected: SNS=30, FAKE_PURCHASE=30

-- 가구매 트리거 활성 상태
SELECT trigger_key, enabled FROM line_message_templates
 WHERE category='FAKE_PURCHASE' AND sub_type='QOO10'
 ORDER BY trigger_key;
```

- [ ] **Step 6: 최종 커밋 (필요 시)**

회귀 수정이 발견되면:

```bash
git add <touched-files>
git commit -m "fix: Plan B 회귀 검증에서 발견된 문제 수정"
```

---

## 완료 조건

- 전체 typecheck 통과
- 전체 jest 통과 (신규 spec 포함)
- admin-web / client-web build 통과
- 가구매 신청 → 주문 → 리뷰 → 정산 흐름 수동 스모크 통과
- LINE 템플릿 60 row 시드 완료 (SNS 30 + FAKE_PURCHASE 30)
- 커밋 수 대략 15~17개 (Task 별 1커밋 + 필요 시 fix)

이 Plan B 완료 후 Plan C (UI 확장: admin-web 캠페인 폼/응모자 상세, client-web 가구매 응모 페이지, i18n) 로 진행.

## 오픈 이슈 / 후속

- `presignInsightUpload` 엔드포인트는 Plan C 에서 client-web 이 통합 엔드포인트로 이전한 뒤 제거 예정 (본 Plan 은 병존)
- `snsHandle.ts` 파일명 유지 (Plan A 기록 그대로)
- FAKE_PURCHASE 자동 종료 dispatch (`FAKE_PURCHASE_CAMPAIGN_COMPLETED`) 는 스펙 §8 향후 범위
