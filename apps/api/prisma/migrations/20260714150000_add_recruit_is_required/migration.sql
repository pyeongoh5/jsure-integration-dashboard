-- 캠페인 recruit 별 "응모 필수" 여부 플래그. 기본 false = 옵션(기존 동작 유지).
ALTER TABLE "campaign_recruits" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false;
