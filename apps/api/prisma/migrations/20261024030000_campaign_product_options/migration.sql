-- 캠페인 제품 옵션(호수/사이즈 등) 설정과 응모 시 선택값.
ALTER TABLE "campaigns" ADD COLUMN "productOptions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "campaign_applications" ADD COLUMN "productOptions" JSONB NOT NULL DEFAULT '[]';
