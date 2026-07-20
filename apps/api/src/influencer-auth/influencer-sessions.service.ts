import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class InfluencerSessionsService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // 어드민(REFRESH_EXPIRES_DAYS)과 분리 — 인플루언서 세션 기간은 독립적으로 조절.
    const days = Number(
      config.get<string>("INFLUENCER_REFRESH_EXPIRES_DAYS") ?? "30",
    );
    this.refreshTtlMs = days * 24 * 60 * 60 * 1000;
  }

  private generateToken(): string {
    return randomBytes(48).toString("base64url");
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async create(
    influencerId: string,
    ctx: SessionContext,
  ): Promise<{ refreshToken: string; sessionId: string }> {
    const refreshToken = this.generateToken();
    const session = await this.prisma.influencerSession.create({
      data: {
        influencerId,
        refreshTokenHash: this.hash(refreshToken),
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return { refreshToken, sessionId: session.id };
  }

  /**
   * 리프레시 토큰 회전: 제시된 토큰의 세션을 폐기하고 새 세션을 발급한다.
   * 폐기·만료된 토큰이면 UnauthorizedException.
   */
  async rotate(
    presented: string,
    ctx: SessionContext,
  ): Promise<{ influencerId: string; refreshToken: string; sessionId: string }> {
    const session = await this.prisma.influencerSession.findUnique({
      where: { refreshTokenHash: this.hash(presented) },
    });
    if (!session) {
      throw new UnauthorizedException("Session not found");
    }
    if (session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired");
    }
    await this.prisma.influencerSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const { refreshToken, sessionId } = await this.create(
      session.influencerId,
      ctx,
    );
    return { influencerId: session.influencerId, refreshToken, sessionId };
  }

  async revokeByToken(presented: string): Promise<void> {
    const hash = this.hash(presented);
    await this.prisma.influencerSession.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async assertSessionAlive(sessionId: string, influencerId: string): Promise<void> {
    const session = await this.prisma.influencerSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.influencerId !== influencerId) {
      throw new UnauthorizedException("Session not found");
    }
    if (session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired");
    }
  }
}
