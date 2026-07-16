-- 캠페인 응모 통합: 서브타입별 응모 행을 (campaignId, influencerId) 단위 1건으로 병합.
-- - Campaign.rewardType (UNIFIED/PER_SUBTYPE) + CampaignRecruit.rewardJpy 추가
-- - CampaignApplication.subType → subTypes 배열, 검토 필드(submissionReview*) 응모 레벨로 이동
-- - Settlement/SubmittedPostRejection 을 post 단위 → application 단위로 이전
--
-- 병합 규칙:
-- - 승자 = active(REJECTED/CANCELLED 아님) 우선 → 진행도 낮은 순 → appliedAt 오름차순
-- - subTypes = active 형제의 subType 집합 (전부 inactive 면 전체 — 제외 캠페인 이력 보존)
-- - 검토 상태 병합: REJECTED > PENDING > APPROVED
-- - 정산: 그룹 내 status 혼재(PENDING+COMPLETED) 시 마이그레이션 중단 → 수동 정리 후 재실행

-- ========== 1. DDL: 신규 enum/컬럼 ==========

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('UNIFIED', 'PER_SUBTYPE');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "rewardType" "RewardType" NOT NULL DEFAULT 'UNIFIED';

-- AlterTable
ALTER TABLE "campaign_recruits" ADD COLUMN "rewardJpy" INTEGER;

-- AlterTable (subType 컬럼은 병합 완료 후 drop)
ALTER TABLE "campaign_applications"
ADD COLUMN "subTypes" "CampaignSubType"[],
ADD COLUMN "submissionReviewStatus" "PostReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "submissionReviewedAt" TIMESTAMP(3),
ADD COLUMN "submissionReviewedById" TEXT;

-- AlterTable (백필 후 NOT NULL 전환)
ALTER TABLE "settlements" ADD COLUMN "applicationId" TEXT;
ALTER TABLE "submitted_post_rejections" ADD COLUMN "applicationId" TEXT;

-- ========== 2. 사전 검증: 같은 그룹에 PENDING/COMPLETED 정산 혼재 시 중단 ==========

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "settlements" s
    JOIN "submitted_posts" p ON p."id" = s."postId"
    JOIN "campaign_applications" a ON a."id" = p."applicationId"
    GROUP BY a."campaignId", a."influencerId"
    HAVING COUNT(DISTINCT s."status") > 1
  ) THEN
    RAISE EXCEPTION '같은 (캠페인, 인플루언서) 그룹에 PENDING/COMPLETED 정산이 혼재합니다. 어드민에서 해당 정산을 완료 처리한 뒤 마이그레이션을 재실행하세요.';
  END IF;
END $$;

-- ========== 3. 승자 선정 ==========

CREATE TEMP TABLE "app_merge" AS
SELECT
  a."id",
  a."campaignId",
  a."influencerId",
  a."subType",
  a."status",
  a."appliedAt",
  (a."status" NOT IN ('REJECTED', 'CANCELLED')) AS "isActive",
  ROW_NUMBER() OVER (
    PARTITION BY a."campaignId", a."influencerId"
    ORDER BY
      (a."status" IN ('REJECTED', 'CANCELLED')),
      CASE a."status"
        WHEN 'APPLIED' THEN 0
        WHEN 'APPROVED' THEN 1
        WHEN 'SHIPPED' THEN 2
        WHEN 'ORDER_SUBMITTED' THEN 2
        WHEN 'DELIVERED' THEN 3
        WHEN 'REVIEW_SUBMITTED' THEN 4
        WHEN 'COMPLETED' THEN 5
        WHEN 'REJECTED' THEN 90
        WHEN 'CANCELLED' THEN 91
      END,
      a."appliedAt"
  ) AS "rn"
FROM "campaign_applications" a;

CREATE TEMP TABLE "app_map" AS
SELECT m."id" AS "loserId", w."id" AS "winnerId"
FROM "app_merge" m
JOIN "app_merge" w
  ON w."campaignId" = m."campaignId"
 AND w."influencerId" = m."influencerId"
 AND w."rn" = 1
WHERE m."rn" > 1;

-- ========== 4. 승자 필드 병합 ==========

WITH "grp" AS (
  SELECT
    m."campaignId",
    m."influencerId",
    BOOL_OR(m."isActive") AS "hasActive",
    COALESCE(
      NULLIF(ARRAY_AGG(m."subType" ORDER BY m."subType") FILTER (WHERE m."isActive"), '{}'::"CampaignSubType"[]),
      ARRAY_AGG(m."subType" ORDER BY m."subType")
    ) AS "subTypes",
    MIN(m."appliedAt") AS "minAppliedAt",
    MAX(a."instagramPostType"::TEXT) FILTER (WHERE m."subType" = 'INSTAGRAM' AND m."isActive") AS "activeInstaType",
    MAX(a."instagramPostType"::TEXT) FILTER (WHERE m."subType" = 'INSTAGRAM') AS "anyInstaType"
  FROM "app_merge" m
  JOIN "campaign_applications" a ON a."id" = m."id"
  GROUP BY m."campaignId", m."influencerId"
)
UPDATE "campaign_applications" w
SET
  "subTypes" = g."subTypes",
  "instagramPostType" = (CASE WHEN g."hasActive" THEN g."activeInstaType" ELSE g."anyInstaType" END)::"InstagramPostType",
  "appliedAt" = g."minAppliedAt"
FROM "app_merge" wm
JOIN "grp" g
  ON g."campaignId" = wm."campaignId"
 AND g."influencerId" = wm."influencerId"
WHERE wm."rn" = 1
  AND w."id" = wm."id";

-- 검토 상태 병합 (그룹 내 모든 post 기준): REJECTED > PENDING > APPROVED
WITH "postGrp" AS (
  SELECT
    m."campaignId",
    m."influencerId",
    BOOL_OR(p."reviewStatus" = 'REJECTED') AS "anyRejected",
    BOOL_OR(p."reviewStatus" = 'PENDING') AS "anyPending",
    MAX(p."reviewedAt") AS "maxReviewedAt",
    MAX(p."reviewedById") AS "reviewedById"
  FROM "app_merge" m
  JOIN "submitted_posts" p ON p."applicationId" = m."id"
  GROUP BY m."campaignId", m."influencerId"
)
UPDATE "campaign_applications" w
SET
  "submissionReviewStatus" = (CASE
    WHEN g."anyRejected" THEN 'REJECTED'
    WHEN g."anyPending" THEN 'PENDING'
    ELSE 'APPROVED'
  END)::"PostReviewStatus",
  "submissionReviewedAt" = g."maxReviewedAt",
  "submissionReviewedById" = g."reviewedById"
FROM "app_merge" wm
JOIN "postGrp" g
  ON g."campaignId" = wm."campaignId"
 AND g."influencerId" = wm."influencerId"
WHERE wm."rn" = 1
  AND w."id" = wm."id";

-- ========== 5. 자식 repoint (패자 → 승자) ==========

UPDATE "submitted_posts" c SET "applicationId" = m."winnerId"
FROM "app_map" m WHERE c."applicationId" = m."loserId";

UPDATE "attachments" c SET "applicationId" = m."winnerId"
FROM "app_map" m WHERE c."applicationId" = m."loserId";

UPDATE "line_dispatch_logs" c SET "applicationId" = m."winnerId"
FROM "app_map" m WHERE c."applicationId" = m."loserId";

-- ========== 6. 반려 이력: post 단위 → application 단위 ==========

UPDATE "submitted_post_rejections" r
SET "applicationId" = p."applicationId"
FROM "submitted_posts" p
WHERE p."id" = r."postId";

-- ========== 7. 정산: post 단위 → application 단위 합산 ==========

UPDATE "settlements" s
SET "applicationId" = p."applicationId"
FROM "submitted_posts" p
WHERE p."id" = s."postId";

CREATE TEMP TABLE "settle_agg" AS
SELECT
  "applicationId",
  MIN("id") AS "keeperId",
  SUM("amountJpy") AS "amountJpy",
  SUM("rewardAmountJpy") AS "rewardAmountJpy",
  SUM("productRefundJpy") AS "productRefundJpy",
  MIN("createdAt") AS "createdAt",
  MAX("completedAt") AS "completedAt"
FROM "settlements"
GROUP BY "applicationId";

UPDATE "settlements" s
SET
  "amountJpy" = g."amountJpy",
  "rewardAmountJpy" = g."rewardAmountJpy",
  "productRefundJpy" = g."productRefundJpy",
  "createdAt" = g."createdAt",
  "completedAt" = g."completedAt"
FROM "settle_agg" g
WHERE s."id" = g."keeperId";

DELETE FROM "settlements" s
WHERE s."id" NOT IN (SELECT "keeperId" FROM "settle_agg");

-- ========== 8. SNS/단순리뷰 상태 정규화: 전 서브타입 제출 완료 건 → REVIEW_SUBMITTED ==========

UPDATE "campaign_applications" a
SET
  "status" = 'REVIEW_SUBMITTED',
  "reviewSubmittedAt" = sub."maxSubmittedAt"
FROM (
  SELECT
    a2."id",
    (SELECT MAX(p."submittedAt") FROM "submitted_posts" p WHERE p."applicationId" = a2."id") AS "maxSubmittedAt"
  FROM "campaign_applications" a2
  JOIN "campaigns" c ON c."id" = a2."campaignId"
  WHERE c."category" IN ('SNS', 'SIMPLE_REVIEW')
    AND a2."status" IN ('SHIPPED', 'DELIVERED')
    AND a2."receivedAt" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM UNNEST(a2."subTypes") st
      WHERE NOT EXISTS (
        SELECT 1 FROM "submitted_posts" p2
        WHERE p2."applicationId" = a2."id" AND p2."subType" = st
      )
    )
) sub
WHERE a."id" = sub."id";

-- ========== 9. 패자 삭제 ==========

DELETE FROM "campaign_applications" a
USING "app_map" m
WHERE a."id" = m."loserId";

DROP TABLE "app_merge";
DROP TABLE "app_map";
DROP TABLE "settle_agg";

-- ========== 10. DDL 마무리: 구 컬럼/인덱스 제거, 제약 확정 ==========

-- DropForeignKey
ALTER TABLE "settlements" DROP CONSTRAINT "settlements_postId_fkey";

-- DropForeignKey
ALTER TABLE "submitted_post_rejections" DROP CONSTRAINT "submitted_post_rejections_postId_fkey";

-- DropIndex
DROP INDEX "campaign_applications_campaignId_influencerId_subType_key";

-- DropIndex
DROP INDEX "submitted_posts_reviewStatus_idx";

-- DropIndex
DROP INDEX "settlements_postId_key";

-- DropIndex
DROP INDEX "submitted_post_rejections_postId_idx";

-- AlterTable
ALTER TABLE "campaign_applications" DROP COLUMN "subType";

-- AlterTable
ALTER TABLE "submitted_posts"
DROP COLUMN "reviewStatus",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedById",
DROP COLUMN "settledAmountJpy",
DROP COLUMN "settledAt",
DROP COLUMN "settledById",
DROP COLUMN "settlementCompletedAt",
DROP COLUMN "settlementCompletedById";

-- AlterTable
ALTER TABLE "settlements" DROP COLUMN "postId",
ALTER COLUMN "applicationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "submitted_post_rejections" DROP COLUMN "postId",
ALTER COLUMN "applicationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "campaign_applications_campaignId_influencerId_key" ON "campaign_applications"("campaignId", "influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_applicationId_key" ON "settlements"("applicationId");

-- CreateIndex
CREATE INDEX "submitted_post_rejections_applicationId_idx" ON "submitted_post_rejections"("applicationId");

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submitted_post_rejections" ADD CONSTRAINT "submitted_post_rejections_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
