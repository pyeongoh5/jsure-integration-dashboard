import type { PrismaService } from "../prisma/prisma.service";

/**
 * 투고(SubmittedPost)가 승인(APPROVED) 되고 정산 가능 상태가 되면 정산(Settlement,
 * PENDING)을 멱등하게 생성한다.
 *
 * 캠페인의 SNS 슬롯 설정(insightRequired)에 따라 정산 조건이 갈린다.
 * - insightRequired=true (기본): 승인 + 인사이트 제출 둘 다 필요
 * - insightRequired=false: 승인만 되면 충분
 *
 * 인사이트 제출 시점(upsertInsight)과 투고 승인 시점(approveSubmittedPost)
 * 어느 쪽에서 호출해도 안전하며, 이미 정산이 있으면 그대로 둔다.
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
      application: {
        select: {
          campaign: {
            select: {
              rewardJpy: true,
              recruits: {
                select: { subType: true, insightRequired: true },
              },
            },
          },
        },
      },
    },
  });
  if (!post) return;
  if (post.reviewStatus !== "APPROVED") return;
  const insightRequired =
    post.application.campaign.recruits.find(
      (recruit) => recruit.subType === post.subType,
    )?.insightRequired ?? true;
  if (insightRequired && post.insightSubmittedAt === null) return;
  await prisma.settlement.upsert({
    where: { postId },
    create: {
      postId,
      amountJpy: post.application.campaign.rewardJpy,
      rewardAmountJpy: post.application.campaign.rewardJpy,
      productRefundJpy: 0,
      status: "PENDING",
    },
    update: {},
  });
}
