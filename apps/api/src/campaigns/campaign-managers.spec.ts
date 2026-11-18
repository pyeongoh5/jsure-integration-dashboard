import { BadRequestException } from "@nestjs/common";
import {
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  type BulkAssignCampaignManagersRequest,
  type CampaignManager,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import type { AuditEntry } from "../audit/audit.service";
import { CampaignsService, pickManagers } from "./campaigns.service";
import { CampaignAudienceService } from "./campaign-audience.service";

const TEST_ACTOR = { id: "admin-1", name: "테스트 어드민" };

const CREATE_REQUEST_BASE = {
  category: "SNS" as const,
  title: "테스트 캠페인",
  tags: [],
  rewardType: "UNIFIED" as const,
  rewardJpy: 1000,
  recruitStartDate: "2026-08-01",
  recruitEndDate: "2026-08-20",
  postingPeriodDays: 14,
  recruits: [
    {
      subType: "INSTAGRAM" as const,
      minFollowers: 0,
      recruitCount: 1,
      subTypeOptions: ["FEED"],
      insightRequired: true,
      isRequired: false,
      productPriceJpy: null,
      productUrl: null,
      options: [],
    },
  ],
  productSummary: "요약",
  productDetailUrls: ["https://example.com/product"],
  guideline: "가이드",
  referenceMediaUrls: [],
  cautions: "주의",
  thumbnailUrl: null,
  excludedCampaignIds: [],
};

function createRequest(
  overrides: Record<string, unknown> = {},
): CreateCampaignRequest {
  return CreateCampaignRequestSchema.parse({ ...CREATE_REQUEST_BASE, ...overrides });
}

function updateRequest(
  overrides: Record<string, unknown>,
): UpdateCampaignRequest {
  return UpdateCampaignRequestSchema.parse(overrides);
}

type MakeServiceOverrides = {
  onCreate?: (args: { data: Record<string, unknown> }) => void;
  onUpdate?: (args: { data: Record<string, unknown> }) => void;
  onUpdateMany?: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => void;
  onRecordMany?: (entries: AuditEntry[]) => void;
  existingAdminIds?: string[];
  /** 삭제되지 않아 assignManagers 의 대상이 되는 캠페인 id. 생략하면 요청한 id 전부가 존재하는 것으로 본다. */
  existingCampaignIds?: string[];
  row?: Record<string, unknown>;
  updateManyCount?: number;
};

/** campaign-drafts.spec.ts 의 makeService stub-prisma 패턴을 그대로 따른다. */
function makeService(overrides: MakeServiceOverrides = {}) {
  const row = {
    id: "c1",
    category: "SNS",
    title: "제목",
    tags: [],
    publishState: "PUBLISHED",
    audienceMode: "PUBLIC",
    rewardType: "UNIFIED",
    rewardJpy: 0,
    recruitStartAt: new Date("2026-07-28T00:00:00Z"),
    recruitEndAt: new Date("2026-07-28T00:00:00Z"),
    closedAt: null,
    hiddenAt: null,
    deletedAt: null,
    postingPeriodDays: 14,
    publishStartAt: null,
    publishEndAt: null,
    orderPeriodDays: null,
    productSummary: "",
    productOptions: [],
    productDetailUrls: [],
    guideline: "",
    referenceMediaUrls: [],
    cautions: "",
    thumbnailUrl: null,
    createdAt: new Date("2026-07-28T00:00:00Z"),
    updatedAt: new Date("2026-07-28T00:00:00Z"),
    recruits: [],
    exclusionsAsExcluding: [],
    managerIds: [],
    ...overrides.row,
  };
  const existingAdminIds = new Set(overrides.existingAdminIds ?? []);
  const prisma = {
    campaign: {
      create: async (args: { data: Record<string, unknown> }) => {
        overrides.onCreate?.(args);
        return row;
      },
      findMany: async (args: { where: { id: { in: string[] } } }) => {
        const existingCampaignIds =
          overrides.existingCampaignIds ?? args.where.id.in;
        return args.where.id.in
          .filter((id) => existingCampaignIds.includes(id))
          .map((id) => ({ id }));
      },
      findUnique: async () => ({ ...row }),
      findFirst: async () => row,
      update: async (args: { data: Record<string, unknown> }) => {
        overrides.onUpdate?.(args);
        return row;
      },
      updateMany: async (args: {
        where: { id: { in: string[] } };
        data: Record<string, unknown>;
      }) => {
        overrides.onUpdateMany?.(args);
        return { count: overrides.updateManyCount ?? args.where.id.in.length };
      },
    },
    adminUser: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in
          .filter((id) => existingAdminIds.has(id))
          .map((id) => ({ id, name: `이름-${id}`, email: `${id}@example.com` })),
      count: async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in.filter((id) => existingAdminIds.has(id)).length,
    },
    // 이 스펙은 담당자 기능만 다루지만 toResponseResolved 경로가 설문 제목도 함께
    // 조회한다 — 이 스펙의 캠페인은 설문과 무관하므로 항상 null 을 돌려준다.
    builderSurvey: {
      findUnique: async () => null,
      findMany: async () => [],
    },
    campaignApplication: {
      groupBy: async () => [],
      count: async () => 0,
    },
    campaignView: {
      groupBy: async () => [],
    },
    campaignAudience: {
      groupBy: async () => [],
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
    },
    // 캠페인 저장은 모집·대상자 반영과 한 트랜잭션이다. 테스트에서는 같은 더블을 그대로 넘긴다.
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(prisma),
    $queryRaw: async () => [],
  } as never;
  const uploads = {
    resolveCampaignThumbnailUrl: async (value: string | null) => value,
    resolveR2ImagesInHtml: async (value: string) => value,
  } as never;
  const audit = {
    record: jest.fn(),
    recordMany: jest.fn((entries: AuditEntry[]) => {
      overrides.onRecordMany?.(entries);
    }),
  } as never;
  const audience = new CampaignAudienceService(prisma);
  return new CampaignsService(prisma, uploads, audit, audience);
}

describe("pickManagers", () => {
  const byId = new Map<string, CampaignManager>([
    ["admin-1", { id: "admin-1", name: "선희", email: "sunhee@example.com" }],
    ["admin-2", { id: "admin-2", name: null, email: "karin@example.com" }],
  ]);

  it("managerIds 순서대로 풀어낸다", () => {
    expect(
      pickManagers(["admin-2", "admin-1"], byId).map((manager) => manager.id),
    ).toEqual(["admin-2", "admin-1"]);
  });

  it("빈 managerIds 는 빈 배열이다", () => {
    expect(pickManagers([], byId)).toEqual([]);
  });

  it("유령 id 는 건너뛰고 나머지는 남긴다", () => {
    expect(
      pickManagers(["ghost", "admin-1"], byId).map((manager) => manager.id),
    ).toEqual(["admin-1"]);
  });
});

describe("캠페인 생성 시 담당자 저장", () => {
  it("managerIds 를 그대로 저장한다", async () => {
    let created: { data: Record<string, unknown> } | null = null;
    const service = makeService({
      existingAdminIds: ["admin-1", "admin-2"],
      onCreate: (args) => {
        created = args;
      },
    });

    await service.create(
      createRequest({ managerIds: ["admin-1", "admin-2"] }),
      TEST_ACTOR,
    );

    expect(created!.data.managerIds).toEqual(["admin-1", "admin-2"]);
  });

  it("존재하지 않는 어드민 id 가 섞이면 BadRequest 를 던진다", async () => {
    const service = makeService({ existingAdminIds: ["admin-1"] });

    await expect(
      service.create(
        createRequest({ managerIds: ["admin-1", "ghost"] }),
        TEST_ACTOR,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("managerIds 가 비어 있으면 그대로 빈 배열로 저장한다", async () => {
    let created: { data: Record<string, unknown> } | null = null;
    const service = makeService({
      onCreate: (args) => {
        created = args;
      },
    });

    await service.create(createRequest({ managerIds: [] }), TEST_ACTOR);

    expect(created!.data.managerIds).toEqual([]);
  });
});

describe("캠페인 수정 시 담당자 저장", () => {
  it("managerIds 를 보내면 통째로 교체한다", async () => {
    let updated: { data: Record<string, unknown> } | null = null;
    const service = makeService({
      existingAdminIds: ["admin-3"],
      onUpdate: (args) => {
        updated = args;
      },
    });

    await service.update(
      "c1",
      updateRequest({ managerIds: ["admin-3"] }),
      TEST_ACTOR,
    );

    expect(updated!.data.managerIds).toEqual(["admin-3"]);
  });

  it("managerIds 를 생략하면 기존 담당자를 건드리지 않는다", async () => {
    let updated: { data: Record<string, unknown> } | null = null;
    const service = makeService({
      onUpdate: (args) => {
        updated = args;
      },
    });

    await service.update("c1", updateRequest({ title: "새 제목" }), TEST_ACTOR);

    expect("managerIds" in updated!.data).toBe(false);
  });

  it("존재하지 않는 어드민 id 가 섞이면 BadRequest 를 던진다", async () => {
    const service = makeService({ existingAdminIds: [] });

    await expect(
      service.update(
        "c1",
        updateRequest({ managerIds: ["ghost"] }),
        TEST_ACTOR,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe("assignManagers", () => {
  const bulkAssignRequest: BulkAssignCampaignManagersRequest = {
    campaignIds: ["c1", "c2"],
    managerIds: ["admin-2"],
  };

  it("선택한 캠페인의 담당자를 통째로 교체한다 — 추가가 아니다", async () => {
    let updateManyArgs: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    } | null = null;
    const service = makeService({
      existingAdminIds: ["admin-2"],
      onUpdateMany: (args) => {
        updateManyArgs = args;
      },
    });

    await service.assignManagers(bulkAssignRequest, TEST_ACTOR);

    expect(updateManyArgs!.data.managerIds).toEqual(["admin-2"]);
  });

  it("삭제된 캠페인은 대상에서 제외한다", async () => {
    let updateManyArgs: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    } | null = null;
    let recordedEntries: AuditEntry[] = [];
    const service = makeService({
      existingAdminIds: ["admin-2"],
      existingCampaignIds: ["c1"], // c2 는 삭제된 것으로 취급
      onUpdateMany: (args) => {
        updateManyArgs = args;
      },
      onRecordMany: (entries) => {
        recordedEntries = entries;
      },
    });

    const response = await service.assignManagers(bulkAssignRequest, TEST_ACTOR);

    expect(updateManyArgs!.where.deletedAt).toBe(null);
    expect(response.updatedCount).toBe(1);
    // 실제로 갱신된 c1 에만 감사 로그가 남고, 걸러진 c2 에는 남지 않는다.
    expect(recordedEntries.map((entry) => entry.campaignId)).toEqual(["c1"]);
  });

  it("managerIds 가 비면 담당자를 해제한다", async () => {
    let updateManyArgs: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    } | null = null;
    const service = makeService({
      onUpdateMany: (args) => {
        updateManyArgs = args;
      },
    });

    await service.assignManagers(
      { campaignIds: ["c1"], managerIds: [] },
      TEST_ACTOR,
    );

    expect(updateManyArgs!.data.managerIds).toEqual([]);
  });

  it("존재하지 않는 어드민 id 가 섞이면 BadRequest 를 던지고 updateMany 를 호출하지 않는다", async () => {
    let updateManyCalled = false;
    const service = makeService({
      existingAdminIds: [],
      onUpdateMany: () => {
        updateManyCalled = true;
      },
    });

    await expect(
      service.assignManagers(
        { campaignIds: ["c1"], managerIds: ["ghost"] },
        TEST_ACTOR,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(updateManyCalled).toBe(false);
  });

  it("CAMPAIGN_MANAGERS_ASSIGN 감사 로그를 캠페인당 1행씩 recordMany 로 남긴다", async () => {
    let recordedEntries: AuditEntry[] = [];
    const service = makeService({
      existingAdminIds: ["admin-2"],
      onRecordMany: (entries) => {
        recordedEntries = entries;
      },
    });

    await service.assignManagers(bulkAssignRequest, TEST_ACTOR);

    expect(recordedEntries).toHaveLength(bulkAssignRequest.campaignIds.length);
    for (const [index, campaignId] of bulkAssignRequest.campaignIds.entries()) {
      expect(recordedEntries[index]).toMatchObject({
        action: "CAMPAIGN_MANAGERS_ASSIGN",
        actor: TEST_ACTOR,
        campaignId,
        metadata: { managerCount: bulkAssignRequest.managerIds.length },
      });
    }
  });
});
