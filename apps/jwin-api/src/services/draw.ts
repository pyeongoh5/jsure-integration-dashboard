import { getPrisma, EntryResult, Prisma } from '@jsure/jwin-db';
import { dateJst } from '@jsure/jwin-shared';

/**
 * 인스턴트윈 추첨 (확정 정책: 확률 + 원자적 재고 차감)
 *
 * - 응모는 캠페인×일(JST) 1회 — Entry unique 제약으로 강제
 * - 경품은 tier 순으로 순차 판정: rand() < winProbability 이고
 *   조건부 UPDATE(remainingQty > 0)가 성공하면 당첨 후보(WIN_PENDING)
 * - 당첨 후보는 당일 내 팔로우+리포스트 검증을 통과하면 확정 (D-2 개정:
 *   미이행이어도 몰수·재고 회수하지 않고 그대로 미이행 종료)
 * - dailyWinCap: 캠페인별 일별 당첨 상한 (설정 시)
 */

export type DrawOutcome =
  | { kind: 'already_entered' }
  | { kind: 'no_post_today' }
  | { kind: 'lose'; entryId: string }
  | { kind: 'win_pending'; entryId: string; winnerId: string; prizeId: string; prizeName: string };

export async function draw(
  campaignId: string,
  userId: string,
  rng: () => number = Math.random,
): Promise<DrawOutcome> {
  const prisma = getPrisma();
  const today = dateJst();
  const now = new Date();

  const campaign = await prisma.brandCampaign.findFirst({
    where: { id: campaignId, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
    include: { prizes: { orderBy: { tier: 'asc' } } },
  });
  if (!campaign) return { kind: 'no_post_today' };

  // D-1: 당일 게시된 캠페인 포스트가 응모 대상
  const post = await prisma.campaignPost.findFirst({
    where: { campaignId, dateJst: today, status: 'POSTED' },
  });
  if (!post) return { kind: 'no_post_today' };

  // 일별 당첨 상한
  if (campaign.dailyWinCap != null) {
    const winsToday = await prisma.entry.count({
      where: {
        campaignId,
        dateJst: today,
        result: { in: [EntryResult.WIN_PENDING, EntryResult.WIN_CONFIRMED] },
      },
    });
    if (winsToday >= campaign.dailyWinCap) {
      return createEntry(campaignId, userId, post.id, today, EntryResult.LOSE);
    }
  }

  // 확률 판정 → 원자적 재고 차감
  for (const prize of campaign.prizes) {
    if (prize.remainingQty <= 0) continue;
    if (rng() >= prize.winProbability) continue;

    const decremented = await prisma.prize.updateMany({
      where: { id: prize.id, remainingQty: { gt: 0 } },
      data: { remainingQty: { decrement: 1 } },
    });
    if (decremented.count === 0) continue; // 동시 응모로 소진 → 다음 경품

    const outcome = await createEntry(campaignId, userId, post.id, today, EntryResult.WIN_PENDING);
    if (outcome.kind === 'already_entered') {
      // 유니크 제약 충돌 → 차감 롤백
      await prisma.prize.update({
        where: { id: prize.id },
        data: { remainingQty: { increment: 1 } },
      });
      return outcome;
    }
    const winner = await prisma.winner.create({
      data: { entryId: outcome.entryId, prizeId: prize.id },
    });
    return {
      kind: 'win_pending',
      entryId: outcome.entryId,
      winnerId: winner.id,
      prizeId: prize.id,
      prizeName: prize.name,
    };
  }

  return createEntry(campaignId, userId, post.id, today, EntryResult.LOSE);
}

async function createEntry(
  campaignId: string,
  userId: string,
  postId: string,
  today: string,
  result: EntryResult,
): Promise<Extract<DrawOutcome, { kind: 'lose' | 'already_entered' }>> {
  try {
    const entry = await getPrisma().entry.create({
      data: { campaignId, userId, postId, dateJst: today, result },
    });
    return { kind: 'lose', entryId: entry.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { kind: 'already_entered' };
    }
    throw error;
  }
}
