-- 서브타입 옵션별 모집 정원·보수 + 응모 옵션 선택 일반화
-- (docs/superpowers/specs/2026-07-16-recruit-option-quota-design.md)

-- 1. recruit 옵션 세부 설정 (정원·보수, 속성별 all-or-nothing)
CREATE TABLE "campaign_recruit_options" (
    "id" TEXT NOT NULL,
    "recruitId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "recruitCount" INTEGER,
    "rewardJpy" INTEGER,

    CONSTRAINT "campaign_recruit_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_recruit_options_recruitId_option_key"
    ON "campaign_recruit_options"("recruitId", "option");

ALTER TABLE "campaign_recruit_options"
    ADD CONSTRAINT "campaign_recruit_options_recruitId_fkey"
    FOREIGN KEY ("recruitId") REFERENCES "campaign_recruits"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. 응모 옵션 선택 (구 instagramPostType 일반화)
CREATE TABLE "campaign_application_options" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "subType" "CampaignSubType" NOT NULL,
    "option" TEXT NOT NULL,

    CONSTRAINT "campaign_application_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_application_options_applicationId_subType_option_key"
    ON "campaign_application_options"("applicationId", "subType", "option");

ALTER TABLE "campaign_application_options"
    ADD CONSTRAINT "campaign_application_options_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "campaign_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. 백필: 기존 instagramPostType → 옵션 행
INSERT INTO "campaign_application_options" ("id", "applicationId", "subType", "option")
SELECT
    'apo_' || substr(md5(random()::text || a."id"), 1, 24),
    a."id",
    'INSTAGRAM'::"CampaignSubType",
    a."instagramPostType"::TEXT
FROM "campaign_applications" a
WHERE a."instagramPostType" IS NOT NULL;

-- 4. 구 컬럼·enum 제거
ALTER TABLE "campaign_applications" DROP COLUMN "instagramPostType";
DROP TYPE "InstagramPostType";
