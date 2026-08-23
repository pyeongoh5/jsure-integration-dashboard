-- 어드민 전용 캠페인 관리 태그(차수 등). 어드민 화면에서만 노출하며 인플루언서 응답에는 포함하지 않는다.
ALTER TABLE "campaigns" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
