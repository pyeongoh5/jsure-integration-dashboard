-- 링크 카드 이미지(LP 의 og:image) 와 이벤트 규칙 가이드 URL. 둘 다 선택 입력이라 nullable 추가만 한다.
ALTER TABLE "BrandCampaign" ADD COLUMN "cardImageUrl" TEXT;
ALTER TABLE "BrandCampaign" ADD COLUMN "rulesUrl" TEXT;
