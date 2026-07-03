import type { PrismaService } from "../prisma/prisma.service";

/**
 * SubmittedPost 가 승인(APPROVED) 되고 정산 가능 상태가 되면 Settlement(PENDING)
 * 를 멱등하게 생성한다.
 *
 * 카테고리별 조건:
 * - SNS: insightRequired=true 이면 승인 + 인사이트 제출 둘 다 필요. false 면 승인만.
 *        정산액 = campaign.rewardJpy (productRefundJpy=0)
 * - FAKE_PURCHASE: 승인만 되면 즉시 생성.
 *        정산액 = campaign.rewardJpy + recruit.productPriceJpy
 */
export async function ensureSettlementForPost(
  prisma: PrismaService,
  postId: string,
): Promise<void> {
  const post = await prisma.submittedPost.findUnique({
    where: { id: postId },
    select: {
      reviewStatus: true,
      insightSubmittedAt: true,
      subType: true,
      applicationId: true,
      application: {
        select: {
          campaignId: true,
          campaign: {
            select: {
              category: true,
              rewardJpy: true,
              recruits: {
                select: {
                  subType: true,
                  insightRequired: true,
                  productPriceJpy: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!post) return;
  if (post.reviewStatus !== "APPROVED") return;

  const category = post.application.campaign.category;
  const recruit = post.application.campaign.recruits.find(
    (r) => r.subType === post.subType,
  );

  if (category === "FAKE_PURCHASE") {
    const productRefundJpy = recruit?.productPriceJpy ?? 0;
    const rewardAmountJpy = post.application.campaign.rewardJpy;
    const amountJpy = rewardAmountJpy + productRefundJpy;
    await prisma.settlement.upsert({
      where: { postId },
      create: {
        postId,
        amountJpy,
        rewardAmountJpy,
        productRefundJpy,
        status: "PENDING",
      },
      update: {},
    });
    return;
  }

  // SNS
  const insightRequired = recruit?.insightRequired ?? true;
  if (insightRequired && post.insightSubmittedAt === null) return;
  const rewardAmountJpy = post.application.campaign.rewardJpy;
  await prisma.settlement.upsert({
    where: { postId },
    create: {
      postId,
      amountJpy: rewardAmountJpy,
      rewardAmountJpy,
      productRefundJpy: 0,
      status: "PENDING",
    },
    update: {},
  });
}
