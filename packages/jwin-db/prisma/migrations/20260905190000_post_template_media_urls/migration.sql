-- 포스트 첨부를 여러 장으로 (최대 4장, X 제한). 기존 단일 mediaUrl 은 배열로 옮겨 담고
-- 컬럼 자체는 남겨 둔다 — 롤백 시 구버전 코드가 그대로 읽을 수 있어야 한다.
ALTER TABLE "PostTemplate" ADD COLUMN "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "PostTemplate"
SET "mediaUrls" = ARRAY["mediaUrl"]
WHERE "mediaUrl" IS NOT NULL AND "mediaUrl" <> '';
