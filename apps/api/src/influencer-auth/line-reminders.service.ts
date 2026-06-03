import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "./line-messaging.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const POSTING_REMINDER_DAYS = [3, 1];
const INSIGHT_REMINDER_DAY_AFTER_POST = 7;
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
    private readonly line: LineMessagingService,
  ) {}

  /** 매일 JST 09:00에 1회. 그날 시간이 도래한 대상에게 리마인더 발송. */
  @Cron("0 9 * * *", { timeZone: JST_TZ })
  async runDaily(): Promise<void> {
    try {
      await this.runPostingReminders();
      await this.runInsightReminders();
    } catch (err) {
      this.logger.error("Reminder daily run failed", err as Error);
    }
  }

  /** 수동 트리거용 — 디버깅/관리자 호출에서 같은 로직 재사용. */
  async runNow(): Promise<void> {
    return this.runDaily();
  }

  private async runPostingReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());

    const apps = await this.prisma.campaignApplication.findMany({
      where: {
        receivedAt: { not: null },
        status: { in: ["SHIPPED", "DELIVERED"] },
      },
      include: {
        campaign: {
          select: { title: true, postingPeriodDays: true },
        },
        posts: { select: { id: true } },
      },
    });

    for (const app of apps) {
      if (!app.receivedAt) continue;
      // 이미 투고가 들어왔으면 투고기간 리마인더는 더 이상 보내지 않음.
      if (app.posts.length > 0) continue;

      const deadlineMs =
        app.receivedAt.getTime() + app.campaign.postingPeriodDays * DAY_MS;
      const deadlineDayStart = startOfJstDay(new Date(deadlineMs));
      const remainingDays = Math.round(
        (deadlineDayStart - todayStart) / DAY_MS,
      );
      if (!POSTING_REMINDER_DAYS.includes(remainingDays)) continue;

      await this.line.pushText(
        app.influencerId,
        `【投稿期限のお知らせ】\n「${app.campaign.title}」の投稿期限まであと${remainingDays}日です。\nお忘れなく投稿のご準備をお願いいたします。\n\n${this.line.applicationUrl(app.id)}`,
      );
    }
  }

  private async runInsightReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());

    // submittedAt 의 JST 기준 일자가 정확히 N일 전인 post만 대상.
    // (그 이후엔 매일 보내지 않도록 == 검사)
    const posts = await this.prisma.submittedPost.findMany({
      where: {
        insightSubmittedAt: null,
        reviewStatus: { in: ["PENDING", "APPROVED"] },
      },
      include: {
        application: {
          select: {
            id: true,
            influencerId: true,
            campaign: { select: { title: true } },
          },
        },
      },
    });

    for (const post of posts) {
      const submittedDayStart = startOfJstDay(post.submittedAt);
      const elapsedDays = Math.round(
        (todayStart - submittedDayStart) / DAY_MS,
      );
      if (elapsedDays !== INSIGHT_REMINDER_DAY_AFTER_POST) continue;

      await this.line.pushText(
        post.application.influencerId,
        `【インサイト提出のお願い】\n「${post.application.campaign.title}」の投稿から${INSIGHT_REMINDER_DAY_AFTER_POST}日が経過しました。\nインサイト（いいね・コメント・シェア・リポスト・保存・閲覧・リーチ）のご提出をお願いいたします。\n\n${this.line.applicationUrl(post.application.id)}`,
      );
    }
  }
}
