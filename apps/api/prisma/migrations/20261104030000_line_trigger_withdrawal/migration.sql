-- 탈퇴 승인·반려 안내 트리거. 캠페인 응모가 없는 COMMON 탭의 첫 트리거다.
-- enum 값 추가는 additive 라 기존 row·구 코드에 영향이 없다.
-- 템플릿 row 는 생성하지 않는다 — 어드민이 본문을 작성하고 켜기 전에는 발송되지 않는다
-- (템플릿이 없으면 디스패처가 SKIPPED_NO_TEMPLATE 로 로그만 남기고 끝낸다).
ALTER TYPE "LineTriggerKey" ADD VALUE 'COMMON_WITHDRAWAL_APPROVED';
ALTER TYPE "LineTriggerKey" ADD VALUE 'COMMON_WITHDRAWAL_REJECTED';
