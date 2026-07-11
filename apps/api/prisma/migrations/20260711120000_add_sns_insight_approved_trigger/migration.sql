-- 인사이트까지 제출된 상태에서 어드민이 검수 승인한 경우를 SNS_POST_APPROVED 와 분리해서
-- SNS_INSIGHT_APPROVED 트리거로 발송하도록 enum 값 추가.
ALTER TYPE "LineTriggerKey" ADD VALUE 'SNS_INSIGHT_APPROVED';
