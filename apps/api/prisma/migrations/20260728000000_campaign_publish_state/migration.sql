-- 캠페인 임시저장(DRAFT) 지원. 기존 캠페인은 전부 PUBLISHED 로 백필된다.
CREATE TYPE "CampaignPublishState" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "campaigns"
  ADD COLUMN "publishState" "CampaignPublishState" NOT NULL DEFAULT 'PUBLISHED';
