-- Add settlement fields to submitted_posts
ALTER TABLE "submitted_posts"
ADD COLUMN "settledAt" TIMESTAMP(3),
ADD COLUMN "settledAmountJpy" INTEGER,
ADD COLUMN "settledById" TEXT;
