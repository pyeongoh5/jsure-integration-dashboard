-- 브랜드 캠페인 지표 스냅샷 (BASELINE: 첫 게시 직후, DAILY: 매일 00:00 JST)
CREATE TYPE "MetricKind" AS ENUM ('BASELINE', 'DAILY');

CREATE TABLE "BrandMetricSnapshot" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "dateJst" TEXT NOT NULL,
  "kind" "MetricKind" NOT NULL,
  "followerCount" INTEGER NOT NULL,
  "postId" TEXT,
  "repostCount" INTEGER,
  "likeCount" INTEGER,
  "replyCount" INTEGER,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrandMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandMetricSnapshot_campaignId_dateJst_kind_key"
  ON "BrandMetricSnapshot"("campaignId", "dateJst", "kind");
CREATE INDEX "BrandMetricSnapshot_campaignId_dateJst_idx"
  ON "BrandMetricSnapshot"("campaignId", "dateJst");

ALTER TABLE "BrandMetricSnapshot" ADD CONSTRAINT "BrandMetricSnapshot_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "BrandCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
