-- 비공개/타깃 전용 캠페인. 전부 additive — 기존 캠페인은 PUBLIC 으로 들어간다.

-- CreateEnum
CREATE TYPE "CampaignAudienceMode" AS ENUM ('PUBLIC', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "CampaignAudienceSource" AS ENUM ('CAMPAIGN', 'TAG', 'MANUAL');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "audienceMode" "CampaignAudienceMode" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "campaign_audiences" (
    "campaignId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "source" "CampaignAudienceSource" NOT NULL,
    "sourceRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_audiences_pkey" PRIMARY KEY ("campaignId","influencerId")
);

-- CreateIndex
CREATE INDEX "campaign_audiences_influencerId_idx" ON "campaign_audiences"("influencerId");

-- AddForeignKey
ALTER TABLE "campaign_audiences" ADD CONSTRAINT "campaign_audiences_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audiences" ADD CONSTRAINT "campaign_audiences_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
