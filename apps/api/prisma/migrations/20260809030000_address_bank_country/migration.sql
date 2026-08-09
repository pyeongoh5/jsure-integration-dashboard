-- 주소·계좌의 국가 구분. 기존 데이터는 전부 일본이므로 default JP 로 채워진다.
CREATE TYPE "AddressCountry" AS ENUM ('JP', 'KR');

ALTER TABLE "influencers" ADD COLUMN "addressCountry" "AddressCountry" NOT NULL DEFAULT 'JP';
ALTER TABLE "influencer_bank_accounts" ADD COLUMN "bankCountry" "AddressCountry" NOT NULL DEFAULT 'JP';

-- 정산 스냅샷은 도입 전 행이 null 이므로(현재 계좌로 fallback) nullable 을 유지한다.
ALTER TABLE "settlements" ADD COLUMN "bankCountry" "AddressCountry";
