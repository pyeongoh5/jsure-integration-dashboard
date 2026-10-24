-- 참여 취소 사유 대분류 + 상세 메모.
-- 둘 다 nullable 이라 기존 row 는 그대로 두고, 구 코드가 돌아도 깨지지 않는다.
-- 이력은 감사 로그(APPLICATION_FORCE_CANCEL)가 계속 보관하고, 이 컬럼은 현재 상태만 담는다.
CREATE TYPE "CancelReasonCategory" AS ENUM (
  'INFLUENCER_CIRCUMSTANCE',
  'COMMUNICATION_ISSUE',
  'PRODUCT_LOGISTICS_ISSUE',
  'OTHER'
);

ALTER TABLE "campaign_applications"
  ADD COLUMN "cancelReasonCategory" "CancelReasonCategory",
  ADD COLUMN "cancelReasonDetail" TEXT;
