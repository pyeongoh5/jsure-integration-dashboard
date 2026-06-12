CREATE TABLE "campaign_exclusions" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "excludedCampaignId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_exclusions_campaignId_excludedCampaignId_key"
  ON "campaign_exclusions"("campaignId", "excludedCampaignId");

CREATE INDEX "campaign_exclusions_excludedCampaignId_idx"
  ON "campaign_exclusions"("excludedCampaignId");

ALTER TABLE "campaign_exclusions"
  ADD CONSTRAINT "campaign_exclusions_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaign_exclusions"
  ADD CONSTRAINT "campaign_exclusions_excludedCampaignId_fkey"
  FOREIGN KEY ("excludedCampaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
