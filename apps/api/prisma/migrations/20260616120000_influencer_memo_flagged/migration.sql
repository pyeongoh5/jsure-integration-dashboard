ALTER TABLE "influencers"
  ADD COLUMN "flaggedAt" TIMESTAMP(3),
  ADD COLUMN "flaggedById" TEXT;

CREATE TABLE "influencer_memos" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "influencer_memos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "influencer_memos_influencerId_idx"
  ON "influencer_memos"("influencerId");

ALTER TABLE "influencer_memos"
  ADD CONSTRAINT "influencer_memos_influencerId_fkey"
  FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
