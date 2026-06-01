-- Add LINE Login linkage to influencers
ALTER TABLE "influencers"
ADD COLUMN "lineUserId" TEXT,
ADD COLUMN "lineLinkedAt" TIMESTAMP(3);

ALTER TABLE "influencers"
ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX "influencers_lineUserId_key" ON "influencers"("lineUserId");
