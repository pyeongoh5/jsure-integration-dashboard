import type { PrismaService } from "../prisma/prisma.service";

/** 응모 기준 보수 금액: UNIFIED 는 고정, PER_SUBTYPE 은 참여 서브타입 합산. */
export function applicationRewardJpy(
  campaign: {
    rewardType: "UNIFIED" | "PER_SUBTYPE";
    rewardJpy: number;
    recruits: { subType: string; rewardJpy: number | null }[];
  },
  subTypes: string[],
): number {
  if (campaign.rewardType !== "PER_SUBTYPE") return campaign.rewardJpy;
  return campaign.recruits
    .filter((recruit) => subTypes.includes(recruit.subType))
    .reduce((sum, recruit) => sum + (recruit.rewardJpy ?? 0), 0);
}

/** 응모 기준 정산 금액(보수 + 가구매 상품 환급). */
export function settlementAmounts(
  campaign: {
    category: "SNS" | "FAKE_PURCHASE" | "SIMPLE_REVIEW";
    rewardType: "UNIFIED" | "PER_SUBTYPE";
    rewardJpy: number;
    recruits: {
      subType: string;
      rewardJpy: number | null;
      productPriceJpy: number | null;
    }[];
  },
  subTypes: string[],
): { rewardAmountJpy: number; productRefundJpy: number } {
  const rewardAmountJpy = applicationRewardJpy(campaign, subTypes);
  const productRefundJpy =
    campaign.category === "FAKE_PURCHASE"
      ? campaign.recruits
          .filter((recruit) => subTypes.includes(recruit.subType))
          .reduce((sum, recruit) => sum + (recruit.productPriceJpy ?? 0), 0)
      : 0;
  return { rewardAmountJpy, productRefundJpy };
}

/**
 * 응모(Application)의 제출물이 승인(APPROVED)되고 정산 가능 상태가 되면
 * Settlement(PENDING) 를 멱등하게 생성한다. 정산은 응모 단위 1건이다.
 *
 * 카테고리별 조건:
 * - SNS: insightRequired=true 인 참여 서브타입의 인사이트가 모두 제출돼야 한다.
 * - FAKE_PURCHASE / SIMPLE_REVIEW: 제출물 승인만 되면 즉시 생성.
 *
 * 정산액:
 * - rewardAmountJpy = UNIFIED 면 campaign.rewardJpy, PER_SUBTYPE 면 참여 서브타입별 recruit.rewardJpy 합산
 * - productRefundJpy = 가구매(FAKE_PURCHASE)만 recruit.productPriceJpy 합산
 */
export async function ensureSettlementForApplication(
  prisma: PrismaService,
  applicationId: string,
): Promise<void> {
  const application = await prisma.campaignApplication.findUnique({
    where: { id: applicationId },
    select: {
      submissionReviewStatus: true,
      subTypes: true,
      posts: { select: { subType: true, insightSubmittedAt: true } },
      campaign: {
        select: {
          category: true,
          rewardType: true,
          rewardJpy: true,
          recruits: {
            select: {
              subType: true,
              insightRequired: true,
              productPriceJpy: true,
              rewardJpy: true,
            },
          },
        },
      },
    },
  });
  if (!application) return;
  if (application.submissionReviewStatus !== "APPROVED") return;

  const { campaign } = application;
  const participatingRecruits = campaign.recruits.filter((recruit) =>
    application.subTypes.includes(recruit.subType),
  );

  if (campaign.category === "SNS") {
    const insightMissing = participatingRecruits.some((recruit) => {
      if (!recruit.insightRequired) return false;
      const post = application.posts.find(
        (candidate) => candidate.subType === recruit.subType,
      );
      return !post || post.insightSubmittedAt === null;
    });
    if (insightMissing) return;
  }

  const { rewardAmountJpy, productRefundJpy } = settlementAmounts(
    campaign,
    application.subTypes,
  );

  await prisma.settlement.upsert({
    where: { applicationId },
    create: {
      applicationId,
      amountJpy: rewardAmountJpy + productRefundJpy,
      rewardAmountJpy,
      productRefundJpy,
      status: "PENDING",
    },
    update: {},
  });
}
