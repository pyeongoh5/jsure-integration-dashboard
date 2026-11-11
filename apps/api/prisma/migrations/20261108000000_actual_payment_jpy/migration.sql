-- 가구매 실결제 금액(JPY). 기존 응모는 null 로 남고, 정산은 productPriceJpy 폴백을 쓴다.
ALTER TABLE "campaign_applications" ADD COLUMN "actualPaymentJpy" INTEGER;
