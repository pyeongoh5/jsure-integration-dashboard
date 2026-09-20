-- 시즌 LP 이미지: 상단 키비주얼 + 브랜드 목록 배경
ALTER TABLE "Campaign" ADD COLUMN "keyVisualUrl" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "listBackgroundUrl" TEXT;
