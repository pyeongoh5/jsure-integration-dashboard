-- 마감 1일 전 리마인더의 초기 본문을 기존 마감 리마인더에서 복사한다.
-- 복사하지 않으면 template row 가 없어 배포 직후 D-1 발송이 SKIPPED_NO_TEMPLATE 로 조용히 멈춘다.
-- 긴급 톤 문구는 운영자가 어드민에서 수정한다.
-- ON CONFLICT DO NOTHING 이라 재실행해도 기존 본문을 덮어쓰지 않는다.
INSERT INTO "line_message_templates" (id, category, "triggerKey", body, enabled, "updatedAt")
SELECT
  gen_random_uuid()::text,
  category,
  'SNS_POST_FINAL_DEADLINE_REMINDER'::"LineTriggerKey",
  body,
  enabled,
  now()
FROM "line_message_templates"
WHERE "triggerKey" = 'SNS_POST_DEADLINE_REMINDER'
ON CONFLICT (category, "triggerKey") DO NOTHING;

INSERT INTO "line_message_templates" (id, category, "triggerKey", body, enabled, "updatedAt")
SELECT
  gen_random_uuid()::text,
  category,
  'FAKE_PURCHASE_REVIEW_FINAL_DEADLINE_REMINDER'::"LineTriggerKey",
  body,
  enabled,
  now()
FROM "line_message_templates"
WHERE "triggerKey" = 'FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER'
ON CONFLICT (category, "triggerKey") DO NOTHING;

INSERT INTO "line_message_templates" (id, category, "triggerKey", body, enabled, "updatedAt")
SELECT
  gen_random_uuid()::text,
  category,
  'SIMPLE_REVIEW_FINAL_DEADLINE_REMINDER'::"LineTriggerKey",
  body,
  enabled,
  now()
FROM "line_message_templates"
WHERE "triggerKey" = 'SIMPLE_REVIEW_DEADLINE_REMINDER'
ON CONFLICT (category, "triggerKey") DO NOTHING;
