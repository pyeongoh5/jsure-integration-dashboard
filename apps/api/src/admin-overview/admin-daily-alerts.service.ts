import { Injectable } from "@nestjs/common";
import {
  DELIVERY_UNCONFIRMED_DAYS,
  resolvePostingDeadline,
  type DailyActionAlertKind,
  type DailyActionAlertTarget,
  type DailyActionAlertsResponse,
} from "@jsure/shared";
import type { LineTriggerKey } from "@jsure/shared";
import type { ApplicationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LineDispatcherService } from "../line-templates/line-dispatcher.service";
import {
  DEADLINE_REMINDER_CONFIGS,
  DELIVERY_RECEIPT_REMINDER_CONFIGS,
} from "../line-templates/line-reminders.service";
import { DISPATCH_APPLICATION_INCLUDE } from "../line-templates/trigger-meta";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 배송 단계가 있는 카테고리만 수령 미확인 대상이다(가구매는 배송이 없다). */
const DELIVERY_CATEGORIES = DELIVERY_RECEIPT_REMINDER_CONFIGS.map(
  (config) => config.category,
);

/** 출고됐지만 아직 수령 확인을 받지 못한 구간. */
const DELIVERY_PENDING_STATUSES: ApplicationStatus[] = ["SHIPPED", "DELIVERED"];

function elapsedDaysSince(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS));
}

/**
 * 어드민 메인 대시보드 '오늘 즉시 처리할 일' 알림.
 *
 * 리마인드 발송은 새 문구를 만들지 않고 기존 LINE 리마인더 템플릿을 그대로
 * 재사용한다 — 트리거 매핑(DEADLINE_REMINDER_CONFIGS / DELIVERY_RECEIPT_REMINDER_CONFIGS)
 * 도 매일 도는 크론과 같은 표를 쓴다.
 */
@Injectable()
export class AdminDailyAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: LineDispatcherService,
  ) {}

  async counts(): Promise<DailyActionAlertsResponse> {
    const [postOverdue, deliveryUnconfirmedCount, withdrawalPendingCount] =
      await Promise.all([
        this.collectPostOverdue(),
        this.prisma.campaignApplication.count({
          where: this.deliveryUnconfirmedWhere(new Date()),
        }),
        this.prisma.influencerWithdrawal.count({ where: { decision: "PENDING" } }),
      ]);

    return {
      postOverdueCount: postOverdue.length,
      deliveryUnconfirmedCount,
      withdrawalPendingCount,
    };
  }

  async targets(kind: DailyActionAlertKind): Promise<DailyActionAlertTarget[]> {
    if (kind === "POST_OVERDUE") return this.collectPostOverdue();
    return this.collectDeliveryUnconfirmed();
  }

  /**
   * 선택한 응모에 리마인드를 보낸다. 응모가 속한 캠페인 카테고리로 트리거를 고르므로
   * SNS·가구매·단순리뷰가 각자의 템플릿을 받는다. 개별 성공·실패는 발송 로그에 남는다.
   */
  async sendReminders(
    kind: DailyActionAlertKind,
    applicationIds: string[],
  ): Promise<number> {
    const applications = await this.prisma.campaignApplication.findMany({
      where: { id: { in: applicationIds } },
      include: DISPATCH_APPLICATION_INCLUDE,
    });

    let requestedCount = 0;
    for (const application of applications) {
      const triggerKey = this.reminderTriggerKeyFor(
        kind,
        application.campaign.category,
      );
      if (!triggerKey) continue;
      await this.dispatcher.dispatch(triggerKey, { application });
      requestedCount += 1;
    }
    return requestedCount;
  }

  private reminderTriggerKeyFor(
    kind: DailyActionAlertKind,
    category: string,
  ): LineTriggerKey | null {
    if (kind === "POST_OVERDUE") {
      return (
        DEADLINE_REMINDER_CONFIGS.find((config) => config.category === category)
          ?.overdueTriggerKey ?? null
      );
    }
    return (
      DELIVERY_RECEIPT_REMINDER_CONFIGS.find(
        (config) => config.category === category,
      )?.triggerKey ?? null
    );
  }

  private deliveryUnconfirmedWhere(now: Date) {
    return {
      status: { in: DELIVERY_PENDING_STATUSES },
      receivedAt: null,
      shippedAt: { lte: new Date(now.getTime() - DELIVERY_UNCONFIRMED_DAYS * DAY_MS) },
      campaign: { category: { in: DELIVERY_CATEGORIES }, deletedAt: null },
    };
  }

  private async collectDeliveryUnconfirmed(): Promise<DailyActionAlertTarget[]> {
    const now = new Date();
    const applications = await this.prisma.campaignApplication.findMany({
      where: this.deliveryUnconfirmedWhere(now),
      select: {
        id: true,
        shippedAt: true,
        campaign: { select: { title: true } },
        influencer: { select: { name: true, lineUserId: true } },
      },
      orderBy: { shippedAt: "asc" },
    });

    return applications.map((application) => ({
      applicationId: application.id,
      influencerName: application.influencer.name,
      campaignTitle: application.campaign.title,
      elapsedDays: application.shippedAt
        ? elapsedDaysSince(application.shippedAt, now)
        : 0,
      lineLinked: application.influencer.lineUserId !== null,
    }));
  }

  /**
   * 투고 마감이 지났는데 제출물이 없는 응모.
   * 마감은 컬럼이 아니라 캠페인 게시 기간 또는 기준일 + postingPeriodDays 로
   * 계산되므로(resolvePostingDeadline), SQL 로 거르지 못하고 후보를 읽어 판정한다.
   */
  private async collectPostOverdue(): Promise<DailyActionAlertTarget[]> {
    const now = new Date();
    const perCategory = await Promise.all(
      DEADLINE_REMINDER_CONFIGS.map(async (config) => {
        const applications = await this.prisma.campaignApplication.findMany({
          where: {
            [config.anchor]: { not: null },
            status: { in: config.statuses },
            posts: { none: {} },
            campaign: { category: config.category, deletedAt: null },
          },
          select: {
            id: true,
            receivedAt: true,
            orderSubmittedAt: true,
            campaign: {
              select: { title: true, publishEndAt: true, postingPeriodDays: true },
            },
            influencer: { select: { name: true, lineUserId: true } },
          },
        });

        return applications.flatMap((application) => {
          const deadline = resolvePostingDeadline({
            publishEndAt: application.campaign.publishEndAt,
            anchorAt: application[config.anchor],
            postingPeriodDays: application.campaign.postingPeriodDays,
          });
          if (!deadline || deadline > now) return [];
          return [
            {
              applicationId: application.id,
              influencerName: application.influencer.name,
              campaignTitle: application.campaign.title,
              elapsedDays: elapsedDaysSince(deadline, now),
              lineLinked: application.influencer.lineUserId !== null,
            },
          ];
        });
      }),
    );

    return perCategory
      .flat()
      .sort((left, right) => right.elapsedDays - left.elapsedDays);
  }
}
