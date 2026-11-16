import { BadRequestException } from "@nestjs/common";
import {
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  type CampaignManager,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
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
  existingAdminIds?: string[];
  row?: Record<string, unknown>;
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
      findMany: async () => [],
      findUnique: async () => ({ ...row }),
      findFirst: async () => row,
      update: async (args: { data: Record<string, unknown> }) => {
        overrides.onUpdate?.(args);
        return row;
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
    recordMany: jest.fn(),
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
