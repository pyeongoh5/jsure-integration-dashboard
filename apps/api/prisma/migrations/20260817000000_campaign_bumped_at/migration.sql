-- 캠페인 끌어올리기용 bumpedAt 컬럼. 인플루언서 목록 정렬 기준으로 쓰이며
-- 끌어올리기 액션에서만 갱신된다. 기존 행은 createdAt 으로 백필해 정렬 순서가 유지된다.
ALTER TABLE "campaigns" ADD COLUMN "bumpedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "campaigns" SET "bumpedAt" = "createdAt";
