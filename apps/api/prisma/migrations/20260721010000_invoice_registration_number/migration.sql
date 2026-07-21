-- 適格請求書登録番号 (인보이스 등록번호) — 계좌 정보와 정산 스냅샷에 추가
ALTER TABLE "influencer_bank_accounts" ADD COLUMN "invoiceRegistrationNumber" TEXT;
ALTER TABLE "settlements" ADD COLUMN "invoiceRegistrationNumber" TEXT;
