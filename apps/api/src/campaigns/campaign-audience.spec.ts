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
  const deleted: string[] = [];
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
      deleteMany: async (args: {
        where: { influencerId?: { in: string[] } };
      }) => {
        deleted.push(...(args.where.influencerId?.in ?? []));
        return { count: deleted.length };
      },
    },
  } as never;
  return {
    service: new CampaignAudienceService(prisma),
    prisma,
    created,
    deleted,
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
    await service.applyInput(prisma, "camp-new", EMPTY_INPUT);
    expect(created).toEqual([]);
  });

  it("기존 캠페인 승인자를 대상자로 불러오고 출처 캠페인을 남긴다", async () => {
    const { service, prisma, created, seenApplicationWhere } = makeService({
      approvedApplications: [
        { campaignId: "camp-1", influencerId: "inf-1" },
        { campaignId: "camp-1", influencerId: "inf-2" },
      ],
    });

    await service.applyInput(prisma, "camp-new", {
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

    await service.applyInput(prisma, "camp-new", {
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

    await service.applyInput(prisma, "camp-new", {
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
      service.applyInput(prisma, "camp-new", {
        ...EMPTY_INPUT,
        audienceTagLabels: ["없는태그"],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("존재하지 않는 인플루언서 id 는 거절한다", async () => {
    const { service, prisma } = makeService({ influencers: [] });

    await expect(
      service.applyInput(prisma, "camp-new", {
        ...EMPTY_INPUT,
        audienceInfluencerIds: ["inf-missing"],
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("저장 전 프리뷰", () => {
  // 수정 화면 진입 직후 — 피커는 비어 있고 이미 저장된 대상자만 보여야 한다.
  it("입력이 비어 있어도 이미 저장된 대상자는 그대로 보여준다", async () => {
    const { service } = makeService({
      savedAudience: [
        {
          influencerId: "inf-1",
          source: "CAMPAIGN",
          sourceRefId: "camp-1",
          createdAt: new Date("2026-11-01T00:00:00Z"),
          influencer: { name: "등록된 사람", email: "saved@example.com" },
        },
      ],
    });

    const result = await service.preview("camp-new", EMPTY_INPUT);

    expect(result.audience).toHaveLength(1);
    expect(result.audience[0]!.influencerId).toBe("inf-1");
    expect(result.audience[0]!.pending).toBe(false);
  });

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

describe("규칙 변경 반영", () => {
  it("규칙이 그대로면 목록에서 개별 제외한 사람을 다시 추가하지 않는다", async () => {
    // camp-1 승인자는 2명인데, 어드민이 inf-2 를 목록에서 제외해 1행만 남은 상태.
    const { service, prisma, created, deleted } = makeService({
      approvedApplications: [
        { campaignId: "camp-1", influencerId: "inf-1" },
        { campaignId: "camp-1", influencerId: "inf-2" },
      ],
      savedAudience: [
        {
          influencerId: "inf-1",
          source: "CAMPAIGN",
          sourceRefId: "camp-1",
          createdAt: new Date("2026-11-01T00:00:00Z"),
          influencer: { name: "남은 사람", email: "inf-1@example.com" },
        },
      ],
    });

    await service.applyInput(prisma, "camp-new", {
      ...EMPTY_INPUT,
      audienceCampaignIds: ["camp-1"],
    });

    expect(created).toEqual([]);
    expect(deleted).toEqual([]);
  });

  it("규칙을 빼면 그 규칙으로만 들어온 사람이 제거된다", async () => {
    const { service, prisma, deleted } = makeService({
      savedAudience: [
        {
          influencerId: "inf-1",
          source: "CAMPAIGN",
          sourceRefId: "camp-1",
          createdAt: new Date("2026-11-01T00:00:00Z"),
          influencer: { name: "빠질 사람", email: "inf-1@example.com" },
        },
      ],
    });

    await service.applyInput(prisma, "camp-new", EMPTY_INPUT);

    expect(deleted).toEqual(["inf-1"]);
  });

  it("규칙을 빼도 남은 다른 규칙에 걸리면 제거하지 않는다", async () => {
    const { service, prisma, deleted } = makeService({
      tags: [{ id: "tag-1", label: "VIP" }],
      tagAssignments: [{ influencerId: "inf-1", tagId: "tag-1" }],
      influencers: [{ id: "inf-1" }],
      savedAudience: [
        {
          influencerId: "inf-1",
          source: "CAMPAIGN",
          sourceRefId: "camp-1",
          createdAt: new Date("2026-11-01T00:00:00Z"),
          influencer: { name: "VIP 겸 승인자", email: "inf-1@example.com" },
        },
      ],
    });

    // camp-1 은 뺐지만 VIP 태그는 그대로 — inf-1 은 여전히 대상이어야 한다.
    await service.applyInput(prisma, "camp-new", {
      ...EMPTY_INPUT,
      audienceTagLabels: ["VIP"],
    });

    expect(deleted).toEqual([]);
  });
});
