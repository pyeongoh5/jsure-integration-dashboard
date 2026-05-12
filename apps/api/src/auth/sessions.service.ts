import {
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

@Injectable()
export class SessionsService {
  private readonly log = new Logger(SessionsService.name);
  private readonly refreshTtlMs: number;
  private readonly revokedRetentionMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const days = Number(config.get<string>("REFRESH_EXPIRES_DAYS") ?? "14");
    this.refreshTtlMs = days * 24 * 60 * 60 * 1000;
  }

  private generateToken(): string {
    return randomBytes(48).toString("base64url");
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async create(
    userId: string,
    ctx: SessionContext,
  ): Promise<{ refreshToken: string; sessionId: string }> {
    const refreshToken = this.generateToken();
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: this.hash(refreshToken),
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return { refreshToken, sessionId: session.id };
  }

  /**
   * Rotate: revoke old row, insert new row.
   * If the presented token matches an *already-revoked* session, treat as
   * reuse: revoke every active session for that user and reject.
   */
  async rotate(
    presented: string,
    ctx: SessionContext,
  ): Promise<{ refreshToken: string; userId: string; sessionId: string }> {
    const presentedHash = this.hash(presented);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: presentedHash },
    });
    if (!session) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (session.revokedAt) {
      this.log.warn(
        `Refresh reuse detected for user=${session.userId} session=${session.id} — revoking all sessions`,
      );
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token reuse detected");
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const next = this.generateToken();
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return tx.userSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: this.hash(next),
          userAgent: ctx.userAgent ?? session.userAgent,
          ip: ctx.ip ?? session.ip,
          expiresAt: new Date(Date.now() + this.refreshTtlMs),
        },
      });
    });
    return { refreshToken: next, userId: session.userId, sessionId: created.id };
  }

  async revokeByToken(presented: string): Promise<void> {
    const presentedHash = this.hash(presented);
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: presentedHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeOwnedById(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async listForUser(userId: string): Promise<SessionSummary[]> {
    const rows = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });
    return rows;
  }

  async touch(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastSeenAt: new Date() },
    });
  }

  async cleanupExpired(): Promise<{ expired: number; revoked: number }> {
    const now = new Date();
    const expired = await this.prisma.userSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const revoked = await this.prisma.userSession.deleteMany({
      where: { revokedAt: { lt: new Date(now.getTime() - this.revokedRetentionMs) } },
    });
    return { expired: expired.count, revoked: revoked.count };
  }
}
