import { BadRequestException } from "@nestjs/common";
import { CreateCampaignRequestSchema, UpdateCampaignRequestSchema } from "@jsure/shared";
import {
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
