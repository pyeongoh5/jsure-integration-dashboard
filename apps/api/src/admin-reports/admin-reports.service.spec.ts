import type { SurveyQuestion } from "@jsure/shared";
import { AdminReportsService } from "./admin-reports.service";

/** 집계 로직 검증이 목적이라 기간은 고정값을 쓴다(stub 은 기간을 보지 않는다). */
const PERIOD = { from: "2026-01-01", to: "2026-12-31" };

type StubApplication = {
  influencerId: string;
  status: string;
  subTypes: string[];
  submissionReviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  posts: {
    subType: string;
    insightLikes: number | null;
    url?: string | null;
    submittedAt?: Date;
  }[];
  settlement: { amountJpy: number } | null;
  options?: { subType: string; option: string }[];
  influencer: {
    id: string;
    name: string;
    snsAccounts: { snsType: string; handle: string; followerCount: number }[];
  };
};

const SUBMITTED_AT = new Date("2026-07-20T02:00:00Z");

function makeService(
  applications: StubApplication[],
  viewerCount = 0,
  managerIds: string[] = ["admin-1"],
) {
  const prisma = {
    campaign: {
      findMany: async () => [
        {
          id: "c1",
          title: "캠페인",
          tags: [],
          category: "SNS",
          recruitStartAt: new Date("2026-06-30T15:00:00Z"), // JST 2026-07-01 00:00
          recruitEndAt: new Date("2026-07-31T14:59:59Z"), // JST 2026-07-31 23:59
          applications,
          managerIds,
        },
      ],
      findFirst: async () => ({ id: "c1" }),
    },
    campaignView: {
      groupBy: async () =>
        viewerCount > 0
          ? [{ campaignId: "c1", _count: { _all: viewerCount } }]
          : [],
    },
    campaignApplication: {
      findMany: async () =>
        applications.map((application, index) => ({
          ...application,
          id: `app${index + 1}`,
          options: application.options ?? [],
          posts: application.posts.map((post) => ({
            url: null,
            submittedAt: SUBMITTED_AT,
            ...post,
          })),
        })),
    },
    adminUser: {
      findMany: async () => [
        { id: "admin-1", name: "선희", email: "sunhee@example.com" },
      ],
    },
  } as never;
  return new AdminReportsService(prisma);
}

function application(overrides: Partial<StubApplication>): StubApplication {
  return {
    influencerId: "i1",
    status: "APPROVED",
    subTypes: ["INSTAGRAM"],
    submissionReviewStatus: "PENDING",
    posts: [],
    settlement: null,
    influencer: {
      id: "i1",
      name: "인플루언서",
      snsAccounts: [
        { snsType: "INSTAGRAM", handle: "handle", followerCount: 100 },
      ],
    },
    ...overrides,
  };
}

describe("캠페인 리포트 집계", () => {
  it("참여자 수는 승인 이후 응모 수(명)이고 미제출도 포함한다", async () => {
    const service = makeService([
      application({ influencerId: "i1", status: "APPROVED" }),
      application({
        influencerId: "i2",
        status: "REVIEW_SUBMITTED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 10 }],
      }),
      // 승인 전/취소는 참여자가 아니다.
      application({ influencerId: "i3", status: "APPLIED" }),
      application({
        influencerId: "i4",
        status: "CANCELLED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 999 }],
      }),
    ]);

    const { rows } = await service.campaignReports("campaignTitle", "asc", PERIOD);

    expect(rows[0]!.participantCount).toBe(2);
  });

  it("콘텐츠 수는 제출 전체에서 취소 응모와 검수 반려를 뺀다", async () => {
    const service = makeService([
      application({
        influencerId: "i1",
        status: "REVIEW_SUBMITTED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 10 }],
      }),
      application({
        influencerId: "i2",
        status: "REVIEW_SUBMITTED",
        submissionReviewStatus: "REJECTED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 5 }],
      }),
      application({
        influencerId: "i3",
        status: "CANCELLED",
        posts: [{ subType: "INSTAGRAM", insightLikes: 7 }],
      }),
    ]);

    const { rows } = await service.campaignReports("campaignTitle", "asc", PERIOD);

    expect(rows[0]!.postCount).toBe(1);
    expect(rows[0]!.totalLikes).toBe(10);
  });
});

describe("참여자 목록", () => {
  it("미제출 참여자도 행으로 나오고 검수 상태는 비어 있다", async () => {
    const service = makeService([
      application({ influencerId: "i1", status: "APPROVED" }),
    ]);

    const { total, participants } = await service.campaignParticipants(
      "c1",
      0,
      20,
    );

    expect(total).toBe(1);
    expect(participants[0]!.status).toBe("APPROVED");
    expect(participants[0]!.submissionReviewStatus).toBeNull();
    expect(participants[0]!.insight.likes).toBeNull();
  });

  it("제출한 행은 상세 열람용 applicationId·URL·제출일을 내려준다", async () => {
    const service = makeService([
      application({
        influencerId: "i1",
        status: "REVIEW_SUBMITTED",
        posts: [
          {
            subType: "INSTAGRAM",
            insightLikes: 3,
            url: "https://instagram.com/p/abc",
          },
        ],
      }),
    ]);

    const { participants } = await service.campaignParticipants("c1", 0, 20);

    expect(participants[0]).toMatchObject({
      applicationId: "app1",
      postUrl: "https://instagram.com/p/abc",
      submittedAt: SUBMITTED_AT.toISOString(),
    });
  });

  it("제출 전 행은 URL·제출일이 null 이라 상세 진입 대상이 아니다", async () => {
    const service = makeService([
      application({ influencerId: "i1", status: "APPROVED" }),
    ]);

    const { participants } = await service.campaignParticipants("c1", 0, 20);

    expect(participants[0]!.postUrl).toBeNull();
    expect(participants[0]!.submittedAt).toBeNull();
  });

  it("참여 서브타입마다 행이 나온다", async () => {
    const service = makeService([
      application({
        influencerId: "i1",
        status: "REVIEW_SUBMITTED",
        subTypes: ["INSTAGRAM", "TIKTOK"],
        posts: [{ subType: "INSTAGRAM", insightLikes: 3 }],
      }),
    ]);

    const { total, participants } = await service.campaignParticipants(
      "c1",
      0,
      20,
    );

    expect(total).toBe(2);
    expect(participants.map((entry) => entry.subType)).toEqual([
      "INSTAGRAM",
      "TIKTOK",
    ]);
    // 제출한 서브타입만 검수 상태가 붙는다.
    expect(participants[0]!.submissionReviewStatus).toBe("PENDING");
    expect(participants[1]!.submissionReviewStatus).toBeNull();
  });

  it("campaignReports 는 조회 인원과 응모율(전체 응모 기준)을 내려준다", async () => {
    const service = makeService(
      [
        application({ influencerId: "i1", status: "APPROVED" }),
        application({ influencerId: "i2", status: "REJECTED" }),
      ],
      20,
    );
    const { rows } = await service.campaignReports("campaignTitle", "asc", PERIOD);
    expect(rows[0]!.viewerCount).toBe(20);
    // 탈락 응모도 분자에 포함 — 2 / 20 = 10%.
    expect(rows[0]!.applicationRate).toBe(10);
  });

  it("campaignReports 는 조회 인원이 0 이면 응모율을 null 로 내려준다", async () => {
    const service = makeService([application({ influencerId: "i1" })]);
    const { rows } = await service.campaignReports("campaignTitle", "asc", PERIOD);
    expect(rows[0]!.viewerCount).toBe(0);
    expect(rows[0]!.applicationRate).toBeNull();
  });

  it("campaignReports 는 카테고리와 JST 모집기간을 내려준다", async () => {
    const service = makeService([]);
    const { rows } = await service.campaignReports("campaignTitle", "asc", PERIOD);
    expect(rows[0]!.category).toBe("SNS");
    expect(rows[0]!.recruitStartDate).toBe("2026-07-01");
    expect(rows[0]!.recruitEndDate).toBe("2026-07-31");
  });

  it("리포트 행에 담당자를 담는다", async () => {
    const service = makeService([]);
    const { rows } = await service.campaignReports("campaignTitle", "asc", PERIOD);
    expect(rows[0]!.managers).toEqual([
      { id: "admin-1", name: "선희", email: "sunhee@example.com" },
    ]);
  });

  it("담당자가 없는 캠페인은 빈 배열이다", async () => {
    const service = makeService([], 0, []);
    const { rows } = await service.campaignReports("campaignTitle", "asc", PERIOD);
    expect(rows[0]!.managers).toEqual([]);
  });
});

/**
 * 참여자 목록에 붙는 설문 응답 스텁. `builderSurvey.findUnique`/`builderSurveyResponse.findMany`
 * 를 `makeService` 와 별도로 둔다 — 기존 테스트가 쓰는 `campaign.findFirst` 모양(select: id 만)을
 * 건드리지 않기 위해서다.
 */
function makeServiceWithSurvey(options: {
  applications: StubApplication[];
  surveyId: string | null;
  surveyQuestions?: SurveyQuestion[];
  surveyResponses?: { applicationId: string; answers: unknown }[];
}) {
  const campaignFindFirst = jest
    .fn()
    .mockResolvedValue({ id: "c1", surveyId: options.surveyId });
  const campaignApplicationFindMany = jest.fn().mockResolvedValue(
    options.applications.map((application, index) => ({
      ...application,
      id: `app${index + 1}`,
      options: application.options ?? [],
      posts: application.posts.map((post) => ({
        url: null,
        submittedAt: SUBMITTED_AT,
        ...post,
      })),
    })),
  );
  const builderSurveyFindUnique = jest.fn().mockResolvedValue(
    options.surveyId
      ? { id: options.surveyId, questions: options.surveyQuestions ?? [] }
      : null,
  );
  const builderSurveyResponseFindMany = jest
    .fn()
    .mockResolvedValue(options.surveyResponses ?? []);
  const prisma = {
    campaign: { findFirst: campaignFindFirst },
    campaignApplication: { findMany: campaignApplicationFindMany },
    builderSurvey: { findUnique: builderSurveyFindUnique },
    builderSurveyResponse: { findMany: builderSurveyResponseFindMany },
  } as never;
  const service = new AdminReportsService(prisma);
  return {
    service,
    builderSurveyFindUnique,
    builderSurveyResponseFindMany,
  };
}

describe("참여자 목록 — 설문 응답", () => {
  const textQuestion: SurveyQuestion = {
    id: "q1",
    type: "TEXT",
    title: "한마디",
    required: false,
    multiline: true,
  };

  it("설문 미연결 캠페인은 survey 가 null 이고 참가자 surveyAnswers 도 null", async () => {
    const { service } = makeServiceWithSurvey({
      applications: [application({ influencerId: "i1", status: "APPROVED" })],
      surveyId: null,
    });

    const { participants, survey } = await service.campaignParticipants("c1", 0, 20);

    expect(survey).toBeNull();
    expect(participants[0]!.surveyAnswers).toBeNull();
  });

  it("설문 연결 캠페인은 survey.questions 를 함께 내린다", async () => {
    const { service } = makeServiceWithSurvey({
      applications: [application({ influencerId: "i1", status: "APPROVED" })],
      surveyId: "survey-1",
      surveyQuestions: [textQuestion],
    });

    const { survey } = await service.campaignParticipants("c1", 0, 20);

    expect(survey).toEqual({ id: "survey-1", questions: [textQuestion] });
  });

  it("같은 응모의 서브타입 행들이 같은 surveyAnswers 를 갖는다", async () => {
    const { service } = makeServiceWithSurvey({
      applications: [
        application({
          influencerId: "i1",
          status: "APPROVED",
          subTypes: ["INSTAGRAM", "TIKTOK"],
        }),
      ],
      surveyId: "survey-1",
      surveyQuestions: [textQuestion],
      surveyResponses: [{ applicationId: "app1", answers: { q1: "좋아요" } }],
    });

    const { participants } = await service.campaignParticipants("c1", 0, 20);

    expect(participants).toHaveLength(2);
    expect(participants[0]!.surveyAnswers).toEqual({ q1: "좋아요" });
    expect(participants[1]!.surveyAnswers).toEqual({ q1: "좋아요" });
  });

  it("응답 조회는 applicationId 묶음으로 한 번에 한다", async () => {
    const { service, builderSurveyResponseFindMany } = makeServiceWithSurvey({
      applications: [
        application({ influencerId: "i1", status: "APPROVED" }),
        application({ influencerId: "i2", status: "APPROVED" }),
      ],
      surveyId: "survey-1",
      surveyQuestions: [textQuestion],
    });

    await service.campaignParticipants("c1", 0, 20);

    expect(builderSurveyResponseFindMany).toHaveBeenCalledTimes(1);
    expect(builderSurveyResponseFindMany).toHaveBeenCalledWith({
      where: { applicationId: { in: ["app1", "app2"] } },
      select: { applicationId: true, answers: true },
    });
  });

  it("설문이 연결되지 않으면 응답 조회 자체를 생략한다", async () => {
    const { service, builderSurveyResponseFindMany } = makeServiceWithSurvey({
      applications: [application({ influencerId: "i1", status: "APPROVED" })],
      surveyId: null,
    });

    await service.campaignParticipants("c1", 0, 20);

    expect(builderSurveyResponseFindMany).not.toHaveBeenCalled();
  });
});
