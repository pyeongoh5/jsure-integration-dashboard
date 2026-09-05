import { InfluencerCampaignsService } from "./influencer-campaigns.service";

type CreateManyCall = {
  data: { campaignId: string; influencerId: string }[];
  skipDuplicates?: boolean;
};

function makeService(createManyImpl?: () => Promise<unknown>) {
  const calls: CreateManyCall[] = [];
  const prisma = {
    campaign: {
      findFirst: async () => ({
        id: "c1",
        category: "SNS",
        title: "캠페인",
        productSummary: "",
        thumbnailUrl: null,
        rewardType: "UNIFIED",
        rewardJpy: 1000,
        recruitStartAt: new Date("2026-07-01T00:00:00Z"),
        recruitEndAt: new Date("2026-07-31T00:00:00Z"),
        postingPeriodDays: 14,
        publishStartAt: null,
        publishEndAt: null,
        orderPeriodDays: null,
        productDetailUrls: [],
        guideline: "",
        referenceMediaUrls: [],
        cautions: "",
        createdAt: new Date("2026-07-01T00:00:00Z"),
        bumpedAt: new Date("2026-07-01T00:00:00Z"),
        closedAt: null,
        recruits: [],
        exclusionsAsExcluding: [],
      }),
    },
    campaignView: {
      createMany: async (args: CreateManyCall) => {
        calls.push(args);
        if (createManyImpl) return createManyImpl();
        return { count: 1 };
      },
    },
    campaignApplication: {
      count: async () => 0,
      findUnique: async () => null,
      findMany: async () => [],
    },
  } as never;
  const uploads = {
    resolveCampaignThumbnailUrl: async (url: string | null) => url,
    resolveR2ImagesInHtml: async (html: string) => html,
  } as never;
  return { service: new InfluencerCampaignsService(prisma, uploads), calls };
}

describe("캠페인 상세 조회 기록", () => {
  it("상세 조회 시 (캠페인, 인플루언서) 1행을 중복 무시로 기록한다", async () => {
    const { service, calls } = makeService();

    await service.detail({ influencerId: "i1", campaignId: "c1" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.data).toEqual([{ campaignId: "c1", influencerId: "i1" }]);
    // 재조회가 행을 늘리지 않도록 중복은 DB 레벨에서 무시된다.
    expect(calls[0]!.skipDuplicates).toBe(true);
  });

  it("기록이 실패해도 상세 조회는 정상 응답한다", async () => {
    const { service } = makeService(async () => {
      throw new Error("DB down");
    });

    const detail = await service.detail({
      influencerId: "i1",
      campaignId: "c1",
    });

    expect(detail.id).toBe("c1");
  });
});
