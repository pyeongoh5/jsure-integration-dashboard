-- 게시 시간을 참여(BrandCampaign)에서 시즌(Campaign)으로 올린다.
-- 기존 값은 시즌별로 참여 중 가장 이른 시각을 승계한다 (참여가 없으면 기본 11:00).
ALTER TABLE "Campaign" ADD COLUMN "dailyPostTime" TEXT NOT NULL DEFAULT '11:00';

UPDATE "Campaign" c
SET "dailyPostTime" = sub."dailyPostTime"
FROM (
  SELECT DISTINCT ON ("campaignId") "campaignId", "dailyPostTime"
  FROM "BrandCampaign"
  ORDER BY "campaignId", "dailyPostTime" ASC
) sub
WHERE sub."campaignId" = c."id";

ALTER TABLE "BrandCampaign" DROP COLUMN "dailyPostTime";
