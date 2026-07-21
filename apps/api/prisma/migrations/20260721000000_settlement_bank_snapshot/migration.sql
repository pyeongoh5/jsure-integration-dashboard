-- 정산 생성 시점 계좌 스냅샷 컬럼 추가
ALTER TABLE "settlements" ADD COLUMN "bankCode" TEXT;
ALTER TABLE "settlements" ADD COLUMN "bankName" TEXT;
ALTER TABLE "settlements" ADD COLUMN "branchName" TEXT;
ALTER TABLE "settlements" ADD COLUMN "branchCode" TEXT;
ALTER TABLE "settlements" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "settlements" ADD COLUMN "accountHolderKana" TEXT;

-- 기존 정산 건은 현재 계좌 정보로 백필 (도입 이전 데이터는 이것이 최선의 근사치)
UPDATE "settlements" s
SET
  "bankCode" = b."bankCode",
  "bankName" = b."bankName",
  "branchName" = b."branchName",
  "branchCode" = b."branchCode",
  "accountNumber" = b."accountNumber",
  "accountHolderKana" = b."accountHolderKana"
FROM "campaign_applications" a
JOIN "influencer_bank_accounts" b ON b."influencerId" = a."influencerId"
WHERE s."applicationId" = a."id";
