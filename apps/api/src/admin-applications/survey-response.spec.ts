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
function makeApplicationRow() {
  return {
    id: "application-1",
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
});
