import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@jsure/jwin-db';
import {
  CampaignLp,
  CampaignSummary,
  EntryResultResponse,
  WinHistoryItem,
  dateJst,
} from '@jsure/jwin-shared';
import { getUserSession } from '../lib/auth';
import { draw } from '../services/draw';
import { verifyWinner } from '../services/verification';
import { saveShipping } from '../services/fulfillment';

/** 유저 대상 공개 API: 캠페인 목록/단독 LP, 응모(추첨), 검증 재시도, 당첨 히스토리, 배송지 입력 */
export async function publicRoutes(app: FastifyInstance) {
  const prisma = getPrisma();

  app.get('/health', async () => ({ ok: true }));

  app.get('/me', async (req) => {
    const session = getUserSession(req);
    return session ? { loggedIn: true, xUsername: session.xUsername } : { loggedIn: false };
  });

  // 진행 중 캠페인 목록 (별도 목록 페이지용)
  app.get('/campaigns', async (): Promise<CampaignSummary[]> => {
    const now = new Date();
    const campaigns = await prisma.brandCampaign.findMany({
      where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
      include: {
        prizes: { orderBy: { tier: 'asc' } },
        brandAccount: { select: { xUsername: true } },
      },
      orderBy: { endsAt: 'asc' },
    });
    return campaigns.map((campaign) => ({
      slug: campaign.slug,
      brandName: campaign.brandName,
      xUsername: campaign.brandAccount?.xUsername ?? null,
      endsAt: campaign.endsAt.toISOString(),
      prizeSummary: campaign.prizes.map((prize) => `${prize.name}×${prize.totalQty}`).join(' / '),
    }));
  });

  // 단독 LP (/c/{slug})
  app.get<{ Params: { slug: string } }>('/campaigns/:slug', async (req, reply) => {
    const campaign = await prisma.brandCampaign.findFirst({
      where: { slug: req.params.slug, status: { in: ['ACTIVE', 'PAUSED', 'ENDED'] } },
      include: {
        prizes: { orderBy: { tier: 'asc' } },
        posts: { where: { dateJst: dateJst(), status: 'POSTED' } },
        brandAccount: { select: { xUsername: true } },
      },
    });
    if (!campaign) return reply.code(404).send({ error: 'キャンペーンが見つかりません' });

    const todayPost = campaign.posts[0];
    const brandXUsername = campaign.brandAccount?.xUsername ?? null;
    const lp: CampaignLp = {
      campaignId: campaign.id,
      slug: campaign.slug,
      brandName: campaign.brandName,
      xUsername: brandXUsername,
      startsAt: campaign.startsAt.toISOString(),
      endsAt: campaign.endsAt.toISOString(),
      todayPostUrl:
        todayPost?.xPostId && brandXUsername
          ? `https://x.com/${brandXUsername}/status/${todayPost.xPostId}`
          : null,
      prizeSummary: campaign.prizes.map((prize) => `${prize.name}×${prize.totalQty}`).join(' / '),
      prUrl: campaign.prUrl,
      winMediaUrl: campaign.winMediaUrl,
      loseMediaUrl: campaign.loseMediaUrl,
    };
    return lp;
  });

  // 응모(추첨 참가) → 당첨 후보면 즉시 lazy 검증까지 수행
  app.post<{ Params: { campaignId: string } }>(
    '/campaigns/:campaignId/enter',
    async (req, reply): Promise<EntryResultResponse | void> => {
      const session = getUserSession(req);
      if (!session) return reply.code(401).send({ error: 'login required' });

      const outcome = await draw(req.params.campaignId, session.userId);
      if (outcome.kind === 'already_entered') {
        return reply.code(409).send({ error: 'already entered today' });
      }
      if (outcome.kind === 'no_post_today') {
        return reply.code(404).send({ error: 'no active post today' });
      }
      if (outcome.kind === 'lose') return { result: 'lose' };

      // 당첨 후보 → 즉시 검증 시도 (실패 시 당일 내 재시도 가능 — F-5.3)
      const verified = await verifyWinner(outcome.winnerId, session.userId);
      if (verified.ok) {
        return {
          result: 'win_confirmed',
          winnerId: outcome.winnerId,
          prizeName: outcome.prizeName,
          prizeType: verified.prizeType,
          needsShipping: verified.prizeType === 'PHYSICAL',
        };
      }
      return {
        result: 'win_pending',
        winnerId: outcome.winnerId,
        prizeName: outcome.prizeName,
        failReason:
          verified.reason === 'follow' || verified.reason === 'repost'
            ? verified.reason
            : undefined,
      };
    },
  );

  // "팔로우/리포스트 했어요" 재검증 버튼 (D-2, 당일 응모 건만)
  app.post<{ Params: { winnerId: string } }>('/winners/:winnerId/verify', async (req, reply) => {
    const session = getUserSession(req);
    if (!session) return reply.code(401).send({ error: 'login required' });
    const verified = await verifyWinner(req.params.winnerId, session.userId);
    return verified.ok
      ? { ok: true, prizeType: verified.prizeType }
      : { ok: false, reason: verified.reason };
  });

  // 당첨 히스토리 (F-3.6): 확정 당첨 건만. campaignId 쿼리로 캠페인별 필터 가능.
  app.get<{ Querystring: { campaignId?: string } }>('/me/wins', async (req, reply) => {
    const session = getUserSession(req);
    if (!session) return reply.code(401).send({ error: 'login required' });
    const now = Date.now();
    const winners = await prisma.winner.findMany({
      where: {
        verification: 'PASSED',
        entry: {
          userId: session.userId,
          result: 'WIN_CONFIRMED',
          ...(req.query.campaignId ? { campaignId: req.query.campaignId } : {}),
        },
      },
      include: { prize: true, entry: { include: { campaign: true } } },
      orderBy: { verifiedAt: 'desc' },
    });
    const items: WinHistoryItem[] = winners.map((winner) => ({
      winnerId: winner.id,
      dateJst: winner.entry.dateJst,
      prizeName: winner.prize.name,
      prizeType: winner.prize.type,
      needsShipping:
        winner.prize.type === 'PHYSICAL' &&
        !winner.encryptedShipping &&
        winner.entry.campaign.endsAt.getTime() >= now,
      shippingEntered: winner.encryptedShipping != null,
      dmSent: winner.fulfillment === 'DM_SENT',
    }));
    return items;
  });

  // 현물 당첨자 배송지 입력 (캠페인 종료 후에는 잠금 — F-6.3)
  const shippingSchema = z.object({
    postalCode: z.string().min(7).max(8),
    prefecture: z.string().min(1),
    address1: z.string().min(1),
    address2: z.string().optional(),
    fullName: z.string().min(1),
    phone: z.string().min(10),
  });
  app.post<{ Params: { winnerId: string } }>('/winners/:winnerId/shipping', async (req, reply) => {
    const session = getUserSession(req);
    if (!session) return reply.code(401).send({ error: 'login required' });
    const parsed = shippingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await saveShipping(req.params.winnerId, session.userId, parsed.data);
    if (result === 'saved') return { ok: true };
    if (result === 'closed') {
      return reply.code(409).send({ error: 'キャンペーン終了のため入力できません' });
    }
    return reply.code(404).send({ error: 'not eligible' });
  });
}
