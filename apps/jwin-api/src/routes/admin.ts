import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@jsure/jwin-db';
import { dateJst } from '@jsure/jwin-shared';
import { config } from '../config';
import { encrypt } from '../lib/crypto';
import { AdminIdentity, getAdminIdentity } from '../lib/auth';
import {
  toCampaignDetail,
  toPrize,
  toPostTemplate,
  toWinner,
  decryptShipping,
  canTransitionFulfillment,
} from './adminMappers';

/**
 * 어드민 API (v1: J-sure 운영자 단일 테넌트 — 브로커형)
 * F-1.1 캠페인 CRUD (기간 단위) / F-1.2 소재 / F-1.3 경품+코드 동시 등록 (F-7.3) /
 * F-1.5 중지 / F-1.6 감사 로그 / 캠페인 단위 통계
 *
 * 인증 (D-10): 로그인 엔드포인트가 없다. 대시보드(@jsure/api)에서 로그인해 받은
 * access token을 Authorization: Bearer 로 실어 보내면 서명만 검증한다.
 */

/** 엑셀 붙여넣기 대응: 개행/탭/쉼표로 분리, 공백 제거 (F-7.3) */
export function parseCodesInput(raw: string): string[] {
  return raw
    .split(/[\r\n\t,]+/)
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}

export async function adminRoutes(app: FastifyInstance) {
  const prisma = getPrisma();

  function requireAdmin(req: FastifyRequest, reply: FastifyReply): AdminIdentity | null {
    const admin = getAdminIdentity(req);
    if (!admin) {
      reply.code(401).send({ error: 'admin login required' });
      return null;
    }
    return admin;
  }

  async function audit(
    admin: AdminIdentity,
    action: string,
    target?: string,
    payload?: unknown,
  ) {
    await prisma.auditLog.create({
      data: {
        adminId: admin.adminId,
        adminEmail: admin.email,
        action,
        target,
        payload: payload as object | undefined,
      },
    });
  }

  /** 토큰 유효성 확인용 (admin-web이 J-WIN 접근 가능 여부를 판단) */
  app.get('/admin/me', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    return { adminId: admin.adminId, email: admin.email, role: admin.role };
  });

  // ── 브랜드 캠페인 (F-1.1, F-1.5 — 기간 단위) ──
  const campaignSchema = z.object({
    brandName: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    dailyPostTime: z.string().regex(/^\d{2}:\d{2}$/).default('11:00'),
    dailyWinCap: z.number().int().positive().nullable().optional(),
    prUrl: z.string().url().nullable().optional(),
    winMediaUrl: z.string().url().nullable().optional(),
    loseMediaUrl: z.string().url().nullable().optional(),
    dmTemplate: z.string().max(1000).nullable().optional(),
  });

  app.post('/admin/campaigns', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.endsAt <= parsed.data.startsAt) {
      return reply.code(400).send({ error: '종료일은 시작일 이후여야 합니다' });
    }
    const campaign = await prisma.brandCampaign.create({ data: parsed.data });
    await audit(admin, 'campaign.create', campaign.id, parsed.data);
    // 브랜드 담당자에게 전달할 X 연동 링크
    return {
      ...campaign,
      connectUrl: `${config().API_BASE_URL}/oauth/brand/start?campaignId=${campaign.id}`,
    };
  });

  app.get('/admin/campaigns', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    return prisma.brandCampaign.findMany({
      orderBy: { startsAt: 'desc' },
      include: {
        _count: { select: { entries: true } },
        credential: { select: { refreshFailedAt: true } },
      },
    });
  });

  // ① 편집 폼 초기값 — 연동 상태·connectUrl 포함
  app.get<{ Params: { id: string } }>('/admin/campaigns/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const campaign = await prisma.brandCampaign.findUnique({
      where: { id: req.params.id },
      include: { credential: { select: { refreshFailedAt: true } } },
    });
    if (!campaign) return reply.code(404).send({ error: '캠페인을 찾을 수 없습니다' });
    const connectUrl = `${config().API_BASE_URL}/oauth/brand/start?campaignId=${campaign.id}`;
    return toCampaignDetail(campaign, connectUrl);
  });

  // ② 경품 목록 — id·확률·유형·코드 재고 포함
  app.get<{ Params: { id: string } }>('/admin/campaigns/:id/prizes', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const prizes = await prisma.prize.findMany({
      where: { campaignId: req.params.id },
      orderBy: { tier: 'asc' },
    });
    const withCounts = await Promise.all(
      prizes.map(async (prize) => {
        const availableCodeCount =
          prize.type === 'CODE'
            ? await prisma.prizeCode.count({ where: { prizeId: prize.id, status: 'AVAILABLE' } })
            : 0;
        return toPrize(prize, availableCodeCount);
      }),
    );
    return { prizes: withCounts };
  });

  // ④ 포스트 소재 목록 — 커버리지 검사·삭제 가능 여부(used)용
  app.get<{ Params: { id: string } }>(
    '/admin/campaigns/:id/post-templates',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const templates = await prisma.postTemplate.findMany({
        where: { campaignId: req.params.id },
        orderBy: { activeFrom: 'asc' },
        include: { _count: { select: { posts: true } } },
      });
      return {
        postTemplates: templates.map((template) =>
          toPostTemplate(template, template._count.posts > 0),
        ),
      };
    },
  );

  app.patch<{ Params: { id: string } }>('/admin/campaigns/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = campaignSchema
      .partial()
      .extend({ status: z.enum(['SETUP', 'ACTIVE', 'PAUSED', 'ENDED']).optional() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const campaign = await prisma.brandCampaign.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    await audit(admin, 'campaign.update', campaign.id, parsed.data);
    return campaign;
  });

  // ── 포스트 소재 (F-1.2 주 단위 교체, mediaUrl 첨부 F-2.3) ──
  const templateSchema = z.object({
    campaignId: z.string(),
    label: z.string().min(1),
    bodyText: z.string().min(1).max(500),
    mediaUrl: z.string().url().optional(),
    activeFrom: z.coerce.date(),
    activeTo: z.coerce.date(),
  });

  app.post('/admin/post-templates', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const template = await prisma.postTemplate.create({ data: parsed.data });
    await audit(admin, 'template.create', template.id);
    return template;
  });

  // ── 경품 + 코드 동시 등록 (F-1.3, F-7.3) ──
  const prizeSchema = z.object({
    campaignId: z.string(),
    type: z.enum(['PHYSICAL', 'CODE']),
    name: z.string().min(1),
    tier: z.number().int().min(1).default(1),
    totalQty: z.number().int().positive(),
    winProbability: z.number().gt(0).lt(1),
    /** CODE 경품: 발송할 코드 원문 (엑셀 붙여넣기 — 개행/탭/쉼표 구분) */
    codesText: z.string().optional(),
  });

  app.post('/admin/prizes', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = prizeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { codesText, ...prizeData } = parsed.data;

    let codes: string[] = [];
    if (prizeData.type === 'CODE') {
      codes = parseCodesInput(codesText ?? '');
      const uniqueCount = new Set(codes).size;
      if (uniqueCount !== codes.length) {
        return reply.code(400).send({ error: '중복된 코드가 있습니다' });
      }
      if (codes.length !== prizeData.totalQty) {
        return reply.code(400).send({
          error: `코드 수(${codes.length})가 수량(${prizeData.totalQty})과 일치하지 않습니다`,
        });
      }
    }

    const prize = await prisma.$transaction(async (tx) => {
      const created = await tx.prize.create({
        data: { ...prizeData, remainingQty: prizeData.totalQty },
      });
      if (codes.length > 0) {
        await tx.prizeCode.createMany({
          data: codes.map((code) => ({
            prizeId: created.id,
            encryptedCode: encrypt(code),
            codeLast4: code.slice(-4),
          })),
        });
      }
      return created;
    });
    await audit(admin, 'prize.create', prize.id, { ...prizeData, codeCount: codes.length });
    return { ...prize, codeCount: codes.length };
  });

  // 코드 추가 등록 (재고 보충 — 본문: text/plain 또는 붙여넣기 원문)
  app.post<{ Params: { id: string } }>('/admin/prizes/:id/codes', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const body = typeof req.body === 'string' ? req.body : '';
    const codes = parseCodesInput(body);
    if (codes.length === 0) return reply.code(400).send({ error: '코드가 없습니다' });
    if (new Set(codes).size !== codes.length) {
      return reply.code(400).send({ error: '중복된 코드가 있습니다' });
    }
    await prisma.$transaction([
      prisma.prizeCode.createMany({
        data: codes.map((code) => ({
          prizeId: req.params.id,
          encryptedCode: encrypt(code),
          codeLast4: code.slice(-4),
        })),
      }),
      prisma.prize.update({
        where: { id: req.params.id },
        data: {
          totalQty: { increment: codes.length },
          remainingQty: { increment: codes.length },
        },
      }),
    ]);
    await audit(admin, 'prize.codes_append', req.params.id, { count: codes.length });
    return { imported: codes.length };
  });

  // ── 모니터링 대시보드 (캠페인 단위) ──
  app.get<{ Params: { id: string } }>('/admin/campaigns/:id/stats', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const campaign = await prisma.brandCampaign.findUnique({
      where: { id: req.params.id },
      include: {
        credential: { select: { refreshFailedAt: true, refreshFailCount: true } },
        prizes: true,
        posts: { where: { status: 'FAILED' } },
        _count: { select: { entries: true } },
      },
    });
    if (!campaign) return reply.code(404).send({ error: 'campaign not found' });

    const today = dateJst();
    const [winConfirmed, winPendingToday, unfulfilledWins] = await Promise.all([
      prisma.entry.count({ where: { campaignId: campaign.id, result: 'WIN_CONFIRMED' } }),
      prisma.entry.count({
        where: { campaignId: campaign.id, result: 'WIN_PENDING', dateJst: today },
      }),
      // 미이행 종료: 검증 미통과 상태로 당일이 지난 당첨 후보 (D-2 개정 — 회수하지 않음)
      prisma.entry.count({
        where: { campaignId: campaign.id, result: 'WIN_PENDING', dateJst: { lt: today } },
      }),
    ]);

    return {
      campaignId: campaign.id,
      brandName: campaign.brandName,
      slug: campaign.slug,
      xUsername: campaign.xUsername,
      status: campaign.status,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      entries: campaign._count.entries,
      winConfirmed,
      winPendingToday,
      unfulfilledWins,
      prizeStock: campaign.prizes.map((prize) => ({
        name: prize.name,
        total: prize.totalQty,
        remaining: prize.remainingQty,
      })),
      failedPosts: campaign.posts.length,
      needsReconnect: !!campaign.credential?.refreshFailedAt, // 브랜드 재연동 필요 알림
    };
  });

  // 당첨자 목록 (이행 처리용) — 배송지 평문/암호문 미노출 (D-11)
  app.get<{ Params: { id: string } }>('/admin/campaigns/:id/winners', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const winners = await prisma.winner.findMany({
      where: { entry: { campaignId: req.params.id } },
      select: {
        id: true,
        verification: true,
        fulfillment: true,
        encryptedShipping: true,
        dmSentAt: true,
        dmError: true,
        prize: { select: { name: true, type: true } },
        entry: { select: { dateJst: true, user: { select: { xUsername: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { winners: winners.map(toWinner) };
  });

  // ⑥ 배송지 복호화 열람 — 개인정보이므로 열람 자체를 감사 로그에 남긴다
  app.get<{ Params: { id: string } }>('/admin/winners/:id/shipping', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const winner = await prisma.winner.findUnique({
      where: { id: req.params.id },
      select: { id: true, encryptedShipping: true, shippingEnteredAt: true },
    });
    if (!winner) return reply.code(404).send({ error: '당첨자를 찾을 수 없습니다' });
    await audit(admin, 'winner.shipping_view', winner.id);
    return {
      winnerId: winner.id,
      shipping: decryptShipping(winner.encryptedShipping),
      shippingEnteredAt: winner.shippingEnteredAt
        ? winner.shippingEnteredAt.toISOString()
        : null,
    };
  });

  // ⑦ 이행 처리 — 허용 전이만: AWAITING_INFO→READY, READY→SHIPPED
  app.patch<{ Params: { id: string } }>(
    '/admin/winners/:id/fulfillment',
    async (req, reply) => {
      const admin = requireAdmin(req, reply);
      if (!admin) return;
      const parsed = z
        .object({
          fulfillment: z.enum(['NOT_READY', 'AWAITING_INFO', 'READY', 'DM_SENT', 'SHIPPED', 'FAILED']),
        })
        .safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const winner = await prisma.winner.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          verification: true,
          fulfillment: true,
          encryptedShipping: true,
          dmSentAt: true,
          dmError: true,
          prize: { select: { name: true, type: true } },
          entry: { select: { dateJst: true, user: { select: { xUsername: true } } } },
        },
      });
      if (!winner) return reply.code(404).send({ error: '당첨자를 찾을 수 없습니다' });
      if (!canTransitionFulfillment(winner.fulfillment, parsed.data.fulfillment)) {
        return reply
          .code(409)
          .send({
            error: `이행 상태를 ${winner.fulfillment}에서 ${parsed.data.fulfillment}(으)로 바꿀 수 없습니다`,
          });
      }
      const updated = await prisma.winner.update({
        where: { id: winner.id },
        data: { fulfillment: parsed.data.fulfillment },
        select: {
          id: true,
          verification: true,
          fulfillment: true,
          encryptedShipping: true,
          dmSentAt: true,
          dmError: true,
          prize: { select: { name: true, type: true } },
          entry: { select: { dateJst: true, user: { select: { xUsername: true } } } },
        },
      });
      await audit(admin, 'winner.fulfillment', winner.id, { fulfillment: parsed.data.fulfillment });
      return toWinner(updated);
    },
  );
}
