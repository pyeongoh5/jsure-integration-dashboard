-- 배송완료 후 수령확인 리마인더 트리거 2종 추가.
-- enum 값 추가는 additive 라 기존 row·구 코드에 영향이 없다.
-- 새 값을 쓰는 template row 는 운영자가 어드민에서 본문을 작성할 때 생긴다.
ALTER TYPE "LineTriggerKey" ADD VALUE 'SNS_APPLICATION_DELIVERY_REMINDER' AFTER 'SNS_APPLICATION_DELIVERED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER' AFTER 'SIMPLE_REVIEW_APPLICATION_DELIVERED';
