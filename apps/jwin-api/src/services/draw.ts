import { getPrisma, EntryResult, Prisma } from '@jsure/jwin-db';
import { dateJst } from '@jsure/jwin-shared';
import {
  appliedProbability,
  pickPrizeByRemainingQty,
  rollForwardWindow,
  scheduleGateOpen,
  type WindowState,
} from './pacing';

/**
 * 인스턴트윈 추첨 (확정 정책: 캠페인 단위 확률 + 수량 비례 상품 선택 + 소진 페이싱)
 *
 * - 응모는 캠페인×일(JST) 1회 — Entry unique 제약으로 강제
 * - 당첨 여부는 캠페인에 설정된 확률 1회 판정. 경품 종류와 무관하다
 * - 당첨이면 남은 수량 비례로 상품을 뽑고 조건부 UPDATE(remainingQty > 0)로 원자적 차감
 * - 소진 속도는 누적 계획선(하드 상한)과 보정 배수(속도 조절)로 민다 — pacing.ts
 * - 당첨 후보는 당일 내 팔로우+리포스트 검증을 통과하면 확정 (D-2 개정:
 *   미이행이어도 몰수·재고 회수하지 않고 그대로 미이행 종료)
 */

export type DrawOutcome =
  | { kind: 'already_entered' }
  | { kind: 'no_post_today' }
  | { kind: 'lose'; entryId: string }
  | { kind: 'win_pending'; entryId: string; winnerId: string; prizeId: string; prizeName: string };

export async function draw(
  brandCampaignId: string,
  userId: string,
  rng: () => number = Math.random,
): Promise<DrawOutcome> {
  const prisma = getPrisma();
  const today = dateJst();
  const now = new Date();

  // 기간은 시즌(Campaign)이, 진행 상태는 참여(BrandCampaign)가 갖는다.
  const campaign = await prisma.brandCampaign.findFirst({
    where: {
      id: brandCampaignId,
      status: 'ACTIVE',
      campaign: { startsAt: { lte: now }, endsAt: { gte: now } },
    },
    include: { campaign: true, prizes: { orderBy: { createdAt: 'asc' } } },
  });
  if (!campaign) return { kind: 'no_post_today' };

  // D-1: 당일 게시된 캠페인 포스트가 응모 대상
  const post = await prisma.campaignPost.findFirst({
    where: { campaignId: brandCampaignId, dateJst: today, status: 'POSTED' },
  });
  if (!post) return { kind: 'no_post_today' };

  const lose = () => createEntry(brandCampaignId, userId, post.id, today, EntryResult.LOSE);

  const totalQty = sumBy(campaign.prizes, (prize) => prize.totalQty);
  const remainingQty = sumBy(campaign.prizes, (prize) => prize.remainingQty);
  const { startsAt, endsAt } = campaign.campaign;

  // 구간 롤포워드 — 보정 배수 갱신. 응모 집계도 여기서 함께 넘긴다.
  const rolled = rollForwardWindow(
    {
      windowStartedAt: campaign.windowStartedAt ?? startsAt,
      windowWinCount: campaign.windowWinCount,
      windowEntryCount: campaign.windowEntryCount,
      paceMultiplier: campaign.paceMultiplier,
    },
    { remainingQty, endsAt, now, baseProbability: campaign.winProbability },
  );
  await persistWindow(brandCampaignId, rolled);

  if (!scheduleGateOpen({ totalQty, remainingQty, startsAt, endsAt, now })) return lose();
  if (rng() >= appliedProbability(campaign.winProbability, rolled.paceMultiplier)) return lose();

  // 수량 비례로 상품을 뽑고 원자적으로 차감. 동시 응모로 소진됐으면 후보에서 빼고 재시도.
  const candidates = campaign.prizes.filter((prize) => prize.remainingQty > 0);
  while (candidates.length > 0) {
    const picked = pickPrizeByRemainingQty(candidates, rng());
    if (!picked) break;

    const decremented = await prisma.prize.updateMany({
      where: { id: picked.id, remainingQty: { gt: 0 } },
      data: { remainingQty: { decrement: 1 } },
    });
    if (decremented.count === 0) {
      candidates.splice(candidates.indexOf(picked), 1);
      continue;
    }

    const outcome = await createEntry(
      brandCampaignId,
      userId,
      post.id,
      today,
      EntryResult.WIN_PENDING,
    );
    if (outcome.kind === 'already_entered') {
      // 유니크 제약 충돌 → 차감 롤백
      await prisma.prize.update({
        where: { id: picked.id },
        data: { remainingQty: { increment: 1 } },
      });
      return outcome;
    }

    const winner = await prisma.winner.create({
      data: { entryId: outcome.entryId, prizeId: picked.id },
    });
    await prisma.brandCampaign.update({
      where: { id: brandCampaignId },
      data: { windowWinCount: { increment: 1 } },
    });
    return {
      kind: 'win_pending',
      entryId: outcome.entryId,
      winnerId: winner.id,
      prizeId: picked.id,
      prizeName: picked.name,
    };
  }

  return lose();
}

/** 구간 상태를 저장하면서 이번 응모를 집계한다. */
async function persistWindow(brandCampaignId: string, window: WindowState): Promise<void> {
  await getPrisma().brandCampaign.update({
    where: { id: brandCampaignId },
    data: {
      windowStartedAt: window.windowStartedAt,
      windowWinCount: window.windowWinCount,
      windowEntryCount: window.windowEntryCount + 1,
      paceMultiplier: window.paceMultiplier,
    },
  });
}

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((sum, item) => sum + pick(item), 0);
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
