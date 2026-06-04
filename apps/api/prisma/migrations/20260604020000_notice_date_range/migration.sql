-- publishedAt → startAt 으로 rename, endAt 추가
ALTER TABLE "notices" RENAME COLUMN "publishedAt" TO "startAt";

ALTER TABLE "notices" ADD COLUMN "endAt" TIMESTAMP(3);

-- 기본 종료일: 시작일 + 30일 (운영자가 수정 가능)
UPDATE "notices" SET "endAt" = "startAt" + INTERVAL '30 days' WHERE "endAt" IS NULL;

ALTER TABLE "notices" ALTER COLUMN "endAt" SET NOT NULL;

-- 인덱스 재구성
DROP INDEX IF EXISTS "notices_publishedAt_idx";
CREATE INDEX "notices_startAt_idx" ON "notices"("startAt");
CREATE INDEX "notices_endAt_idx" ON "notices"("endAt");
