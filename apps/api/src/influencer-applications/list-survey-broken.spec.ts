import { InfluencerApplicationsService } from "./influencer-applications.service";

/**
 * I3 회귀 테스트: `builder_surveys.questions` 가 깨진 캠페인이 섞여 있어도
 * `listForInfluencer` 전체가 500 으로 번지지 않고, 나머지 행은 정상으로
 * 내려와야 한다 — 설문 하나가 무관한 응모 목록 전체를 끌고 내려가면 안 된다.
 */
function makeApplicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    campaignId: "camp-1",
    influencerId: "inf-1",
    status: "ORDER_SUBMITTED",
    appliedAt: new Date("2026-06-01T00:00:00Z"),
    reviewedAt: null,
    trackingCarrier: null,
    trackingNumber: null,
    shippedAt: null,
    deliveredAt: null,
    receivedAt: null,
    completedAt: null,
    subTypes: ["INSTAGRAM"],
    options: [],
    productOptions: [],
    submissionReviewStatus: "PENDING",
    submissionReviewedAt: null,
    submissionRejections: [],
    orderNumber: null,
    orderSubmittedAt: null,
    reviewSubmittedAt: null,
    posts: [],
    crossPosts: [],
    settlement: null,
    campaign: {
      id: "camp-1",
      category: "SNS",
      title: "캠페인",
      thumbnailUrl: null,
      rewardType: "UNIFIED",
      rewardJpy: 1000,
      postingPeriodDays: 14,
      orderPeriodDays: null,
      publishStartAt: null,
      publishEndAt: null,
      surveyId: null,
      recruits: [],
    },
    ...overrides,
  };
}

describe("listForInfluencer — 설문 questions 가 깨진 캠페인이 섞여 있을 때", () => {
  it("한 캠페인의 설문이 깨져도 나머지 행이 정상이다", async () => {
    const brokenRow = makeApplicationRow({
      id: "app-broken",
      campaignId: "camp-broken",
      campaign: {
        ...makeApplicationRow().campaign,
        id: "camp-broken",
        surveyId: "survey-broken",
      },
    });
    const normalRow = makeApplicationRow({
      id: "app-normal",
      campaignId: "camp-normal",
      campaign: {
        ...makeApplicationRow().campaign,
        id: "camp-normal",
        surveyId: null,
      },
    });

    const campaignApplicationFindMany = jest.fn(async () => [
      brokenRow,
      normalRow,
    ]);
    const builderSurveyFindMany = jest.fn(async () => [
      {
        id: "survey-broken",
        title: "깨진 설문",
        description: null,
        // 배열이 아닌 값 — SurveyQuestionSchema.array() 파싱이 실패해야 한다.
        questions: "이건 배열이 아니다",
      },
    ]);

    const builderSurveyResponseFindMany = jest.fn(async () => []);
    const prisma = {
      campaignApplication: { findMany: campaignApplicationFindMany },
      builderSurvey: { findMany: builderSurveyFindMany },
      builderSurveyResponse: { findMany: builderSurveyResponseFindMany },
    };
    const uploads = {
      resolveCampaignThumbnailUrl: jest.fn(async (raw: string | null) => raw),
    };
    const service = new InfluencerApplicationsService(
      prisma as never,
      uploads as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const applications = await service.listForInfluencer("inf-1");

    expect(applications).toHaveLength(2);
    const broken = applications.find((application) => application.id === "app-broken");
    const normal = applications.find((application) => application.id === "app-normal");
    expect(broken?.survey).toBeNull();
    expect(normal?.survey).toBeNull();
  });
});
