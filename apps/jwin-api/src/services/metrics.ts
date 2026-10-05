import { getPrisma } from '@jsure/jwin-db';
import { dateJst } from '@jsure/jwin-shared';
import { getBrandAccessToken } from '../lib/tokens';
import { getFollowerCount, getPostMetrics } from '../lib/x-api';

/**
 * 브랜드 캠페인 지표 수집.
 *
 * - BASELINE: 참여의 첫 게시가 성공한 직후 팔로워 수 1회 (성과 비교 기준점)
 * - DAILY: 매일 00:00 JST — 방금 끝난 게시일의 팔로워 수와 당일 포스트의
 *   리포스트·좋아요·댓글 수 (owned read, 참여당 $0.002/일 수준)
 *
 * 수집 실패는 게시·추첨에 영향을 주면 안 된다 — 호출부가 로그만 남기고 넘어간다.
 */

/** 방금 끝난 게시일 — 00:00 JST 직후 실행되므로 1시간 전 시각의 JST 날짜가 그 날이다. */
export function endedDateJst(now: Date = new Date()): string {
  return dateJst(new Date(now.getTime() - 60 * 60 * 1000));
}

/** 첫 게시 직후의 팔로워 기준점. 이미 있으면 아무것도 하지 않는다. */
export async function collectBaseline(brandCampaignId: string): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.brandMetricSnapshot.findFirst({
    where: { campaignId: brandCampaignId, kind: 'BASELINE' },
    select: { id: true },
  });
  if (existing) return;

  const participation = await prisma.brandCampaign.findUnique({
    where: { id: brandCampaignId },
    include: { brandAccount: true },
  });
  if (!participation?.brandAccount) return;

  const token = await getBrandAccessToken(participation.brandAccount);
  const followerCount = await getFollowerCount(token);
  await prisma.brandMetricSnapshot
    .create({
      data: { campaignId: brandCampaignId, dateJst: dateJst(), kind: 'BASELINE', followerCount },
    })
    .catch(() => {}); // 동시 실행으로 유니크 충돌 시 무시
}

/** 00:00 JST — 방금 끝난 게시일의 지표를 참여별로 수집한다. */
export async function collectDailyMetrics(): Promise<void> {
  const prisma = getPrisma();
  const targetDate = endedDateJst();

  // 그날 게시가 나간 참여만 수집한다 (게시 없는 날은 지표 의미가 없다)
  const posts = await prisma.campaignPost.findMany({
    where: { dateJst: targetDate, status: 'POSTED', xPostId: { not: null } },
    include: { campaign: { include: { brandAccount: true } } },
  });

  for (const post of posts) {
    const brandAccount = post.campaign.brandAccount;
    if (!brandAccount) continue;
    try {
      const token = await getBrandAccessToken(brandAccount);
      const [followerCount, postMetrics] = await Promise.all([
        getFollowerCount(token),
        getPostMetrics(token, post.xPostId as string),
      ]);
      await prisma.brandMetricSnapshot.upsert({
        where: {
          campaignId_dateJst_kind: {
            campaignId: post.campaignId,
            dateJst: targetDate,
            kind: 'DAILY',
          },
        },
        update: { followerCount, postId: post.xPostId, ...postMetrics },
        create: {
          campaignId: post.campaignId,
          dateJst: targetDate,
          kind: 'DAILY',
          followerCount,
          postId: post.xPostId,
          ...postMetrics,
        },
      });
    } catch (error) {
      console.error(
        `[metrics] 수집 실패 campaign=${post.campaignId} date=${targetDate}`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
