import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InfluencerSessionsService } from "./influencer-sessions.service";

type SessionRow = {
  id: string;
  influencerId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

function makeService(existing: SessionRow | null) {
  const updates: unknown[] = [];
  const creates: unknown[] = [];
  const prisma = {
    influencerSession: {
      findUnique: async () => existing,
      update: async (args: unknown) => {
        updates.push(args);
        return null;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        creates.push(args);
        return { id: "new-session-id", ...args.data };
      },
    },
  } as never;
  const config = { get: () => "30" } as unknown as ConfigService;
  const service = new InfluencerSessionsService(prisma, config);
  return { service, updates, creates };
}

describe("InfluencerSessionsService.rotate", () => {
  const alive: SessionRow = {
    id: "sess-1",
    influencerId: "inf-1",
    refreshTokenHash: "irrelevant",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
  };

  it("유효한 세션이면 기존 폐기 + 새 세션 발급", async () => {
    const { service, updates, creates } = makeService(alive);
    const result = await service.rotate("token", { userAgent: null, ip: null });
    expect(result.influencerId).toBe("inf-1");
    expect(result.sessionId).toBe("new-session-id");
    expect(result.refreshToken).toBeTruthy();
    expect(updates).toHaveLength(1); // 기존 세션 revokedAt 세팅
    expect(creates).toHaveLength(1);
  });

  it("존재하지 않는 토큰이면 Unauthorized", async () => {
    const { service } = makeService(null);
    await expect(
      service.rotate("token", { userAgent: null, ip: null }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("폐기된 세션이면 Unauthorized", async () => {
    const { service } = makeService({ ...alive, revokedAt: new Date() });
    await expect(
      service.rotate("token", { userAgent: null, ip: null }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("만료된 세션이면 Unauthorized", async () => {
    const { service } = makeService({
      ...alive,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(
      service.rotate("token", { userAgent: null, ip: null }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
