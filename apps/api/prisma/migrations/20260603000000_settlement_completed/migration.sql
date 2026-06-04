ALTER TABLE "submitted_posts"
  ADD COLUMN "settlementCompletedAt" TIMESTAMP(3),
  ADD COLUMN "settlementCompletedById" TEXT;
