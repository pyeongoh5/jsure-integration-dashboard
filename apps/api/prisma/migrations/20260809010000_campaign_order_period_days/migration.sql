-- 가구매 주문 마감기한(승인일 + N일). nullable 이라 기존 캠페인은 마감 없음으로 남는다.
ALTER TABLE "campaigns" ADD COLUMN "orderPeriodDays" INTEGER;

-- 주문 리마인더·기한 초과 취소 안내 트리거.
-- enum 값 추가는 additive 라 기존 row·구 코드에 영향이 없다.
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_ORDER_DEADLINE_REMINDER' AFTER 'FAKE_PURCHASE_APPLICATION_REJECTED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'FAKE_PURCHASE_ORDER_EXPIRED' AFTER 'FAKE_PURCHASE_ORDER_DEADLINE_REMINDER';
