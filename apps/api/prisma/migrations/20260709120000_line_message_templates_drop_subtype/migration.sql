-- LineMessageTemplate 를 category 단위로만 관리하도록 subType 컬럼 제거.
-- SNS 는 INSTAGRAM row 를, FAKE_PURCHASE 는 QOO10 row 를 대표로 남긴다.

-- 1) 기존 unique constraint 제거
ALTER TABLE "line_message_templates"
  DROP CONSTRAINT IF EXISTS "line_message_templates_category_subType_triggerKey_key";

-- 2) 카테고리 대표 row 만 남기고 나머지 삭제
DELETE FROM "line_message_templates"
WHERE ("category" = 'SNS' AND ("subType" IS DISTINCT FROM 'INSTAGRAM'))
   OR ("category" = 'FAKE_PURCHASE' AND ("subType" IS DISTINCT FROM 'QOO10'));

-- 3) subType 컬럼 제거
ALTER TABLE "line_message_templates" DROP COLUMN "subType";

-- 4) 새 unique (category, triggerKey)
ALTER TABLE "line_message_templates"
  ADD CONSTRAINT "line_message_templates_category_triggerKey_key"
  UNIQUE ("category", "triggerKey");
