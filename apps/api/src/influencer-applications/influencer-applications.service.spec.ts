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

describe("InfluencerApplicationsService.submitReview", () => {
  const screenshots = [
    {
      objectKey: "attachments/app-1/REVIEW_SCREENSHOT/a.png",
      contentType: "image/png" as const,
      sizeBytes: 100,
    },
    {
      objectKey: "attachments/app-1/REVIEW_SCREENSHOT/b.png",
      contentType: "image/png" as const,
      sizeBytes: 120,
    },
  ];

  it("ORDER_SUBMITTED → REVIEW_SUBMITTED 첫 제출: SubmittedPost + REVIEW_SCREENSHOT 첨부 생성", async () => {
    const dispatch = jest.fn();
    const postCreate = jest.fn(async () => ({ id: "post-1" }));
    const postUpdate = jest.fn(async () => ({ id: "post-1" }));
    const postFindUnique = jest.fn(async () => ({
      id: "post-1",
      reviewStatus: "PENDING",
    }));
    const attachmentCreateMany = jest.fn(async () => ({ count: 2 }));
    const attachmentDeleteMany = jest.fn(async () => ({ count: 0 }));
    const applicationUpdate = jest.fn(async () => ({ id: "app-1" }));
    const refreshedRow = makeApplicationRow({ status: "REVIEW_SUBMITTED" });
    const detailRow = makeApplicationRow({ status: "REVIEW_SUBMITTED" });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: "app-1",
        influencerId: "inf-1",
        status: "ORDER_SUBMITTED",
        subType: "QOO10",
        campaign: { category: "FAKE_PURCHASE" },
        posts: [],
      })
      .mockResolvedValueOnce(detailRow);
    const findUniqueOrThrow = jest.fn(async () => refreshedRow);
    const tx = {
      submittedPost: { create: postCreate, update: postUpdate },
      attachment: {
        deleteMany: attachmentDeleteMany,
        createMany: attachmentCreateMany,
      },
      campaignApplication: { update: applicationUpdate },
    };
    const prisma = {
      campaignApplication: {
        findUnique,
        findUniqueOrThrow,
        update: applicationUpdate,
      },
      submittedPost: { findUnique: postFindUnique },
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

    await svc.submitReview("inf-1", "app-1", "https://example.com/review", screenshots);

    expect(verifyAttachmentUploads).toHaveBeenCalledWith(
      screenshots,
      "attachments/",
    );
    expect(postCreate).toHaveBeenCalledTimes(1);
    expect(postUpdate).not.toHaveBeenCalled();
    const createArg = (postCreate.mock.calls[0] as unknown[])[0] as {
      data: { applicationId: string; subType: string; url: string; reviewStatus: string };
    };
    expect(createArg.data.applicationId).toBe("app-1");
    expect(createArg.data.subType).toBe("QOO10");
    expect(createArg.data.url).toBe("https://example.com/review");
    expect(createArg.data.reviewStatus).toBe("PENDING");

    expect(attachmentCreateMany).toHaveBeenCalledTimes(1);
    const attachmentArg = (attachmentCreateMany.mock.calls[0] as unknown[])[0] as {
      data: { kind: string; postId: string }[];
    };
    expect(attachmentArg.data).toHaveLength(2);
    expect(attachmentArg.data[0]?.kind).toBe("REVIEW_SCREENSHOT");
    expect(attachmentArg.data[0]?.postId).toBe("post-1");

    expect(applicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({ status: "REVIEW_SUBMITTED" }),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      "FAKE_PURCHASE_REVIEW_SUBMITTED",
      expect.objectContaining({ application: refreshedRow }),
    );
  });

  it("REVIEW_SUBMITTED + post REJECTED 재제출: 기존 첨부 삭제 후 post update", async () => {
    const dispatch = jest.fn();
    const postCreate = jest.fn(async () => ({ id: "post-1" }));
    const postUpdate = jest.fn(async () => ({ id: "post-1" }));
    const postFindUnique = jest.fn(async () => ({
      id: "post-1",
      reviewStatus: "PENDING",
    }));
    const attachmentCreateMany = jest.fn(async () => ({ count: 2 }));
    const attachmentDeleteMany = jest.fn(async () => ({ count: 2 }));
    const applicationUpdate = jest.fn(async () => ({ id: "app-1" }));
    const refreshedRow = makeApplicationRow({ status: "REVIEW_SUBMITTED" });
    const detailRow = makeApplicationRow({ status: "REVIEW_SUBMITTED" });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: "app-1",
        influencerId: "inf-1",
        status: "REVIEW_SUBMITTED",
        subType: "QOO10",
        campaign: { category: "FAKE_PURCHASE" },
        posts: [{ id: "post-1", reviewStatus: "REJECTED" }],
      })
      .mockResolvedValueOnce(detailRow);
    const findUniqueOrThrow = jest.fn(async () => refreshedRow);
    const tx = {
      submittedPost: { create: postCreate, update: postUpdate },
      attachment: {
        deleteMany: attachmentDeleteMany,
        createMany: attachmentCreateMany,
      },
      campaignApplication: { update: applicationUpdate },
    };
    const prisma = {
      campaignApplication: {
        findUnique,
        findUniqueOrThrow,
        update: applicationUpdate,
      },
      submittedPost: { findUnique: postFindUnique },
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    };
    const svc = makeService({
      prisma,
      dispatcher: { dispatch },
    });

    await svc.submitReview("inf-1", "app-1", "https://example.com/review-2", screenshots);

    expect(postCreate).not.toHaveBeenCalled();
    expect(postUpdate).toHaveBeenCalledTimes(1);
    const updateArg = (postUpdate.mock.calls[0] as unknown[])[0] as {
      where: { id: string };
      data: { url: string; reviewStatus: string; reviewedAt: null; reviewedById: null };
    };
    expect(updateArg.where).toEqual({ id: "post-1" });
    expect(updateArg.data.reviewStatus).toBe("PENDING");
    expect(updateArg.data.reviewedAt).toBeNull();
    expect(updateArg.data.reviewedById).toBeNull();
    expect(updateArg.data.url).toBe("https://example.com/review-2");

    expect(attachmentDeleteMany).toHaveBeenCalledWith({
      where: { postId: "post-1", kind: "REVIEW_SCREENSHOT" },
    });
    expect(attachmentCreateMany).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      "FAKE_PURCHASE_REVIEW_SUBMITTED",
      expect.objectContaining({ application: refreshedRow }),
    );
  });

  it("REVIEW_SUBMITTED + post PENDING 재제출 시도는 INVALID_TRANSITION", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "REVIEW_SUBMITTED",
          subType: "QOO10",
          campaign: { category: "FAKE_PURCHASE" },
          posts: [{ id: "post-1", reviewStatus: "PENDING" }],
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitReview("inf-1", "app-1", "https://example.com/review", screenshots),
    ).rejects.toThrow(/INVALID_TRANSITION|レビューを提出/);
  });

  it("SNS 카테고리는 CATEGORY_MISMATCH", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "ORDER_SUBMITTED",
          subType: "INSTAGRAM",
          campaign: { category: "SNS" },
          posts: [],
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitReview("inf-1", "app-1", "https://example.com/review", screenshots),
    ).rejects.toThrow(/CATEGORY_MISMATCH|買取レビュー/);
  });

  it("screenshots 2장 미만은 REVIEW_SCREENSHOTS_REQUIRED", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "ORDER_SUBMITTED",
          subType: "QOO10",
          campaign: { category: "FAKE_PURCHASE" },
          posts: [],
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitReview("inf-1", "app-1", "https://example.com/review", [screenshots[0]!]),
    ).rejects.toThrow(/REVIEW_SCREENSHOTS_REQUIRED|スクリーンショット/);
  });
});
