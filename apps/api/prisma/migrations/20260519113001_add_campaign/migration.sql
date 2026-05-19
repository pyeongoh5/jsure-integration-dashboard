-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rewardJpy" INTEGER NOT NULL,
    "snsTypes" TEXT[],
    "condition" TEXT NOT NULL,
    "recruitCount" INTEGER NOT NULL,
    "recruitStartAt" TIMESTAMP(3) NOT NULL,
    "recruitEndAt" TIMESTAMP(3) NOT NULL,
    "productSummary" TEXT NOT NULL,
    "productDetailUrl" TEXT NOT NULL,
    "guideline" TEXT NOT NULL,
    "referenceMediaUrls" TEXT[],
    "ngItems" TEXT NOT NULL,
    "cautions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_recruitStartAt_idx" ON "campaigns"("recruitStartAt");
