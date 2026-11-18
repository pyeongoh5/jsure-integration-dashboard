import { InfluencerApplicationsService } from "./influencer-applications.service";

/**
 * I4 회귀 테스트: 인사이트 재제출 시 기존 설문 답이 프리필되도록, 응모 조회
 * 응답에 이미 제출한 답(surveyAnswers)이 실려 내려와야 한다.
 */
function makeApplicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    campaignId: "camp-1",
    influencerId: "inf-1",
    status: "INSIGHT_DUE",
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
      surveyId: "survey-1",
      recruits: [],
    },
    ...overrides,
  };
}

describe("getForInfluencer — 설문 답 프리필", () => {
  it("기존 응답이 있으면 응모 조회에 그 답이 실려 내려온다", async () => {
    const row = makeApplicationRow();
    const campaignApplicationFindUnique = jest.fn(async () => row);
    const builderSurveyFindUnique = jest.fn(async () => ({
      id: "survey-1",
      title: "사후 설문",
      description: null,
      questions: [
        {
          id: "q1",
          type: "TEXT",
          title: "개선할 점",
          required: true,
          multiline: false,
        },
      ],
    }));
    const builderSurveyResponseFindUnique = jest.fn(async () => ({
      answers: { q1: "기존에 낸 답" },
    }));

    const prisma = {
      campaignApplication: { findUnique: campaignApplicationFindUnique },
      builderSurvey: { findUnique: builderSurveyFindUnique },
      builderSurveyResponse: { findUnique: builderSurveyResponseFindUnique },
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

    const application = await service.getForInfluencer("inf-1", "app-1");

    expect(application.surveyAnswers).toEqual({ q1: "기존에 낸 답" });
    expect(builderSurveyResponseFindUnique).toHaveBeenCalledWith({
      where: { applicationId: "app-1" },
      select: { answers: true },
    });
  });

  it("아직 답한 적이 없으면 surveyAnswers 는 null 이다", async () => {
    const row = makeApplicationRow();
    const campaignApplicationFindUnique = jest.fn(async () => row);
    const builderSurveyFindUnique = jest.fn(async () => ({
      id: "survey-1",
      title: "사후 설문",
      description: null,
      questions: [
        {
          id: "q1",
          type: "TEXT",
          title: "개선할 점",
          required: true,
          multiline: false,
        },
      ],
    }));
    const builderSurveyResponseFindUnique = jest.fn(async () => null);

    const prisma = {
      campaignApplication: { findUnique: campaignApplicationFindUnique },
      builderSurvey: { findUnique: builderSurveyFindUnique },
      builderSurveyResponse: { findUnique: builderSurveyResponseFindUnique },
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

    const application = await service.getForInfluencer("inf-1", "app-1");

    expect(application.surveyAnswers).toBeNull();
  });
});
