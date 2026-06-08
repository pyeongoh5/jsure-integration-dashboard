-- entityType / ownerType 컬럼 및 enum 제거
ALTER TABLE "influencers" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "influencer_bank_accounts" DROP COLUMN IF EXISTS "ownerType";
DROP TYPE IF EXISTS "InfluencerEntityType";
