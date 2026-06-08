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

  async notifyApproved(args: {
    influencerId: string;
    applicationId: string;
    campaignTitle: string;
  }): Promise<void> {
    await this.pushText(
      args.influencerId,
      `【承認のお知らせ】\n「${args.campaignTitle}」へのご応募が承認されました。\n商品の発送準備に入ります。`,
    );
  }

  async notifyRejected(args: {
    influencerId: string;
    applicationId: string;
    campaignTitle: string;
    reason: string;
  }): Promise<void> {
    await this.pushText(
      args.influencerId,
      `【選考結果のお知らせ】\n「${args.campaignTitle}」につきまして、誠に申し訳ございませんが今回は見送りとなりました。\n\n理由: ${args.reason}`,
    );
  }

  async notifyShipped(args: {
    influencerId: string;
    applicationId: string;
    campaignTitle: string;
    trackingCarrier: string;
    trackingNumber: string;
  }): Promise<void> {
    await this.pushText(
      args.influencerId,
      `【発送のお知らせ】\n「${args.campaignTitle}」の商品を発送いたしました。\n配送業者: ${args.trackingCarrier}\n運送番号: ${args.trackingNumber}`,
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
      `【配送完了 / 受領のお願い】\n「${args.campaignTitle}」の商品が配送完了となりました。\n\nアプリで「受領を確認」を押すと、ここから${args.postingPeriodDays}日間の投稿期間がスタートします。`,
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
      `【精算完了のお知らせ】\n「${args.campaignTitle}」のご報酬 ¥${args.rewardJpy.toLocaleString("ja-JP")}円のお振込が完了いたしました。\n今後ともよろしくお願いいたします。`,
    );
  }
}
