-- 캠페인 게시(투고) 기간 컬럼 추가. 기존 캠페인은 두 컬럼 모두 NULL 이라
-- 투고 시점 제약이 없던 기존 동작과 완전히 동일하게 유지된다.
ALTER TABLE "campaigns" ADD COLUMN     "publishEndAt" TIMESTAMP(3),
ADD COLUMN     "publishStartAt" TIMESTAMP(3);
