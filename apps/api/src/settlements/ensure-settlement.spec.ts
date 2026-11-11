import {
  ensureSettlementForApplication,
  insightMissingForSettlement,
} from "./ensure-settlement";

type ApplicationSelect = {
  submissionReviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  subTypes: string[];
  options: { subType: string; option: string }[];
  posts: { subType: string; insightSubmittedAt: Date | null }[];
  /** 가구매 실결제 금액 — 생략 시 도입 전 응모(null 폴백). */
  actualPaymentJpy?: number | null;
  /** 기존 정산 존재 여부 — 생략 시 없음. */
  settlement?: { id: string } | null;
  /** 계좌 스냅샷용 — 생략 시 계좌 미등록. */
  influencer?: {
    bankAccount: {
      bankCode: string;
      bankName: string;
      branchName: string;
      branchCode: string;
      accountNumber: string;
      accountHolder: string;
    } | null;
  };
  campaign: {
    category: "SNS" | "FAKE_PURCHASE" | "SIMPLE_REVIEW";
    rewardType: "UNIFIED" | "PER_SUBTYPE";
    rewardJpy: number;
    recruits: {
      subType: string;
      insightRequired: boolean;
      productPriceJpy: number | null;
      rewardJpy: number | null;
      options?: { option: string; rewardJpy: number | null }[];
    }[];
  };
};

function makeStubPrisma(
  application: ApplicationSelect | null,
  createdSettlementId = "settle-created",
) {
  const upserts: unknown[] = [];
  /** 응모를 COMPLETED 로 넘기는 updateMany 호출 기록. */
  const applicationUpdates: unknown[] = [];
  const prisma = {
    campaignApplication: {
      findUnique: async () =>
        application
          ? { influencer: { bankAccount: null }, ...application }
          : null,
      updateMany: async (args: unknown) => {
        applicationUpdates.push(args);
        return { count: 1 };
      },
    },
    settlement: {
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: createdSettlementId };
      },
    },
  } as never;
  return { prisma, upserts, applicationUpdates };
}

type UpsertArgs = {
  create: {
    amountJpy: number;
    rewardAmountJpy: number;
    productRefundJpy: number;
    status: "PENDING" | "COMPLETED";
    completedAt: Date | null;
    bankCode: string | null;
    accountNumber: string | null;
  };
};

describe("ensureSettlementForApplication — FAKE_PURCHASE", () => {
  it("승인된 가구매 리뷰: reward + productPriceJpy 합계로 settlement upsert", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["QOO10"],
      options: [],
      posts: [{ subType: "QOO10", insightSubmittedAt: null }],
      campaign: {
        category: "FAKE_PURCHASE",
        rewardType: "UNIFIED",
        rewardJpy: 5000,
        recruits: [
          {
            subType: "QOO10",
            insightRequired: false,
            productPriceJpy: 3000,
            rewardJpy: null,
          },
        ],
      },
    });
    const { autoCompleted } = await ensureSettlementForApplication(
      prisma,
      "app-1",
    );
    expect(upserts).toHaveLength(1);
    const args = upserts[0] as UpsertArgs;
    expect(args.create.amountJpy).toBe(8000);
    expect(args.create.rewardAmountJpy).toBe(5000);
    expect(args.create.productRefundJpy).toBe(3000);
    expect(args.create.status).toBe("PENDING");
    expect(autoCompleted).toBe(false);
  });

  it("가구매 리뷰가 아직 PENDING 이면 settlement 미생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "PENDING",
      subTypes: ["QOO10"],
      options: [],
      posts: [{ subType: "QOO10", insightSubmittedAt: null }],
      campaign: {
        category: "FAKE_PURCHASE",
        rewardType: "UNIFIED",
        rewardJpy: 5000,
        recruits: [
          {
            subType: "QOO10",
            insightRequired: false,
            productPriceJpy: 3000,
            rewardJpy: null,
          },
        ],
      },
    });
    await ensureSettlementForApplication(prisma, "app-1");
    expect(upserts).toHaveLength(0);
  });
});

describe("ensureSettlementForApplication — createdSettlementId", () => {
  const approvedFakePurchase: ApplicationSelect = {
    submissionReviewStatus: "APPROVED",
    subTypes: ["QOO10"],
    options: [],
    posts: [],
    campaign: {
      category: "FAKE_PURCHASE",
      rewardType: "UNIFIED",
      rewardJpy: 3000,
      recruits: [
        {
          subType: "QOO10",
          insightRequired: false,
          productPriceJpy: 1000,
          rewardJpy: null,
        },
      ],
    },
  };

  it("신규 생성 시 upsert 가 만든 정산 id 를 반환한다", async () => {
    const { prisma } = makeStubPrisma(approvedFakePurchase, "settle-new");

    const result = await ensureSettlementForApplication(prisma, "app-1");

    expect(result.createdSettlementId).toBe("settle-new");
    expect(result.autoCompleted).toBe(false);
  });

  it("이미 정산이 있으면 upsert 없이 createdSettlementId 는 null", async () => {
    const { prisma, upserts } = makeStubPrisma({
      ...approvedFakePurchase,
      settlement: { id: "settle-existing" },
    });

    const result = await ensureSettlementForApplication(prisma, "app-1");

    expect(result.createdSettlementId).toBeNull();
    expect(upserts).toHaveLength(0);
  });

  it("조건 미충족(제출물 미승인)이면 createdSettlementId 는 null", async () => {
    const { prisma } = makeStubPrisma({
      ...approvedFakePurchase,
      submissionReviewStatus: "PENDING",
    });

    const result = await ensureSettlementForApplication(prisma, "app-1");

    expect(result.createdSettlementId).toBeNull();
  });

  it("응모가 없으면 createdSettlementId 는 null", async () => {
    const { prisma } = makeStubPrisma(null);

    const result = await ensureSettlementForApplication(prisma, "app-1");

    expect(result.createdSettlementId).toBeNull();
  });
});

describe("ensureSettlementForApplication — SNS", () => {
  const SNS_RECRUITS = [
    {
      subType: "INSTAGRAM",
      insightRequired: true,
      productPriceJpy: null,
      rewardJpy: 5000,
    },
    {
      subType: "X",
      insightRequired: true,
      productPriceJpy: null,
      rewardJpy: 3000,
    },
  ];

  it("insightRequired=true 서브타입 중 하나라도 인사이트 미제출이면 미생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["INSTAGRAM", "X"],
      options: [],
      posts: [
        { subType: "INSTAGRAM", insightSubmittedAt: new Date() },
        { subType: "X", insightSubmittedAt: null },
      ],
      campaign: {
        category: "SNS",
        rewardType: "PER_SUBTYPE",
        rewardJpy: 0,
        recruits: SNS_RECRUITS,
      },
    });
    await ensureSettlementForApplication(prisma, "app-1");
    expect(upserts).toHaveLength(0);
  });

  it("PER_SUBTYPE: 참여 서브타입 보수 합산으로 settlement 생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["INSTAGRAM", "X"],
      options: [],
      posts: [
        { subType: "INSTAGRAM", insightSubmittedAt: new Date() },
        { subType: "X", insightSubmittedAt: new Date() },
      ],
      campaign: {
        category: "SNS",
        rewardType: "PER_SUBTYPE",
        rewardJpy: 0,
        recruits: SNS_RECRUITS,
      },
    });
    await ensureSettlementForApplication(prisma, "app-1");
    expect(upserts).toHaveLength(1);
    const args = upserts[0] as UpsertArgs;
    expect(args.create.amountJpy).toBe(8000);
    expect(args.create.rewardAmountJpy).toBe(8000);
    expect(args.create.productRefundJpy).toBe(0);
  });

  it("옵션별 보수 분리: 선택 옵션(REELS)의 보수로 합산", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["INSTAGRAM", "X"],
      options: [{ subType: "INSTAGRAM", option: "REELS" }],
      posts: [
        { subType: "INSTAGRAM", insightSubmittedAt: new Date() },
        { subType: "X", insightSubmittedAt: new Date() },
      ],
      campaign: {
        category: "SNS",
        rewardType: "PER_SUBTYPE",
        rewardJpy: 0,
        recruits: [
          {
            subType: "INSTAGRAM",
            insightRequired: true,
            productPriceJpy: null,
            // 보수 분리 시 부모 보수는 null
            rewardJpy: null,
            options: [
              { option: "FEED", rewardJpy: 5000 },
              { option: "REELS", rewardJpy: 8000 },
            ],
          },
          {
            subType: "X",
            insightRequired: true,
            productPriceJpy: null,
            rewardJpy: 3000,
          },
        ],
      },
    });
    await ensureSettlementForApplication(prisma, "app-1");
    expect(upserts).toHaveLength(1);
    const args = upserts[0] as UpsertArgs;
    // REELS 8000 + X 3000
    expect(args.create.rewardAmountJpy).toBe(11000);
    expect(args.create.amountJpy).toBe(11000);
  });

  it("총액 0원: PENDING 대신 COMPLETED 로 즉시 완료 생성 (autoCompleted)", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["INSTAGRAM"],
      options: [],
      posts: [{ subType: "INSTAGRAM", insightSubmittedAt: new Date() }],
      campaign: {
        category: "SNS",
        rewardType: "PER_SUBTYPE",
        rewardJpy: 0,
        recruits: [
          {
            subType: "INSTAGRAM",
            insightRequired: true,
            productPriceJpy: null,
            rewardJpy: 0,
          },
        ],
      },
    });
    const { autoCompleted } = await ensureSettlementForApplication(
      prisma,
      "app-1",
    );
    expect(autoCompleted).toBe(true);
    expect(upserts).toHaveLength(1);
    const args = upserts[0] as UpsertArgs;
    expect(args.create.amountJpy).toBe(0);
    expect(args.create.status).toBe("COMPLETED");
    expect(args.create.completedAt).toBeInstanceOf(Date);
  });

  it("이미 정산이 존재하면 재호출해도 upsert 없이 autoCompleted=false", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["INSTAGRAM"],
      options: [],
      settlement: { id: "settle-1" },
      posts: [{ subType: "INSTAGRAM", insightSubmittedAt: new Date() }],
      campaign: {
        category: "SNS",
        rewardType: "PER_SUBTYPE",
        rewardJpy: 0,
        recruits: [
          {
            subType: "INSTAGRAM",
            insightRequired: true,
            productPriceJpy: null,
            rewardJpy: 0,
          },
        ],
      },
    });
    const { autoCompleted } = await ensureSettlementForApplication(
      prisma,
      "app-1",
    );
    expect(autoCompleted).toBe(false);
    expect(upserts).toHaveLength(0);
  });

  it("UNIFIED: 참여 서브타입 수와 무관하게 campaign.rewardJpy 로 생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["INSTAGRAM", "X"],
      options: [],
      posts: [
        { subType: "INSTAGRAM", insightSubmittedAt: new Date() },
        { subType: "X", insightSubmittedAt: new Date() },
      ],
      campaign: {
        category: "SNS",
        rewardType: "UNIFIED",
        rewardJpy: 10000,
        recruits: SNS_RECRUITS.map((recruit) => ({
          ...recruit,
          rewardJpy: null,
        })),
      },
    });
    await ensureSettlementForApplication(prisma, "app-1");
    expect(upserts).toHaveLength(1);
    const args = upserts[0] as UpsertArgs;
    expect(args.create.amountJpy).toBe(10000);
  });

  it("정산 생성 시점의 계좌를 스냅샷으로 저장", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["INSTAGRAM", "X"],
      options: [],
      posts: [
        { subType: "INSTAGRAM", insightSubmittedAt: new Date() },
        { subType: "X", insightSubmittedAt: new Date() },
      ],
      influencer: {
        bankAccount: {
          bankCode: "0001",
          bankName: "みずほ銀行",
          branchName: "本店",
          branchCode: "001",
          accountNumber: "1234567",
          accountHolder: "ヤマダ タロウ",
        },
      },
      campaign: {
        category: "SNS",
        rewardType: "UNIFIED",
        rewardJpy: 10000,
        recruits: SNS_RECRUITS.map((recruit) => ({
          ...recruit,
          rewardJpy: null,
        })),
      },
    });
    await ensureSettlementForApplication(prisma, "app-1");
    const args = upserts[0] as UpsertArgs;
    expect(args.create.bankCode).toBe("0001");
    expect(args.create.accountNumber).toBe("1234567");
  });

  it("계좌 미등록이면 스냅샷은 null 로 생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      submissionReviewStatus: "APPROVED",
      subTypes: ["INSTAGRAM", "X"],
      options: [],
      posts: [
        { subType: "INSTAGRAM", insightSubmittedAt: new Date() },
        { subType: "X", insightSubmittedAt: new Date() },
      ],
      campaign: {
        category: "SNS",
        rewardType: "UNIFIED",
        rewardJpy: 10000,
        recruits: SNS_RECRUITS.map((recruit) => ({
          ...recruit,
          rewardJpy: null,
        })),
      },
    });
    await ensureSettlementForApplication(prisma, "app-1");
    const args = upserts[0] as UpsertArgs;
    expect(args.create.bankCode).toBeNull();
    expect(args.create.accountNumber).toBeNull();
  });
});

describe("ensureSettlementForApplication — 가구매 환급액 3단 폴백", () => {
  const fakePurchase = (
    actualPaymentJpy?: number | null,
  ): ApplicationSelect => ({
    submissionReviewStatus: "APPROVED",
    subTypes: ["QOO10"],
    options: [],
    posts: [],
    actualPaymentJpy,
    campaign: {
      category: "FAKE_PURCHASE",
      rewardType: "UNIFIED",
      rewardJpy: 1000,
      recruits: [
        {
          subType: "QOO10",
          insightRequired: false,
          productPriceJpy: 3000,
          rewardJpy: null,
        },
      ],
    },
  });

  async function refundOf(
    application: ApplicationSelect,
    override?: number,
  ): Promise<number> {
    const { prisma, upserts } = makeStubPrisma(application);
    await ensureSettlementForApplication(prisma, "app-1", override);
    return (upserts[0] as UpsertArgs).create.productRefundJpy;
  }

  it("운영자 조정액이 있으면 그 값으로 환급한다", async () => {
    expect(await refundOf(fakePurchase(2500), 2300)).toBe(2300);
  });

  it("조정이 없으면 인플루언서가 제출한 실결제 금액으로 환급한다", async () => {
    expect(await refundOf(fakePurchase(2500))).toBe(2500);
  });

  it("실결제 금액이 없는(도입 전) 응모는 캠페인 상품가로 폴백한다", async () => {
    expect(await refundOf(fakePurchase(null))).toBe(3000);
  });

  // 0엔 조정은 "조정하지 않음"이 아니다 — 전액 포인트 결제 등으로 환급 0 이 될 수 있다.
  it("운영자가 0엔으로 조정하면 제출값이 아니라 0 이 적용된다", async () => {
    expect(await refundOf(fakePurchase(2500), 0)).toBe(0);
  });

  it("가구매가 아니면 실결제 금액이 있어도 환급은 0 이다", async () => {
    const application = fakePurchase(2500);
    application.campaign.category = "SIMPLE_REVIEW";
    expect(await refundOf(application)).toBe(0);
  });
});

describe("정산 완료 시 응모 상태 전이", () => {
  const zeroYenFakePurchase: ApplicationSelect = {
    submissionReviewStatus: "APPROVED",
    subTypes: ["QOO10"],
    options: [],
    posts: [],
    actualPaymentJpy: 0,
    campaign: {
      category: "FAKE_PURCHASE",
      rewardType: "UNIFIED",
      rewardJpy: 0,
      recruits: [
        {
          subType: "QOO10",
          insightRequired: false,
          productPriceJpy: 0,
          rewardJpy: null,
        },
      ],
    },
  };

  it("0엔 자동완료면 응모도 COMPLETED 로 넘긴다", async () => {
    const { prisma, applicationUpdates } = makeStubPrisma(zeroYenFakePurchase);
    const { autoCompleted } = await ensureSettlementForApplication(
      prisma,
      "app-1",
    );
    expect(autoCompleted).toBe(true);
    expect(applicationUpdates).toHaveLength(1);
    const args = applicationUpdates[0] as {
      where: { id: { in: string[] }; status: { in: string[] } };
      data: { status: string; completedAt: Date };
    };
    expect(args.where.id.in).toEqual(["app-1"]);
    expect(args.data.status).toBe("COMPLETED");
    // 반려·취소된 건까지 휩쓸지 않도록 진행 구간으로 한정한다.
    expect(args.where.status.in).not.toContain("CANCELLED");
    expect(args.where.status.in).not.toContain("REJECTED");
  });

  it("정산 대기(PENDING)면 응모 상태를 건드리지 않는다", async () => {
    const pendingSettlement: ApplicationSelect = {
      ...zeroYenFakePurchase,
      actualPaymentJpy: 3000,
      campaign: { ...zeroYenFakePurchase.campaign, rewardJpy: 1000 },
    };
    const { prisma, applicationUpdates } = makeStubPrisma(pendingSettlement);
    const { autoCompleted } = await ensureSettlementForApplication(
      prisma,
      "app-1",
    );
    expect(autoCompleted).toBe(false);
    expect(applicationUpdates).toHaveLength(0);
  });
});

describe("insightMissingForSettlement", () => {
  const application = (insightRequired: boolean) => ({
    subTypes: ["INSTAGRAM"],
    posts: [{ subType: "INSTAGRAM", insightSubmittedAt: null }],
    campaign: { recruits: [{ subType: "INSTAGRAM", insightRequired }] },
  });

  it("insightRequired 인 서브타입의 인사이트가 없으면 막힌 것으로 본다", () => {
    expect(insightMissingForSettlement(application(true))).toBe(true);
  });

  // 모집 후 insightRequired 를 해제한 캠페인. 정산은 진행되므로 독촉도 멈춰야 한다.
  it("insightRequired 를 해제하면 인사이트가 없어도 막지 않는다", () => {
    expect(insightMissingForSettlement(application(false))).toBe(false);
  });

  it("참여하지 않은 서브타입의 insightRequired 는 무시한다", () => {
    expect(
      insightMissingForSettlement({
        subTypes: ["INSTAGRAM"],
        posts: [{ subType: "INSTAGRAM", insightSubmittedAt: new Date() }],
        campaign: {
          recruits: [
            { subType: "INSTAGRAM", insightRequired: true },
            { subType: "TIKTOK", insightRequired: true },
          ],
        },
      }),
    ).toBe(false);
  });
});
