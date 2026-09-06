import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@jsure/jwin-db';
import {
  CampaignLp,
  CampaignSeasonLp,
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

  /** 브랜드 카드에 실을 경품 요약. */
  const prizeSummaryOf = (prizes: { name: string; totalQty: number }[]) =>
    prizes.map((prize) => `${prize.name}×${prize.totalQty}`).join(' / ');

  // 진행 중 시즌 목록 (별도 목록 페이지용)
  app.get('/campaigns', async (): Promise<CampaignSummary[]> => {
    const now = new Date();
    const campaigns = await prisma.campaign.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gte: now },
        // 공개 조건: 기간 내 + ACTIVE 참여가 1건 이상
        brands: { some: { status: 'ACTIVE' } },
      },
      include: { _count: { select: { brands: true } } },
      orderBy: { endsAt: 'asc' },
    });
    return campaigns.map((campaign) => ({
      slug: campaign.slug,
      name: campaign.name,
      startsAt: campaign.startsAt.toISOString(),
      endsAt: campaign.endsAt.toISOString(),
      brandCount: campaign._count.brands,
    }));
  });

  // 시즌 LP (/c/{campaignSlug}) — 참여 브랜드 카드 목록
  app.get<{ Params: { campaignSlug: string } }>('/campaigns/:campaignSlug', async (req, reply) => {
    const campaign = await prisma.campaign.findUnique({
      where: { slug: req.params.campaignSlug },
      include: {
        brands: {
          where: { status: { in: ['ACTIVE', 'PAUSED', 'ENDED'] } },
          include: {
            prizes: { orderBy: { tier: 'asc' } },
            brandAccount: { select: { label: true, slug: true, logoUrl: true, xUsername: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!campaign) return reply.code(404).send({ error: 'キャンペーンが見つかりません' });

    const lp: CampaignSeasonLp = {
      campaignId: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      startsAt: campaign.startsAt.toISOString(),
      endsAt: campaign.endsAt.toISOString(),
      brands: campaign.brands.map((brandCampaign) => ({
        brandCampaignId: brandCampaign.id,
        brandName: brandCampaign.brandAccount.label,
        brandSlug: brandCampaign.brandAccount.slug,
        brandLogoUrl: brandCampaign.brandAccount.logoUrl,
        xUsername: brandCampaign.brandAccount.xUsername,
        prizeSummary: prizeSummaryOf(brandCampaign.prizes),
      })),
    };
    return lp;
  });

  // 참여 LP (/c/{campaignSlug}/{brandSlug})
  app.get<{ Params: { campaignSlug: string; brandSlug: string } }>(
    '/campaigns/:campaignSlug/brands/:brandSlug',
    async (req, reply) => {
      const brandCampaign = await prisma.brandCampaign.findFirst({
        where: {
          status: { in: ['ACTIVE', 'PAUSED', 'ENDED'] },
          campaign: { slug: req.params.campaignSlug },
          brandAccount: { slug: req.params.brandSlug },
        },
        include: {
          campaign: true,
          prizes: { orderBy: { tier: 'asc' } },
          posts: { where: { dateJst: dateJst(), status: 'POSTED' } },
          brandAccount: { select: { label: true, slug: true, logoUrl: true, xUsername: true } },
        },
      });
      if (!brandCampaign) return reply.code(404).send({ error: 'キャンペーンが見つかりません' });

      const todayPost = brandCampaign.posts[0];
      const brandXUsername = brandCampaign.brandAccount.xUsername;
      const lp: CampaignLp = {
        brandCampaignId: brandCampaign.id,
        campaign: { name: brandCampaign.campaign.name, slug: brandCampaign.campaign.slug },
        brandName: brandCampaign.brandAccount.label,
        brandSlug: brandCampaign.brandAccount.slug,
        brandLogoUrl: brandCampaign.brandAccount.logoUrl,
        xUsername: brandXUsername,
        // 기간은 시즌에서 온다
        startsAt: brandCampaign.campaign.startsAt.toISOString(),
        endsAt: brandCampaign.campaign.endsAt.toISOString(),
        todayPostUrl:
          todayPost?.xPostId && brandXUsername
            ? `https://x.com/${brandXUsername}/status/${todayPost.xPostId}`
            : null,
        prizeSummary: prizeSummaryOf(brandCampaign.prizes),
        cardImageUrl: brandCampaign.cardImageUrl,
        rulesUrl: brandCampaign.rulesUrl,
        prUrl: brandCampaign.prUrl,
        winMediaUrl: brandCampaign.winMediaUrl,
        loseMediaUrl: brandCampaign.loseMediaUrl,
      };
      return lp;
    },
  );

  // 응모(추첨 참가) → 당첨 후보면 즉시 lazy 검증까지 수행
  app.post<{ Params: { brandCampaignId: string } }>(
    '/brand-campaigns/:brandCampaignId/enter',
    async (req, reply): Promise<EntryResultResponse | void> => {
      const session = getUserSession(req);
      if (!session) return reply.code(401).send({ error: 'login required' });

      const outcome = await draw(req.params.brandCampaignId, session.userId);
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

  // 당첨 히스토리 (F-3.6): 확정 당첨 건만. brandCampaignId 쿼리로 참여별 필터 가능.
  app.get<{ Querystring: { brandCampaignId?: string } }>('/me/wins', async (req, reply) => {
    const session = getUserSession(req);
    if (!session) return reply.code(401).send({ error: 'login required' });
    const now = Date.now();
    const winners = await prisma.winner.findMany({
      where: {
        verification: 'PASSED',
        entry: {
          userId: session.userId,
          result: 'WIN_CONFIRMED',
          ...(req.query.brandCampaignId ? { campaignId: req.query.brandCampaignId } : {}),
        },
      },
      include: {
        prize: true,
        entry: { include: { campaign: { include: { campaign: true } } } },
      },
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
        winner.entry.campaign.campaign.endsAt.getTime() >= now,
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
