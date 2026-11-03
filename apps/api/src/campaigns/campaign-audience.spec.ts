import { NotFoundException } from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  audienceExclusionConflicts,
} from "@jsure/shared";
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
  /** 캠페인에 저장돼 있는 규칙 (selection 복원 검증용) */
  savedRules?: {
    audienceCampaignIds: string[];
    audienceTagIds: string[];
    audienceInfluencerIds: string[];
  };
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
  const savedRuleWrites: Record<string, unknown>[] = [];
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
      findUnique: async () => fixture.savedRules ?? null,
      // applyInput 은 규칙 자체도 캠페인에 남긴다.
      update: async (args: { data: Record<string, unknown> }) => {
        savedRuleWrites.push(args.data);
        return {};
      },
    },
    campaignAudience: {
      findMany: async () => fixture.savedAudience ?? [],
      createMany: async (args: { data: CreatedRow[] }) => {
        created.push(...args.data);
        return { count: args.data.length };
      },
      deleteMany: async (args: {
        where: { influencerId?: { notIn?: string[] } };
      }) => {
        // notIn 은 "이 사람들만 남긴다", 조건이 없으면 전체 삭제.
        const keep = args.where.influencerId?.notIn;
        deleted.push(...(keep ?? ["ALL"]));
        return { count: 0 };
      },
    },
  } as never;
  return {
    service: new CampaignAudienceService(prisma),
    prisma,
    created,
    deleted,
    savedRuleWrites,
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
  // 프리뷰는 "저장하면 이렇게 된다" 다. 규칙이 비면 저장 시 명단도 비므로 0명이 맞다.
  it("규칙이 비면 저장된 대상자가 있어도 빈 명단을 보여준다", async () => {
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

    expect(result.audience).toEqual([]);
  });

  it("이미 저장된 사람은 pending=false, 이번에 새로 들어오는 사람은 true", async () => {
    const { service } = makeService({
      approvedApplications: [
        { campaignId: "camp-1", influencerId: "inf-saved" },
        { campaignId: "camp-1", influencerId: "inf-new" },
      ],
      influencers: [{ id: "inf-saved" }, { id: "inf-new" }],
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
  it("규칙에서 빠진 사람은 제거된다 — 명단은 규칙의 함수다", async () => {
    const { service, prisma, deleted } = makeService({
      approvedApplications: [{ campaignId: "camp-1", influencerId: "inf-1" }],
    });

    // 규칙이 비었으므로 기존 대상자는 전부 사라져야 한다.
    await service.applyInput(prisma, "camp-new", EMPTY_INPUT);

    // 남길 사람이 없으면 캠페인 전체 삭제로 간다(notIn: [] 를 피한다).
    expect(deleted).toEqual(["ALL"]);
  });

  it("규칙에 남은 사람은 지우지 않고 유지한다", async () => {
    const { service, prisma, created, deleted } = makeService({
      approvedApplications: [{ campaignId: "camp-1", influencerId: "inf-1" }],
    });

    await service.applyInput(prisma, "camp-new", {
      ...EMPTY_INPUT,
      audienceCampaignIds: ["camp-1"],
    });

    expect(created.map((row) => row.influencerId)).toEqual(["inf-1"]);
    // inf-1 만 남기고 나머지를 지우는 형태여야 한다.
    expect(deleted).toEqual(["inf-1"]);
  });
});

describe("공개 대상 / 참여 제외 충돌", () => {
  it("같은 캠페인이 양쪽에 지정되면 충돌로 잡는다", () => {
    expect(
      audienceExclusionConflicts({
        audienceCampaignIds: ["camp-1", "camp-2"],
        excludedCampaignIds: ["camp-2", "camp-3"],
      }),
    ).toEqual(["camp-2"]);
  });

  it("겹치지 않으면 충돌이 없다", () => {
    expect(
      audienceExclusionConflicts({
        audienceCampaignIds: ["camp-1"],
        excludedCampaignIds: ["camp-2"],
      }),
    ).toEqual([]);
  });

  it("한쪽이 비어 있으면 충돌이 없다", () => {
    expect(audienceExclusionConflicts({ excludedCampaignIds: ["camp-1"] })).toEqual(
      [],
    );
  });
});

describe("규칙 저장/복원", () => {
  it("승인자가 0명인 캠페인을 골라도 규칙은 저장된다", async () => {
    // 결과 행이 하나도 안 생기는 상황 — 예전에는 복원할 근거가 없어 선택이 사라졌다.
    const { service, prisma, created, savedRuleWrites } = makeService({
      approvedApplications: [],
    });

    await service.applyInput(prisma, "camp-new", {
      ...EMPTY_INPUT,
      audienceCampaignIds: ["camp-empty"],
    });

    expect(created).toEqual([]);
    expect(savedRuleWrites[0]!.audienceCampaignIds).toEqual(["camp-empty"]);
  });

  it("복원은 결과 행이 아니라 저장된 규칙 컬럼에서 읽는다", async () => {
    const { service } = makeService({
      tags: [{ id: "tag-1", label: "VIP" }],
      savedRules: {
        audienceCampaignIds: ["camp-empty"],
        audienceTagIds: ["tag-1"],
        audienceInfluencerIds: ["inf-1"],
      },
      // 결과 행은 하나도 없다.
      savedAudience: [],
    });

    expect(await service.selection("camp-new")).toEqual({
      audienceCampaignIds: ["camp-empty"],
      audienceTagLabels: ["VIP"],
      audienceInfluencerIds: ["inf-1"],
    });
  });

  it("아무도 안 걸린 선택은 프리뷰가 이름으로 알려준다", async () => {
    const { service } = makeService({ approvedApplications: [] });

    const result = await service.preview("camp-new", {
      ...EMPTY_INPUT,
      audienceCampaignIds: ["camp-empty"],
    });

    expect(result.audience).toEqual([]);
    // 제목을 못 찾으면 id 로라도 알린다.
    expect(result.emptyRuleLabels).toEqual(["camp-empty"]);
  });
});
