import { AdminOverviewService } from "./admin-overview.service";

type CampaignCountArgs = { where: Record<string, unknown> };

function makeService(overrides: {
  campaignCounts?: number[];
  onCampaignCount?: (args: CampaignCountArgs) => void;
  applicationCounts?: number[];
  settlementAgg?: {
    _sum: { amountJpy: number | null };
    _count: { _all: number };
  };
}) {
  const campaignCounts = overrides.campaignCounts ?? [0, 0];
  const applicationCounts = overrides.applicationCounts ?? [0, 0];
  let campaignCountCallIndex = 0;
  let applicationCountCallIndex = 0;
  const prisma = {
    campaign: {
      count: async (args: CampaignCountArgs) => {
        overrides.onCampaignCount?.(args);
        const value = campaignCounts[campaignCountCallIndex] ?? 0;
        campaignCountCallIndex += 1;
        return value;
      },
    },
    campaignApplication: {
      count: async () => {
        const value = applicationCounts[applicationCountCallIndex] ?? 0;
        applicationCountCallIndex += 1;
        return value;
      },
    },
    settlement: {
      aggregate: async () =>
        overrides.settlementAgg ?? {
          _sum: { amountJpy: 0 },
          _count: { _all: 0 },
        },
    },
  } as never;
  return new AdminOverviewService(prisma);
}

describe("AdminOverviewService.stats", () => {
  it("내 담당 모집중 집계는 모집중 조건에 managerIds has 를 더한 where 를 쓴다", async () => {
    const capturedWheres: Record<string, unknown>[] = [];
    const service = makeService({
      onCampaignCount: (args) => capturedWheres.push(args.where),
    });

    await service.stats("admin-1");

    expect(capturedWheres).toHaveLength(2);
    const [recruitingWhere, myRecruitingWhere] = capturedWheres;
    expect(recruitingWhere).toMatchObject({ closedAt: null });
    expect(recruitingWhere).toHaveProperty("recruitStartAt");
    expect(recruitingWhere).toHaveProperty("recruitEndAt");
    expect(myRecruitingWhere).toMatchObject({
      ...recruitingWhere,
      managerIds: { has: "admin-1" },
    });
  });

  it("두 집계가 서로 다른 값을 돌려준다", async () => {
    const service = makeService({ campaignCounts: [5, 2] });

    const result = await service.stats("admin-1");

    expect(result.recruitingCampaignCount).toBe(5);
    expect(result.myRecruitingCampaignCount).toBe(2);
  });
});
