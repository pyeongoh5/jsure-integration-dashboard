import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@jsure/jwin-db';
import {
  CampaignLp,
  CampaignSeasonLp,
  CampaignSummary,
  EntryResultResponse,
  TodayEntryResponse,
  WinHistoryItem,
  dateJst,
} from '@jsure/jwin-shared';
import { config } from '../config';
import { getUserSession, setUserSession } from '../lib/auth';
import { decrypt } from '../lib/crypto';
import { draw } from '../services/draw';
import { verifyWinner } from '../services/verification';
import { saveShipping, type ShippingInfo } from '../services/fulfillment';

/** 유저 대상 공개 API: 캠페인 목록/단독 LP, 응모(추첨), 검증 재시도, 당첨 히스토리, 배송지 입력 */
export async function publicRoutes(app: FastifyInstance) {
  const prisma = getPrisma();

  app.get('/health', async () => ({ ok: true }));

  // 로컬 확인용 — X 연동 없이 데모 유저로 로그인한다. 운영에서는 등록되지 않는다.
  // 데모 데이터는 apps/jwin-api/spikes/seed-demo.ts 로 심는다.
  if (config().NODE_ENV !== 'production') {
    app.get('/dev/login', async (req, reply) => {
      const user = await prisma.user.upsert({
        where: { xUserId: 'demo-user' },
        update: {},
        create: { xUserId: 'demo-user', xUsername: 'demo_user', displayName: '데모 유저' },
      });
      setUserSession(reply, { userId: user.id, xUsername: user.xUsername });
      return reply.redirect(`${config().WEB_BASE_URL}/c/demo`);
    });
  }

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
            posts: {
              where: { status: 'POSTED' },
              orderBy: { dateJst: 'desc' },
              take: 1,
              include: { template: true },
            },
            postTemplates: true,
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
      keyVisualUrl: campaign.keyVisualUrl,
      listBackgroundUrl: campaign.listBackgroundUrl,
      brands: campaign.brands.map((brandCampaign) => {
        const latestPost = brandCampaign.posts[0];
        const xUsername = brandCampaign.brandAccount.xUsername;
        // 카드 썸네일: 최근 게시물의 소재 → 없으면 현재 유효 소재의 첫 이미지
        const now = new Date();
        const template =
          latestPost?.template ??
          brandCampaign.postTemplates.find(
            (candidate) => candidate.activeFrom <= now && now <= candidate.activeTo,
          );
        return {
          brandCampaignId: brandCampaign.id,
          brandName: brandCampaign.brandAccount.label,
          brandSlug: brandCampaign.brandAccount.slug,
          brandLogoUrl: brandCampaign.brandAccount.logoUrl,
          xUsername,
          postImageUrl: template?.mediaUrls[0] ?? template?.mediaUrl ?? null,
          latestPostUrl:
            latestPost?.xPostId && xUsername
              ? `https://x.com/${xUsername}/status/${latestPost.xPostId}`
              : null,
        };
      }),
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
          posts: { where: { dateJst: dateJst(), status: 'POSTED' }, include: { template: true } },
          postTemplates: true,
          brandAccount: { select: { label: true, slug: true, logoUrl: true, xUsername: true } },
        },
      });
      if (!brandCampaign) return reply.code(404).send({ error: 'キャンペーンが見つかりません' });

      const todayPost = brandCampaign.posts[0];
      const brandXUsername = brandCampaign.brandAccount.xUsername;
      // 응모 화면 상단 이미지: 당일 게시물의 소재 → 없으면 현재 유효한 소재의 첫 이미지
      const now = new Date();
      const activeTemplate =
        todayPost?.template ??
        brandCampaign.postTemplates.find(
          (template) => template.activeFrom <= now && now <= template.activeTo,
        );
      const lp: CampaignLp = {
        brandCampaignId: brandCampaign.id,
        campaign: {
          name: brandCampaign.campaign.name,
          slug: brandCampaign.campaign.slug,
          thumbnailUrl: brandCampaign.campaign.thumbnailUrl,
        },
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
        dailyPostTime: brandCampaign.campaign.dailyPostTime,
        postImageUrl: activeTemplate?.mediaUrls[0] ?? activeTemplate?.mediaUrl ?? null,
        prizeSummary: prizeSummaryOf(brandCampaign.prizes),
        prizes: brandCampaign.prizes.map((prize) => ({
          name: prize.name,
          totalQty: prize.totalQty,
        })),
        cardImageUrl: brandCampaign.cardImageUrl,
        rulesUrl: brandCampaign.rulesUrl,
        prUrl: brandCampaign.prUrl,
        prBannerUrl: brandCampaign.prBannerUrl,
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

  // 오늘(JST) 응모 상태 — 화면 재진입 시 당첨 후보(검증 대기) 상태를 복구한다.
  // 이게 없으면 새로고침 후 응모 버튼이 409 "응모 완료"만 보여줘 재검증 입구가 사라진다.
  app.get<{ Params: { brandCampaignId: string } }>(
    '/brand-campaigns/:brandCampaignId/entries/today',
    async (req, reply): Promise<TodayEntryResponse | void> => {
      const session = getUserSession(req);
      if (!session) return reply.code(401).send({ error: 'login required' });

      const entry = await prisma.entry.findUnique({
        where: {
          campaignId_userId_dateJst: {
            campaignId: req.params.brandCampaignId,
            userId: session.userId,
            dateJst: dateJst(),
          },
        },
        include: { winner: { include: { prize: true } } },
      });
      if (!entry) return { entered: false };
      if (entry.result === 'LOSE' || !entry.winner) return { entered: true, result: 'lose' };

      const winner = entry.winner;
      if (entry.result === 'WIN_CONFIRMED' || winner.verification === 'PASSED') {
        return {
          entered: true,
          result: 'win_confirmed',
          winnerId: winner.id,
          prizeName: winner.prize.name,
          prizeType: winner.prize.type,
          needsShipping: winner.prize.type === 'PHYSICAL' && !winner.encryptedShipping,
        };
      }
      return {
        entered: true,
        result: 'win_pending',
        winnerId: winner.id,
        prizeName: winner.prize.name,
        failReason:
          winner.verification === 'FOLLOW_FAILED'
            ? 'follow'
            : winner.verification === 'REPOST_FAILED'
              ? 'repost'
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
    /** 하이픈 포함 "123-4567" */
    postalCode: z.string().regex(/^\d{3}-\d{4}$/),
    prefecture: z.string().min(1),
    address1: z.string().min(1),
    address2: z.string().optional(),
    fullName: z.string().min(1),
    nameKana: z.string().min(1),
    /** 하이픈 없는 숫자만 */
    phone: z.string().regex(/^\d{10,11}$/),
  });

  /**
   * 본인 배송지 조회 — 새로고침·재진입 시 입력 상태를 복구한다.
   * 본인(세션 userId) 당첨 건만 조회되고, 어드민 열람과 달리 감사 대상이 아니다.
   */
  app.get<{ Params: { winnerId: string } }>('/winners/:winnerId/shipping', async (req, reply) => {
    const session = getUserSession(req);
    if (!session) return reply.code(401).send({ error: 'login required' });
    const winner = await prisma.winner.findFirst({
      where: { id: req.params.winnerId, entry: { userId: session.userId }, verification: 'PASSED' },
      include: {
        prize: true,
        entry: { include: { campaign: { include: { campaign: true } } } },
      },
    });
    if (!winner || winner.prize.type !== 'PHYSICAL') {
      return reply.code(404).send({ error: 'not eligible' });
    }

    // 같은 시즌에서 본인이 가장 최근에 입력한 배송지 — 새 당첨 폼의 자동 입력용
    const previous = winner.encryptedShipping
      ? null
      : await prisma.winner.findFirst({
          where: {
            id: { not: winner.id },
            encryptedShipping: { not: null },
            entry: {
              userId: session.userId,
              campaign: { campaignId: winner.entry.campaign.campaignId },
            },
          },
          orderBy: { shippingEnteredAt: 'desc' },
          select: { encryptedShipping: true },
        });

    return {
      prizeName: winner.prize.name,
      xUsername: session.xUsername,
      closed: winner.entry.campaign.campaign.endsAt.getTime() < Date.now(),
      entered: winner.encryptedShipping != null,
      shipping: winner.encryptedShipping
        ? (JSON.parse(decrypt(winner.encryptedShipping)) as ShippingInfo)
        : null,
      previousShipping: previous?.encryptedShipping
        ? (JSON.parse(decrypt(previous.encryptedShipping)) as ShippingInfo)
        : null,
    };
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
