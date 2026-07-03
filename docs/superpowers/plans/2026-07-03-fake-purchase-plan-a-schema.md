# 가구매 캠페인 Plan A — 스키마 리네임 & 기반 확장

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가구매 캠페인의 데이터 모델 기반을 준비한다. `SnsType` → `CampaignSubType` rename, `CampaignSnsRecruit` → `CampaignRecruit` rename, `SubmittedPostAttachment` → `Attachment` 통합, 그리고 카테고리/서브타입 확장. 기존 SNS 기능은 100% 유지.

**Architecture:** Prisma 스키마 rename + 확장을 단일 마이그레이션 배치로 수행. 코드는 패키지별로 순차 rename 스윕. 신규 컬럼은 모두 nullable/default 로 하위 호환 유지.

**Tech Stack:** Prisma 5, NestJS, React (Vite), pnpm 모노레포, TypeScript strict, Zod. Postgres (Neon).

**Spec:** `docs/superpowers/specs/2026-07-03-fake-purchase-campaign-design.md`

---

## 실행 규칙

- 커밋 메시지는 **한글** (CLAUDE.md)
- `git add -A` 금지 — 항상 파일 명시 add
- 각 Task 종료 시 해당 패키지 `typecheck` 및 관련 `jest` 통과 후 커밋
- 신규 브랜치에서 작업 권장: `feat/fake-purchase-schema` (현재 `feat/line-message-templates` 에서 분기)
- rename 은 **의미 있는 최소 그룹 단위** 로 커밋하여 되돌리기 쉽게

## 브랜치 세팅

- [ ] **Step 1: 새 브랜치 생성**

```bash
git checkout -b feat/fake-purchase-schema
```

- [ ] **Step 2: 기본 통과 상태 확인** (baseline typecheck 결과 확인 목적)

```bash
pnpm typecheck && pnpm --filter @jsure/api exec jest src/line-templates
```

Expected: 통과 (기존 상태).

---

## Task 1: Prisma 스키마 편집 (Enum 변경)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `SnsType` enum → `CampaignSubType` 로 이름 변경 및 값 추가**

`apps/api/prisma/schema.prisma` 에서 `enum SnsType { ... }` 블록을 찾아 다음으로 교체:

```prisma
enum CampaignSubType {
  INSTAGRAM
  TIKTOK
  X
  YOUTUBE
  QOO10
  LIPS
  ATCOSME
}
```

- [ ] **Step 2: `ApplicationStatus` enum 에 값 2개 추가**

`enum ApplicationStatus { ... }` 블록에 `ORDER_SUBMITTED`, `REVIEW_SUBMITTED` 추가:

```prisma
enum ApplicationStatus {
  APPLIED
  APPROVED
  REJECTED
  SHIPPED
  DELIVERED
  ORDER_SUBMITTED
  REVIEW_SUBMITTED
  COMPLETED
  CANCELLED
}
```

- [ ] **Step 3: `LineTriggerSubType` enum 에 값 3개 추가**

```prisma
enum LineTriggerSubType {
  INSTAGRAM
  X
  QOO10
  LIPS
  ATCOSME
}
```

- [ ] **Step 4: `LineTriggerKey` enum 에 `FAKE_PURCHASE_*` 10개 추가**

기존 15개 SNS_* 값 뒤에 추가:

```prisma
enum LineTriggerKey {
  // ... 기존 15개 SNS_* 유지
  FAKE_PURCHASE_APPLICATION_APPLIED
  FAKE_PURCHASE_APPLICATION_APPROVED
  FAKE_PURCHASE_APPLICATION_REJECTED
  FAKE_PURCHASE_ORDER_SUBMITTED
  FAKE_PURCHASE_REVIEW_SUBMITTED
  FAKE_PURCHASE_REVIEW_APPROVED
  FAKE_PURCHASE_REVIEW_REJECTED
  FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER
  FAKE_PURCHASE_SETTLEMENT_COMPLETED
  FAKE_PURCHASE_CAMPAIGN_COMPLETED
}
```

- [ ] **Step 5: 신규 `AttachmentKind` enum 추가**

`schema.prisma` 파일 맨 뒤에 추가:

```prisma
enum AttachmentKind {
  INSIGHT_SCREENSHOT
  ORDER_RECEIPT
  REVIEW_SCREENSHOT
}
```

- [ ] **Step 6: 커밋** (아직 migrate 안 함 — 다음 Task 에서 스키마 완성 후 한 번에)

이 시점에서는 커밋하지 않고 다음 Task 로 계속. Task 5 완료 후 하나의 커밋으로 통합.

---

## Task 2: Prisma 스키마 편집 (Campaign, CampaignRecruit)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `Campaign` 모델에 `category` 필드 추가**

`model Campaign { ... }` 안, `title` 위 라인에 추가:

```prisma
  category           CampaignCategory  @default(SNS)
```

`snsRecruits` 관계 이름을 `recruits` 로 변경:

```prisma
  recruits           CampaignRecruit[]
```

- [ ] **Step 2: `CampaignSnsRecruit` 모델 → `CampaignRecruit` 로 rename + 컬럼 변경**

`model CampaignSnsRecruit { ... }` 전체를 다음으로 교체:

```prisma
model CampaignRecruit {
  id                 String              @id @default(cuid())
  campaignId         String
  subType            CampaignSubType
  minFollowers       Int                 @default(0)
  recruitCount       Int
  instagramPostTypes InstagramPostType[]
  insightRequired    Boolean             @default(true)
  productPriceJpy    Int?
  productUrl         String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, subType])
  @@map("campaign_recruits")
}
```

**변경점**:
- 모델명 `CampaignSnsRecruit` → `CampaignRecruit`
- 필드명 `snsType` → `subType`
- 신규 필드: `productPriceJpy Int?`, `productUrl String?`
- `@@map` 도 `campaign_sns_recruits` → `campaign_recruits`

---

## Task 3: Prisma 스키마 편집 (CampaignApplication)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `CampaignApplication` 모델 필드 변경**

`model CampaignApplication { ... }` 안에서:

1. `snsType SnsType` → `subType CampaignSubType`
2. `@@unique([campaignId, influencerId, snsType])` → `@@unique([campaignId, influencerId, subType])`
3. 다음 3개 신규 필드 추가 (`completedAt` 뒤 라인에):

```prisma
  orderNumber        String?
  orderSubmittedAt   DateTime?
  reviewSubmittedAt  DateTime?
```

4. 관계에 `attachments` 추가 (기존 `posts` 뒤에):

```prisma
  attachments        Attachment[]
```

(기존 `lineDispatchLogs LineDispatchLog[]` 유지)

---

## Task 4: Prisma 스키마 편집 (SubmittedPost, SubmittedPostAttachment → Attachment)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `SubmittedPost` 필드 rename**

`model SubmittedPost { ... }` 안에서:
- `snsType SnsType` → `subType CampaignSubType`
- `@@unique([applicationId, snsType])` → `@@unique([applicationId, subType])`
- 관계 이름 `attachments SubmittedPostAttachment[]` → `attachments Attachment[]`

- [ ] **Step 2: `SubmittedPostAttachment` 모델 → `Attachment` 로 재작성**

`model SubmittedPostAttachment { ... }` 블록 전체를 다음으로 교체:

```prisma
model Attachment {
  id            String              @id @default(cuid())
  kind          AttachmentKind
  applicationId String
  postId        String?
  objectKey     String              @unique
  contentType   String
  sizeBytes     Int
  uploadedAt    DateTime            @default(now())

  application   CampaignApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  post          SubmittedPost?      @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([applicationId, kind])
  @@index([postId, kind])
  @@map("attachments")
}
```

---

## Task 5: Prisma 스키마 편집 (Settlement) + 마이그레이션 생성

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_fake_purchase_schema_foundation/migration.sql`

- [ ] **Step 1: `Settlement` 모델에 컬럼 추가**

`model Settlement { ... }` 에서 `amountJpy Int` 뒤에:

```prisma
  rewardAmountJpy   Int              @default(0)
  productRefundJpy  Int              @default(0)
```

- [ ] **Step 2: 마이그레이션 생성 (미실행)**

Run: `pnpm --filter @jsure/api exec prisma migrate dev --name fake_purchase_schema_foundation --create-only`

Expected: 새 마이그레이션 폴더 생성됨. `--create-only` 이므로 DB 반영 안 함. Prisma 가 생성한 SQL 확인 및 편집 필요 (enum rename, 테이블 rename 등을 Prisma 가 drop+create 로 생성했을 수 있음).

- [ ] **Step 3: 마이그레이션 SQL 편집**

생성된 `migration.sql` 을 열어 안전한 rename 형태로 편집:

```sql
-- Enum rename (drop+create 로 생성됐다면 rename 으로 교체)
ALTER TYPE "SnsType" RENAME TO "CampaignSubType";

-- Enum 값 추가
ALTER TYPE "CampaignSubType" ADD VALUE 'QOO10';
ALTER TYPE "CampaignSubType" ADD VALUE 'LIPS';
ALTER TYPE "CampaignSubType" ADD VALUE 'ATCOSME';

ALTER TYPE "ApplicationStatus" ADD VALUE 'ORDER_SUBMITTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'REVIEW_SUBMITTED';

ALTER TYPE "LineTriggerSubType" ADD VALUE 'QOO10';
ALTER TYPE "LineTriggerSubType" ADD VALUE 'LIPS';
ALTER TYPE "LineTriggerSubType" ADD VALUE 'ATCOSME';

ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_APPLICATION_APPLIED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_APPLICATION_APPROVED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_APPLICATION_REJECTED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_ORDER_SUBMITTED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_REVIEW_SUBMITTED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_REVIEW_APPROVED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_REVIEW_REJECTED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_SETTLEMENT_COMPLETED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_CAMPAIGN_COMPLETED';

-- Attachment kind enum
CREATE TYPE "AttachmentKind" AS ENUM ('INSIGHT_SCREENSHOT', 'ORDER_RECEIPT', 'REVIEW_SCREENSHOT');

-- Campaign.category
ALTER TABLE "campaigns" ADD COLUMN "category" "CampaignCategory" NOT NULL DEFAULT 'SNS';

-- CampaignRecruit rename (기존 campaign_sns_recruits → campaign_recruits)
ALTER TABLE "campaign_sns_recruits" RENAME TO "campaign_recruits";
ALTER TABLE "campaign_recruits" RENAME COLUMN "snsType" TO "subType";
ALTER TABLE "campaign_recruits" ADD COLUMN "productPriceJpy" INTEGER;
ALTER TABLE "campaign_recruits" ADD COLUMN "productUrl" TEXT;

-- 유니크 인덱스 rename (기존 이름 확인 후 조정)
ALTER INDEX "campaign_sns_recruits_campaignId_snsType_key" RENAME TO "campaign_recruits_campaignId_subType_key";

-- CampaignApplication 필드 rename + 신규 필드
ALTER TABLE "campaign_applications" RENAME COLUMN "snsType" TO "subType";
ALTER INDEX "campaign_applications_campaignId_influencerId_snsType_key" RENAME TO "campaign_applications_campaignId_influencerId_subType_key";
ALTER TABLE "campaign_applications" ADD COLUMN "orderNumber" TEXT;
ALTER TABLE "campaign_applications" ADD COLUMN "orderSubmittedAt" TIMESTAMP(3);
ALTER TABLE "campaign_applications" ADD COLUMN "reviewSubmittedAt" TIMESTAMP(3);

-- SubmittedPost 필드 rename
ALTER TABLE "submitted_posts" RENAME COLUMN "snsType" TO "subType";
ALTER INDEX "submitted_posts_applicationId_snsType_key" RENAME TO "submitted_posts_applicationId_subType_key";

-- Attachment 통합 (기존 submitted_post_attachments → attachments)
ALTER TABLE "submitted_post_attachments" RENAME TO "attachments";
ALTER TABLE "attachments" ADD COLUMN "kind" "AttachmentKind" NOT NULL DEFAULT 'INSIGHT_SCREENSHOT';
ALTER TABLE "attachments" ADD COLUMN "applicationId" TEXT;
ALTER TABLE "attachments" ALTER COLUMN "postId" DROP NOT NULL;

-- Attachment.applicationId 백필: post → application
UPDATE "attachments" a
   SET "applicationId" = p."applicationId"
  FROM "submitted_posts" p
 WHERE a."postId" = p."id";

ALTER TABLE "attachments" ALTER COLUMN "applicationId" SET NOT NULL;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "campaign_applications"("id") ON DELETE CASCADE;

CREATE INDEX "attachments_applicationId_kind_idx" ON "attachments"("applicationId", "kind");
CREATE INDEX "attachments_postId_kind_idx" ON "attachments"("postId", "kind");

-- Settlement 컬럼 확장 + 백필
ALTER TABLE "settlements" ADD COLUMN "rewardAmountJpy" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "settlements" ADD COLUMN "productRefundJpy" INTEGER NOT NULL DEFAULT 0;
UPDATE "settlements" SET "rewardAmountJpy" = "amountJpy";
```

**주의**: 실제 인덱스/제약 이름은 DB 에서 `SELECT indexname FROM pg_indexes WHERE tablename = '...'` 로 확인 후 정확히 지정. Prisma default naming 이 아닐 수 있음.

- [ ] **Step 4: 마이그레이션 실행 (dev DB)**

Run: `pnpm --filter @jsure/api exec prisma migrate deploy`

Expected: 마이그레이션 성공. 검증:

```bash
pnpm --filter @jsure/api exec prisma db execute --stdin <<< 'SELECT COUNT(*) FROM "attachments" WHERE "applicationId" IS NULL;'
```

Expected: `0` (백필 완료)

- [ ] **Step 5: Prisma 클라이언트 재생성**

Run: `pnpm --filter @jsure/api exec prisma generate`

Expected: 클라이언트 재생성. 이 시점부터 코드에서 `SnsType`, `snsType`, `CampaignSnsRecruit`, `SubmittedPostAttachment` 사용처가 typecheck 실패.

- [ ] **Step 6: 커밋 (스키마만)**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(db): 가구매 캠페인 스키마 기반 (SnsType→CampaignSubType, Attachment 통합, 카테고리 필드)"
```

---

## Task 6: Shared 패키지 rename & 확장

**Files:**
- Modify: `packages/shared/src/types/campaign.ts`
- Modify: `packages/shared/src/types/application.ts`
- Modify: `packages/shared/src/types/lineTemplate.ts`
- Modify: `packages/shared/src/types/influencer.ts`
- Modify: `packages/shared/src/types/adminInfluencer.ts`
- Modify: `packages/shared/src/types/adminReport.ts`
- Modify: `packages/shared/src/types/applicationExport.ts`
- Modify: `packages/shared/src/utils/snsHandle.ts`
- (필요 시 rename: `snsHandle.ts` → `subTypeHandle.ts`. YAGNI — 이번엔 파일명 유지)

- [ ] **Step 1: `campaign.ts` 편집**

`SnsType` 이 이 파일에 정의되어 있으면 rename. Prisma 에서 import 하지 않고 직접 정의된 Zod enum 일 가능성 큼.

파일 열어서:
- `z.enum([...SnsType 값들])` 을 `CampaignSubType` 로 rename (변수/타입 export 이름 모두)
- 값 배열에 `"QOO10", "LIPS", "ATCOSME"` 추가
- `snsRecruits` → `recruits` 필드 이름 변경 (Recruit 관련 스키마)
- `snsType` 필드 → `subType` 로 rename
- Recruit 스키마에 `productPriceJpy: z.number().int().positive().nullable()`, `productUrl: z.string().url().nullable()` 추가
- `CampaignCategory` schema 추가 (`z.enum(["SNS", "FAKE_PURCHASE"])`) 및 Campaign response 에 `category` 필드 추가

정확한 편집은 파일 열어 확인 후 수행. Zod 스키마 변경 예시:

```ts
export const CampaignSubTypeSchema = z.enum([
  "INSTAGRAM",
  "TIKTOK",
  "X",
  "YOUTUBE",
  "QOO10",
  "LIPS",
  "ATCOSME",
]);
export type CampaignSubType = z.infer<typeof CampaignSubTypeSchema>;

export const CampaignCategorySchema = z.enum(["SNS", "FAKE_PURCHASE"]);
export type CampaignCategory = z.infer<typeof CampaignCategorySchema>;

// Recruit 스키마
export const CampaignRecruitSchema = z.object({
  subType: CampaignSubTypeSchema,
  minFollowers: z.number().int().nonnegative(),
  recruitCount: z.number().int().nonnegative(),
  instagramPostTypes: z.array(InstagramPostTypeSchema),
  insightRequired: z.boolean(),
  productPriceJpy: z.number().int().positive().nullable(),
  productUrl: z.string().url().nullable(),
});
```

- [ ] **Step 2: `application.ts` 편집**

- `snsType: SnsTypeSchema` → `subType: CampaignSubTypeSchema` (모든 참조)
- ApplicationStatus enum 에 `ORDER_SUBMITTED`, `REVIEW_SUBMITTED` 추가
- `InfluencerApplication`, `AdminApplication` response 에 다음 nullable 필드 추가:
  - `orderNumber: z.string().nullable()`
  - `orderSubmittedAt: IsoDateTime.nullable()`
  - `reviewSubmittedAt: IsoDateTime.nullable()`
- Category 필드 노출 (`category: CampaignCategorySchema`) 관련 응답 스키마 조정

- [ ] **Step 3: `lineTemplate.ts` 편집**

- `LineTriggerSubTypeSchema` 에 `QOO10`, `LIPS`, `ATCOSME` 추가
- `LineTriggerKeySchema` 에 `FAKE_PURCHASE_*` 10개 추가

- [ ] **Step 4: 나머지 4개 파일 (`influencer.ts`, `adminInfluencer.ts`, `adminReport.ts`, `applicationExport.ts`, `snsHandle.ts`) 편집**

각 파일에서 `SnsType` → `CampaignSubType`, `snsType` → `subType` 로 일괄 rename. `SnsAccount` 관련 필드는 그대로 유지 (인플루언서의 SNS 계정 정보는 별개 개념).

**중요**: `SnsAccount.snsType` (인플루언서 SNS 계정의 타입) 은 SnsType 을 유지할지 결정 필요. 이 스펙 범위에서는 **동일 enum 재사용** (CampaignSubType) 으로 통합. 즉 인플루언서 프로필의 snsAccounts 도 subType 을 갖게 됨. (QOO10/LIPS/ATCOSME 값이 노출되지만 사용 안 됨. 향후 사용자 프로필에 리뷰 플랫폼 계정 등록 시 활용 가능)

- [ ] **Step 5: `index.ts` re-export 확인**

`packages/shared/src/index.ts` 에서 rename 반영. `SnsType` export → `CampaignSubType`.

- [ ] **Step 6: 빌드 및 typecheck**

```bash
pnpm --filter @jsure/shared build
```

Expected: 통과. shared 는 자체 완결이므로 여기서 통과해야 함.

- [ ] **Step 7: 커밋**

```bash
git add packages/shared/src
git commit -m "feat(shared): SnsType→CampaignSubType rename 및 가구매 필드 추가"
```

---

## Task 7: apps/api rename 스윕

**Files (대략)**:
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts`
- Modify: `apps/api/src/influencer-applications/influencer-applications.controller.ts`
- Modify: `apps/api/src/admin-applications/admin-applications.service.ts`
- Modify: `apps/api/src/admin-applications/admin-applications.controller.ts`
- Modify: `apps/api/src/campaigns/campaigns.service.ts`
- Modify: `apps/api/src/campaigns/campaigns.controller.ts`
- Modify: `apps/api/src/uploads/uploads.service.ts`
- Modify: `apps/api/src/uploads/uploads.controller.ts`
- Modify: `apps/api/src/uploads/admin-uploads.controller.ts`
- Modify: `apps/api/src/influencer-me/*.ts`
- Modify: `apps/api/src/settlements/ensure-settlement.ts`
- Modify: `apps/api/src/influencer-campaigns/display-stage.ts`
- Modify: `apps/api/src/influencer-campaigns/influencer-campaigns.service.ts`
- Modify: `apps/api/src/admin-broadcasts/admin-broadcasts.service.ts`
- Modify: `apps/api/src/line-templates/trigger-meta.ts`

- [ ] **Step 1: rename 대상 파일 목록 확보**

```bash
grep -rln "SnsType\|snsType\|CampaignSnsRecruit\|SubmittedPostAttachment\|snsRecruits" apps/api/src
```

각 파일을 순회하며 아래 규칙으로 치환:
- 타입 `SnsType` → `CampaignSubType`
- 필드 `.snsType` → `.subType`
- 함수/변수 `snsType` → `subType`
- 모델 `CampaignSnsRecruit` → `CampaignRecruit`
- Prisma 접근 `prisma.campaignSnsRecruit` → `prisma.campaignRecruit`
- Prisma 접근 `prisma.submittedPostAttachment` → `prisma.attachment`
- 관계 이름 `snsRecruits` → `recruits`
- 모델 `SubmittedPostAttachment` → `Attachment`

- [ ] **Step 2: `apps/api/src/settlements/ensure-settlement.ts` — Settlement 신규 컬럼 대응**

기존 Settlement 생성/업데이트 시 `rewardAmountJpy` 를 명시:

```ts
await prisma.settlement.upsert({
  where: { postId },
  create: {
    postId,
    amountJpy: campaign.rewardJpy,
    rewardAmountJpy: campaign.rewardJpy,   // 신규
    productRefundJpy: 0,                    // 신규 (SNS 는 0)
    status: "PENDING",
  },
  update: {},
});
```

- [ ] **Step 3: `apps/api/src/uploads/uploads.service.ts` — Attachment 사용 대응**

기존 `submittedPostAttachment.create` 호출부:
- Prisma 필드 `SubmittedPostAttachment` → `Attachment`
- `applicationId` 필드 추가 (인사이트 첨부는 postId 로만 저장했었지만, 이제 applicationId 도 필수)
- `kind: "INSIGHT_SCREENSHOT"` 추가

예:
```ts
await this.prisma.attachment.create({
  data: {
    kind: "INSIGHT_SCREENSHOT",
    applicationId: post.applicationId,
    postId: post.id,
    objectKey,
    contentType,
    sizeBytes,
  },
});
```

- [ ] **Step 4: typecheck 및 jest**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
pnpm --filter @jsure/api exec jest
```

Expected: typecheck 통과 (0 errors), jest 통과. 기존 33개 테스트 유지.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src
git commit -m "refactor(api): SnsType→CampaignSubType rename 반영, Attachment 통합 적용"
```

---

## Task 8: apps/admin-web rename 스윕

**Files (대략, 15개)**:
- Modify: `apps/admin-web/src/domains/campaign/**/*.tsx` (CampaignForm, SnsRecruitList, CampaignCardSnsRecruits 등)
- Modify: `apps/admin-web/src/domains/application/**/*.tsx` (draftsApi.ts, InsightDetailDialog.tsx 등)
- Modify: `apps/admin-web/src/domains/broadcast/**/*.tsx`
- Modify: `apps/admin-web/src/pages/Campaigns/*.tsx`
- Modify: `apps/admin-web/src/pages/Applicants/*.tsx`
- Modify: `apps/admin-web/src/pages/Influencers/*.tsx`

- [ ] **Step 1: 대상 파일 목록 확보**

```bash
grep -rln "SnsType\|snsType\|snsRecruits" apps/admin-web/src
```

- [ ] **Step 2: 동일 치환 규칙 적용**

- 타입 `SnsType` → `CampaignSubType`
- 필드 `.snsType` → `.subType`
- 함수/변수 명 `snsType` → `subType` (선언, 파라미터, 사용처 모두)
- 관계 `snsRecruits` → `recruits`
- 컴포넌트 이름은 이 Plan 범위 밖 (`SnsRecruitList` 는 Plan C 에서 재작성 예정) — 이번엔 참조 필드만 rename

**컴포넌트/파일명 리네임 유예**: `SnsRecruitList.tsx`, `CampaignCardSnsRecruits.tsx` 파일명은 이번 Plan A 에서 유지. 내부 rename 만 반영. Plan C 에서 컴포넌트 재작성 시 파일도 함께 rename.

- [ ] **Step 3: build 및 lint**

```bash
pnpm --filter @jsure/admin-web build
pnpm --filter @jsure/admin-web lint
```

Expected: 통과 (`--max-warnings=0`).

- [ ] **Step 4: 커밋**

```bash
git add apps/admin-web/src
git commit -m "refactor(admin-web): SnsType→CampaignSubType rename 반영"
```

---

## Task 9: apps/client-web rename 스윕

**Files (대략, 16개)**:
- Modify: `apps/client-web/src/pages/CampaignDetail/index.tsx`
- Modify: `apps/client-web/src/pages/Apply/index.tsx`
- Modify: `apps/client-web/src/pages/Applications/*.tsx`
- Modify: `apps/client-web/src/pages/Auth/*.tsx`
- Modify: `apps/client-web/src/pages/Signup/*.tsx`
- Modify: `apps/client-web/src/domains/campaign/**/*.tsx`
- Modify: `apps/client-web/src/domains/application/**/*.tsx`
- Modify: `apps/client-web/src/domains/auth/**/*.tsx`

- [ ] **Step 1: 대상 파일 목록 확보**

```bash
grep -rln "SnsType\|snsType\|snsRecruits" apps/client-web/src
```

- [ ] **Step 2: 동일 치환 규칙 적용**

Task 7/8 와 동일 규칙.

- [ ] **Step 3: build 및 lint**

```bash
pnpm --filter @jsure/client-web build
pnpm --filter @jsure/client-web lint
```

Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add apps/client-web/src
git commit -m "refactor(client-web): SnsType→CampaignSubType rename 반영"
```

---

## Task 10: 전체 회귀 검증

**Files**: (변경 없음)

- [ ] **Step 1: 전체 typecheck**

```bash
pnpm typecheck
```

Expected: 모든 패키지 통과.

- [ ] **Step 2: 전체 jest**

```bash
pnpm --filter @jsure/api exec jest
```

Expected: pre-existing 1개 실패(`display-stage.spec.ts`)만 제외하고 통과. 신규 실패 없음.

- [ ] **Step 3: 전체 lint**

```bash
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/client-web lint
```

Expected: 0 warnings.

- [ ] **Step 4: 로컬 dev 서버 기동 및 SNS 흐름 확인**

```bash
pnpm dev
```

Manually verify (스모크 테스트):
- 어드민에서 캠페인 조회 정상
- 인플루언서에서 캠페인 조회/신청 정상
- 응모자 관리 페이지 정상
- 게시물 검토 페이지 정상
- 정산 페이지 정상

기존 SNS 캠페인 데이터가 그대로 표시되는지, `category = SNS` 로 잘 백필됐는지 확인.

- [ ] **Step 5: DB 검증 쿼리**

```sql
-- 전체 캠페인은 SNS 카테고리로 백필됨
SELECT COUNT(*) FROM campaigns WHERE category = 'SNS';

-- 모든 attachment 는 applicationId 가 채워짐
SELECT COUNT(*) FROM attachments WHERE "applicationId" IS NULL;
-- Expected: 0

-- 모든 attachment 는 INSIGHT_SCREENSHOT 로 백필됨
SELECT kind, COUNT(*) FROM attachments GROUP BY kind;
-- Expected: 전체가 INSIGHT_SCREENSHOT

-- Settlement 백필 확인
SELECT COUNT(*) FROM settlements WHERE "rewardAmountJpy" != "amountJpy";
-- Expected: 0

-- CampaignRecruit 신규 컬럼은 nullable
SELECT COUNT(*) FROM campaign_recruits WHERE "productPriceJpy" IS NOT NULL;
-- Expected: 0 (아직 아무 캠페인도 가구매 아님)
```

- [ ] **Step 6: 최종 커밋** (필요 시)

만약 회귀 검증 중 사소한 수정이 발견되면:
```bash
git add <touched-files>
git commit -m "fix: 스키마 rename 후 발견된 회귀 수정"
```

---

## 오픈 이슈 / 후속 (Plan A 범위 밖)

- `SnsAccount.snsType` 필드가 인플루언서 프로필용인지 확인. `CampaignSubType` 재사용은 논쟁 여지 (인플루언서는 QOO10/LIPS 계정을 안 가짐). Plan B 에서 재검토
- `snsHandle.ts` 유틸의 파일명 유지. 향후 이름 변경 필요 시 별도 정리
- 어드민 UI 의 `SnsRecruitList`, `CampaignCardSnsRecruits` 컴포넌트/파일명 rename 은 Plan C 에서 컴포넌트 재작성 시 함께 처리

## 롤백 시나리오

- 회귀 검증 실패 시: 마이그레이션은 실제 rename SQL 이라 되돌리기 어려움. 스테이징 전면 검증 후 프로덕션 진행
- 프로덕션 롤백 대신 forward-fix 원칙
- 브랜치 자체 삭제 시: 로컬 dev DB 리셋 (`prisma migrate reset`) 로 복구

## 완료 조건

- 전체 typecheck 통과 ✓
- 전체 lint 통과 ✓
- 전체 jest 통과 (pre-existing 1개 실패 제외) ✓
- SNS 캠페인 스모크 테스트 통과 ✓
- DB 백필 검증 쿼리 모두 정상 ✓
- 6 커밋 (스키마 / shared / api / admin-web / client-web / [필요 시] fix)

이 Plan A 완료 후 Plan B (백엔드 가구매 서비스) 로 진행.
