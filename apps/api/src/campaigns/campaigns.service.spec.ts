import { BadRequestException } from "@nestjs/common";
import {
  jstDayStartUtc,
  jstDayEndUtc,
  utcToJstDateStr,
  validateRecruitsForCategory,
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
          instagramPostTypes: [],
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
          instagramPostTypes: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE 에서 productUrl 이 없으면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "LIPS",
          minFollowers: 0,
          insightRequired: false,
          productPriceJpy: 1500,
          productUrl: null,
          instagramPostTypes: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it("FAKE_PURCHASE 에서 minFollowers=100 이면 BadRequest", () => {
    expect(() =>
      validateRecruitsForCategory("FAKE_PURCHASE", [
        {
          subType: "ATCOSME",
          minFollowers: 100,
          insightRequired: false,
          productPriceJpy: 2000,
          productUrl: "https://example.com/item",
          instagramPostTypes: [],
        },
      ]),
    ).toThrow(BadRequestException);
  });
});
