-- 상품 상세 URL 을 복수 입력 가능하도록 배열화. 기존 단일 값은 1개짜리 배열로 백필.
ALTER TABLE "campaigns" ADD COLUMN "productDetailUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "campaigns" SET "productDetailUrls" = ARRAY["productDetailUrl"];
ALTER TABLE "campaigns" DROP COLUMN "productDetailUrl";
