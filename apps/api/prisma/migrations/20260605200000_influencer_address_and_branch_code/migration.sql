-- Influencer 주소 컬럼 추가 (기존 행은 빈 문자열로 backfill)
ALTER TABLE "influencers"
  ADD COLUMN "postalCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "prefecture" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "city" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "addressLine1" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "addressLine2" TEXT NOT NULL DEFAULT '';

-- 은행 지점 코드 컬럼 추가
ALTER TABLE "influencer_bank_accounts"
  ADD COLUMN "branchCode" TEXT NOT NULL DEFAULT '';
