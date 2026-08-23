import { getPrisma } from '@jsure/jwin-db';
import { dateJst } from '@jsure/jwin-shared';
import { getUserAccessToken } from '../lib/tokens';
import { checkFollows, checkReposted } from '../lib/x-api';
import { assignCodeAndSendDm } from './fulfillment';

/**
 * D-2(개정) lazy 검증: 당첨 후보(WIN_PENDING)에 대해서만 팔로우+리포스트를 확인한다.
 * 유저 본인의 OAuth 토큰으로 조회 → owned read 단가 + 유저별 레이트리밋.
 *
 * - 재시도는 응모 당일(JST)에만 가능 (F-5.3). 당일 포스트 리포스트만 인정하므로(D-1)
 *   다음 날 이후의 검증은 의미가 없다.
 * - 당일 내 미완료여도 몰수·재고 회수는 하지 않는다 (F-5.4). 그대로 미이행 종료.
 */

export type VerifyResult =
  | { ok: true; prizeType: 'PHYSICAL' | 'CODE' }
  | { ok: false; reason: 'follow' | 'repost' | 'expired' | 'token' | 'not_found' };

export async function verifyWinner(winnerId: string, userId: string): Promise<VerifyResult> {
  const prisma = getPrisma();
  const winner = await prisma.winner.findFirst({
    where: { id: winnerId, entry: { userId } },
    include: {
      prize: true,
      entry: { include: { user: true, post: true, campaign: { include: { brandAccount: true } } } },
    },
  });
  if (!winner) return { ok: false, reason: 'not_found' };
  if (winner.verification === 'PASSED') return { ok: true, prizeType: winner.prize.type };
  // 당일 응모 건만 검증 가능 (F-5.3)
  if (winner.entry.dateJst !== dateJst()) return { ok: false, reason: 'expired' };

  const { user, post, campaign } = winner.entry;
  const token = await getUserAccessToken(user);
  if (!token) return { ok: false, reason: 'token' };
  const brandXUserId = campaign.brandAccount?.xUserId;
  if (!brandXUserId || !post.xPostId) return { ok: false, reason: 'not_found' };

  const follows = await checkFollows(token, brandXUserId);
  if (!follows) {
    await prisma.winner.update({
      where: { id: winner.id },
      data: { verification: 'FOLLOW_FAILED' },
    });
    return { ok: false, reason: 'follow' };
  }

  const reposted = await checkReposted(token, user.xUserId, post.xPostId);
  if (!reposted) {
    await prisma.winner.update({
      where: { id: winner.id },
      data: { verification: 'REPOST_FAILED' },
    });
    return { ok: false, reason: 'repost' };
  }

  // 통과 → 당첨 확정
  await prisma.$transaction([
    prisma.winner.update({
      where: { id: winner.id },
      data: {
        verification: 'PASSED',
        verifiedAt: new Date(),
        fulfillment: winner.prize.type === 'PHYSICAL' ? 'AWAITING_INFO' : 'READY',
      },
    }),
    prisma.entry.update({ where: { id: winner.entryId }, data: { result: 'WIN_CONFIRMED' } }),
  ]);

  if (winner.prize.type === 'CODE') {
    // 코드 할당 + DM 발송 (실패 시 스케줄러가 재시도)
    assignCodeAndSendDm(winner.id).catch(() => {});
  }
  return { ok: true, prizeType: winner.prize.type };
}
