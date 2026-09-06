-- 단순리뷰에서 한 채널에 리뷰를 여러 개 올린 경우, 두 번째 URL 부터 제출 순서대로 담는다.
-- 기존 행은 빈 배열이 되어 지금과 동일하게 동작한다(백필 없음).
ALTER TABLE "submitted_posts" ADD COLUMN "extraUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
