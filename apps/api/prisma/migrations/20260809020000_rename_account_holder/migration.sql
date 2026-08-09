-- accountHolderKana -> accountHolder.
-- Kana 는 일본 은행의 カナ 대조 표기를 뜻해 한국 계좌에는 맞지 않는다.
-- 데이터 변환이 없고 인덱스·외래키·뷰가 걸려 있지 않은 단순 rename 이다.
ALTER TABLE "influencer_bank_accounts" RENAME COLUMN "accountHolderKana" TO "accountHolder";
ALTER TABLE "settlements" RENAME COLUMN "accountHolderKana" TO "accountHolder";
