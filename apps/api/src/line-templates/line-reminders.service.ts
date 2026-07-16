import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { LineDispatcherService } from "./line-dispatcher.service";
import { DISPATCH_APPLICATION_INCLUDE } from "./trigger-meta";

const DAY_MS = 24 * 60 * 60 * 1000;
const POSTING_REMINDER_DAYS = [3, 1];
const INSIGHT_REMINDER_DAY_AFTER_POST = 7;
const INSIGHT_OVERDUE_REMINDER_DAY_AFTER_POST = 8;
const POST_REJECTION_RESUBMIT_DAYS = 1;
const JST_TZ = "Asia/Tokyo";

/** JST 기준 그 날의 00:00 UTC 타임스탬프 (밀리초). */
function startOfJstDay(d: Date): number {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const shifted = d.getTime() + jstOffsetMs;
  const dayStartUtcShifted = shifted - (shifted % DAY_MS);
  return dayStartUtcShifted - jstOffsetMs;
}

@Injectable()
export class LineRemindersService {
  private readonly logger = new Logger(LineRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: LineDispatcherService,
  ) {}

  /** 매일 JST 09:00에 1회. 그날 시간이 도래한 대상에게 리마인더 발송. */
  @Cron("0 9 * * *", { timeZone: JST_TZ })
  async runDaily(): Promise<void> {
    try {
      await this.runSnsPostingReminders();
      await this.runSnsInsightReminders();
      await this.runSnsInsightOverdueReminders();
      await this.runSnsPostRejectionReminders();
      await this.runFakePurchaseReviewReminders();
      await this.runSimpleReviewDeadlineReminders();
      await this.runSimpleReviewRejectionReminders();
    } catch (err) {
      this.logger.error("Reminder daily run failed", err as Error);
    }
  }

  /** 수동 트리거용 — 디버깅/관리자 호출에서 같은 로직 재사용. */
  async runNow(): Promise<void> {
    return this.runDaily();
  }

  private async runSnsPostingReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());

    const apps = await this.prisma.campaignApplication.findMany({
      where: {
        receivedAt: { not: null },
        status: { in: ["SHIPPED", "DELIVERED"] },
        campaign: { category: "SNS" },
      },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        posts: { select: { id: true } },
      },
    });

    for (const app of apps) {
      if (!app.receivedAt) continue;
      // 이미 투고가 들어왔으면 투고기간 리마인더는 더 이상 보내지 않음.
      if (app.posts.length > 0) continue;

      const deadlineMs = app.receivedAt.getTime() + app.campaign.postingPeriodDays * DAY_MS;
      const deadlineDayStart = startOfJstDay(new Date(deadlineMs));
      const remainingDays = Math.round((deadlineDayStart - todayStart) / DAY_MS);
      if (!POSTING_REMINDER_DAYS.includes(remainingDays)) continue;

      await this.dispatcher.dispatch("SNS_POST_DEADLINE_REMINDER", {
        application: app,
        extra: { remainingDays },
      });
    }
  }

  private async runSnsPostRejectionReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());
    const yesterdayStart = todayStart - DAY_MS;

    // submissionReviewedAt 은 반려 시점에 가장 최근 반려와 동일하게 갱신되므로
    // "현재 활성 반려"의 시각을 그대로 나타낸다. 과거 반려 row 는 무관.
    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        submissionReviewStatus: "REJECTED",
        submissionReviewedAt: { not: null },
        campaign: { category: "SNS" },
      },
      include: DISPATCH_APPLICATION_INCLUDE,
    });

    for (const application of applications) {
      if (!application.submissionReviewedAt) continue;
      if (startOfJstDay(application.submissionReviewedAt) !== yesterdayStart) continue;

      const latest = await this.prisma.submissionRejection.findFirst({
        where: { applicationId: application.id },
        orderBy: { rejectedAt: "desc" },
      });
      if (!latest) continue;

      const finalDeadlineAt = new Date(
        application.submissionReviewedAt.getTime() +
          POST_REJECTION_RESUBMIT_DAYS * DAY_MS,
      );
      await this.dispatcher.dispatch("SNS_POST_REJECTION_REMINDER", {
        application,
        rejection: latest,
        extra: { finalDeadlineAt },
      });
    }
  }

  /**
   * SNS: 인사이트 미제출 응모 대상. 제출일(reviewSubmittedAt)의 JST 기준 일자가
   * 정확히 N일 전인 응모만 대상 (그 이후엔 매일 보내지 않도록 == 검사).
   */
  private async collectSnsInsightPendingApplications(elapsedTarget: number) {
    const todayStart = startOfJstDay(new Date());

    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        status: "REVIEW_SUBMITTED",
        reviewSubmittedAt: { not: null },
        submissionReviewStatus: { in: ["PENDING", "APPROVED"] },
        posts: { some: { insightSubmittedAt: null } },
        campaign: { category: "SNS" },
      },
      include: DISPATCH_APPLICATION_INCLUDE,
    });

    return applications.filter((application) => {
      if (!application.reviewSubmittedAt) return false;
      const submittedDayStart = startOfJstDay(application.reviewSubmittedAt);
      const elapsedDays = Math.round((todayStart - submittedDayStart) / DAY_MS);
      return elapsedDays === elapsedTarget;
    });
  }

  private async runSnsInsightReminders(): Promise<void> {
    const applications = await this.collectSnsInsightPendingApplications(
      INSIGHT_REMINDER_DAY_AFTER_POST,
    );
    for (const application of applications) {
      await this.dispatcher.dispatch("SNS_INSIGHT_REMINDER", { application });
    }
  }

  /** SNS: 인사이트 제출 마감 다음날(day+1) 미제출 응모에 독촉 리마인더. */
  private async runSnsInsightOverdueReminders(): Promise<void> {
    const applications = await this.collectSnsInsightPendingApplications(
      INSIGHT_OVERDUE_REMINDER_DAY_AFTER_POST,
    );
    for (const application of applications) {
      await this.dispatcher.dispatch("SNS_INSIGHT_OVERDUE_REMINDER", {
        application,
      });
    }
  }

  private async runFakePurchaseReviewReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());
    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        status: "ORDER_SUBMITTED",
        orderSubmittedAt: { not: null },
        campaign: { category: "FAKE_PURCHASE" },
      },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        posts: { select: { id: true } },
      },
    });

    for (const application of applications) {
      if (!application.orderSubmittedAt) continue;
      if (application.posts.length > 0) continue;

      const deadlineMs =
        application.orderSubmittedAt.getTime() +
        application.campaign.postingPeriodDays * DAY_MS;
      const deadlineDayStart = startOfJstDay(new Date(deadlineMs));
      const remainingDays = Math.round((deadlineDayStart - todayStart) / DAY_MS);
      if (!POSTING_REMINDER_DAYS.includes(remainingDays)) continue;

      await this.dispatcher.dispatch("FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER", {
        application,
        extra: { remainingDays },
      });
    }
  }

  /**
   * 단순 리뷰: 승인 후 postingPeriodDays 임박 시 리뷰 제출 리마인더.
   * status=APPROVED 이면서 아직 SubmittedPost 가 없는 응모가 대상.
   */
  private async runSimpleReviewDeadlineReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());
    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        status: "APPROVED",
        reviewedAt: { not: null },
        campaign: { category: "SIMPLE_REVIEW" },
      },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        posts: { select: { id: true } },
      },
    });

    for (const application of applications) {
      if (!application.reviewedAt) continue;
      if (application.posts.length > 0) continue;

      const deadlineMs =
        application.reviewedAt.getTime() +
        application.campaign.postingPeriodDays * DAY_MS;
      const deadlineDayStart = startOfJstDay(new Date(deadlineMs));
      const remainingDays = Math.round((deadlineDayStart - todayStart) / DAY_MS);
      if (!POSTING_REMINDER_DAYS.includes(remainingDays)) continue;

      await this.dispatcher.dispatch("SIMPLE_REVIEW_DEADLINE_REMINDER", {
        application,
        extra: { remainingDays },
      });
    }
  }

  /**
   * 단순 리뷰: 리뷰 반려 후 재제출 지연 리마인더.
   * submissionReviewStatus=REJECTED 인 SIMPLE_REVIEW 카테고리 응모가 대상.
   * SNS 반려 리마인더와 동일하게 반려 후 1일 경과 시점(어제 반려된 건) 발송.
   */
  private async runSimpleReviewRejectionReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());
    const yesterdayStart = todayStart - POST_REJECTION_RESUBMIT_DAYS * DAY_MS;

    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        submissionReviewStatus: "REJECTED",
        submissionReviewedAt: { not: null },
        campaign: { category: "SIMPLE_REVIEW" },
      },
      include: DISPATCH_APPLICATION_INCLUDE,
    });

    for (const application of applications) {
      if (!application.submissionReviewedAt) continue;
      if (startOfJstDay(application.submissionReviewedAt) !== yesterdayStart) continue;

      const latest = await this.prisma.submissionRejection.findFirst({
        where: { applicationId: application.id },
        orderBy: { rejectedAt: "desc" },
      });
      if (!latest) continue;

      const finalDeadlineAt = new Date(
        application.submissionReviewedAt.getTime() +
          POST_REJECTION_RESUBMIT_DAYS * DAY_MS,
      );
      await this.dispatcher.dispatch("SIMPLE_REVIEW_REJECTION_REMINDER", {
        application,
        rejection: latest,
        extra: { finalDeadlineAt },
      });
    }
  }
}
