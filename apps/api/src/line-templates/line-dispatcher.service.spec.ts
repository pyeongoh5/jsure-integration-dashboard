import { LineDispatcherService } from "./line-dispatcher.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { LineMessagingService } from "../influencer-auth/line-messaging.service";

function makePrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    lineMessageTemplate: {
      findUnique: jest.fn(),
    },
    lineDispatchLog: {
      create: jest.fn().mockResolvedValue({ id: "log1" }),
    },
    campaignRecruit: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as unknown as PrismaService;
}

function makeLineMock(pushTextImpl: (id: string, text: string) => Promise<void> = jest.fn()) {
  return { pushText: pushTextImpl } as unknown as LineMessagingService;
}

const application = {
  id: "app1",
  campaignId: "c1",
  influencerId: "inf1",
  subTypes: ["INSTAGRAM"],
  trackingCarrier: null,
  trackingNumber: null,
  campaign: {
    id: "c1",
    title: "Test Campaign",
    postingPeriodDays: 14,
    rewardType: "UNIFIED",
    rewardJpy: 10000,
    recruits: [],
  },
  influencer: { id: "inf1", name: "Alice", lineUserId: "U123" },
} as never;

const fakePurchaseApplication = {
  id: "app2",
  campaignId: "c2",
  influencerId: "inf2",
  subTypes: ["QOO10"],
  trackingCarrier: null,
  trackingNumber: null,
  orderNumber: null,
  orderSubmittedAt: null,
  campaign: {
    id: "c2",
    title: "FP Campaign",
    postingPeriodDays: 14,
    category: "FAKE_PURCHASE",
    rewardType: "UNIFIED",
    rewardJpy: 5000,
    recruits: [
      {
        subType: "QOO10",
        rewardJpy: null,
        productPriceJpy: 3000,
        productUrl: "https://qoo10.jp/g/xyz",
      },
    ],
  },
  influencer: { id: "inf2", name: "Bob", lineUserId: "U234" },
} as never;

describe("LineDispatcherService", () => {
  it("템플릿이 없으면 SKIPPED_NO_TEMPLATE 로그 후 발송 안 함", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue(null);
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
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue({
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
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue({
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
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue({
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

  it("가구매 카테고리는 캠페인 recruits 에서 상품가/정산 예상액을 렌더", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      enabled: true,
      body: "hi {{influencerName}} price={{productPriceJpy}} total={{totalSettlementJpy}}",
    });
    const push = jest.fn().mockResolvedValue(undefined);
    const svc = new LineDispatcherService(prisma, makeLineMock(push));

    await svc.dispatch("FAKE_PURCHASE_APPLICATION_APPLIED", {
      application: fakePurchaseApplication,
    });

    expect(push).toHaveBeenCalledWith("inf2", "hi Bob price=3,000 total=8,000");
  });

  it("같은 인플루언서 연속 발송은 첫 push 가 느려도 호출 순서대로 도착", async () => {
    const prisma = makePrismaMock();
    // 트리거 키를 본문으로 사용해 어느 메시지가 언제 push 됐는지 관찰한다.
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockImplementation(
      (args: { where: { category_triggerKey: { triggerKey: string } } }) =>
        Promise.resolve({
          id: "t1",
          enabled: true,
          body: args.where.category_triggerKey.triggerKey,
        }),
    );
    const pushed: string[] = [];
    // 첫 번째 push 만 인위적으로 지연시켜 레이스를 재현한다.
    const push = jest.fn().mockImplementation((_id: string, text: string) => {
      const delayMs = text === "SNS_INSIGHT_SUBMITTED" ? 30 : 0;
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          pushed.push(text);
          resolve();
        }, delayMs),
      );
    });
    const svc = new LineDispatcherService(prisma, makeLineMock(push));

    const first = svc.dispatch("SNS_INSIGHT_SUBMITTED", { application });
    const second = svc.dispatch("SNS_CAMPAIGN_COMPLETED", { application });
    await Promise.all([first, second]);

    expect(pushed).toEqual(["SNS_INSIGHT_SUBMITTED", "SNS_CAMPAIGN_COMPLETED"]);
  });

  it("서로 다른 인플루언서 발송은 직렬화하지 않는다 (병렬 유지)", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      enabled: true,
      body: "hi",
    });
    const order: string[] = [];
    const push = jest.fn().mockImplementation((id: string) => {
      // inf1 은 느리고 inf2 는 빠름 — 병렬이면 inf2 가 먼저 끝난다.
      const delayMs = id === "inf1" ? 30 : 0;
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          order.push(id);
          resolve();
        }, delayMs),
      );
    });
    const svc = new LineDispatcherService(prisma, makeLineMock(push));

    await Promise.all([
      svc.dispatch("SNS_APPLICATION_APPLIED", { application }),
      svc.dispatch("FAKE_PURCHASE_APPLICATION_APPLIED", {
        application: fakePurchaseApplication,
      }),
    ]);

    expect(order).toEqual(["inf2", "inf1"]);
  });

  it("템플릿 조회 키는 (category, triggerKey) 만 사용", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue(null);
    const svc = new LineDispatcherService(prisma, makeLineMock());
    await svc.dispatch("SNS_APPLICATION_APPLIED", { application });
    expect(prisma.lineMessageTemplate.findUnique).toHaveBeenCalledWith({
      where: {
        category_triggerKey: {
          category: "SNS",
          triggerKey: "SNS_APPLICATION_APPLIED",
        },
      },
    });
  });
});
