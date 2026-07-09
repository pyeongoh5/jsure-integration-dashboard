# 가구매 단일 트랙 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 가구매 캠페인을 QOO10 단일 서브타입 + LIPS/@cosme 옵션 리뷰 채널 모델로 재설계.

**Architecture:** enum 축소 → CampaignRecruit rename(instagramPostTypes → subTypeOptions) → SubmittedPost.submissionData 신설 → 서비스/UI 전면 조정.

**Tech Stack:** Prisma 5, NestJS, React 18, Vite, Zod, pnpm monorepo.

---

## 실행 규칙

- 커밋 메시지 한글
- `git add -A` 금지, 명시 경로만
- admin-web 한국어 하드코딩 OK / client-web i18n 필수
- 약어 금지, 주석 최소
- 브랜치: `feat/fake-purchase-single-track` (main `main` 기반)

## 사전 확인

- 이전 Plan A/B/C 는 별도 브랜치 `feat/fake-purchase-ui` 로 미머지 상태 (관련 코드는 main 에는 없거나 이전 Plan B 만 반영). 본 Plan 은 `feat/fake-purchase-ui` 를 base 로 이어감

---

## Task 1: shared — enum / 스키마 재정의

**Files:**
- Modify: `packages/shared/src/types/influencer.ts` (CampaignSubType)
- Modify: `packages/shared/src/types/lineTemplate.ts` (LineTriggerSubType)
- Modify: `packages/shared/src/types/campaign.ts` (CampaignRecruit)
- Modify: `packages/shared/src/types/application.ts` (SubmittedPost / SubmitReviewRequest)
- Modify: `packages/shared/src/ui/labels.ts` (FAKE_PURCHASE_SUB_TYPES)

- [ ] **Step 1: `CampaignSubTypeSchema` 축소**

```ts
export const CampaignSubTypeSchema = z.enum([
  "INSTAGRAM",
  "TIKTOK",
  "X",
  "YOUTUBE",
  "QOO10",
]);
```

- [ ] **Step 2: `LineTriggerSubTypeSchema` 축소**

```ts
export const LineTriggerSubTypeSchema = z.enum(["INSTAGRAM", "X", "QOO10"]);
```

- [ ] **Step 3: `CampaignRecruitSchema` 및 form input rename**

```ts
export const CampaignRecruitSchema = z.object({
  subType: CampaignSubTypeSchema,
  minFollowers: z.number().int().min(0),
  recruitCount: z.number().int().min(1),
  insightRequired: z.boolean(),
  subTypeOptions: z.array(z.string()).default([]), // FEED/REELS or LIPS/ATCOSME
  productPriceJpy: z.number().int().positive().nullable().default(null),
  productUrl: z.string().url().nullable().default(null),
});
```

`CampaignRecruitInputSchema` 도 동일. `superRefine` 로직도 subTypeOptions 검증으로 갱신:
- SNS INSTAGRAM: subTypeOptions ⊆ {"FEED","REELS"}
- SNS 기타: subTypeOptions = []
- FAKE_PURCHASE QOO10: subTypeOptions ⊆ {"LIPS","ATCOSME"}

- [ ] **Step 4: `SubmittedPost` / `SubmitReviewRequestSchema` 갱신**

```ts
export const SubmittedPostSchema = z.object({
  ...
  url: z.string().nullable(), // QOO10 는 null
  submissionData: z.record(z.unknown()).nullable().default(null),
});

export const SubmitReviewRequestSchema = z.object({
  screenshots: z.array(AttachmentUploadInputSchema).min(2).max(10),
  reviewUrls: z.record(
    z.enum(["LIPS","ATCOSME"]),
    z.string().url().startsWith("https://"),
  ).default({}),
});
```

기존 `reviewUrl` 단일 필드 제거.

- [ ] **Step 5: `FAKE_PURCHASE_SUB_TYPES` 축소**

`packages/shared/src/ui/labels.ts`:

```ts
export const FAKE_PURCHASE_SUB_TYPES = ["QOO10"] as const;
```

- [ ] **Step 6: build / commit**

```bash
pnpm --filter @jsure/shared build
git add packages/shared/src/types/*.ts packages/shared/src/ui/labels.ts
git commit -m "feat(shared): 가구매 단일 트랙 스키마 (enum 축소, subTypeOptions, submissionData, reviewUrls)"
```

---

## Task 2: prisma — enum 축소 + 컬럼 rename + JSON 필드

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/{timestamp}_fake_purchase_single_track/migration.sql`

- [ ] **Step 1: schema.prisma 갱신**

```prisma
enum CampaignSubType {
  INSTAGRAM
  TIKTOK
  X
  YOUTUBE
  QOO10
}

enum LineTriggerSubType {
  INSTAGRAM
  X
  QOO10
}

model CampaignRecruit {
  // ...
  subTypeOptions String[] @default([]) // instagramPostTypes 대체
  productPriceJpy Int?
  productUrl      String?
  // ...
}

model SubmittedPost {
  // ...
  url            String?
  submissionData Json?
  // ...
}
```

- [ ] **Step 2: 마이그레이션 SQL 수동 작성**

`prisma migrate dev --create-only --name fake_purchase_single_track` 실행 후 자동 생성된 SQL 이 안전하지 않을 수 있으므로 수동 편집:

```sql
-- 1) FAKE_PURCHASE dead data cleanup
DELETE FROM "line_message_templates" WHERE "sub_type" IN ('LIPS','ATCOSME');
DELETE FROM "attachments" WHERE "application_id" IN (
  SELECT id FROM "campaign_applications" WHERE "sub_type" IN ('LIPS','ATCOSME')
);
DELETE FROM "submitted_posts" WHERE "sub_type" IN ('LIPS','ATCOSME');
DELETE FROM "campaign_applications" WHERE "sub_type" IN ('LIPS','ATCOSME');
DELETE FROM "campaign_recruits" WHERE "sub_type" IN ('LIPS','ATCOSME');

-- 2) CampaignSubType 축소
ALTER TYPE "CampaignSubType" RENAME TO "CampaignSubType_old";
CREATE TYPE "CampaignSubType" AS ENUM ('INSTAGRAM','TIKTOK','X','YOUTUBE','QOO10');
ALTER TABLE "campaign_recruits" ALTER COLUMN "sub_type" TYPE "CampaignSubType" USING "sub_type"::text::"CampaignSubType";
ALTER TABLE "campaign_applications" ALTER COLUMN "sub_type" TYPE "CampaignSubType" USING "sub_type"::text::"CampaignSubType";
ALTER TABLE "submitted_posts" ALTER COLUMN "sub_type" TYPE "CampaignSubType" USING "sub_type"::text::"CampaignSubType";
DROP TYPE "CampaignSubType_old";

-- 3) LineTriggerSubType 축소
ALTER TYPE "LineTriggerSubType" RENAME TO "LineTriggerSubType_old";
CREATE TYPE "LineTriggerSubType" AS ENUM ('INSTAGRAM','X','QOO10');
ALTER TABLE "line_message_templates" ALTER COLUMN "sub_type" TYPE "LineTriggerSubType" USING "sub_type"::text::"LineTriggerSubType";
DROP TYPE "LineTriggerSubType_old";

-- 4) CampaignRecruit 컬럼 rename
ALTER TABLE "campaign_recruits" RENAME COLUMN "instagram_post_types" TO "sub_type_options";

-- 5) SubmittedPost 신규 필드 + url nullable
ALTER TABLE "submitted_posts" ADD COLUMN "submission_data" JSONB;
ALTER TABLE "submitted_posts" ALTER COLUMN "url" DROP NOT NULL;
```

- [ ] **Step 3: prisma generate + 마이그레이션 배포**

```bash
pnpm --filter @jsure/api exec prisma generate
pnpm --filter @jsure/api exec prisma migrate deploy
```

- [ ] **Step 4: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(api): 가구매 단일 트랙 마이그레이션 (enum 축소, subTypeOptions, submissionData)"
```

---

## Task 3: api — CampaignSubType/LineTriggerSubType 참조 sweep

**Files:** api 전체 sweep

- [ ] **Step 1: `LIPS`/`ATCOSME` 문자열 참조 검색**

```bash
grep -rn "LIPS\|ATCOSME" apps/api/src --include="*.ts"
```

각 참조를:
- Enum 배열/switch 에서 LIPS/ATCOSME 케이스 제거
- `campaignSubTypeToTriggerSubType` (있다면) 매핑에서 LIPS/ATCOSME 제거
- FAKE_PURCHASE_SUB_TYPES 상수 → `["QOO10"]`

- [ ] **Step 2: `instagramPostTypes` → `subTypeOptions` sweep**

```bash
grep -rn "instagramPostTypes\|instagram_post_types" apps/api/src --include="*.ts"
```

Prisma select/include/create/update payload 를 subTypeOptions 로 갱신.

- [ ] **Step 3: typecheck / commit**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src
git commit -m "refactor(api): CampaignRecruit.subTypeOptions rename 반영 및 LIPS/ATCOSME 참조 제거"
```

---

## Task 4: api — submitReview 재작성 (screenshots + reviewUrls)

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts`
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.spec.ts`
- Modify: `apps/api/src/influencer-applications/influencer-applications.controller.ts`

- [ ] **Step 1: submitReview 시그니처 변경**

```ts
async submitReview(
  influencerId: string,
  applicationId: string,
  screenshots: AttachmentUploadInput[],
  reviewUrls: Partial<Record<"LIPS"|"ATCOSME", string>>,
): Promise<InfluencerApplication>
```

내부 로직:
1. 기존 카테고리/상태 검증 유지
2. `application.campaign.recruits` 에서 QOO10 recruit 로드 → `subTypeOptions` 획득
3. 요구 채널 집합 = subTypeOptions ∩ {LIPS, ATCOSME}
4. 요구 채널마다 `reviewUrls[channel]` 존재 + `https://` 시작 검증. 하나라도 누락 → `REVIEW_URL_REQUIRED`
5. `reviewUrls` 에 있으나 요구되지 않은 채널 → `REVIEW_URL_NOT_REQUESTED`
6. screenshots ≥ 2
7. verifyAttachmentUploads
8. 트랜잭션:
   - 첫 제출: submittedPost.create({ subType:"QOO10", url: null, submissionData: { reviewUrls }, reviewStatus:"PENDING", submittedAt })
   - 재제출: existingPost.update({ url: null, submissionData: { reviewUrls }, reviewStatus:"PENDING", reviewedAt: null, reviewedById: null }) + attachment.deleteMany(kind=REVIEW_SCREENSHOT)
   - attachment.createMany (kind=REVIEW_SCREENSHOT)
   - application.update(status:"REVIEW_SUBMITTED", reviewSubmittedAt)
9. dispatch(FAKE_PURCHASE_REVIEW_SUBMITTED)

- [ ] **Step 2: 컨트롤러 payload 갱신**

```ts
@Post(":id/review")
submitReview(
  @Request() req,
  @Param("id") id: string,
  @Body(new ZodValidationPipe(SubmitReviewRequestSchema)) dto,
) {
  return this.svc.submitReview(req.user.id, id, dto.screenshots, dto.reviewUrls);
}
```

- [ ] **Step 3: spec 갱신**

기존 submitReview 5 케이스를:
- 첫 제출 (reviewUrls 없음) — subTypeOptions=[] 이면 성공
- 첫 제출 + subTypeOptions=["LIPS"] + reviewUrls={LIPS:"https://..."} → 성공
- 첫 제출 + subTypeOptions=["LIPS"] + reviewUrls={} → REVIEW_URL_REQUIRED
- 첫 제출 + reviewUrls={ATCOSME:...} + subTypeOptions=["LIPS"] → REVIEW_URL_NOT_REQUESTED
- 재제출: 기존 attachment/submissionData 초기화
- screenshots 1장 → 400

- [ ] **Step 4: typecheck / jest / commit**

```bash
pnpm --filter @jsure/api exec jest src/influencer-applications
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/influencer-applications
git commit -m "feat(api): submitReview 재작성 (screenshots + 채널별 reviewUrls, subTypeOptions 기반 검증)"
```

---

## Task 5: api — CampaignForm 검증 (subTypeOptions 카테고리별)

**Files:**
- Modify: `apps/api/src/campaigns/campaigns.service.ts`
- Modify: `apps/api/src/campaigns/campaigns.service.spec.ts`

- [ ] **Step 1: `validateRecruitsForCategory` 갱신**

- SNS INSTAGRAM recruit: subTypeOptions ⊆ {"FEED","REELS"}
- SNS 기타: subTypeOptions = []
- FAKE_PURCHASE QOO10: subTypeOptions ⊆ {"LIPS","ATCOSME"}, productPriceJpy>0, productUrl 필수
- FAKE_PURCHASE 는 recruit 이 정확히 1개 (subType=QOO10)

기존 `instagramPostTypes` 참조는 `subTypeOptions` 로 이관.

- [ ] **Step 2: spec 케이스 갱신**

기존 4 케이스 + 신규:
- FAKE_PURCHASE + recruits 2개 → 400
- FAKE_PURCHASE + subType!==QOO10 → 400
- FAKE_PURCHASE + subTypeOptions=["INVALID"] → 400

- [ ] **Step 3: 커밋**

```bash
pnpm --filter @jsure/api exec jest src/campaigns
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/campaigns
git commit -m "feat(api): campaigns 단일 트랙 recruit 검증 (subTypeOptions 카테고리별)"
```

---

## Task 6: api — apply 흐름 QOO10 강제

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts` (create)

- [ ] **Step 1: FAKE_PURCHASE 응모는 subType=QOO10 로 강제**

```ts
if (campaign.category === "FAKE_PURCHASE") {
  subTypes = ["QOO10"];
}
```

기존 SUBTYPE_CATEGORY_MISMATCH 검증은 SNS 만 대상.

- [ ] **Step 2: typecheck / commit**

```bash
pnpm --filter @jsure/api exec tsc --noEmit
git add apps/api/src/influencer-applications/influencer-applications.service.ts
git commit -m "feat(api): 가구매 응모는 subType=QOO10 강제"
```

---

## Task 7: api — 시드 갱신

**Files:**
- Modify: `apps/api/prisma/seeds/line-templates.seed.ts`

- [ ] **Step 1: LIPS/ATCOSME 시드 루프 삭제, QOO10 만 남김**

```ts
for (const row of FP_SEED_ROWS) {
  await prisma.lineMessageTemplate.upsert({
    where: { category_subType_triggerKey: { category:"FAKE_PURCHASE", subType:"QOO10", triggerKey: row.triggerKey } },
    create: { category:"FAKE_PURCHASE", subType:"QOO10", triggerKey: row.triggerKey, enabled: row.enabled, body: row.body },
    update: {},
  });
}
```

- [ ] **Step 2: 실행 + 커밋**

```bash
pnpm --filter @jsure/api exec ts-node prisma/seeds/line-templates.seed.ts
git add apps/api/prisma/seeds/line-templates.seed.ts
git commit -m "feat(api): LINE 템플릿 시드 QOO10 만 남김 (LIPS/ATCOSME 제거)"
```

---

## Task 8: admin-web — CampaignForm/RecruitList (subTypeOptions rename)

**Files:**
- Modify: `apps/admin-web/src/domains/campaign/components/RecruitList.tsx`
- Modify: `apps/admin-web/src/domains/campaign/components/CampaignForm.tsx`

- [ ] **Step 1: FAKE_PURCHASE recruit UI 조정**

- FAKE_PURCHASE 선택 시 QOO10 recruit 카드 하나 강제 (체크박스로 추가/제거 안 됨)
- QOO10 recruit 카드에 `subTypeOptions` 체크박스 (LIPS / @cosme) 추가
- INSTAGRAM recruit 는 기존 instagramPostTypes 필드명만 `subTypeOptions` 로 변경 (UI 동일)

- [ ] **Step 2: form schema / API 호출 payload 갱신**

`instagramPostTypes` → `subTypeOptions`. Zod schema refine 도 subTypeOptions 기준.

- [ ] **Step 3: typecheck / build / commit**

```bash
pnpm --filter @jsure/admin-web exec tsc -b --noEmit
pnpm --filter @jsure/admin-web build
git add apps/admin-web/src/domains/campaign
git commit -m "feat(admin-web): CampaignForm QOO10 recruit 강제 + subTypeOptions 체크박스"
```

---

## Task 9: admin-web — Applicants / Drafts UI 정리

**Files:**
- Modify: `apps/admin-web/src/domains/application/components/applicants/*`
- Modify: `apps/admin-web/src/domains/application/components/drafts/*`

- [ ] **Step 1: 매체 컬럼 QOO10 만 노출**

FAKE_PURCHASE pill 은 QOO10 하나만. LIPS/ATCOSME pill 관련 코드/CSS 삭제.

- [ ] **Step 2: Drafts 상세 다이얼로그에 리뷰 URL 섹션**

`InsightDetailDialog` 확장: `submittedPost.submissionData?.reviewUrls` 를 라벨 + 링크로 나열. 없으면 섹션 hidden.

- [ ] **Step 3: 메시지 템플릿 UI 서브타입 라디오 QOO10 만 노출**

`apps/admin-web/src/pages/MessageTemplates/index.tsx` 의 `FAKE_PURCHASE_SUB_TYPES` 를 `["QOO10"]` 로.

- [ ] **Step 4: typecheck / build / commit**

```bash
pnpm --filter @jsure/admin-web exec tsc -b --noEmit
pnpm --filter @jsure/admin-web build
git add apps/admin-web/src
git commit -m "feat(admin-web): Applicants/Drafts/MessageTemplates 가구매 QOO10 단일 서브타입 반영"
```

---

## Task 10: client-web — Apply / CampaignDetail / Browse 조정

**Files:**
- Modify: `apps/client-web/src/pages/Apply/index.tsx`
- Modify: `apps/client-web/src/pages/CampaignDetail/index.tsx`
- Modify: `apps/client-web/src/domains/campaign/*` (Browse 카드)

- [ ] **Step 1: Apply 에서 FAKE_PURCHASE 는 subType 선택 UI 완전 숨김**

기존 subType 체크박스 렌더 skip. payload 는 서버가 강제하므로 신경 안 써도 되지만 명확성 위해 클라이언트도 `["QOO10"]` 로 넣어 보내는 편이 안전.

- [ ] **Step 2: CampaignDetail 에 리뷰 채널 요약 표시**

QOO10 recruit 카드에 `subTypeOptions` 값이 있으면 문구 추가 — 예: "リビューチャンネル: Qoo10 + LIPS + @cosme". i18n 키 사용.

- [ ] **Step 3: Browse 카드에서 LIPS/ATCOSME 뱃지 삭제**

FAKE_PURCHASE 카드에는 QOO10 만.

- [ ] **Step 4: typecheck / build / commit**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src/pages apps/client-web/src/domains/campaign
git commit -m "feat(client-web): Apply/CampaignDetail/Browse 가구매 단일 서브타입 반영"
```

---

## Task 11: client-web — ReviewSubmitForm 재작성

**Files:**
- Modify: `apps/client-web/src/domains/application/components/ReviewSubmitForm.tsx`
- Modify: `apps/client-web/src/domains/application/api.ts` (submitReview)
- Modify: `i18n/messages.ts`

- [ ] **Step 1: 폼 필드 확장**

- QOO10 스크린샷 업로드 (기존)
- recruit.subTypeOptions 를 props 로 받아 각 채널 URL 입력 필드 렌더

- [ ] **Step 2: submit payload**

```ts
{ screenshots: [...], reviewUrls: { LIPS: "...", ATCOSME: "..." } }
```

`submitReview(applicationId, screenshots, reviewUrls)` API 클라이언트 갱신.

- [ ] **Step 3: i18n 키 추가**

```
application.reviewForm.channelUrlLabelPrefix
application.reviewForm.channelUrlLabelSuffix
application.reviewForm.channelUrlPlaceholder
```

- [ ] **Step 4: Detail.tsx 에서 recruit.subTypeOptions 전달**

응모 상세 데이터에서 recruit 로드 후 subTypeOptions 를 폼 props 로.

- [ ] **Step 5: typecheck / build / commit**

```bash
pnpm --filter @jsure/client-web exec tsc -b --noEmit
pnpm --filter @jsure/client-web build
git add apps/client-web/src apps/client-web/src/domains/application i18n/messages.ts
git commit -m "feat(client-web): ReviewSubmitForm 스크린샷+채널 URL 통합 제출"
```

---

## Task 12: 최종 회귀

- [ ] **Step 1: pnpm typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2: pnpm build (admin-web + client-web)**

- [ ] **Step 3: api jest 회귀**

```bash
pnpm --filter @jsure/api exec jest
```

`INSIGHT_DUE_DAYS=0` pre-existing 실패 1건 외 통과 확인.

- [ ] **Step 4: DB 상태 검증**

```sql
SELECT category, sub_type, COUNT(*) FROM line_message_templates GROUP BY category, sub_type;
-- Expected: SNS × (INSTAGRAM|X) = 각 15 row, FAKE_PURCHASE × QOO10 = 10 row
```

- [ ] **Step 5: 회귀 fix 커밋 (필요 시)**

## 완료 조건

- typecheck / build 통과
- 마이그레이션 배포 후 DB enum 및 데이터 정합
- api / admin-web / client-web 모두 QOO10 단일 트랙 흐름으로 동작
- LIPS/ATCOSME 는 오직 캠페인 recruit 의 subTypeOptions 및 SubmittedPost.submissionData.reviewUrls 로만 존재
