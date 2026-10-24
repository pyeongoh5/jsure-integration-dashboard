-- 당첨확률을 경품(Prize)에서 참여(BrandCampaign)로 올리고, 소진 페이싱 상태를 붙인다.
-- 당첨 여부는 캠페인 단위 확률 1회 판정으로 정하고, 어떤 상품인지는 남은 수량 비례로 뽑는다.
-- 설계: docs/superpowers/specs/2026-10-24-jwin-instant-win-pacing-design.md

ALTER TABLE "BrandCampaign" ADD COLUMN "winProbability" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "BrandCampaign" ADD COLUMN "paceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "BrandCampaign" ADD COLUMN "windowStartedAt" TIMESTAMP(3);
ALTER TABLE "BrandCampaign" ADD COLUMN "windowWinCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BrandCampaign" ADD COLUMN "windowEntryCount" INTEGER NOT NULL DEFAULT 0;

-- 기존 경품별 확률의 합계가 순차 판정의 전체 당첨률에 가장 가깝다. 1 을 넘으면 1 로 자른다.
UPDATE "BrandCampaign" bc
SET "winProbability" = LEAST(sub."total", 1)
FROM (
  SELECT "campaignId", SUM("winProbability") AS "total"
  FROM "Prize"
  GROUP BY "campaignId"
) sub
WHERE sub."campaignId" = bc."id";

-- 진행 중인 캠페인은 캠페인 시작 시각부터 구간을 세면 경과분만큼 보정 배수가 한 번에
-- 치솟는다. 마이그레이션 실행 시각을 현재 구간의 시작으로 잡아 그 점프를 막는다.
UPDATE "BrandCampaign" SET "windowStartedAt" = NOW() WHERE "status" = 'ACTIVE';

ALTER TABLE "Prize" DROP COLUMN "winProbability";
ALTER TABLE "Prize" DROP COLUMN "tier";
ALTER TABLE "BrandCampaign" DROP COLUMN "dailyWinCap";
