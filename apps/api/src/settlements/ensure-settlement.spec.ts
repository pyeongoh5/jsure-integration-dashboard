import { ensureSettlementForApplication } from "./ensure-settlement";

type ApplicationSelect = {
  submissionReviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  subTypes: string[];
  options: { subType: string; option: string }[];
  posts: { subType: string; insightSubmittedAt: Date | null }[];
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
      accountHolderKana: string;
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

function makeStubPrisma(application: ApplicationSelect | null) {
  const upserts: unknown[] = [];
  const prisma = {
    campaignApplication: {
      findUnique: async () =>
        application
          ? { influencer: { bankAccount: null }, ...application }
          : null,
    },
    settlement: {
      upsert: async (args: unknown) => {
        upserts.push(args);
        return null;
      },
    },
  } as never;
  return { prisma, upserts };
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
          accountHolderKana: "ヤマダ タロウ",
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
