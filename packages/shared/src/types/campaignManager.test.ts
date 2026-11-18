import { describe, expect, it } from "vitest";
import {
  CampaignResponseSchema,
  BulkAssignCampaignManagersRequestSchema,
} from "./campaign.js";
import { AdminOverviewResponseSchema } from "./adminOverview.js";

/** CampaignResponseSchema 를 통과하는 최소 리터럴. toResponse 가 만드는 모양을 따른다. */
const VALID_CAMPAIGN_RESPONSE = {
  id: "campaign-1",
  category: "SNS",
  title: "캠페인 제목",
  tags: [],
  rewardType: "UNIFIED",
  rewardJpy: 1000,
  publishState: "PUBLISHED",
  status: "recruit",
  recruits: [],
  recruitStartDate: "2026-01-01",
  recruitEndDate: "2026-01-31",
  recruitStartAt: "2026-01-01T00:00:00.000Z",
  recruitEndAt: "2026-01-31T00:00:00.000Z",
  closedAt: null,
  hiddenAt: null,
  postingPeriodDays: 14,
  orderPeriodDays: null,
  productSummary: "상품 소개",
  productDetailUrls: ["https://example.com"],
  guideline: "가이드라인",
  referenceMediaUrls: [],
  cautions: "",
  thumbnailUrl: null,
  thumbnailObjectKey: null,
  approvedCount: 0,
  appliedCount: 0,
  viewerCount: 0,
  excludedCampaignIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("CampaignResponseSchema.managers", () => {
  it("managers 가 없는 구 API 응답도 빈 배열로 파싱한다", () => {
    const parsed = CampaignResponseSchema.parse(VALID_CAMPAIGN_RESPONSE);
    expect(parsed.managers).toEqual([]);
  });

  it("managers 를 그대로 보존한다", () => {
    const parsed = CampaignResponseSchema.parse({
      ...VALID_CAMPAIGN_RESPONSE,
      managers: [{ id: "admin-1", name: "선희", email: "sunhee@example.com" }],
    });
    expect(parsed.managers).toHaveLength(1);
  });
});

describe("AdminOverviewResponseSchema", () => {
  it("myRecruitingCampaignCount 가 없는 구 응답은 0 으로 채운다", () => {
    const parsed = AdminOverviewResponseSchema.parse({
      recruitingCampaignCount: 3,
      pendingApplicationCount: 0,
      pendingPostReviewCount: 0,
      pendingSettlementAmountJpy: 0,
      pendingSettlementCount: 0,
    });
    expect(parsed.myRecruitingCampaignCount).toBe(0);
  });
});

describe("BulkAssignCampaignManagersRequestSchema", () => {
  it("campaignIds 가 비면 거부한다", () => {
    const result = BulkAssignCampaignManagersRequestSchema.safeParse({
      campaignIds: [],
      managerIds: ["admin-1"],
    });
    expect(result.success).toBe(false);
  });

  it("managerIds 가 비면 허용한다 — 담당자 해제다", () => {
    const result = BulkAssignCampaignManagersRequestSchema.safeParse({
      campaignIds: ["c1"],
      managerIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("campaignIds 200건 초과를 거부한다", () => {
    const result = BulkAssignCampaignManagersRequestSchema.safeParse({
      campaignIds: Array.from({ length: 201 }, (_, index) => `c${index}`),
      managerIds: [],
    });
    expect(result.success).toBe(false);
  });
});
