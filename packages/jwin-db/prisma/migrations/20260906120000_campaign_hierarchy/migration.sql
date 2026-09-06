-- 캠페인 위계 개편: 시즌(Campaign) → 참여(BrandCampaign) → 브랜드(BrandXAccount)
-- 기존 BrandCampaign 한 행이 "브랜드 1개짜리 시즌"으로 무손실 변환된다.
-- 설계: docs/jwin/CAMPAIGN_HIERARCHY.md

-- ① 시즌 테이블
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");
CREATE INDEX "Campaign_startsAt_endsAt_idx" ON "Campaign"("startsAt", "endsAt");

-- ② 브랜드 승격 — slug 는 label 을 슬러그화하지 않는다.
--    label 이 일본어·한글이면 결과가 빈 문자열이 되어 UNIQUE 충돌이 난다.
ALTER TABLE "BrandXAccount" ADD COLUMN "slug" TEXT;
ALTER TABLE "BrandXAccount" ADD COLUMN "logoUrl" TEXT;
UPDATE "BrandXAccount" SET "slug" = 'brand-' || substr("id", 1, 8) WHERE "slug" IS NULL;
ALTER TABLE "BrandXAccount" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "BrandXAccount_slug_key" ON "BrandXAccount"("slug");

-- ③ 브랜드 계정이 없던 참여 → 이름만 가진 브랜드를 만들어 연결 (미연동 상태 그대로 보존)
INSERT INTO "BrandXAccount" ("id", "label", "slug", "createdAt", "updatedAt")
SELECT "id" || '-brand', "brandName", 'brand-' || substr("id", 1, 8), NOW(), NOW()
FROM "BrandCampaign"
WHERE "brandAccountId" IS NULL;

UPDATE "BrandCampaign"
SET "brandAccountId" = "id" || '-brand'
WHERE "brandAccountId" IS NULL;

-- ④ 기존 참여 1행 → 시즌 1개 (이름·slug·기간을 그대로 이관)
ALTER TABLE "BrandCampaign" ADD COLUMN "campaignId" TEXT;

INSERT INTO "Campaign" ("id", "name", "slug", "startsAt", "endsAt", "createdAt", "updatedAt")
SELECT "id" || '-season', "brandName", "slug", "startsAt", "endsAt", "createdAt", NOW()
FROM "BrandCampaign";

UPDATE "BrandCampaign" SET "campaignId" = "id" || '-season';

-- ⑤ 제약
ALTER TABLE "BrandCampaign" ALTER COLUMN "campaignId" SET NOT NULL;
ALTER TABLE "BrandCampaign" ALTER COLUMN "brandAccountId" SET NOT NULL;
ALTER TABLE "BrandCampaign"
  ADD CONSTRAINT "BrandCampaign_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "BrandCampaign_campaignId_brandAccountId_key"
  ON "BrandCampaign"("campaignId", "brandAccountId");

-- ⑥ 상위로 옮겨간 컬럼 제거 (되돌릴 수 없는 지점)
DROP INDEX IF EXISTS "BrandCampaign_status_startsAt_endsAt_idx";
CREATE INDEX "BrandCampaign_status_idx" ON "BrandCampaign"("status");
DROP INDEX IF EXISTS "BrandCampaign_slug_key";
ALTER TABLE "BrandCampaign" DROP COLUMN "brandName";
ALTER TABLE "BrandCampaign" DROP COLUMN "slug";
ALTER TABLE "BrandCampaign" DROP COLUMN "startsAt";
ALTER TABLE "BrandCampaign" DROP COLUMN "endsAt";
