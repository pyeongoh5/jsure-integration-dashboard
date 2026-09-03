import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  resolvePostingDeadline,
  type CampaignCategory,
  type LineTriggerKey,
} from "@jsure/shared";
import type { ApplicationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { linePushAllowed } from "../common/line-push-allowed";
import { insightMissingForSettlement } from "../settlements/ensure-settlement";
import { POST_REJECTION_RESUBMIT_DAYS } from "../common/resubmit-deadline";
import { LineDispatcherService } from "./line-dispatcher.service";
import { DISPATCH_APPLICATION_INCLUDE } from "./trigger-meta";

const DAY_MS = 24 * 60 * 60 * 1000;
const POSTING_REMINDER_DAYS = [3, 1];
/** 마감 다음날. 미제출자 독촉을 1회만 보내기 위해 동등 비교로 쓴다. */
const OVERDUE_REMINDER_DAY = -1;
const INSIGHT_REMINDER_DAY_AFTER_POST = 7;
const INSIGHT_OVERDUE_REMINDER_DAY_AFTER_POST = 8;
const JST_TZ = "Asia/Tokyo";

/**
 * 리마인더 대상 캠페인 조건 — 삭제된 캠페인의 응모에는 발송하지 않는다.
 * (campaigns 모듈의 PUBLISHED_CAMPAIGN_WHERE 는 campaign 테이블 직접 조회용이고,
 * 여기는 응모에서 출발해 campaign 을 중첩 필터로 거는 경로다.)
 */
function activeCampaign(category: CampaignCategory) {
  return { category, deletedAt: null } as const;
}

/** JST 기준 그 날의 00:00 UTC 타임스탬프 (밀리초). */
function startOfJstDay(d: Date): number {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const shifted = d.getTime() + jstOffsetMs;
  const dayStartUtcShifted = shifted - (shifted % DAY_MS);
  return dayStartUtcShifted - jstOffsetMs;
}

/**
 * 제출 마감 리마인더 설정. SNS 게시·가구매 리뷰·단순리뷰가 마감 계산과 발송 조건을
 * 공유하고, 기준 시각 필드·응모 상태·트리거 키만 다르다.
 */
type DeadlineReminderConfig = {
  category: CampaignCategory;
  /** 마감 계산 기준 시각 필드. SNS·단순리뷰는 수령 확인, 가구매는 주문 제출. */
  anchor: "receivedAt" | "orderSubmittedAt";
  statuses: ApplicationStatus[];
  deadlineTriggerKey: LineTriggerKey;
  overdueTriggerKey: LineTriggerKey;
};

export const DEADLINE_REMINDER_CONFIGS: DeadlineReminderConfig[] = [
  {
    category: "SNS",
    anchor: "receivedAt",
    statuses: ["SHIPPED", "DELIVERED"],
    deadlineTriggerKey: "SNS_POST_DEADLINE_REMINDER",
    overdueTriggerKey: "SNS_POST_OVERDUE_REMINDER",
  },
  {
    category: "FAKE_PURCHASE",
    anchor: "orderSubmittedAt",
    statuses: ["ORDER_SUBMITTED"],
    deadlineTriggerKey: "FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER",
    overdueTriggerKey: "FAKE_PURCHASE_REVIEW_OVERDUE_REMINDER",
  },
  {
    category: "SIMPLE_REVIEW",
    anchor: "receivedAt",
    statuses: ["SHIPPED", "DELIVERED"],
    deadlineTriggerKey: "SIMPLE_REVIEW_DEADLINE_REMINDER",
    overdueTriggerKey: "SIMPLE_REVIEW_OVERDUE_REMINDER",
  },
];

/** 가구매 주문 마감 리마인더 발송 시점 — 마감 3일 전, 마감 당일. */
const ORDER_REMINDER_DAYS = [3, 0];
/** 가구매 주문 마감 다음날. 이날 아직 주문하지 않은 응모를 취소한다. */
const ORDER_CANCEL_DAY = -1;

export type OrderDeadlineAction = "remind" | "cancel" | "none";

/** 주문 마감까지 남은 일수로 그날 할 일을 고른다. */
export function orderDeadlineActionFor(remainingDays: number): OrderDeadlineAction {
  if (ORDER_REMINDER_DAYS.includes(remainingDays)) return "remind";
  if (remainingDays === ORDER_CANCEL_DAY) return "cancel";
  return "none";
}

/** 배송완료 다음날. 수령확인 독촉을 1회만 보내기 위해 동등 비교로 쓴다. */
const DELIVERY_RECEIPT_REMINDER_DAY = 1;

/**
 * 배송완료 후 수령확인 리마인더 설정. 배송 단계가 있는 두 카테고리가 조건을
 * 공유하고 트리거 키만 다르다. 가구매는 배송 단계가 없어 대상이 아니다.
 */
type DeliveryReceiptReminderConfig = {
  category: CampaignCategory;
  triggerKey: LineTriggerKey;
};

export const DELIVERY_RECEIPT_REMINDER_CONFIGS: DeliveryReceiptReminderConfig[] = [
  { category: "SNS", triggerKey: "SNS_APPLICATION_DELIVERY_REMINDER" },
  {
    category: "SIMPLE_REVIEW",
    triggerKey: "SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER",
  },
];

/** 마감까지 남은 일수로 보낼 리마인더를 고른다. 보낼 것이 없으면 null. */
export function reminderTriggerKeyFor(
  remainingDays: number,
  config: DeadlineReminderConfig,
): LineTriggerKey | null {
  if (remainingDays === OVERDUE_REMINDER_DAY) return config.overdueTriggerKey;
  if (POSTING_REMINDER_DAYS.includes(remainingDays)) return config.deadlineTriggerKey;
  return null;
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
    // 발송이 막힌 환경에서는 대상 조회·발송 로그까지 전부 건너뛴다. 로그만 쌓여
    // 프로덕션 발송 이력을 오염시키는 걸 막기 위함.
    if (!linePushAllowed()) {
      this.logger.warn("Reminder run skipped: LINE push disabled in this environment");
      return;
    }
    try {
      await this.runOrderDeadlineReminders();
      for (const config of DELIVERY_RECEIPT_REMINDER_CONFIGS) {
        await this.runDeliveryReceiptReminders(config);
      }
      for (const config of DEADLINE_REMINDER_CONFIGS) {
        await this.runDeadlineReminders(config);
      }
      await this.runSnsInsightReminders();
      await this.runSnsInsightOverdueReminders();
      await this.runSnsPostRejectionReminders();
      await this.runSimpleReviewRejectionReminders();
    } catch (err) {
      this.logger.error("Reminder daily run failed", err as Error);
    }
  }

  /** 수동 트리거용 — 디버깅/관리자 호출에서 같은 로직 재사용. */
  async runNow(): Promise<void> {
    return this.runDaily();
  }

  /**
   * 가구매 주문 마감 — 마감 3일 전·당일 리마인더를 보내고, 마감 다음날까지
   * 주문하지 않은 응모를 취소한다. 대상 조건이 같아 한 번의 조회로 처리한다.
   * 캠페인에 orderPeriodDays 가 없으면 마감 개념이 없어 대상이 아니다.
   */
  private async runOrderDeadlineReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());

    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        // APPROVED 가 곧 "주문 대기" — 주문을 낸 응모는 ORDER_SUBMITTED 로 빠진다.
        status: "APPROVED",
        reviewedAt: { not: null },
        campaign: {
          ...activeCampaign("FAKE_PURCHASE"),
          orderPeriodDays: { not: null },
        },
      },
      include: DISPATCH_APPLICATION_INCLUDE,
    });

    for (const application of applications) {
      const { reviewedAt } = application;
      const { orderPeriodDays } = application.campaign;
      if (!reviewedAt || orderPeriodDays == null) continue;

      const deadlineMs = reviewedAt.getTime() + orderPeriodDays * DAY_MS;
      const deadlineDayStart = startOfJstDay(new Date(deadlineMs));
      const remainingDays = Math.round((deadlineDayStart - todayStart) / DAY_MS);

      switch (orderDeadlineActionFor(remainingDays)) {
        case "remind":
          await this.dispatcher.dispatch("FAKE_PURCHASE_ORDER_DEADLINE_REMINDER", {
            application,
            extra: { remainingDays },
          });
          break;
        case "cancel":
          // 취소를 먼저 확정하고 안내를 보낸다. 발송이 실패해도 취소는 유지되고
          // 실패는 line_dispatch_logs 에 남는다.
          await this.prisma.campaignApplication.update({
            where: { id: application.id },
            data: { status: "CANCELLED" },
          });
          await this.dispatcher.dispatch("FAKE_PURCHASE_ORDER_EXPIRED", {
            application,
          });
          break;
        case "none":
          break;
      }
    }
  }

  /**
   * 배송완료 다음날까지 수령확인을 하지 않은 응모에 리마인더.
   * 수령확인이 없으면 receivedAt 이 비어 게시 마감 리마인더까지 전부 발송되지
   * 않으므로, 응모가 조용히 방치되는 걸 막는 지점이다.
   */
  private async runDeliveryReceiptReminders(
    config: DeliveryReceiptReminderConfig,
  ): Promise<void> {
    const todayStart = startOfJstDay(new Date());

    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        status: "DELIVERED",
        receivedAt: null,
        deliveredAt: { not: null },
        campaign: activeCampaign(config.category),
      },
      include: DISPATCH_APPLICATION_INCLUDE,
    });

    for (const application of applications) {
      if (!application.deliveredAt) continue;
      const deliveredDayStart = startOfJstDay(application.deliveredAt);
      const elapsedDays = Math.round((todayStart - deliveredDayStart) / DAY_MS);
      if (elapsedDays !== DELIVERY_RECEIPT_REMINDER_DAY) continue;

      await this.dispatcher.dispatch(config.triggerKey, { application });
    }
  }

  /**
   * 제출 마감 리마인더 — 마감 3일 전·1일 전 독려와 마감 다음날 독촉을 함께 처리한다.
   * 아직 제출물이 없는 응모만 대상이며, 각 시점에 1회만 발송된다.
   */
  private async runDeadlineReminders(config: DeadlineReminderConfig): Promise<void> {
    const todayStart = startOfJstDay(new Date());

    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        [config.anchor]: { not: null },
        status: { in: config.statuses },
        campaign: activeCampaign(config.category),
      },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        posts: { select: { id: true } },
      },
    });

    for (const application of applications) {
      const anchorAt = application[config.anchor];
      if (!anchorAt) continue;
      // 이미 제출이 들어왔으면 마감 리마인더는 더 이상 보내지 않음.
      if (application.posts.length > 0) continue;

      const deadline = resolvePostingDeadline({
        publishEndAt: application.campaign.publishEndAt,
        anchorAt,
        postingPeriodDays: application.campaign.postingPeriodDays,
      });
      if (!deadline) continue;
      const deadlineDayStart = startOfJstDay(deadline);
      const remainingDays = Math.round((deadlineDayStart - todayStart) / DAY_MS);

      const triggerKey = reminderTriggerKeyFor(remainingDays, config);
      if (!triggerKey) continue;

      await this.dispatcher.dispatch(triggerKey, {
        application,
        extra: { remainingDays },
      });
    }
  }

  private async runSnsPostRejectionReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());
    const reminderDayStart = todayStart - POST_REJECTION_RESUBMIT_DAYS * DAY_MS;

    // submissionReviewedAt 은 반려 시점에 가장 최근 반려와 동일하게 갱신되므로
    // "현재 활성 반려"의 시각을 그대로 나타낸다. 과거 반려 row 는 무관.
    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        submissionReviewStatus: "REJECTED",
        submissionReviewedAt: { not: null },
        campaign: activeCampaign("SNS"),
      },
      include: DISPATCH_APPLICATION_INCLUDE,
    });

    for (const application of applications) {
      if (!application.submissionReviewedAt) continue;
      if (startOfJstDay(application.submissionReviewedAt) !== reminderDayStart) continue;

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
        campaign: activeCampaign("SNS"),
      },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        posts: { select: { subType: true, insightSubmittedAt: true } },
      },
    });

    return applications.filter((application) => {
      if (!application.reviewSubmittedAt) return false;
      // 정산을 막고 있는 사유가 인사이트일 때만 독촉한다. insightRequired 가
      // 꺼진 서브타입이나 이미 정산이 생성된 응모에는 보내지 않는다.
      if (!insightMissingForSettlement(application)) return false;
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

  /**
   * 단순 리뷰: 리뷰 반려 후 재제출 지연 리마인더.
   * submissionReviewStatus=REJECTED 인 SIMPLE_REVIEW 카테고리 응모가 대상.
   * SNS 반려 리마인더와 동일하게 반려 후 1일 경과 시점(어제 반려된 건) 발송.
   */
  private async runSimpleReviewRejectionReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());
    const reminderDayStart = todayStart - POST_REJECTION_RESUBMIT_DAYS * DAY_MS;

    const applications = await this.prisma.campaignApplication.findMany({
      where: {
        submissionReviewStatus: "REJECTED",
        submissionReviewedAt: { not: null },
        campaign: activeCampaign("SIMPLE_REVIEW"),
      },
      include: DISPATCH_APPLICATION_INCLUDE,
    });

    for (const application of applications) {
      if (!application.submissionReviewedAt) continue;
      if (startOfJstDay(application.submissionReviewedAt) !== reminderDayStart) continue;

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
