-- 캠페인 비공개(hiddenAt)·논리 삭제(deletedAt). 기존 캠페인은 전부 NULL 이므로
-- 공개·미삭제 상태가 그대로 유지된다.
ALTER TABLE "campaigns"
  ADD COLUMN "hiddenAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);
