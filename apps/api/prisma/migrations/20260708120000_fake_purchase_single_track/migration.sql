-- 1) 가구매 dead data cleanup (LIPS/ATCOSME 서브타입 데이터 제거)
DELETE FROM "line_dispatch_logs" WHERE "subType" IN ('LIPS','ATCOSME');
DELETE FROM "line_message_templates" WHERE "subType" IN ('LIPS','ATCOSME');
DELETE FROM "attachments" WHERE "applicationId" IN (
  SELECT id FROM "campaign_applications" WHERE "subType" IN ('LIPS','ATCOSME')
);
DELETE FROM "submitted_posts" WHERE "subType" IN ('LIPS','ATCOSME');
DELETE FROM "campaign_applications" WHERE "subType" IN ('LIPS','ATCOSME');
DELETE FROM "campaign_recruits" WHERE "subType" IN ('LIPS','ATCOSME');

-- 2) CampaignSubType enum 축소 (LIPS/ATCOSME 제거)
ALTER TYPE "CampaignSubType" RENAME TO "CampaignSubType_old";
CREATE TYPE "CampaignSubType" AS ENUM ('INSTAGRAM','TIKTOK','X','YOUTUBE','QOO10');
ALTER TABLE "campaign_recruits" ALTER COLUMN "subType" TYPE "CampaignSubType" USING "subType"::text::"CampaignSubType";
ALTER TABLE "campaign_applications" ALTER COLUMN "subType" TYPE "CampaignSubType" USING "subType"::text::"CampaignSubType";
ALTER TABLE "submitted_posts" ALTER COLUMN "subType" TYPE "CampaignSubType" USING "subType"::text::"CampaignSubType";
ALTER TABLE "influencer_sns_accounts" ALTER COLUMN "snsType" TYPE "CampaignSubType" USING "snsType"::text::"CampaignSubType";
DROP TYPE "CampaignSubType_old";

-- 3) LineTriggerSubType enum 축소 (LIPS/ATCOSME 제거)
ALTER TYPE "LineTriggerSubType" RENAME TO "LineTriggerSubType_old";
CREATE TYPE "LineTriggerSubType" AS ENUM ('INSTAGRAM','X','QOO10');
ALTER TABLE "line_message_templates" ALTER COLUMN "subType" TYPE "LineTriggerSubType" USING "subType"::text::"LineTriggerSubType";
ALTER TABLE "line_dispatch_logs" ALTER COLUMN "subType" TYPE "LineTriggerSubType" USING "subType"::text::"LineTriggerSubType";
DROP TYPE "LineTriggerSubType_old";

-- 4) CampaignRecruit.instagramPostTypes -> subTypeOptions (InstagramPostType[] -> text[])
ALTER TABLE "campaign_recruits"
  ADD COLUMN "subTypeOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "campaign_recruits"
  SET "subTypeOptions" = ARRAY(SELECT unnest("instagramPostTypes")::text);
ALTER TABLE "campaign_recruits" DROP COLUMN "instagramPostTypes";

-- 5) SubmittedPost: submissionData 추가 + url nullable 화
ALTER TABLE "submitted_posts" ADD COLUMN "submissionData" JSONB;
ALTER TABLE "submitted_posts" ALTER COLUMN "url" DROP NOT NULL;
