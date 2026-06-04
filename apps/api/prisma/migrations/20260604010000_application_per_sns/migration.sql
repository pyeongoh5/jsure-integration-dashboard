-- CampaignApplication 을 (campaign, influencer) 1:1 에서 (campaign, influencer, snsType) 로 split.

-- 1) snsType 컬럼 추가 (NULL 허용으로 시작)
ALTER TABLE "campaign_applications" ADD COLUMN "snsType" "SnsType";

-- 2) 기존 row 의 snsType = selectedSnsTypes 의 첫 번째 값
UPDATE "campaign_applications"
SET "snsType" = "selectedSnsTypes"[1]
WHERE array_length("selectedSnsTypes", 1) >= 1;

-- 3) selectedSnsTypes 가 비어있는 legacy row 는 campaign 의 SNS 모집 첫 항목으로 폴백
UPDATE "campaign_applications" ca
SET "snsType" = (
  SELECT sr."snsType"
  FROM "campaign_sns_recruits" sr
  WHERE sr."campaignId" = ca."campaignId"
  ORDER BY sr."snsType"
  LIMIT 1
)
WHERE ca."snsType" IS NULL;

-- 4) 기존 unique index 먼저 제거 (확장 INSERT 전에)
DROP INDEX IF EXISTS "campaign_applications_campaignId_influencerId_key";

-- 5) selectedSnsTypes 가 N개(>1) 인 row → 추가 (N-1) 개 row 를 새로 INSERT
INSERT INTO "campaign_applications" (
  id, "campaignId", "influencerId", "snsType", status, "appliedAt",
  "reviewedAt", "reviewedById", "rejectReason",
  "trackingCarrier", "trackingNumber",
  "shippedAt", "deliveredAt", "receivedAt", "completedAt",
  "selectedSnsTypes", "createdAt", "updatedAt"
)
SELECT
  ca.id || '__' || sub.sns,
  ca."campaignId",
  ca."influencerId",
  sub.sns,
  ca.status,
  ca."appliedAt",
  ca."reviewedAt",
  ca."reviewedById",
  ca."rejectReason",
  ca."trackingCarrier",
  ca."trackingNumber",
  ca."shippedAt",
  ca."deliveredAt",
  ca."receivedAt",
  ca."completedAt",
  ca."selectedSnsTypes",
  ca."createdAt",
  ca."updatedAt"
FROM "campaign_applications" ca
JOIN LATERAL (
  SELECT sns, ord
  FROM unnest(ca."selectedSnsTypes") WITH ORDINALITY AS u(sns, ord)
  WHERE u.ord > 1
) sub ON TRUE
WHERE array_length(ca."selectedSnsTypes", 1) > 1;

-- 6) submitted_posts: post.snsType 이 다른 application 으로 가야 한다면 이동
UPDATE "submitted_posts" sp
SET "applicationId" = matched.new_id
FROM (
  SELECT
    sp_inner.id AS post_id,
    new_ca.id AS new_id
  FROM "submitted_posts" sp_inner
  JOIN "campaign_applications" old_ca ON old_ca.id = sp_inner."applicationId"
  JOIN "campaign_applications" new_ca
    ON new_ca."campaignId" = old_ca."campaignId"
    AND new_ca."influencerId" = old_ca."influencerId"
    AND new_ca."snsType" = sp_inner."snsType"
    AND new_ca.id <> old_ca.id
  WHERE old_ca."snsType" <> sp_inner."snsType"
) matched
WHERE sp.id = matched.post_id;

-- 7) snsType NOT NULL 로 변경
ALTER TABLE "campaign_applications" ALTER COLUMN "snsType" SET NOT NULL;

-- 8) selectedSnsTypes 컬럼 제거
ALTER TABLE "campaign_applications" DROP COLUMN "selectedSnsTypes";

-- 9) 새 unique index 추가
CREATE UNIQUE INDEX "campaign_applications_campaignId_influencerId_snsType_key"
  ON "campaign_applications"("campaignId", "influencerId", "snsType");
