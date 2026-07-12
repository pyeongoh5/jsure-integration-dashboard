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
    ).rejects.toThrow(/CATEGORY_MISMATCH|가구매 리뷰/);
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
    ).rejects.toThrow(/INVALID_TRANSITION|주문 정보를 제출/);
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
    ).rejects.toThrow(/RECEIPT_REQUIRED|스크린샷/);
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

  function makeApplicationLookup(overrides: {
    status?: string;
    posts?: { id: string; reviewStatus: string }[];
    recruits?: { subType: string; subTypeOptions: string[] }[];
    category?: string;
    subType?: string;
  } = {}) {
    return {
      id: "app-1",
      influencerId: "inf-1",
      status: overrides.status ?? "ORDER_SUBMITTED",
      subType: overrides.subType ?? "QOO10",
      campaign: {
        category: overrides.category ?? "FAKE_PURCHASE",
        recruits: overrides.recruits ?? [
          { subType: "QOO10", subTypeOptions: [] },
        ],
      },
      posts: overrides.posts ?? [],
    };
  }

  function makeSubmitPrisma(lookup: unknown, opts: {
    postCreate?: jest.Mock;
    postUpdate?: jest.Mock;
    attachmentCreateMany?: jest.Mock;
    attachmentDeleteMany?: jest.Mock;
    applicationUpdate?: jest.Mock;
    refreshedRow?: unknown;
    detailRow?: unknown;
  } = {}) {
    const postCreate = opts.postCreate ?? jest.fn(async () => ({ id: "post-1" }));
    const postUpdate = opts.postUpdate ?? jest.fn(async () => ({ id: "post-1" }));
    const attachmentCreateMany =
      opts.attachmentCreateMany ?? jest.fn(async () => ({ count: 2 }));
    const attachmentDeleteMany =
      opts.attachmentDeleteMany ?? jest.fn(async () => ({ count: 0 }));
    const applicationUpdate =
      opts.applicationUpdate ?? jest.fn(async () => ({ id: "app-1" }));
    const refreshedRow =
      opts.refreshedRow ?? makeApplicationRow({ status: "REVIEW_SUBMITTED" });
    const detailRow =
      opts.detailRow ?? makeApplicationRow({ status: "REVIEW_SUBMITTED" });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(lookup)
      .mockResolvedValueOnce(detailRow);
    const findUniqueOrThrow = jest.fn(async () => refreshedRow);
    const postFindUnique = jest.fn(async () => ({
      id: "post-1",
      reviewStatus: "PENDING",
    }));
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
    return {
      prisma,
      postCreate,
      postUpdate,
      attachmentCreateMany,
      attachmentDeleteMany,
      applicationUpdate,
      refreshedRow,
    };
  }

  it("subTypeOptions=[] + reviewUrls={} 첫 제출 성공", async () => {
    const dispatch = jest.fn();
    const { prisma, postCreate, refreshedRow } = makeSubmitPrisma(
      makeApplicationLookup(),
    );
    const svc = makeService({ prisma, dispatcher: { dispatch } });

    await svc.submitReview("inf-1", "app-1", screenshots, {});

    expect(postCreate).toHaveBeenCalledTimes(1);
    const createArg = (postCreate.mock.calls[0] as unknown[])[0] as {
      data: {
        applicationId: string;
        subType: string;
        url: null;
        reviewStatus: string;
        submissionData: { reviewUrls: Record<string, string> };
      };
    };
    expect(createArg.data.url).toBeNull();
    expect(createArg.data.subType).toBe("QOO10");
    expect(createArg.data.submissionData.reviewUrls).toEqual({});
    expect(dispatch).toHaveBeenCalledWith(
      "FAKE_PURCHASE_REVIEW_SUBMITTED",
      expect.objectContaining({ application: refreshedRow }),
    );
  });

  it("subTypeOptions=['LIPS'] + reviewUrls={LIPS} 성공", async () => {
    const { prisma, postCreate } = makeSubmitPrisma(
      makeApplicationLookup({
        recruits: [{ subType: "QOO10", subTypeOptions: ["LIPS"] }],
      }),
    );
    const svc = makeService({ prisma });

    await svc.submitReview("inf-1", "app-1", screenshots, {
      LIPS: "https://lips.example.com/r/1",
    });

    const createArg = (postCreate.mock.calls[0] as unknown[])[0] as {
      data: { submissionData: { reviewUrls: Record<string, string> } };
    };
    expect(createArg.data.submissionData.reviewUrls).toEqual({
      LIPS: "https://lips.example.com/r/1",
    });
  });

  it("subTypeOptions=['LIPS'] + reviewUrls={} → REVIEW_URL_REQUIRED", async () => {
    const { prisma } = makeSubmitPrisma(
      makeApplicationLookup({
        recruits: [{ subType: "QOO10", subTypeOptions: ["LIPS"] }],
      }),
    );
    const svc = makeService({ prisma });

    await expect(
      svc.submitReview("inf-1", "app-1", screenshots, {}),
    ).rejects.toThrow(/REVIEW_URL_REQUIRED|리뷰 URL/);
  });

  it("subTypeOptions=['LIPS'] + reviewUrls={ATCOSME} → REVIEW_URL_NOT_REQUESTED", async () => {
    const { prisma } = makeSubmitPrisma(
      makeApplicationLookup({
        recruits: [{ subType: "QOO10", subTypeOptions: ["LIPS"] }],
      }),
    );
    const svc = makeService({ prisma });

    await expect(
      svc.submitReview("inf-1", "app-1", screenshots, {
        ATCOSME: "https://cosme.example.com/r/1",
      }),
    ).rejects.toThrow(/REVIEW_URL_NOT_REQUESTED|요구하지 않는/);
  });

  it("subTypeOptions=['LIPS','ATCOSME'] + reviewUrls 양쪽 성공", async () => {
    const { prisma, postCreate } = makeSubmitPrisma(
      makeApplicationLookup({
        recruits: [{ subType: "QOO10", subTypeOptions: ["LIPS", "ATCOSME"] }],
      }),
    );
    const svc = makeService({ prisma });

    await svc.submitReview("inf-1", "app-1", screenshots, {
      LIPS: "https://lips.example.com/r/1",
      ATCOSME: "https://cosme.example.com/r/1",
    });

    const createArg = (postCreate.mock.calls[0] as unknown[])[0] as {
      data: { submissionData: { reviewUrls: Record<string, string> } };
    };
    expect(createArg.data.submissionData.reviewUrls).toEqual({
      LIPS: "https://lips.example.com/r/1",
      ATCOSME: "https://cosme.example.com/r/1",
    });
  });

  it("REJECTED 재제출: submissionData 갱신 + attachment 재생성", async () => {
    const {
      prisma,
      postCreate,
      postUpdate,
      attachmentDeleteMany,
      attachmentCreateMany,
    } = makeSubmitPrisma(
      makeApplicationLookup({
        status: "REVIEW_SUBMITTED",
        posts: [{ id: "post-1", reviewStatus: "REJECTED" }],
        recruits: [{ subType: "QOO10", subTypeOptions: ["LIPS"] }],
      }),
      { attachmentDeleteMany: jest.fn(async () => ({ count: 2 })) },
    );
    const svc = makeService({ prisma });

    await svc.submitReview("inf-1", "app-1", screenshots, {
      LIPS: "https://lips.example.com/r/2",
    });

    expect(postCreate).not.toHaveBeenCalled();
    expect(postUpdate).toHaveBeenCalledTimes(1);
    const updateArg = (postUpdate.mock.calls[0] as unknown[])[0] as {
      where: { id: string };
      data: {
        url: null;
        submissionData: { reviewUrls: Record<string, string> };
        reviewStatus: string;
        reviewedAt: null;
        reviewedById: null;
      };
    };
    expect(updateArg.where).toEqual({ id: "post-1" });
    expect(updateArg.data.url).toBeNull();
    expect(updateArg.data.submissionData.reviewUrls).toEqual({
      LIPS: "https://lips.example.com/r/2",
    });
    expect(updateArg.data.reviewedAt).toBeNull();
    expect(updateArg.data.reviewedById).toBeNull();
    expect(attachmentDeleteMany).toHaveBeenCalledWith({
      where: { postId: "post-1", kind: "REVIEW_SCREENSHOT" },
    });
    expect(attachmentCreateMany).toHaveBeenCalledTimes(1);
  });

  it("REVIEW_SUBMITTED + post PENDING 재제출 시도는 INVALID_TRANSITION", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () =>
          makeApplicationLookup({
            status: "REVIEW_SUBMITTED",
            posts: [{ id: "post-1", reviewStatus: "PENDING" }],
          }),
        ),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitReview("inf-1", "app-1", screenshots, {}),
    ).rejects.toThrow(/INVALID_TRANSITION|리뷰를 제출/);
  });

  it("SNS 카테고리는 CATEGORY_MISMATCH", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () =>
          makeApplicationLookup({
            category: "SNS",
            subType: "INSTAGRAM",
            recruits: [{ subType: "INSTAGRAM", subTypeOptions: [] }],
          }),
        ),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitReview("inf-1", "app-1", screenshots, {}),
    ).rejects.toThrow(/CATEGORY_MISMATCH|가구매 리뷰/);
  });

  it("screenshots 2장 미만은 REVIEW_SCREENSHOTS_REQUIRED", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => makeApplicationLookup()),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitReview("inf-1", "app-1", [screenshots[0]!], {}),
    ).rejects.toThrow(/REVIEW_SCREENSHOTS_REQUIRED|스크린샷/);
  });
});
