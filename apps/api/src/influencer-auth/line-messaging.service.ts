import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { linePushAllowed } from "../common/line-push-allowed";

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

/**
 * 발송 결과. 예외를 던지지 않는 대신 호출부가 실제 도달 여부를 알 수 있게 한다.
 * skipped=true 는 "보낼 대상/설정이 없어 애초에 시도하지 않음"(발송 이력에서
 * 실패와 구분해야 함), skipped=false 는 시도했으나 실패.
 */
export type LinePushResult =
  | { ok: true }
  | { ok: false; skipped: boolean; reason: string };

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
    if (!linePushAllowed()) {
      this.logger.warn(
        "LINE push blocked: NODE_ENV != production (set LINE_PUSH_ENABLED=true to allow)",
      );
      return null;
    }
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
  async pushToInfluencer(
    influencerId: string,
    messages: LineMessage[],
  ): Promise<LinePushResult> {
    const token = await this.resolveToken();
    if (!token) {
      this.logger.warn("LINE messaging token not configured; skipping push");
      return { ok: false, skipped: true, reason: "발송이 비활성화된 환경이거나 토큰 미설정" };
    }
    const inf = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { lineUserId: true },
    });
    if (!inf?.lineUserId) {
      return { ok: false, skipped: true, reason: "LINE 연동되지 않은 인플루언서" };
    }
    return this.push(inf.lineUserId, messages, token, `inf=${influencerId}`);
  }

  pushText(influencerId: string, text: string): Promise<LinePushResult> {
    return this.pushToInfluencer(influencerId, [{ type: "text", text }]);
  }

  /**
   * Push messages directly to a raw LINE user ID (bypasses influencer lookup).
   * Used by admin test-send and other flows where the lineUserId is already known.
   */
  async pushToLineUserId(
    lineUserId: string,
    messages: LineMessage[],
  ): Promise<LinePushResult> {
    const token = await this.resolveToken();
    if (!token) {
      this.logger.warn("LINE messaging token not configured; skipping push");
      return { ok: false, skipped: true, reason: "발송이 비활성화된 환경이거나 토큰 미설정" };
    }
    return this.push(lineUserId, messages, token, `lineUserId=${lineUserId}`);
  }

  /** 실제 push 호출 — 실패는 던지지 않고 결과로 돌려준다. */
  private async push(
    lineUserId: string,
    messages: LineMessage[],
    token: string,
    logLabel: string,
  ): Promise<LinePushResult> {
    try {
      const res = await fetch(LINE_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: lineUserId, messages }),
      });
      if (res.ok) return { ok: true };
      const body = await res.text();
      this.logger.warn(`LINE push failed (${res.status}) for ${logLabel}: ${body}`);
      return { ok: false, skipped: false, reason: `HTTP ${res.status}: ${body}`.slice(0, 500) };
    } catch (err) {
      this.logger.error(`LINE push error for ${logLabel}`, err as Error);
      return {
        ok: false,
        skipped: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
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
}
