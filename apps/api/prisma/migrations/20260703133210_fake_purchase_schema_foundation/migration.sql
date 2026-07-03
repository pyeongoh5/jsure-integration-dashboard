-- Rename enum SnsType -> CampaignSubType (preserves data across all columns using it)
ALTER TYPE "SnsType" RENAME TO "CampaignSubType";

-- Add new values to CampaignSubType
ALTER TYPE "CampaignSubType" ADD VALUE 'QOO10';
ALTER TYPE "CampaignSubType" ADD VALUE 'LIPS';
ALTER TYPE "CampaignSubType" ADD VALUE 'ATCOSME';

-- Add values to ApplicationStatus
ALTER TYPE "ApplicationStatus" ADD VALUE 'ORDER_SUBMITTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'REVIEW_SUBMITTED';

-- Add values to LineTriggerSubType
ALTER TYPE "LineTriggerSubType" ADD VALUE 'QOO10';
ALTER TYPE "LineTriggerSubType" ADD VALUE 'LIPS';
ALTER TYPE "LineTriggerSubType" ADD VALUE 'ATCOSME';

-- Add FAKE_PURCHASE_* values to LineTriggerKey
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

-- Create AttachmentKind enum
CREATE TYPE "AttachmentKind" AS ENUM ('INSIGHT_SCREENSHOT', 'ORDER_RECEIPT', 'REVIEW_SCREENSHOT');

-- Campaign: add category
ALTER TABLE "campaigns" ADD COLUMN "category" "CampaignCategory" NOT NULL DEFAULT 'SNS';

-- Rename campaign_sns_recruits -> campaign_recruits
ALTER TABLE "campaign_sns_recruits" RENAME TO "campaign_recruits";
ALTER TABLE "campaign_recruits" RENAME COLUMN "snsType" TO "subType";
ALTER TABLE "campaign_recruits" ADD COLUMN "productPriceJpy" INTEGER;
ALTER TABLE "campaign_recruits" ADD COLUMN "productUrl" TEXT;

-- Rename campaign_recruits indexes/constraints
ALTER INDEX "campaign_sns_recruits_pkey" RENAME TO "campaign_recruits_pkey";
ALTER INDEX "campaign_sns_recruits_campaignId_snsType_key" RENAME TO "campaign_recruits_campaignId_subType_key";
DROP INDEX "campaign_sns_recruits_campaignId_idx";

-- CampaignApplication: rename column, add new fields
ALTER TABLE "campaign_applications" RENAME COLUMN "snsType" TO "subType";
ALTER TABLE "campaign_applications" ADD COLUMN "orderNumber" TEXT;
ALTER TABLE "campaign_applications" ADD COLUMN "orderSubmittedAt" TIMESTAMP(3);
ALTER TABLE "campaign_applications" ADD COLUMN "reviewSubmittedAt" TIMESTAMP(3);
ALTER INDEX "campaign_applications_campaignId_influencerId_snsType_key" RENAME TO "campaign_applications_campaignId_influencerId_subType_key";

-- SubmittedPost: rename column
ALTER TABLE "submitted_posts" RENAME COLUMN "snsType" TO "subType";
ALTER INDEX "submitted_posts_applicationId_snsType_key" RENAME TO "submitted_posts_applicationId_subType_key";

-- Attachment unification: rename table, add columns, backfill, add FK
ALTER TABLE "submitted_post_attachments" RENAME TO "attachments";
ALTER INDEX "submitted_post_attachments_pkey" RENAME TO "attachments_pkey";
ALTER INDEX "submitted_post_attachments_objectKey_key" RENAME TO "attachments_objectKey_key";
DROP INDEX "submitted_post_attachments_postId_idx";

ALTER TABLE "attachments" ADD COLUMN "kind" "AttachmentKind" NOT NULL DEFAULT 'INSIGHT_SCREENSHOT';
ALTER TABLE "attachments" ADD COLUMN "applicationId" TEXT;
ALTER TABLE "attachments" ALTER COLUMN "postId" DROP NOT NULL;

UPDATE "attachments" a
   SET "applicationId" = p."applicationId"
  FROM "submitted_posts" p
 WHERE a."postId" = p."id";

ALTER TABLE "attachments" ALTER COLUMN "applicationId" SET NOT NULL;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "attachments_applicationId_kind_idx" ON "attachments"("applicationId", "kind");
CREATE INDEX "attachments_postId_kind_idx" ON "attachments"("postId", "kind");

-- Settlement: reward/refund breakdown
ALTER TABLE "settlements" ADD COLUMN "rewardAmountJpy" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "settlements" ADD COLUMN "productRefundJpy" INTEGER NOT NULL DEFAULT 0;
UPDATE "settlements" SET "rewardAmountJpy" = "amountJpy";
