import { LineDispatcherService } from "./line-dispatcher.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { LineMessagingService } from "../influencer-auth/line-messaging.service";

function makePrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    lineMessageTemplate: {
      findFirst: jest.fn(),
    },
    lineDispatchLog: {
      create: jest.fn().mockResolvedValue({ id: "log1" }),
    },
    ...overrides,
  } as unknown as PrismaService;
}

function makeLineMock(pushTextImpl: (id: string, text: string) => Promise<void> = jest.fn()) {
  return { pushText: pushTextImpl } as unknown as LineMessagingService;
}

const application = {
  id: "app1",
  influencerId: "inf1",
  snsType: "INSTAGRAM",
  trackingCarrier: null,
  trackingNumber: null,
  campaign: { id: "c1", title: "Test Campaign", postingPeriodDays: 14 },
  influencer: { id: "inf1", name: "Alice", lineUserId: "U123" },
} as never;

describe("LineDispatcherService", () => {
  it("템플릿이 없으면 SKIPPED_NO_TEMPLATE 로그 후 발송 안 함", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findFirst as jest.Mock).mockResolvedValue(null);
    const push = jest.fn();
    const line = makeLineMock(push);

    const svc = new LineDispatcherService(prisma, line);
    await svc.dispatch("SNS_APPLICATION_APPLIED", { application });

    expect(push).not.toHaveBeenCalled();
    expect(prisma.lineDispatchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SKIPPED_NO_TEMPLATE" }),
      }),
    );
  });

  it("템플릿이 disabled 면 SKIPPED_DISABLED 로그 후 발송 안 함", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: "t1",
      enabled: false,
      body: "hi {{influencerName}}",
    });
    const push = jest.fn();
    const line = makeLineMock(push);

    const svc = new LineDispatcherService(prisma, line);
    await svc.dispatch("SNS_APPLICATION_APPLIED", { application });

    expect(push).not.toHaveBeenCalled();
    expect(prisma.lineDispatchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SKIPPED_DISABLED" }),
      }),
    );
  });

  it("enabled 면 렌더 후 pushText + SUCCESS 로그", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: "t1",
      enabled: true,
      body: "hi {{influencerName}} / {{campaignTitle}}",
    });
    const push = jest.fn().mockResolvedValue(undefined);
    const line = makeLineMock(push);

    const svc = new LineDispatcherService(prisma, line);
    await svc.dispatch("SNS_APPLICATION_APPLIED", { application });

    expect(push).toHaveBeenCalledWith("inf1", "hi Alice / Test Campaign");
    expect(prisma.lineDispatchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUCCESS",
          renderedBody: "hi Alice / Test Campaign",
          templateId: "t1",
        }),
      }),
    );
  });

  it("pushText 가 throw 하면 FAILED 로그 (예외 삼킴)", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: "t1",
      enabled: true,
      body: "hi",
    });
    const push = jest.fn().mockRejectedValue(new Error("boom"));
    const line = makeLineMock(push);

    const svc = new LineDispatcherService(prisma, line);
    await expect(svc.dispatch("SNS_APPLICATION_APPLIED", { application })).resolves.toBeUndefined();

    expect(prisma.lineDispatchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "boom",
        }),
      }),
    );
  });

  it("subType 은 application.snsType 에서 도출 (INSTAGRAM/X)", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findFirst as jest.Mock).mockResolvedValue(null);
    const svc = new LineDispatcherService(prisma, makeLineMock());
    await svc.dispatch("SNS_APPLICATION_APPLIED", {
      application: { ...(application as object), snsType: "X" } as never,
    });
    expect(prisma.lineMessageTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        category: "SNS",
        subType: "X",
        triggerKey: "SNS_APPLICATION_APPLIED",
      },
    });
  });
});
