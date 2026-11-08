-- LINE 템플릿 분류를 CampaignCategory 에서 분리한다.
-- 캠페인에 속하지 않는 알림(탈퇴 승인·반려)을 담을 COMMON 탭이 필요한데,
-- CampaignCategory 는 캠페인 생성 API 의 입력 검증에도 쓰여서 값을 늘리면
-- category 가 COMMON 인 캠페인이 만들어질 수 있다.
--
-- 값 집합이 기존의 상위집합이라 안전한 확대 변환이다 (기존 row 는 전부 그대로 매핑).
-- ⚠️ ALTER COLUMN TYPE 은 테이블 재작성 + ACCESS EXCLUSIVE 락이다.
--    line_dispatch_logs 는 발송 로그라 계속 쌓이므로, 배포 전에 행 수를 확인할 것.

CREATE TYPE "LineTemplateCategory" AS ENUM ('SNS', 'FAKE_PURCHASE', 'SIMPLE_REVIEW', 'COMMON');

ALTER TABLE "line_message_templates"
  ALTER COLUMN "category" TYPE "LineTemplateCategory"
  USING "category"::text::"LineTemplateCategory";

ALTER TABLE "line_dispatch_logs"
  ALTER COLUMN "category" TYPE "LineTemplateCategory"
  USING "category"::text::"LineTemplateCategory";

-- CampaignCategory 는 Campaign.category 가 계속 쓰므로 남겨 둔다.
