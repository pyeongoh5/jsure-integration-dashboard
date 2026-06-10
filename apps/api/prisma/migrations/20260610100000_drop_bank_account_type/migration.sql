-- 은행 계좌 종류(普通/当座) 컬럼 및 enum 제거
ALTER TABLE "influencer_bank_accounts" DROP COLUMN "accountType";
DROP TYPE "JpAccountType";
