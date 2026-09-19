import { Prisma } from "@prisma/client";
import { SLOT_CONSUMING_STATUSES } from "@jsure/shared";
import type { PrismaService } from "../prisma/prisma.service";
import { optionKey } from "./campaign-fullness";

export type SlotOccupancy = {
  /** 서브타입 → 슬롯 점유 수 */
  subTypeApproved: Map<string, number>;
  /** optionKey(subType, option) → 슬롯 점유 수 */
  optionApproved: Map<string, number>;
};

export const EMPTY_OCCUPANCY: SlotOccupancy = {
  subTypeApproved: new Map(),
  optionApproved: new Map(),
};

/**
 * 캠페인별 서브타입·옵션 슬롯 점유(SLOT_CONSUMING_STATUSES 응모 수)를 일괄 집계.
 * subTypes 가 배열 컬럼이라 prisma groupBy 로는 못 풀어 unnest raw 쿼리를 쓴다.
 * 캠페인 수와 무관하게 쿼리 2번.
 */
export async function loadSlotOccupancy(
  prisma: PrismaService,
  campaignIds: string[],
): Promise<Map<string, SlotOccupancy>> {
  const map = new Map<string, SlotOccupancy>();
  if (campaignIds.length === 0) return map;
  for (const id of campaignIds) {
    map.set(id, {
      subTypeApproved: new Map(),
      optionApproved: new Map(),
    });
  }

  const [subTypeRows, optionRows] = await Promise.all([
    prisma.$queryRaw<{ campaignId: string; subType: string; count: bigint }[]>`
      SELECT "campaignId", unnest("subTypes")::text AS "subType", COUNT(*) AS count
      FROM "campaign_applications"
      WHERE "campaignId" IN (${Prisma.join(campaignIds)})
        AND "status"::text IN (${Prisma.join(SLOT_CONSUMING_STATUSES)})
      GROUP BY 1, 2
    `,
    prisma.$queryRaw<
      { campaignId: string; subType: string; option: string; count: bigint }[]
    >`
      SELECT app."campaignId", opt."subType"::text AS "subType", opt."option",
             COUNT(*) AS count
      FROM "campaign_application_options" opt
      JOIN "campaign_applications" app ON app."id" = opt."applicationId"
      WHERE app."campaignId" IN (${Prisma.join(campaignIds)})
        AND app."status"::text IN (${Prisma.join(SLOT_CONSUMING_STATUSES)})
      GROUP BY 1, 2, 3
    `,
  ]);

  for (const row of subTypeRows) {
    map.get(row.campaignId)?.subTypeApproved.set(row.subType, Number(row.count));
  }
  for (const row of optionRows) {
    map
      .get(row.campaignId)
      ?.optionApproved.set(optionKey(row.subType, row.option), Number(row.count));
  }
  return map;
}
