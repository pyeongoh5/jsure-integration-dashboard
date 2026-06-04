-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "settlements" (
    "id"            TEXT NOT NULL,
    "postId"        TEXT NOT NULL,
    "amountJpy"     INTEGER NOT NULL,
    "status"        "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"   TIMESTAMP(3),
    "completedById" TEXT,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settlements_postId_key" ON "settlements"("postId");
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- AddForeignKey
ALTER TABLE "settlements"
ADD CONSTRAINT "settlements_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "submitted_posts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: 기존 submitted_posts 의 정산 데이터를 settlements 로 복사
-- 1) settlementCompletedAt 있음 → COMPLETED 로 기록 (실제로 정산이 완료된 건)
INSERT INTO "settlements"
  ("id", "postId", "amountJpy", "status", "createdAt", "completedAt", "completedById")
SELECT
  'st_' || sp."id",
  sp."id",
  COALESCE(sp."settledAmountJpy",
           (SELECT c."rewardJpy"
            FROM "campaign_applications" ca
            JOIN "campaigns" c ON c."id" = ca."campaignId"
            WHERE ca."id" = sp."applicationId")),
  'COMPLETED',
  COALESCE(sp."settledAt", sp."settlementCompletedAt", CURRENT_TIMESTAMP),
  sp."settlementCompletedAt",
  sp."settlementCompletedById"
FROM "submitted_posts" sp
WHERE sp."settlementCompletedAt" IS NOT NULL
ON CONFLICT ("postId") DO NOTHING;

-- 2) settledAt 있는데 completedAt 없음 → 과거 "정산하기"만 눌린 케이스. PENDING 로 마이그레이션
INSERT INTO "settlements"
  ("id", "postId", "amountJpy", "status", "createdAt")
SELECT
  'st_' || sp."id",
  sp."id",
  COALESCE(sp."settledAmountJpy",
           (SELECT c."rewardJpy"
            FROM "campaign_applications" ca
            JOIN "campaigns" c ON c."id" = ca."campaignId"
            WHERE ca."id" = sp."applicationId")),
  'PENDING',
  sp."settledAt"
FROM "submitted_posts" sp
WHERE sp."settledAt" IS NOT NULL
  AND sp."settlementCompletedAt" IS NULL
ON CONFLICT ("postId") DO NOTHING;
