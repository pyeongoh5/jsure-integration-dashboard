import { NotFoundException } from "@nestjs/common";
import { SLOT_CONSUMING_STATUSES } from "@jsure/shared";
import { audienceVisibleWhere } from "./campaign-audience";
import { CampaignAudienceService } from "./campaign-audience.service";

type CreatedRow = {
  campaignId: string;
  influencerId: string;
  source: string;
  sourceRefId: string | null;
};

function makeService(fixture: {
  /** 기존 캠페인 승인자 — (campaignId, influencerId) 쌍 */
  approvedApplications?: { campaignId: string; influencerId: string }[];
  tags?: { id: string; label: string }[];
  tagAssignments?: { influencerId: string; tagId: string }[];
  influencers?: { id: string; name?: string; email?: string }[];
  /** 이미 저장된 대상자 행 (프리뷰 병합 검증용) */
  savedAudience?: {
    influencerId: string;
    source: string;
    sourceRefId: string | null;
    createdAt: Date;
    influencer: { name: string; email: string };
  }[];
}) {
  const created: CreatedRow[] = [];
  const seenApplicationWhere: Record<string, unknown>[] = [];
  const prisma = {
    campaignApplication: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        seenApplicationWhere.push(args.where);
        return fixture.approvedApplications ?? [];
      },
    },
    influencerTag: {
      findMany: async () => fixture.tags ?? [],
    },
    influencerTagAssignment: {
      findMany: async () => fixture.tagAssignments ?? [],
    },
    influencer: {
      findMany: async () =>
        (fixture.influencers ?? []).map((influencer) => ({
          name: `이름-${influencer.id}`,
          email: `${influencer.id}@example.com`,
          ...influencer,
        })),
    },
    campaign: {
      findMany: async () => [],
    },
    campaignAudience: {
      findMany: async () => fixture.savedAudience ?? [],
      createMany: async (args: { data: CreatedRow[] }) => {
        created.push(...args.data);
        return { count: args.data.length };
      },
    },
  } as never;
  return {
    service: new CampaignAudienceService(prisma),
    prisma,
    created,
    seenApplicationWhere,
  };
}

const EMPTY_INPUT = {
  audienceCampaignIds: [],
  audienceTagLabels: [],
  audienceInfluencerIds: [],
};

describe("공개 범위 where 조각", () => {
  it("전체 공개이거나 본인이 대상자인 캠페인만 통과시킨다", () => {
    expect(audienceVisibleWhere("inf-1")).toEqual({
      OR: [
        { audienceMode: "PUBLIC" },
        { audience: { some: { influencerId: "inf-1" } } },
      ],
    });
  });
});

describe("대상자 해석", () => {
  it("입력이 전부 비어 있으면 아무 행도 만들지 않는다", async () => {
    const { service, prisma, created } = makeService({});
    await service.addFromInput(prisma, "camp-new", EMPTY_INPUT);
    expect(created).toEqual([]);
  });

  it("기존 캠페인 승인자를 대상자로 불러오고 출처 캠페인을 남긴다", async () => {
    const { service, prisma, created, seenApplicationWhere } = makeService({
      approvedApplications: [
        { campaignId: "camp-1", influencerId: "inf-1" },
        { campaignId: "camp-1", influencerId: "inf-2" },
      ],
    });

    await service.addFromInput(prisma, "camp-new", {
      ...EMPTY_INPUT,
      audienceCampaignIds: ["camp-1"],
    });

    expect(created).toEqual([
      {
        campaignId: "camp-new",
        influencerId: "inf-1",
        source: "CAMPAIGN",
        sourceRefId: "camp-1",
      },
      {
        campaignId: "camp-new",
        influencerId: "inf-2",
        source: "CAMPAIGN",
        sourceRefId: "camp-1",
      },
    ]);
    // 승인 이후 흐름만 — 응모만 했거나 승인 후 취소된 인원은 대상자가 되면 안 된다.
    expect(seenApplicationWhere[0]!.status).toEqual({
      in: SLOT_CONSUMING_STATUSES,
    });
  });

  it("자기 자신을 기준 캠페인으로 넣어도 무시한다", async () => {
    const { service, prisma, created } = makeService({
      approvedApplications: [{ campaignId: "camp-new", influencerId: "inf-1" }],
    });

    await service.addFromInput(prisma, "camp-new", {
      ...EMPTY_INPUT,
      audienceCampaignIds: ["camp-new"],
    });

    expect(created).toEqual([]);
  });

  it("세 경로에 겹치는 인원은 1행이고 먼저 잡힌 출처가 남는다", async () => {
    const { service, prisma, created } = makeService({
      approvedApplications: [{ campaignId: "camp-1", influencerId: "inf-1" }],
      tags: [{ id: "tag-1", label: "VIP" }],
      tagAssignments: [{ influencerId: "inf-1", tagId: "tag-1" }],
      influencers: [{ id: "inf-1" }],
    });

    await service.addFromInput(prisma, "camp-new", {
      audienceCampaignIds: ["camp-1"],
      audienceTagLabels: ["VIP"],
      audienceInfluencerIds: ["inf-1"],
    });

    expect(created).toEqual([
      {
        campaignId: "camp-new",
        influencerId: "inf-1",
        source: "CAMPAIGN",
        sourceRefId: "camp-1",
      },
    ]);
  });

  it("등록되지 않은 태그 라벨은 거절한다 — 조용히 0명이 되면 안 된다", async () => {
    const { service, prisma } = makeService({ tags: [] });

    await expect(
      service.addFromInput(prisma, "camp-new", {
        ...EMPTY_INPUT,
        audienceTagLabels: ["없는태그"],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("존재하지 않는 인플루언서 id 는 거절한다", async () => {
    const { service, prisma } = makeService({ influencers: [] });

    await expect(
      service.addFromInput(prisma, "camp-new", {
        ...EMPTY_INPUT,
        audienceInfluencerIds: ["inf-missing"],
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("저장 전 프리뷰", () => {
  it("저장된 대상자 뒤에 이번에 추가될 인원을 pending 으로 붙인다", async () => {
    const { service } = makeService({
      approvedApplications: [
        { campaignId: "camp-1", influencerId: "inf-saved" },
        { campaignId: "camp-1", influencerId: "inf-new" },
      ],
      influencers: [{ id: "inf-new" }],
      savedAudience: [
        {
          influencerId: "inf-saved",
          source: "MANUAL",
          sourceRefId: null,
          createdAt: new Date("2026-11-01T00:00:00Z"),
          influencer: { name: "이미 등록", email: "saved@example.com" },
        },
      ],
    });

    const result = await service.preview("camp-new", {
      ...EMPTY_INPUT,
      audienceCampaignIds: ["camp-1"],
    });

    expect(
      result.audience.map((entry) => [entry.influencerId, entry.pending]),
    ).toEqual([
      ["inf-saved", false],
      ["inf-new", true],
    ]);
  });

  it("등록되지 않은 태그는 프리뷰에서 알려만 주고 목록을 깨뜨리지 않는다", async () => {
    const { service } = makeService({ tags: [] });

    const result = await service.preview(null, {
      ...EMPTY_INPUT,
      audienceTagLabels: ["없는태그"],
    });

    expect(result.unknownTagLabels).toEqual(["없는태그"]);
    expect(result.audience).toEqual([]);
  });
});
