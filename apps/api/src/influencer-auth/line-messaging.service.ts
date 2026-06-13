import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_MULTICAST_URL = "https://api.line.me/v2/bot/message/multicast";
const LINE_TOKEN_URL = "https://api.line.me/v2/oauth/accessToken";
const MULTICAST_CHUNK = 500;

type LineMessage =
  | { type: "text"; text: string }
  | {
      type: "flex";
      altText: string;
      contents: unknown;
    };

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class LineMessagingService {
  private readonly logger = new Logger(LineMessagingService.name);
  private cachedToken: CachedToken | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private staticToken(): string | null {
    return this.config.get<string>("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN") ?? null;
  }

  private channelCreds(): { id: string; secret: string } | null {
    const id = this.config.get<string>("LINE_MESSAGING_CHANNEL_ID");
    const secret = this.config.get<string>("LINE_MESSAGING_CHANNEL_SECRET");
    if (!id || !secret) return null;
    return { id, secret };
  }

  /**
   * Resolve a usable channel access token. Preference:
   * 1. Static long-lived token from env (LINE_MESSAGING_CHANNEL_ACCESS_TOKEN)
   * 2. Short-lived v2 token issued from channel id + secret, cached until ~5min before expiry
   */
  private async resolveToken(): Promise<string | null> {
    const stat = this.staticToken();
    if (stat) return stat;

    const creds = this.channelCreds();
    if (!creds) return null;

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 5 * 60 * 1000) {
      return this.cachedToken.token;
    }

    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.id,
        client_secret: creds.secret,
      });
      const res = await fetch(LINE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`LINE token issue failed (${res.status}): ${text}`);
        return null;
      }
      const json = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };
      this.cachedToken = {
        token: json.access_token,
        expiresAt: now + json.expires_in * 1000,
      };
      return json.access_token;
    } catch (err) {
      this.logger.error("LINE token issue error", err as Error);
      return null;
    }
  }

  private appBaseUrl(): string {
    return this.config.get<string>("APP_BASE_URL") ?? "http://localhost:5174";
  }

  /**
   * Push messages to an influencer via their linked LINE user ID.
   * Silently no-ops if:
   * - The influencer has no lineUserId
   * - The messaging access token is not configured
   * - LINE returns a 4xx (e.g., user blocked/unfollowed the OA)
   *
   * Errors are logged but never thrown — messaging should never break the
   * primary business action that triggered it.
   */
  async pushToInfluencer(influencerId: string, messages: LineMessage[]): Promise<void> {
    const token = await this.resolveToken();
    if (!token) {
      this.logger.warn("LINE messaging token not configured; skipping push");
      return;
    }
    const inf = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { lineUserId: true },
    });
    if (!inf?.lineUserId) return;

    try {
      const res = await fetch(LINE_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: inf.lineUserId, messages }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`LINE push failed (${res.status}) for inf=${influencerId}: ${body}`);
      }
    } catch (err) {
      this.logger.error(`LINE push error for inf=${influencerId}`, err as Error);
    }
  }

  pushText(influencerId: string, text: string): Promise<void> {
    return this.pushToInfluencer(influencerId, [{ type: "text", text }]);
  }

  pushFlex(influencerId: string, altText: string, contents: unknown): Promise<void> {
    return this.pushToInfluencer(influencerId, [{ type: "flex", altText, contents }]);
  }

  /**
   * 여러 lineUserId 에게 동일한 메시지 전송. 500명씩 chunk 하고
   * 결과(성공/실패 카운트) 반환. 실패한 ID 는 errors 에 기록.
   */
  async multicast(
    lineUserIds: string[],
    messages: LineMessage[],
  ): Promise<{ sent: number; failed: number; errors: { ids: string[]; reason: string }[] }> {
    const token = await this.resolveToken();
    if (!token) {
      this.logger.warn("LINE messaging token not configured; skipping multicast");
      return {
        sent: 0,
        failed: lineUserIds.length,
        errors: [{ ids: lineUserIds, reason: "messaging token not configured" }],
      };
    }
    let sent = 0;
    let failed = 0;
    const errors: { ids: string[]; reason: string }[] = [];
    for (let i = 0; i < lineUserIds.length; i += MULTICAST_CHUNK) {
      const chunk = lineUserIds.slice(i, i + MULTICAST_CHUNK);
      try {
        const res = await fetch(LINE_MULTICAST_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to: chunk, messages }),
        });
        if (res.ok) {
          sent += chunk.length;
        } else {
          const body = await res.text();
          failed += chunk.length;
          errors.push({ ids: chunk, reason: `HTTP ${res.status}: ${body}` });
          this.logger.warn(
            `LINE multicast failed (${res.status}) for ${chunk.length} ids: ${body}`,
          );
        }
      } catch (err) {
        failed += chunk.length;
        errors.push({
          ids: chunk,
          reason: err instanceof Error ? err.message : String(err),
        });
        this.logger.error("LINE multicast error", err as Error);
      }
    }
    return { sent, failed, errors };
  }

  applicationUrl(applicationId: string): string {
    return `${this.appBaseUrl()}/applications/${applicationId}`;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Pre-defined message builders
  // ────────────────────────────────────────────────────────────────────────

  async notifyApproved(args: { influencerId: string; campaignTitle: string }): Promise<void> {
    await this.pushText(
      args.influencerId,
      `🎉【当選おめでとうございます！】キャンペーンのご案内 🎉

お世話になっております。
「${args.campaignTitle}」の当選者に選出されました！👏✨

ご応募誠にありがとうございました。現在、心を込めて商品の発送準備を進めております。📦
発送が完了いたしましたら、改めてご案内メッセージをお送りいたします。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`,
    );
  }

  async notifyShipped(args: {
    influencerId: string;
    campaignTitle: string;
    trackingCarrier: string;
    trackingNumber: string;
  }): Promise<void> {
    const lines = [
      `**📦【発送完了】キャンペーン商品発送のお知らせ 📦**`,
      ``,
      `お世話になっております！`,
      `お待ちかねの**「${args.campaignTitle}」**のキャンペーン商品が、本日無事に発送されました！🎉`,
      ``,
      `配送状況は下記の情報よりご確認いただけます。`,
      ``,
      `🚚 **配送情報のご案内**`,
      `- **配送業者:** ${args.trackingCarrier}`,
      `- **追跡番号:** [${args.trackingNumber}]`,
      ``,
      `💡 **お届け期間および追跡に関するご案内**`,
      `- **日本国内から発送の場合:** 発送後、約2日でお届け`,
      `- **韓国から発送の場合:** 発送後、約7日でお届け`,
      `※韓国からの発送の場合、通関等の事情により、システムへの追跡情報の反映に遅れが生じる場合がございます。何卒ご理解いただけますようお願いいたします。`,
      ``,
      `✨ **お願い:商品が到着いたしましたら、必ず【応募履歴 - 受取確認】ボタンを押してください！**`,
      ``,
      `それでは、商品の到着まで今しばらくお待ちください。よろしくお願いいたします！`,
      ``,
      `※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。`,
      `※システムの行き違いで重複して届いた場合はご容赦ください。`,
      `🕐 運営:平日 10:00〜20:00`,
    ];
    await this.pushFlex(
      args.influencerId,
      `【発送完了】「${args.campaignTitle}」のキャンペーン商品を発送しました`,
      buildBubble(lines),
    );
  }

  async notifyShippedWithPlainText(args: {
    influencerId: string;
    campaignTitle: string;
    trackingCarrier: string;
    trackingNumber: string;
  }): Promise<void> {
    await this.pushText(
      args.influencerId,
      `📦【発送完了】キャンペーン商品発送のお知らせ 📦

お世話になっております！
お待ちかねの「${args.campaignTitle}」のキャンペーン商品が、本日無事に発送されました！🎉

配送状況は下記の情報よりご確認いただけます。

🚚 配送情報のご案内
- 配送業者:${args.trackingCarrier}
- 追跡番号:${args.trackingNumber}

💡 お届け期間および追跡に関するご案内
- 日本国内から発送の場合:発送後、約2日でお届け
- 韓国から発送の場合:発送後、約7日でお届け
※韓国からの発送の場合、通関等の事情により、システムへの追跡情報の反映に遅れが生じる場合がございます。何卒ご理解いただけますようお願いいたします。

✨ お願い:商品が到着いたしましたら、必ず【応募履歴 - 受取確認】ボタンを押してください！

それでは、商品の到着まで今しばらくお待ちください。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`,
    );
  }

  async notifyDelivered(args: {
    influencerId: string;
    applicationId: string;
    campaignTitle: string;
    postingPeriodDays: number;
  }): Promise<void> {
    await this.pushText(
      args.influencerId,
      `🎁【配達完了】商品は無事に届きましたでしょうか？ 🎁
お世話になっております！
ご応募いただいた「${args.campaignTitle}」のキャンペーン商品が、無事に配達完了となりました。

商品がお手元に届きましたら、下記の内容を必ずご確認いただけますようお願いいたします。

✨ 必須チェックリスト
1️⃣ 受取確認: 商品が到着いたしましたら、必ず【応募履歴 - 受取確認】ボタンを押してください！
2️⃣ レビュー投稿: 事前にご案内したガイドラインに沿って、素敵なご投稿をお願いいたします。📸
3️⃣ URL提出: 投稿完了後、必ず【応募履歴 - 投稿URL提出】をお願いいたします。

⚠️ 万が一、商品に問題がある場合
配送中の破損や商品に不具合などがございましたら、ご投稿前にこのメッセージへお気軽にご連絡ください。迅速に対応させていただきます。

商品がお気に召していただけますと幸いです。素敵なご投稿を心より楽しみにしております。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`,
    );
  }

  async notifySettlementComplete(args: {
    influencerId: string;
    applicationId: string;
    campaignTitle: string;
    rewardJpy: number;
  }): Promise<void> {
    await this.pushText(
      args.influencerId,
      `💰【お振込完了】キャンペーン報酬支給のお知らせ 💰
お世話になっております！
ご参加いただいた「${args.campaignTitle}」のレポート確認が完了し、キャンペーン報酬のお振込手続きが完了いたしました。🎉

お振込情報は下記をご確認ください。
💳 お振込情報のご案内
- 振込名義: 株）ジェイシュア
- お振込金額: ${args.rewardJpy} 円

💡 ご確認のお願い
- 複数のキャンペーンに同時にご参加いただいた場合、個別ではなく合算された金額で一括してお振込いたします。
- 本通知メッセージはシステム上、キャンペーンの案件ごとにそれぞれ自動送信されます。実際の口座には合算金額で入金されますので、あらかじめご了承いただけますようお願いいたします。

この度は、弊社のキャンペーンのために素敵なご投稿をいただき誠にありがとうございました。またのご参加を心よりお待ちしております！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`,
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Flex builder helpers
//
// 텍스트 라인 배열을 받아 LINE Flex bubble JSON 으로 변환.
// 라인 안의 `**...**` 부분은 bold span 으로 처리된다. 빈 문자열 라인은
// 시각적 여백(filler box)으로 변환된다.
// ──────────────────────────────────────────────────────────────────────────

type FlexSpan = { type: "span"; text: string; weight?: "bold" };

function parseBoldSpans(line: string): FlexSpan[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { type: "span", text: part.slice(2, -2), weight: "bold" };
    }
    return { type: "span", text: part };
  });
}

function buildBubble(lines: string[]): unknown {
  const contents = lines.map((line) => {
    if (line === "") {
      return { type: "box", layout: "vertical", contents: [], height: "8px" };
    }
    return {
      type: "text",
      wrap: true,
      size: "sm",
      contents: parseBoldSpans(line),
    };
  });
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents,
    },
  };
}
