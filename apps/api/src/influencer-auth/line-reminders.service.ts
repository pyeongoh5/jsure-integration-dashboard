import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "./line-messaging.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const POSTING_REMINDER_DAYS = [3, 1];
const INSIGHT_REMINDER_DAY_AFTER_POST = 7;
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
    private readonly line: LineMessagingService,
  ) {}

  /** 매일 JST 09:00에 1회. 그날 시간이 도래한 대상에게 리마인더 발송. */
  @Cron("0 9 * * *", { timeZone: JST_TZ })
  async runDaily(): Promise<void> {
    try {
      await this.runPostingReminders();
      await this.runInsightReminders();
      await this.runPostRejectionReminders();
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

      const deadlineMs = app.receivedAt.getTime() + app.campaign.postingPeriodDays * DAY_MS;
      const deadlineDayStart = startOfJstDay(new Date(deadlineMs));
      const remainingDays = Math.round((deadlineDayStart - todayStart) / DAY_MS);
      if (!POSTING_REMINDER_DAYS.includes(remainingDays)) continue;

      await this.line.pushText(
        app.influencerId,
        `⏰【期限間近】キャンペーン投稿期限まであと${remainingDays}日です！ ⏰
お世話になっております！
ご参加いただいている「${app.campaign.title}」の投稿期限まで、あと${remainingDays}日となりました。

投稿期限に遅れのないよう、ご注意ください。

✨ 投稿完了後のお願い
SNSへご投稿いただいた後は、必ずシステムより【応募履歴 - 投稿URL提出】を完了していただけますようお願いいたします。

素敵なご投稿を心より楽しみにしております。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`,
        // `【投稿期限のお知らせ】\n「${app.campaign.title}」の投稿期限まであと${remainingDays}日です。\nお忘れなく投稿のご準備をお願いいたします。\n\n${this.line.applicationUrl(app.id)}`,
      );
    }
  }

  private async runPostRejectionReminders(): Promise<void> {
    const todayStart = startOfJstDay(new Date());
    const yesterdayStart = todayStart - DAY_MS;

    const posts = await this.prisma.submittedPost.findMany({
      where: { reviewStatus: "REJECTED" },
      include: {
        application: {
          select: {
            id: true,
            influencerId: true,
            campaign: { select: { title: true } },
          },
        },
        rejections: {
          orderBy: { rejectedAt: "desc" },
          take: 1,
        },
      },
    });

    for (const post of posts) {
      const latest = post.rejections[0];
      if (!latest) continue;
      if (startOfJstDay(latest.rejectedAt) !== yesterdayStart) continue;

      const finalDeadlineAt = new Date(
        latest.rejectedAt.getTime() + POST_REJECTION_RESUBMIT_DAYS * DAY_MS,
      );
      await this.line.notifyPostRejectionReminder({
        influencerId: post.application.influencerId,
        applicationId: post.application.id,
        campaignTitle: post.application.campaign.title,
        rejectReason: latest.comment,
        finalDeadlineAt,
      });
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
      const elapsedDays = Math.round((todayStart - submittedDayStart) / DAY_MS);
      if (elapsedDays !== INSIGHT_REMINDER_DAY_AFTER_POST) continue;

      await this.line.pushText(
        post.application.influencerId,
        `📊【インサイト提出のお願い】数執の登録をお願いいたします 📊
お世話になっております。
ご参加いただいている「${post.application.campaign.title}」の投稿から7日が経過いたしました。素敵なご投稿をいただき、誠にありがとうございます。

キャンペーンの最終精算および成果測定のため、大変お手数ですが下記のご案内をお読みいただき、インサイト資料のご提出をお願いいたします。

📝 提出項目のご案内
- 対象インサイト: いいね数・コメント数・シェア数・リポスト数・保存数・閲覧数・リーチ数などの画面スクリーンショットおよび数値入力

※投稿の成果数値が確認できる画面をスクリーンショットし、サイト内の【応募履歴 - インサイト提出】よりご登録をお願いいたします。期限内にご提出いただくことで、報酬の精算手続きがスムーズに進行いたします。

ご協力のほどよろしくお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00
>`,
      );
    }
  }
}
