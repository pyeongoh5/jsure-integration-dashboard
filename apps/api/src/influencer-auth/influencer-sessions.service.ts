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
    const days = Number(config.get<string>("REFRESH_EXPIRES_DAYS") ?? "30");
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
