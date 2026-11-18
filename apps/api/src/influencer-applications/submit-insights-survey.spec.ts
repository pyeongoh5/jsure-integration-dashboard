import { InfluencerApplicationsService } from "./influencer-applications.service";

/** prisma 호출 인자 검증용 — 실제 Prisma 타입 대신 느슨한 모양을 쓴다. */
type PrismaCallArgs = Record<string, unknown>;

type UpsertArgs = {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

type BuilderSurveyRow = {
  id: string;
  title: string;
  description: string | null;
  questions: unknown;
};

const SURVEY_ID = "survey-1";
const APPLICATION_ID = "app-1";
const INFLUENCER_ID = "inf-1";

const SINGLE_REQUIRED_QUESTION = [
  {
    id: "q1",
    type: "TEXT",
    title: "개선할 점",
    required: true,
    multiline: false,
  },
];

function makeApplicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPLICATION_ID,
    campaignId: "camp-1",
    influencerId: INFLUENCER_ID,
    status: "REVIEW_SUBMITTED",
    appliedAt: new Date("2026-06-01T00:00:00Z"),
    trackingCarrier: null,
    trackingNumber: null,
    shippedAt: null,
    deliveredAt: null,
    receivedAt: new Date("2026-06-05T00:00:00Z"),
    completedAt: null,
    subTypes: ["INSTAGRAM"],
    options: [],
    productOptions: [],
    // ensureSettlementForApplication 을 조기 종료시키기 위한 값 — 이 스펙은
    // 설문 검증·저장만 본다. 정산 로직은 admin-reports 등 다른 스펙의 몫이다.
    submissionReviewStatus: "PENDING",
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
      title: "테스트 캠페인",
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

function makeBuilderSurveyRow(
  overrides: Partial<BuilderSurveyRow> = {},
): BuilderSurveyRow {
  return {
    id: SURVEY_ID,
    title: "사후 설문",
    description: null,
    questions: SINGLE_REQUIRED_QUESTION,
    ...overrides,
  };
}

function makeService(options: {
  applicationRow: ReturnType<typeof makeApplicationRow>;
  surveyRow?: BuilderSurveyRow | null;
}) {
  const submittedPostFindMany = jest.fn(async () =>
    options.applicationRow.subTypes.map((subType: string) => ({
      id: `post-${subType}`,
      subType,
    })),
  );
  const submittedPostUpdate = jest.fn(async (_args: PrismaCallArgs) => ({}));
  const builderSurveyFindUnique = jest.fn(
    async (_args: PrismaCallArgs) => options.surveyRow ?? null,
  );
  const builderSurveyResponseUpsert = jest.fn(
    async (_args: UpsertArgs) => ({}),
  );
  const campaignApplicationFindUnique = jest.fn(
    async (_args: PrismaCallArgs) => options.applicationRow,
  );
  const campaignApplicationFindUniqueOrThrow = jest.fn(
    async (_args: PrismaCallArgs) => ({}),
  );

  const prisma = {
    campaignApplication: {
      findUnique: campaignApplicationFindUnique,
      findUniqueOrThrow: campaignApplicationFindUniqueOrThrow,
    },
    submittedPost: {
      findMany: submittedPostFindMany,
      update: submittedPostUpdate,
    },
    builderSurvey: {
      findUnique: builderSurveyFindUnique,
    },
    builderSurveyResponse: {
      upsert: builderSurveyResponseUpsert,
    },
  };
  const uploads = {
    resolveCampaignThumbnailUrl: jest.fn(async (raw: string | null) => raw),
  };
  const dispatcher = { dispatch: jest.fn() };
  const audit = { record: jest.fn() };
  const line = {};

  const service = new InfluencerApplicationsService(
    prisma as never,
    uploads as never,
    line as never,
    dispatcher as never,
    audit as never,
  );

  return {
    service,
    submittedPostUpdate,
    builderSurveyFindUnique,
    builderSurveyResponseUpsert,
    campaignApplicationFindUnique,
  };
}

const ONE_INSIGHT = [
  {
    subType: "INSTAGRAM" as const,
    likes: 10,
    comments: 1,
    shares: 0,
    reposts: 0,
    saves: 0,
    views: 100,
    reach: 50,
  },
];

describe("submitInsights — 앙케이트", () => {
  it("설문 미연결 캠페인은 surveyAnswers 없이도 성공한다", async () => {
    const { service, builderSurveyResponseUpsert, submittedPostUpdate } =
      makeService({ applicationRow: makeApplicationRow() });

    await service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT);

    expect(builderSurveyResponseUpsert).not.toHaveBeenCalled();
    expect(submittedPostUpdate).toHaveBeenCalledTimes(1);
  });

  it("설문 미연결인데 surveyAnswers 가 와도 조용히 무시한다", async () => {
    const { service, builderSurveyResponseUpsert } = makeService({
      applicationRow: makeApplicationRow(),
    });

    await expect(
      service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT, {
        q1: "무시돼야 함",
      }),
    ).resolves.toBeDefined();

    expect(builderSurveyResponseUpsert).not.toHaveBeenCalled();
  });

  it("설문 연결됐는데 surveyAnswers 가 없으면 SURVEY_ANSWERS_REQUIRED", async () => {
    const { service } = makeService({
      applicationRow: makeApplicationRow({
        campaign: { ...makeApplicationRow().campaign, surveyId: SURVEY_ID },
      }),
      surveyRow: makeBuilderSurveyRow(),
    });

    await expect(
      service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT),
    ).rejects.toMatchObject({ response: { code: "SURVEY_ANSWERS_REQUIRED" } });
  });

  it("필수 문항이 비면 SURVEY_ANSWERS_INVALID 이고 지표도 저장하지 않는다", async () => {
    const { service, submittedPostUpdate } = makeService({
      applicationRow: makeApplicationRow({
        campaign: { ...makeApplicationRow().campaign, surveyId: SURVEY_ID },
      }),
      surveyRow: makeBuilderSurveyRow(),
    });

    await expect(
      service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT, {
        q1: "",
      }),
    ).rejects.toMatchObject({ response: { code: "SURVEY_ANSWERS_INVALID" } });
    expect(submittedPostUpdate).not.toHaveBeenCalled();
  });

  it("정상 응답이면 지표와 함께 응답을 저장한다", async () => {
    const { service, builderSurveyResponseUpsert } = makeService({
      applicationRow: makeApplicationRow({
        campaign: { ...makeApplicationRow().campaign, surveyId: SURVEY_ID },
      }),
      surveyRow: makeBuilderSurveyRow(),
    });

    await service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT, {
      q1: "매우 만족",
    });

    expect(builderSurveyResponseUpsert).toHaveBeenCalledTimes(1);
    expect(builderSurveyResponseUpsert.mock.calls[0]?.[0]?.where).toEqual({
      applicationId: APPLICATION_ID,
    });
  });

  it("questionsSnapshot 은 저장 시점 설문의 questions 다", async () => {
    const changedQuestions = [
      {
        id: "q1",
        type: "TEXT",
        title: "바뀐 뒤의 문항",
        required: true,
        multiline: true,
      },
    ];
    const { service, builderSurveyResponseUpsert } = makeService({
      applicationRow: makeApplicationRow({
        campaign: { ...makeApplicationRow().campaign, surveyId: SURVEY_ID },
      }),
      surveyRow: makeBuilderSurveyRow({ questions: changedQuestions }),
    });

    await service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT, {
      q1: "답변",
    });

    const upsertArgs = builderSurveyResponseUpsert.mock.calls[0]?.[0];
    expect(upsertArgs?.create?.questionsSnapshot).toEqual(changedQuestions);
    expect(upsertArgs?.update?.questionsSnapshot).toEqual(changedQuestions);
  });

  it("재제출이면 upsert 로 갱신한다 — create 로 중복 삽입하지 않는다", async () => {
    const { service, builderSurveyResponseUpsert } = makeService({
      applicationRow: makeApplicationRow({
        campaign: { ...makeApplicationRow().campaign, surveyId: SURVEY_ID },
      }),
      surveyRow: makeBuilderSurveyRow(),
    });

    await service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT, {
      q1: "재제출 답변",
    });

    const upsertArgs = builderSurveyResponseUpsert.mock.calls[0]?.[0];
    expect(upsertArgs?.where).toEqual({ applicationId: APPLICATION_ID });
    expect(upsertArgs?.create).toMatchObject({
      applicationId: APPLICATION_ID,
      surveyId: SURVEY_ID,
      answers: { q1: "재제출 답변" },
    });
    expect(upsertArgs?.update).toMatchObject({
      surveyId: SURVEY_ID,
      answers: { q1: "재제출 답변" },
    });
    expect(upsertArgs?.update?.questionsSnapshot).toBeDefined();
  });

  it("설문 조회는 relation include 가 아니라 builderSurvey.findUnique 로 한다", async () => {
    const { service, builderSurveyFindUnique, campaignApplicationFindUnique } =
      makeService({
        applicationRow: makeApplicationRow({
          campaign: { ...makeApplicationRow().campaign, surveyId: SURVEY_ID },
        }),
        surveyRow: makeBuilderSurveyRow(),
      });

    await service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT, {
      q1: "답변",
    });

    expect(builderSurveyFindUnique).toHaveBeenCalledWith({
      where: { id: SURVEY_ID },
      select: { title: true, description: true, questions: true },
    });
    // campaign.select 에 survey relation 을 요청한 적이 없어야 한다(FK 가 없어
    // 애초에 불가능하다) — surveyId(scalar)는 허용하므로 콜론까지 포함해 구분한다.
    for (const call of campaignApplicationFindUnique.mock.calls) {
      expect(JSON.stringify(call[0] ?? {})).not.toContain('"survey":');
    }
  });

  it("surveyId 가 가리키는 설문이 없으면 설문 없는 것처럼 지표만 저장한다", async () => {
    const { service, builderSurveyResponseUpsert, submittedPostUpdate } =
      makeService({
        applicationRow: makeApplicationRow({
          campaign: { ...makeApplicationRow().campaign, surveyId: SURVEY_ID },
        }),
        surveyRow: null,
      });

    await service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT);

    expect(builderSurveyResponseUpsert).not.toHaveBeenCalled();
    expect(submittedPostUpdate).toHaveBeenCalledTimes(1);
  });

  it("surveyId 가 가리키는 설문이 없으면 surveyAnswers 없이도 성공한다", async () => {
    const { service } = makeService({
      applicationRow: makeApplicationRow({
        campaign: { ...makeApplicationRow().campaign, surveyId: SURVEY_ID },
      }),
      surveyRow: null,
    });

    // campaigns 서비스는 surveyId 유효성을 검증하지 않아(별도 범위) 오염된
    // 참조가 실제로 생길 수 있다 — SURVEY_ANSWERS_REQUIRED 로 막히면 안 된다.
    await expect(
      service.submitInsights(INFLUENCER_ID, APPLICATION_ID, ONE_INSIGHT),
    ).resolves.toBeDefined();
  });
});

describe("listForInfluencer — 앙케이트 일괄 조회", () => {
  it("응모 목록은 설문을 id 묶음으로 한 번에 조회한다", async () => {
    const rows = [
      makeApplicationRow({
        id: "app-1",
        campaign: { ...makeApplicationRow().campaign, surveyId: "survey-1" },
      }),
      makeApplicationRow({
        id: "app-2",
        campaign: { ...makeApplicationRow().campaign, surveyId: "survey-2" },
      }),
    ];
    const builderSurveyFindMany = jest.fn(async (_args: PrismaCallArgs) => [
      makeBuilderSurveyRow({ id: "survey-1" }),
      makeBuilderSurveyRow({ id: "survey-2" }),
    ]);
    const builderSurveyFindUnique = jest.fn(async (_args: PrismaCallArgs) => null);
    const prisma = {
      campaignApplication: {
        findMany: jest.fn(async (_args: PrismaCallArgs) => rows),
      },
      builderSurvey: {
        findMany: builderSurveyFindMany,
        findUnique: builderSurveyFindUnique,
      },
    };
    const uploads = {
      resolveCampaignThumbnailUrl: jest.fn(async (raw: string | null) => raw),
    };
    const service = new InfluencerApplicationsService(
      prisma as never,
      uploads as never,
      {} as never,
      { dispatch: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    await service.listForInfluencer(INFLUENCER_ID);

    expect(builderSurveyFindMany).toHaveBeenCalledTimes(1);
    expect(builderSurveyFindUnique).not.toHaveBeenCalled();
    expect(builderSurveyFindMany.mock.calls[0]?.[0]?.where).toEqual({
      id: { in: ["survey-1", "survey-2"] },
    });
  });
});
