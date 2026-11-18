import { EMPTY_SUBMISSION_FILTER } from "@jsure/shared";
import { AdminApplicationsService } from "./admin-applications.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { LineDispatcherService } from "../line-templates/line-dispatcher.service";
import type { LineMessagingService } from "../influencer-auth/line-messaging.service";
import type { R2Service } from "../r2/r2.service";
import type { UploadsService } from "../uploads/uploads.service";

/**
 * SUBMISSION_INCLUDE 가 요구하는 최소 모양. thumbnailUrl 은 null 로 둬서
 * resolveThumbnail 이 r2 를 건드리지 않게 한다(이 테스트의 관심사가 아니다).
 */
function makeApplicationRow(id = "application-1") {
  return {
    id,
    status: "APPROVED",
    subTypes: ["INSTAGRAM"],
    options: [],
    orderNumber: null,
    actualPaymentJpy: null,
    reviewSubmittedAt: new Date("2026-11-01T00:00:00.000Z"),
    submissionReviewStatus: "PENDING",
    submissionReviewedAt: null,
    posts: [],
    crossPosts: [],
    settlement: null,
    submissionRejections: [],
    campaign: {
      id: "campaign-1",
      title: "캠페인",
      category: "SNS",
      thumbnailUrl: null,
      rewardJpy: 0,
    },
    influencer: {
      id: "influencer-1",
      name: "인플루언서",
      flaggedAt: null,
      tagAssignments: [],
      snsAccounts: [],
    },
  };
}

function makeService(
  applicationRow: ReturnType<typeof makeApplicationRow> | null,
  surveyResponseRow: unknown,
) {
  const builderSurveyResponseFindUnique = jest
    .fn()
    .mockResolvedValue(surveyResponseRow);
  const prisma = {
    campaignApplication: {
      findUnique: jest.fn().mockResolvedValue(applicationRow),
    },
    builderSurveyResponse: {
      findUnique: builderSurveyResponseFindUnique,
    },
  };
  const service = new AdminApplicationsService(
    prisma as unknown as PrismaService,
    {} as LineMessagingService,
    {} as LineDispatcherService,
    {} as R2Service,
    {} as AuditService,
    {} as UploadsService,
  );
  return { service, prisma, builderSurveyResponseFindUnique };
}

describe("getSubmission 의 설문 응답", () => {
  it("응답이 없으면 surveyResponse 가 null", async () => {
    const { service } = makeService(makeApplicationRow(), null);

    const submission = await service.getSubmission("application-1");

    expect(submission.surveyResponse).toBeNull();
  });

  it("응답이 있으면 스냅샷·답·제출시각을 내린다", async () => {
    const questionsSnapshot = [
      {
        id: "q1",
        title: "만족하시나요?",
        required: true,
        type: "LIKERT",
        scale: { preset: "AGREEMENT" },
      },
    ];
    const answers = { q1: 4 };
    const submittedAt = new Date("2026-11-10T03:00:00.000Z");
    const { service } = makeService(makeApplicationRow(), {
      questionsSnapshot,
      answers,
      submittedAt,
    });

    const submission = await service.getSubmission("application-1");

    expect(submission.surveyResponse).toEqual({
      questionsSnapshot,
      answers,
      submittedAt: submittedAt.toISOString(),
    });
  });

  it("응답 조회는 applicationId 로 한 번만 한다", async () => {
    const { service, builderSurveyResponseFindUnique } = makeService(
      makeApplicationRow(),
      null,
    );

    await service.getSubmission("application-1");

    expect(builderSurveyResponseFindUnique).toHaveBeenCalledTimes(1);
    expect(builderSurveyResponseFindUnique).toHaveBeenCalledWith({
      where: { applicationId: "application-1" },
      select: { questionsSnapshot: true, answers: true, submittedAt: true },
    });
  });

  it("questionsSnapshot 이 깨져 있으면 500 대신 surveyResponse 가 null", async () => {
    // schemaVersion 이 있는 이유대로 옛 스냅샷이 새 zod 스키마와 어긋날 수 있다 —
    // questions 는 최소 1개를 요구하는데 빈 배열로 저장돼 있던 경우를 흉내낸다.
    const { service } = makeService(makeApplicationRow(), {
      questionsSnapshot: [],
      answers: { q1: 4 },
      submittedAt: new Date("2026-11-10T03:00:00.000Z"),
    });

    const submission = await service.getSubmission("application-1");

    expect(submission.surveyResponse).toBeNull();
  });
});

/** listSubmissionsPage 의 $queryRaw 두 번 + campaignApplication/builderSurveyResponse 조회 스텁. */
function makeListService(options: {
  idRows: { id: string }[];
  applicationRows: ReturnType<typeof makeApplicationRow>[];
  surveyResponseRows: unknown[];
}) {
  const queryRaw = jest
    .fn()
    .mockResolvedValueOnce(options.idRows)
    .mockResolvedValueOnce([{ count: BigInt(options.idRows.length) }]);
  const campaignApplicationFindMany = jest
    .fn()
    .mockResolvedValue(options.applicationRows);
  const builderSurveyResponseFindMany = jest
    .fn()
    .mockResolvedValue(options.surveyResponseRows);
  const prisma = {
    $queryRaw: queryRaw,
    campaignApplication: { findMany: campaignApplicationFindMany },
    builderSurveyResponse: { findMany: builderSurveyResponseFindMany },
  };
  const service = new AdminApplicationsService(
    prisma as unknown as PrismaService,
    {} as LineMessagingService,
    {} as LineDispatcherService,
    {} as R2Service,
    {} as AuditService,
    {} as UploadsService,
  );
  return { service, builderSurveyResponseFindMany };
}

describe("listSubmissionsPage 의 설문 응답", () => {
  it("응답은 페이지의 applicationId 묶음으로 한 번에 조회한다", async () => {
    const { service, builderSurveyResponseFindMany } = makeListService({
      idRows: [{ id: "application-1" }, { id: "application-2" }],
      applicationRows: [
        makeApplicationRow("application-1"),
        makeApplicationRow("application-2"),
      ],
      surveyResponseRows: [],
    });

    await service.listSubmissionsPage(EMPTY_SUBMISSION_FILTER, null, 2);

    expect(builderSurveyResponseFindMany).toHaveBeenCalledTimes(1);
    expect(builderSurveyResponseFindMany).toHaveBeenCalledWith({
      where: { applicationId: { in: ["application-1", "application-2"] } },
      select: { applicationId: true, questionsSnapshot: true, answers: true, submittedAt: true },
    });
  });

  it("응답 있는 행과 없는 행이 섞여도 각자 제대로 붙는다", async () => {
    const questionsSnapshot = [
      { id: "q1", title: "만족하시나요?", required: true, type: "LIKERT", scale: { preset: "AGREEMENT" } },
    ];
    const answers = { q1: 5 };
    const submittedAt = new Date("2026-11-10T03:00:00.000Z");
    const { service } = makeListService({
      idRows: [{ id: "application-1" }, { id: "application-2" }],
      applicationRows: [
        makeApplicationRow("application-1"),
        makeApplicationRow("application-2"),
      ],
      surveyResponseRows: [
        { applicationId: "application-1", questionsSnapshot, answers, submittedAt },
      ],
    });

    const page = await service.listSubmissionsPage(EMPTY_SUBMISSION_FILTER, null, 2);

    const first = page.submissions.find((submission) => submission.id === "application-1");
    const second = page.submissions.find((submission) => submission.id === "application-2");
    expect(first?.surveyResponse).toEqual({
      questionsSnapshot,
      answers,
      submittedAt: submittedAt.toISOString(),
    });
    expect(second?.surveyResponse).toBeNull();
  });

  it("한 행의 응답이 깨져 있어도 페이지 전체가 500 이 되지 않는다", async () => {
    const { service } = makeListService({
      idRows: [{ id: "application-1" }, { id: "application-2" }],
      applicationRows: [
        makeApplicationRow("application-1"),
        makeApplicationRow("application-2"),
      ],
      surveyResponseRows: [
        {
          applicationId: "application-1",
          questionsSnapshot: [],
          answers: { q1: 4 },
          submittedAt: new Date("2026-11-10T03:00:00.000Z"),
        },
      ],
    });

    const page = await service.listSubmissionsPage(EMPTY_SUBMISSION_FILTER, null, 2);

    const first = page.submissions.find((submission) => submission.id === "application-1");
    expect(first?.surveyResponse).toBeNull();
  });
});
