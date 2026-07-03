import { ensureSettlementForPost } from "./ensure-settlement";

type PostSelect = {
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  insightSubmittedAt: Date | null;
  subType: string;
  applicationId: string;
  application: {
    campaignId: string;
    campaign: {
      category: "SNS" | "FAKE_PURCHASE";
      rewardJpy: number;
      recruits: { subType: string; insightRequired: boolean; productPriceJpy: number | null }[];
    };
  };
};

function makeStubPrisma(post: PostSelect | null) {
  const upserts: unknown[] = [];
  const prisma = {
    submittedPost: { findUnique: async () => post },
    settlement: {
      upsert: async (args: unknown) => {
        upserts.push(args);
        return null;
      },
    },
  } as never;
  return { prisma, upserts };
}

describe("ensureSettlementForPost — FAKE_PURCHASE", () => {
  it("승인된 가구매 리뷰: reward + productPriceJpy 합계로 settlement upsert", async () => {
    const { prisma, upserts } = makeStubPrisma({
      reviewStatus: "APPROVED",
      insightSubmittedAt: null,
      subType: "QOO10",
      applicationId: "app-1",
      application: {
        campaignId: "c-1",
        campaign: {
          category: "FAKE_PURCHASE",
          rewardJpy: 5000,
          recruits: [
            { subType: "QOO10", insightRequired: false, productPriceJpy: 3000 },
          ],
        },
      },
    });
    await ensureSettlementForPost(prisma, "post-1");
    expect(upserts).toHaveLength(1);
    const args = upserts[0] as { create: { amountJpy: number; rewardAmountJpy: number; productRefundJpy: number } };
    expect(args.create.amountJpy).toBe(8000);
    expect(args.create.rewardAmountJpy).toBe(5000);
    expect(args.create.productRefundJpy).toBe(3000);
  });

  it("가구매 리뷰가 아직 PENDING 이면 settlement 미생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      reviewStatus: "PENDING",
      insightSubmittedAt: null,
      subType: "QOO10",
      applicationId: "app-1",
      application: {
        campaignId: "c-1",
        campaign: {
          category: "FAKE_PURCHASE",
          rewardJpy: 5000,
          recruits: [
            { subType: "QOO10", insightRequired: false, productPriceJpy: 3000 },
          ],
        },
      },
    });
    await ensureSettlementForPost(prisma, "post-1");
    expect(upserts).toHaveLength(0);
  });
});

describe("ensureSettlementForPost — SNS (기존 동작 유지)", () => {
  it("insightRequired=true 이고 인사이트 미제출이면 미생성", async () => {
    const { prisma, upserts } = makeStubPrisma({
      reviewStatus: "APPROVED",
      insightSubmittedAt: null,
      subType: "INSTAGRAM",
      applicationId: "app-1",
      application: {
        campaignId: "c-1",
        campaign: {
          category: "SNS",
          rewardJpy: 5000,
          recruits: [
            { subType: "INSTAGRAM", insightRequired: true, productPriceJpy: null },
          ],
        },
      },
    });
    await ensureSettlementForPost(prisma, "post-1");
    expect(upserts).toHaveLength(0);
  });
});
