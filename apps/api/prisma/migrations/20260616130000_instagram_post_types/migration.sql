-- Instagram FEED/REELS 구분 도입.
-- CampaignSnsRecruit 는 허용 타입 배열(1개 이상)을 보관하고,
-- CampaignApplication 은 인플루언서가 선택한 단일 타입을 보관한다.

-- 1) Enum 생성
CREATE TYPE "InstagramPostType" AS ENUM ('FEED', 'REELS');

-- 2) CampaignSnsRecruit.instagramPostTypes 컬럼 추가 (기본 빈 배열)
ALTER TABLE "campaign_sns_recruits"
  ADD COLUMN "instagramPostTypes" "InstagramPostType"[] NOT NULL DEFAULT ARRAY[]::"InstagramPostType"[];

-- 3) 기존 INSTAGRAM 모집 row 는 FEED 로 backfill
UPDATE "campaign_sns_recruits"
SET "instagramPostTypes" = ARRAY['FEED']::"InstagramPostType"[]
WHERE "snsType" = 'INSTAGRAM';

-- 4) CampaignApplication.instagramPostType 컬럼 추가 (null 허용)
ALTER TABLE "campaign_applications"
  ADD COLUMN "instagramPostType" "InstagramPostType";

-- 5) 기존 INSTAGRAM 응모 row 는 FEED 로 backfill
UPDATE "campaign_applications"
SET "instagramPostType" = 'FEED'
WHERE "snsType" = 'INSTAGRAM';
