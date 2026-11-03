-- 대상자 지정 규칙을 캠페인에 보존한다. campaign_audiences 는 규칙을 사람으로 푼
-- 결과물이라, 결과가 0명인 규칙은 거기서 복원할 수 없었다. 전부 additive.

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "audienceCampaignIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "campaigns" ADD COLUMN "audienceTagIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "campaigns" ADD COLUMN "audienceInfluencerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
