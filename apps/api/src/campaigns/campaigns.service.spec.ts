import { BadRequestException } from "@nestjs/common";
import {
  CampaignDraftRequestSchema,
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
} from "@jsure/shared";
import type { AuditActor } from "../audit/audit.service";
import {
  CampaignsService,
  jstDayStartUtc,
  jstDayEndUtc,
  utcToJstDateStr,
  jstDateTimeToUtc,
  utcToJstDateTimeStr,
  validateRecruitsForCategory,
  validateRecruitsForRewardType,
  validateRecruitOptionConfigs,
} from "./campaigns.service";

describe("JST date conversion helpers", () => {
  it("jstDayStartUtc converts YYYY-MM-DD to JST 00:00:00 in UTC", () => {
    // 2026-05-19 00:00:00 JST === 2026-05-18 15:00:00 UTC
    expect(jstDayStartUtc("2026-05-19").toISOString()).toBe(
      "2026-05-18T15:00:00.000Z",
    );
  });

  it("jstDayEndUtc converts YYYY-MM-DD to JST 23:59:59 in UTC", () => {
    // 2026-05-19 23:59:59 JST === 2026-05-19 14:59:59 UTC
    expect(jstDayEndUtc("2026-05-19").toISOString()).toBe(
      "2026-05-19T14:59:59.000Z",
    );
  });

  it("utcToJstDateStr returns the JST calendar date for a UTC Date", () => {
    expect(utcToJstDateStr(new Date("2026-05-18T15:00:00Z"))).toBe(
      "2026-05-19",
    );
    expect(utcToJstDateStr(new Date("2026-05-19T14:59:59Z"))).toBe(
      "2026-05-19",
    );
  });

  it("jstDateTimeToUtc converts YYYY-MM-DDTHH:mm as JST", () => {
    // 2026-09-01 10:00 JST === 2026-09-01 01:00 UTC
    expect(jstDateTimeToUtc("2026-09-01T10:00").toISOString()).toBe(
      "2026-09-01T01:00:00.000Z",
    );
  });

  it("utcToJstDateTimeStr round-trips through jstDateTimeToUtc", () => {
    expect(utcToJstDateTimeStr(jstDateTimeToUtc("2026-09-10T23:59"))).toBe(
      "2026-09-10T23:59",
    );
  });
});

describe("validateRecruitsForCategory", () => {
  it("SNS 캠페인에 QOO10 recruit 이 들어오면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("SNS", [
        {
          subType: "QOO10",
          minFollowers: 1000,
          insightRequired: true,
          productPriceJpy: null,
          productUrl: null,
          subTypeOptions: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE 에서 productPriceJpy=0 이면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "QOO10",
          minFollowers: 0,
          insightRequired: false,
          productPriceJpy: 0,
          productUrl: "https://example.com/item",
          subTypeOptions: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE 에서 productUrl 이 없으면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "QOO10",
          minFollowers: 0,
          insightRequired: false,
          productPriceJpy: 1500,
          productUrl: null,
          subTypeOptions: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE 에서 minFollowers=100 이면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "QOO10",
          minFollowers: 100,
          insightRequired: false,
          productPriceJpy: 2000,
          productUrl: "https://example.com/item",
          subTypeOptions: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE 에서 recruits 가 2개면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "QOO10",
          minFollowers: 0,
          insightRequired: false,
          productPriceJpy: 2000,
          productUrl: "https://example.com/item",
          subTypeOptions: [],
        },
        {
          subType: "QOO10",
          minFollowers: 0,
          insightRequired: false,
          productPriceJpy: 2000,
          productUrl: "https://example.com/item2",
          subTypeOptions: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE 에서 subType 이 QOO10 이 아니면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "INSTAGRAM",
          minFollowers: 0,
          insightRequired: false,
          productPriceJpy: 2000,
          productUrl: "https://example.com/item",
          subTypeOptions: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE 에서 subTypeOptions=['INVALID'] 이면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "QOO10",
          minFollowers: 0,
          insightRequired: false,
          productPriceJpy: 2000,
          productUrl: "https://example.com/item",
          subTypeOptions: ["INVALID"],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE + subTypeOptions=['LIPS'] 정상", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "QOO10",
          minFollowers: 0,
          insightRequired: false,
          productPriceJpy: 2000,
          productUrl: "https://example.com/item",
          subTypeOptions: ["LIPS"],
        },
      ]),
    ).not.toThrow();
  });
});

describe("validateRecruitOptionConfigs / RewardType — 옵션별 정원·보수", () => {
  const instaRecruit = (
    options: { option: string; recruitCount: number | null; rewardJpy: number | null }[],
    rewardJpy: number | null = null,
  ) => ({
    subType: "INSTAGRAM",
    subTypeOptions: ["FEED", "REELS"],
    rewardJpy,
    options,
  });

  it("옵션 행이 허용 옵션 전체와 일치하지 않으면 BadRequest", () => {
    expect(() =>
      validateRecruitOptionConfigs([
        instaRecruit([{ option: "FEED", recruitCount: 10, rewardJpy: null }]),
      ]),
    ).toThrow(BadRequestException);
  });

  it("정원 부분 입력(all-or-nothing 위반)이면 BadRequest", () => {
    expect(() =>
      validateRecruitOptionConfigs([
        instaRecruit([
          { option: "FEED", recruitCount: 10, rewardJpy: null },
          { option: "REELS", recruitCount: null, rewardJpy: null },
        ]),
      ]),
    ).toThrow(BadRequestException);
  });

  it("옵션 선택형이 아닌 서브타입(QOO10)의 옵션 설정은 BadRequest", () => {
    expect(() =>
      validateRecruitOptionConfigs([
        {
          subType: "QOO10",
          subTypeOptions: ["LIPS"],
          options: [{ option: "LIPS", recruitCount: 5, rewardJpy: null }],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("정원 분리 + 보수 분리 정상 케이스는 통과", () => {
    expect(() =>
      validateRecruitOptionConfigs([
        instaRecruit([
          { option: "FEED", recruitCount: 30, rewardJpy: 5000 },
          { option: "REELS", recruitCount: 10, rewardJpy: 8000 },
        ]),
      ]),
    ).not.toThrow();
  });

  it("보수 분리인데 부모 rewardJpy 가 남아 있으면 BadRequest", () => {
    expect(() =>
      validateRecruitsForRewardType("PER_SUBTYPE", [
        instaRecruit(
          [
            { option: "FEED", recruitCount: null, rewardJpy: 5000 },
            { option: "REELS", recruitCount: null, rewardJpy: 8000 },
          ],
          4000,
        ),
      ]),
    ).toThrow(BadRequestException);
  });

  it("보수 분리면 부모 rewardJpy=null 이어도 PER_SUBTYPE 통과", () => {
    expect(() =>
      validateRecruitsForRewardType("PER_SUBTYPE", [
        instaRecruit([
          { option: "FEED", recruitCount: null, rewardJpy: 5000 },
          { option: "REELS", recruitCount: null, rewardJpy: 8000 },
        ]),
      ]),
    ).not.toThrow();
  });

  it("UNIFIED 캠페인에 옵션 보수가 있으면 BadRequest", () => {
    expect(() =>
      validateRecruitsForRewardType("UNIFIED", [
        instaRecruit([
          { option: "FEED", recruitCount: null, rewardJpy: 5000 },
          { option: "REELS", recruitCount: null, rewardJpy: 8000 },
        ]),
      ]),
    ).toThrow(BadRequestException);
  });
});

describe("CreateCampaignRequestSchema 게시 기간", () => {
  const base = {
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

  it("게시 기간 미입력이면 null 로 통과한다", () => {
    const parsed = CreateCampaignRequestSchema.parse(base);
    expect(parsed.publishStartDateTime).toBeNull();
    expect(parsed.publishEndDateTime).toBeNull();
  });

  it("시작만 입력하면 거부한다", () => {
    const result = CreateCampaignRequestSchema.safeParse({
      ...base,
      publishStartDateTime: "2026-09-01T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("종료가 시작보다 이르면 거부한다", () => {
    const result = CreateCampaignRequestSchema.safeParse({
      ...base,
      publishStartDateTime: "2026-09-10T10:00",
      publishEndDateTime: "2026-09-01T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("정상 게시 기간은 통과한다", () => {
    const parsed = CreateCampaignRequestSchema.parse({
      ...base,
      publishStartDateTime: "2026-09-01T10:00",
      publishEndDateTime: "2026-09-10T23:59",
    });
    expect(parsed.publishStartDateTime).toBe("2026-09-01T10:00");
  });
});

describe("UpdateCampaignRequestSchema 게시 기간", () => {
  it("시작만 보내면 거부한다", () => {
    const result = UpdateCampaignRequestSchema.safeParse({
      publishStartDateTime: "2026-09-01T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("역전된 값이면 거부한다", () => {
    const result = UpdateCampaignRequestSchema.safeParse({
      publishStartDateTime: "2026-09-10T10:00",
      publishEndDateTime: "2026-09-01T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("둘 다 null 이면 통과한다 (게시 기간 해제)", () => {
    const result = UpdateCampaignRequestSchema.safeParse({
      publishStartDateTime: null,
      publishEndDateTime: null,
    });
    expect(result.success).toBe(true);
  });

  it("둘 다 미포함이면 통과한다 (미변경)", () => {
    const result = UpdateCampaignRequestSchema.safeParse({
      title: "제목만 수정",
    });
    expect(result.success).toBe(true);
  });

  it("정상 쌍은 통과한다", () => {
    const result = UpdateCampaignRequestSchema.safeParse({
      publishStartDateTime: "2026-09-01T10:00",
      publishEndDateTime: "2026-09-10T23:59",
    });
    expect(result.success).toBe(true);
  });
});

describe("CampaignsService — surveyId 연결", () => {
  const actor: AuditActor = { id: "admin-1", name: "어드민" };

  const validCreateInput = {
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

  function makeCampaignRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "campaign-1",
      category: "SNS",
      title: "캠페인",
      tags: [],
      publishState: "PUBLISHED",
      audienceMode: "PUBLIC",
      audienceCampaignIds: [],
      audienceTagIds: [],
      audienceInfluencerIds: [],
      rewardType: "UNIFIED",
      rewardJpy: 1000,
      surveyId: null,
      recruitStartAt: new Date("2026-08-01T00:00:00Z"),
      recruitEndAt: new Date("2026-08-20T00:00:00Z"),
      closedAt: null,
      hiddenAt: null,
      deletedAt: null,
      postingPeriodDays: 14,
      publishStartAt: null,
      publishEndAt: null,
      orderPeriodDays: null,
      productSummary: "요약",
      productOptions: [],
      productDetailUrls: ["https://example.com/product"],
      guideline: "가이드",
      referenceMediaUrls: [],
      cautions: "주의",
      thumbnailUrl: null,
      createdAt: new Date("2026-08-01T00:00:00Z"),
      bumpedAt: new Date("2026-08-01T00:00:00Z"),
      updatedAt: new Date("2026-08-01T00:00:00Z"),
      recruits: [],
      exclusionsAsExcluding: [],
      managerIds: [],
      ...overrides,
    };
  }

  function makeCampaignService(overrides?: {
    campaignCreate?: jest.Mock<Promise<unknown>, [{ data: Record<string, unknown> }]>;
    campaignFindUnique?: jest.Mock;
    campaignFindFirst?: jest.Mock;
    campaignUpdate?: jest.Mock;
    builderSurveyFindUnique?: jest.Mock<Promise<{ title: string } | null>, [unknown]>;
  }) {
    const prisma: Record<string, unknown> = {
      campaign: {
        create: overrides?.campaignCreate ?? jest.fn(async () => makeCampaignRow()),
        findUnique: overrides?.campaignFindUnique ?? jest.fn(async () => makeCampaignRow()),
        findFirst: overrides?.campaignFindFirst ?? jest.fn(async () => makeCampaignRow()),
        findMany: jest.fn(async () => []),
        update: overrides?.campaignUpdate ?? jest.fn(async () => makeCampaignRow()),
      },
      builderSurvey: {
        findUnique: overrides?.builderSurveyFindUnique ?? jest.fn(async () => null),
        findMany: jest.fn(async () => []),
      },
      // 이 스펙은 설문 연결만 다루지만 toResponseResolved 경로가 담당자도 함께
      // 조회한다 — managerIds 가 항상 빈 배열(makeCampaignRow 기본값)이라 조회를
      // 건너뛰므로 빈 배열을 돌려주는 더미면 충분하다.
      adminUser: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
      },
      campaignApplication: { groupBy: jest.fn(async () => []) },
      campaignView: { groupBy: jest.fn(async () => []) },
      campaignAudience: { groupBy: jest.fn(async () => []) },
      $queryRaw: jest.fn(async () => []),
    };
    prisma.$transaction = jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(prisma),
    );
    const uploads = {
      resolveCampaignThumbnailUrl: jest.fn(async (url: string | null) => url),
      resolveR2ImagesInHtml: jest.fn(async (html: string) => html),
    };
    const audit = { record: jest.fn(async () => undefined) };
    const audience = { applyInput: jest.fn(async () => undefined) };
    const service = new CampaignsService(
      prisma as never,
      uploads as never,
      audit as never,
      audience as never,
    );
    return { service, prisma, uploads, audit, audience };
  }

  it("surveyId 를 저장한다", async () => {
    const campaignCreate = jest.fn(
      async (_args: { data: Record<string, unknown> }) =>
        makeCampaignRow({ surveyId: "survey-1" }),
    );
    const { service } = makeCampaignService({ campaignCreate });
    const input = CreateCampaignRequestSchema.parse({
      ...validCreateInput,
      surveyId: "survey-1",
    });

    await service.create(input, actor);

    expect(campaignCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      surveyId: "survey-1",
    });
  });

  it("surveyId 가 있으면 응답에 surveyTitle 을 채운다", async () => {
    const campaignCreate = jest.fn(
      async (_args: { data: Record<string, unknown> }) =>
        makeCampaignRow({ surveyId: "survey-1" }),
    );
    const builderSurveyFindUnique = jest.fn(async (_args: unknown) => ({ title: "7월 설문" }));
    const { service } = makeCampaignService({ campaignCreate, builderSurveyFindUnique });
    const input = CreateCampaignRequestSchema.parse({
      ...validCreateInput,
      surveyId: "survey-1",
    });

    const response = await service.create(input, actor);

    expect(response.surveyTitle).toBe("7월 설문");
    // include 로 가져오지 않는다 (FK 가 없다) — 별도 findUnique 호출이어야 한다.
    expect(builderSurveyFindUnique.mock.calls[0]?.[0]).toEqual({
      where: { id: "survey-1" },
      select: { title: true },
    });
  });

  it("surveyId 가 null 이면 surveyTitle 도 null 이고 설문을 조회하지 않는다", async () => {
    const builderSurveyFindUnique = jest.fn(async (_args: unknown) => ({ title: "안 쓰임" }));
    const { service } = makeCampaignService({ builderSurveyFindUnique });
    const input = CreateCampaignRequestSchema.parse({
      ...validCreateInput,
      surveyId: null,
    });

    const response = await service.create(input, actor);

    expect(response.surveyTitle).toBeNull();
    expect(builderSurveyFindUnique).not.toHaveBeenCalled();
  });

  it("연결된 설문이 삭제됐어도 제목을 그대로 내린다", async () => {
    const campaignFindFirst = jest.fn(
      async (_args: unknown) => makeCampaignRow({ surveyId: "survey-1" }),
    );
    const builderSurveyFindUnique = jest.fn(async (_args: unknown) => ({ title: "삭제된 설문" }));
    const { service } = makeCampaignService({ campaignFindFirst, builderSurveyFindUnique });

    const response = await service.findById("campaign-1");

    expect(response.surveyTitle).toBe("삭제된 설문");
    expect(builderSurveyFindUnique.mock.calls[0]?.[0]).toEqual({
      where: { id: "survey-1" },
      select: { title: true },
    });
  });

  it("임시저장이 surveyId 를 보존한다", async () => {
    const campaignCreate = jest.fn(
      async (_args: { data: Record<string, unknown> }) =>
        makeCampaignRow({ surveyId: "survey-1" }),
    );
    const { service } = makeCampaignService({ campaignCreate });
    const input = CampaignDraftRequestSchema.parse({
      title: "임시저장 캠페인",
      surveyId: "survey-1",
    });

    await service.createDraft(input, actor);

    expect(campaignCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      surveyId: "survey-1",
    });
  });
});
