import { InfluencerApplicationsService } from "./influencer-applications.service";

type ServiceOverrides = Partial<{
  prisma: unknown;
  uploads: unknown;
  line: unknown;
  dispatcher: unknown;
}>;

function makeService(overrides?: ServiceOverrides) {
  const prisma = overrides?.prisma ?? {};
  const uploads = overrides?.uploads ?? {
    verifyAttachmentUploads: jest.fn(async () => undefined),
    resolveCampaignThumbnailUrl: jest.fn(async (raw: string | null) => raw),
  };
  const line = overrides?.line ?? {};
  const dispatcher = overrides?.dispatcher ?? { dispatch: jest.fn() };
  return new InfluencerApplicationsService(
    prisma as never,
    uploads as never,
    line as never,
    dispatcher as never,
  );
}

function makeApplicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    campaignId: "camp-1",
    influencerId: "inf-1",
    status: "ORDER_SUBMITTED",
    appliedAt: new Date("2026-06-01T00:00:00Z"),
    trackingCarrier: null,
    trackingNumber: null,
    shippedAt: null,
    deliveredAt: null,
    receivedAt: null,
    completedAt: null,
    rejectReason: null,
    subType: "QOO10",
    instagramPostType: null,
    orderNumber: "ORDER-1",
    orderSubmittedAt: new Date("2026-07-01T00:00:00Z"),
    reviewSubmittedAt: null,
    posts: [],
    campaign: {
      id: "camp-1",
      category: "FAKE_PURCHASE",
      title: "テストキャンペーン",
      thumbnailUrl: null,
      rewardJpy: 1000,
      postingPeriodDays: 14,
      recruits: [],
    },
    ...overrides,
  };
}

describe("InfluencerApplicationsService.submitOrder", () => {
  const receipts = [
    {
      objectKey: "attachments/app-1/ORDER_RECEIPT/x.png",
      contentType: "image/png" as const,
      sizeBytes: 100,
    },
  ];

  it("SNS 카테고리 응모는 CATEGORY_MISMATCH", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "APPROVED",
          subType: "INSTAGRAM",
          campaign: { category: "SNS" },
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitOrder("inf-1", "app-1", "ORDER-1", receipts),
    ).rejects.toThrow(/CATEGORY_MISMATCH|買取レビュー/);
  });

  it("APPROVED → ORDER_SUBMITTED 성공: attachments 생성, dispatch 호출", async () => {
    const dispatch = jest.fn();
    const createMany = jest.fn(async () => ({ count: 1 }));
    const deleteMany = jest.fn(async () => ({ count: 0 }));
    const update = jest.fn(async () => ({
      id: "app-1",
      status: "ORDER_SUBMITTED",
      orderNumber: "ORDER-1",
    }));
    const refreshedRow = makeApplicationRow({ status: "ORDER_SUBMITTED" });
    const detailRow = makeApplicationRow({ status: "ORDER_SUBMITTED" });
    const findUnique = jest
      .fn()
      // submitOrder: 초기 findUnique (category/status 확인)
      .mockResolvedValueOnce({
        id: "app-1",
        influencerId: "inf-1",
        status: "APPROVED",
        subType: "QOO10",
        campaign: { category: "FAKE_PURCHASE" },
      })
      // getForInfluencer: 재조회
      .mockResolvedValueOnce(detailRow);
    const findUniqueOrThrow = jest.fn(async () => refreshedRow);
    const tx = {
      attachment: { deleteMany, createMany },
      campaignApplication: { update },
    };
    const prisma = {
      campaignApplication: { findUnique, findUniqueOrThrow, update },
      attachment: { deleteMany, createMany },
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    };
    const verifyAttachmentUploads = jest.fn(async () => undefined);
    const resolveCampaignThumbnailUrl = jest.fn(
      async (raw: string | null) => raw,
    );
    const svc = makeService({
      prisma,
      uploads: { verifyAttachmentUploads, resolveCampaignThumbnailUrl },
      dispatcher: { dispatch },
    });

    await svc.submitOrder("inf-1", "app-1", "  ORDER-1  ", receipts);

    expect(verifyAttachmentUploads).toHaveBeenCalledWith(
      receipts,
      "attachments/",
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1", kind: "ORDER_RECEIPT" },
    });
    expect(createMany).toHaveBeenCalledTimes(1);
    const createArg = (createMany.mock.calls[0] as unknown[])[0] as {
      data: { kind: string; objectKey: string; postId: null }[];
    };
    expect(createArg.data[0]?.kind).toBe("ORDER_RECEIPT");
    expect(createArg.data[0]?.postId).toBeNull();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({
          status: "ORDER_SUBMITTED",
          orderNumber: "ORDER-1",
        }),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      "FAKE_PURCHASE_ORDER_SUBMITTED",
      expect.objectContaining({ application: refreshedRow }),
    );
  });

  it("ORDER_SUBMITTED 재제출: 기존 첨부 deleteMany 후 재생성", async () => {
    const deleteMany = jest.fn(async () => ({ count: 2 }));
    const createMany = jest.fn(async () => ({ count: 1 }));
    const update = jest.fn(async () => ({ id: "app-1" }));
    const refreshedRow = makeApplicationRow({ status: "ORDER_SUBMITTED" });
    const detailRow = makeApplicationRow({ status: "ORDER_SUBMITTED" });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: "app-1",
        influencerId: "inf-1",
        status: "ORDER_SUBMITTED",
        subType: "QOO10",
        campaign: { category: "FAKE_PURCHASE" },
      })
      .mockResolvedValueOnce(detailRow);
    const findUniqueOrThrow = jest.fn(async () => refreshedRow);
    const tx = {
      attachment: { deleteMany, createMany },
      campaignApplication: { update },
    };
    const prisma = {
      campaignApplication: { findUnique, findUniqueOrThrow, update },
      attachment: { deleteMany, createMany },
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    };
    const svc = makeService({
      prisma,
      dispatcher: { dispatch: jest.fn() },
    });

    await svc.submitOrder("inf-1", "app-1", "ORDER-2", receipts);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1", kind: "ORDER_RECEIPT" },
    });
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it("REVIEW_SUBMITTED 상태에서는 INVALID_TRANSITION", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "REVIEW_SUBMITTED",
          subType: "QOO10",
          campaign: { category: "FAKE_PURCHASE" },
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitOrder("inf-1", "app-1", "ORDER-1", receipts),
    ).rejects.toThrow(/INVALID_TRANSITION|注文情報を提出/);
  });

  it("receipts 배열이 비어있으면 400", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "APPROVED",
          subType: "QOO10",
          campaign: { category: "FAKE_PURCHASE" },
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitOrder("inf-1", "app-1", "ORDER-1", []),
    ).rejects.toThrow(/RECEIPT_REQUIRED|スクリーンショット/);
  });
});
