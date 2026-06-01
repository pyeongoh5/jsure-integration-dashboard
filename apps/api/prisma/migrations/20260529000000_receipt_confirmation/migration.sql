-- Add postingPeriodDays to campaigns (default 14 days for existing rows)
ALTER TABLE "campaigns"
ADD COLUMN "postingPeriodDays" INTEGER NOT NULL DEFAULT 14;

-- Add receivedAt to campaign_applications (influencer's actual receipt confirmation)
ALTER TABLE "campaign_applications"
ADD COLUMN "receivedAt" TIMESTAMP(3);
