-- CreateTable
CREATE TABLE "campaign_sns_recruits" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "snsType" "SnsType" NOT NULL,
    "condition" TEXT NOT NULL DEFAULT '',
    "recruitCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_sns_recruits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_sns_recruits_campaignId_snsType_key" ON "campaign_sns_recruits"("campaignId", "snsType");
CREATE INDEX "campaign_sns_recruits_campaignId_idx" ON "campaign_sns_recruits"("campaignId");

-- AddForeignKey
ALTER TABLE "campaign_sns_recruits"
  ADD CONSTRAINT "campaign_sns_recruits_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing per-campaign data into the new table (one row per existing snsType).
-- For the legacy single condition/recruitCount/snsTypes columns, materialize them per snsType.
INSERT INTO "campaign_sns_recruits" ("id", "campaignId", "snsType", "condition", "recruitCount", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  c.id,
  s.sns::"SnsType",
  COALESCE(c."condition", ''),
  c."recruitCount",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "campaigns" c
CROSS JOIN LATERAL unnest(c."snsTypes") AS s(sns);

-- Drop legacy columns from campaigns
ALTER TABLE "campaigns" DROP COLUMN "snsTypes";
ALTER TABLE "campaigns" DROP COLUMN "condition";
ALTER TABLE "campaigns" DROP COLUMN "recruitCount";
