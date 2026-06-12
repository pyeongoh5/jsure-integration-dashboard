import type { PrismaService } from "../prisma/prisma.service";

/**
 * 투고(SubmittedPost)가 승인(APPROVED) 되고 인사이트까지 제출된 경우에만
 * 정산(Settlement, PENDING)을 멱등하게 생성한다.
 *
 * 인사이트 제출 시점(upsertInsight)과 투고 승인 시점(approveSubmittedPost)
 * 어느 쪽에서 호출해도 안전하며, 이미 정산이 있으면 그대로 둔다.
 * 두 조건 중 하나라도 미충족이면 아무것도 하지 않는다.
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
      application: {
        select: { campaign: { select: { rewardJpy: true } } },
      },
    },
  });
  if (!post) return;
  if (post.reviewStatus !== "APPROVED" || post.insightSubmittedAt === null) {
    return;
  }
  await prisma.settlement.upsert({
    where: { postId },
    create: {
      postId,
      amountJpy: post.application.campaign.rewardJpy,
      status: "PENDING",
    },
    update: {},
  });
}
