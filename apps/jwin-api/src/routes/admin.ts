import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@jsure/jwin-db';
import {
  ADMIN_WINNER_PAGE_SIZE,
  AdminBrandAccountCreateSchema,
  AdminBrandAccountPatchSchema,
  AdminBrandCampaignCreateSchema,
  AdminBrandCampaignPatchSchema,
  AdminWinnerFilterSchema,
  dateJst,
  parseCodesInput,
  POST_MEDIA_MAX,
  type AdminWinnerFilter,
} from '@jsure/jwin-shared';
import { config } from '../config';
import { decrypt, encrypt } from '../lib/crypto';
import { AdminIdentity, getAdminIdentity } from '../lib/auth';
import {
  toBrandAccount,
  toBrandCampaignDetail,
  toBrandCampaignListItem,
  toCampaignDetail,
  toCampaignListItem,
  toPrize,
  toPostTemplate,
  toWinner,
  toWinnerExportRow,
  decryptShipping,
  canTransitionFulfillment,
  winnerFilterWhere,
  WINNER_SELECT,
  BrandAccountRow,
} from './adminMappers';
import { activationBlockers, resolveAccountForActivationCheck } from './campaignActivation';

/**
 * 어드민 API (v1: J-sure 운영자 단일 테넌트 — 브로커형)
 * F-1.1 캠페인 CRUD (기간 단위) / F-1.2 소재 / F-1.3 경품+코드 동시 등록 (F-7.3) /
 * F-1.5 중지 / F-1.6 감사 로그 / 캠페인 단위 통계
 *
 * 인증 (D-10): 로그인 엔드포인트가 없다. 대시보드(@jsure/api)에서 로그인해 받은
 * access token을 Authorization: Bearer 로 실어 보내면 서명만 검증한다.
 */

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

  const accountConnectUrl = (accountId: string) =>
    `${config().API_BASE_URL}/oauth/brand/start?accountId=${accountId}`;

  // ── 브랜드 X 계정 (독립 엔티티 — 캠페인과 다대일) ──
  app.get('/admin/brand-accounts', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const accounts = await prisma.brandXAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { campaigns: true } } },
    });
    return {
      accounts: accounts.map((account) =>
        toBrandAccount(account, account._count.campaigns, accountConnectUrl(account.id)),
      ),
    };
  });

  app.post('/admin/brand-accounts', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = AdminBrandAccountCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await ensureBrandSlugAvailable(parsed.data.slug, reply))) return;
    const account = await prisma.brandXAccount.create({ data: parsed.data });
    await audit(admin, 'brandAccount.create', account.id, parsed.data);
    return toBrandAccount(account, 0, accountConnectUrl(account.id));
  });

  app.patch<{ Params: { id: string } }>('/admin/brand-accounts/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = AdminBrandAccountPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await ensureBrandSlugAvailable(parsed.data.slug, reply, req.params.id))) return;
    const account = await prisma.brandXAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return reply.code(404).send({ error: '브랜드를 찾을 수 없습니다' });

    const updated = await prisma.brandXAccount.update({
      where: { id: account.id },
      data: parsed.data,
      include: { _count: { select: { campaigns: true } } },
    });
    await audit(admin, 'brandAccount.update', updated.id, parsed.data);
    return toBrandAccount(updated, updated._count.campaigns, accountConnectUrl(updated.id));
  });

  /**
   * brandAccountId가 명시적으로(null이 아닌 값으로) 주어졌을 때만 실존 여부를 확인한다.
   * 없거나(undefined) 연결 해제(null)인 경우는 검증 없이 통과 — 존재하지 않는 계정을
   * 그대로 저장하면 Prisma가 FK 제약 위반(P2003)으로 500을 던지므로 여기서 400으로 막는다.
   */
  async function ensureBrandAccountExists(
    brandAccountId: string | null | undefined,
    reply: FastifyReply,
  ): Promise<boolean> {
    if (brandAccountId === undefined || brandAccountId === null) return true;
    const account = await prisma.brandXAccount.findUnique({
      where: { id: brandAccountId },
      select: { id: true },
    });
    if (!account) {
      reply.code(400).send({ error: '존재하지 않는 브랜드 계정입니다' });
      return false;
    }
    return true;
  }

  /**
   * slug 는 LP URL 조각이라 unique 다. 중복이면 Prisma 가 P2002 를 던져 500 으로
   * 나가므로, 원인을 알 수 있는 400 으로 미리 거른다.
   */
  async function ensureCampaignSlugAvailable(
    slug: string | undefined,
    reply: FastifyReply,
    currentCampaignId?: string,
  ): Promise<boolean> {
    if (slug === undefined) return true;
    const existing = await prisma.campaign.findUnique({ where: { slug }, select: { id: true } });
    if (existing && existing.id !== currentCampaignId) {
      reply.code(400).send({ error: `이미 사용 중인 slug 입니다: ${slug}` });
      return false;
    }
    return true;
  }

  async function ensureBrandSlugAvailable(
    slug: string | undefined,
    reply: FastifyReply,
    currentBrandAccountId?: string,
  ): Promise<boolean> {
    if (slug === undefined) return true;
    const existing = await prisma.brandXAccount.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing && existing.id !== currentBrandAccountId) {
      reply.code(400).send({ error: `이미 사용 중인 브랜드 slug 입니다: ${slug}` });
      return false;
    }
    return true;
  }

  /** 참여 응답에 실을 브랜드 DTO 조립 */
  async function buildBrandAccountDto(brandAccount: BrandAccountRow) {
    const campaignCount = await prisma.brandCampaign.count({
      where: { brandAccountId: brandAccount.id },
    });
    return toBrandAccount(brandAccount, campaignCount, accountConnectUrl(brandAccount.id));
  }

  // ── 시즌 캠페인 (F-1.1) ──
  //
  // 위계: Campaign(시즌) → BrandCampaign(참여) → BrandXAccount(브랜드).
  // 기간은 시즌이, 진행 상태·게시 설정은 참여가 갖는다. 설계: docs/jwin/CAMPAIGN_HIERARCHY.md

  /** 시즌 목록·상세에서 참여 브랜드 행을 만들 때 쓰는 include. */
  const BRAND_CAMPAIGN_LIST_INCLUDE = {
    _count: { select: { entries: true } },
    brandAccount: {
      select: {
        label: true,
        slug: true,
        logoUrl: true,
        xUsername: true,
        refreshFailedAt: true,
      },
    },
    posts: { where: { status: 'FAILED' as const }, select: { id: true } },
  };

  const campaignSchema = z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  });

  app.post('/admin/campaigns', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.endsAt <= parsed.data.startsAt) {
      return reply.code(400).send({ error: '종료일은 시작일 이후여야 합니다' });
    }
    if (!(await ensureCampaignSlugAvailable(parsed.data.slug, reply))) return;

    const campaign = await prisma.campaign.create({ data: parsed.data });
    await audit(admin, 'campaign.create', campaign.id, parsed.data);
    return toCampaignDetail(campaign, []);
  });

  app.get('/admin/campaigns', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const campaigns = await prisma.campaign.findMany({
      orderBy: { startsAt: 'desc' },
      include: { brands: { include: BRAND_CAMPAIGN_LIST_INCLUDE } },
    });
    return { campaigns: campaigns.map(toCampaignListItem) };
  });

  app.get<{ Params: { id: string } }>('/admin/campaigns/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        brands: {
          include: BRAND_CAMPAIGN_LIST_INCLUDE,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!campaign) return reply.code(404).send({ error: '캠페인을 찾을 수 없습니다' });
    return toCampaignDetail(campaign, campaign.brands.map(toBrandCampaignListItem));
  });

  app.patch<{ Params: { id: string } }>('/admin/campaigns/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = campaignSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await ensureCampaignSlugAvailable(parsed.data.slug, reply, req.params.id))) return;

    const current = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!current) return reply.code(404).send({ error: '캠페인을 찾을 수 없습니다' });
    const startsAt = parsed.data.startsAt ?? current.startsAt;
    const endsAt = parsed.data.endsAt ?? current.endsAt;
    if (endsAt <= startsAt) {
      return reply.code(400).send({ error: '종료일은 시작일 이후여야 합니다' });
    }

    const campaign = await prisma.campaign.update({
      where: { id: current.id },
      data: parsed.data,
      include: { brands: { include: BRAND_CAMPAIGN_LIST_INCLUDE } },
    });
    await audit(admin, 'campaign.update', campaign.id, parsed.data);
    return toCampaignDetail(campaign, campaign.brands.map(toBrandCampaignListItem));
  });

  /** 시즌 삭제 영향도 — 참여 브랜드들의 데이터를 합산한다. */
  app.get<{ Params: { id: string } }>(
    '/admin/campaigns/:id/delete-impact',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, slug: true, _count: { select: { brands: true } } },
      });
      if (!campaign) return reply.code(404).send({ error: '캠페인을 찾을 수 없습니다' });

      const [entryCount, winnerCount, postedCount] = await Promise.all([
        prisma.entry.count({ where: { campaign: { campaignId: campaign.id } } }),
        prisma.winner.count({ where: { entry: { campaign: { campaignId: campaign.id } } } }),
        prisma.campaignPost.count({
          where: { campaign: { campaignId: campaign.id }, status: 'POSTED' },
        }),
      ]);

      return {
        campaignId: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        brandCount: campaign._count.brands,
        entryCount,
        winnerCount,
        postedCount,
      };
    },
  );

  /** 시즌 삭제 — 참여와 그 하위 데이터를 모두 지운다. */
  app.delete<{ Params: { id: string } }>('/admin/campaigns/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, slug: true },
    });
    if (!campaign) return reply.code(404).send({ error: '캠페인을 찾을 수 없습니다' });

    const where = { campaign: { campaignId: campaign.id } };
    await prisma.$transaction([
      prisma.prizeCode.deleteMany({ where: { prize: where } }),
      prisma.winner.deleteMany({ where: { entry: where } }),
      prisma.entry.deleteMany({ where }),
      prisma.campaignPost.deleteMany({ where }),
      prisma.prize.deleteMany({ where }),
      prisma.postTemplate.deleteMany({ where }),
      prisma.brandCampaign.deleteMany({ where: { campaignId: campaign.id } }),
      prisma.campaign.delete({ where: { id: campaign.id } }),
    ]);
    await audit(admin, 'campaign.delete', campaign.id, {
      name: campaign.name,
      slug: campaign.slug,
    });
    return { deleted: true };
  });

  // ── 브랜드 참여 (Campaign × Brand) ──

  app.post('/admin/brand-campaigns', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = AdminBrandCampaignCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await ensureBrandAccountExists(parsed.data.brandAccountId, reply))) return;

    const campaign = await prisma.campaign.findUnique({
      where: { id: parsed.data.campaignId },
      select: { id: true },
    });
    if (!campaign) return reply.code(400).send({ error: '존재하지 않는 캠페인입니다' });

    const duplicate = await prisma.brandCampaign.findUnique({
      where: {
        campaignId_brandAccountId: {
          campaignId: parsed.data.campaignId,
          brandAccountId: parsed.data.brandAccountId,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      return reply.code(400).send({ error: '이미 이 캠페인에 참여 중인 브랜드입니다' });
    }

    const brandCampaign = await prisma.brandCampaign.create({
      data: parsed.data,
      include: { brandAccount: true, campaign: true },
    });
    await audit(admin, 'brandCampaign.create', brandCampaign.id, parsed.data);
    return toBrandCampaignDetail(
      brandCampaign,
      await buildBrandAccountDto(brandCampaign.brandAccount),
    );
  });

  app.get<{ Params: { id: string } }>(
    '/admin/campaigns/:id/brand-campaigns',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const brandCampaigns = await prisma.brandCampaign.findMany({
        where: { campaignId: req.params.id },
        include: BRAND_CAMPAIGN_LIST_INCLUDE,
        orderBy: { createdAt: 'asc' },
      });
      return { brandCampaigns: brandCampaigns.map(toBrandCampaignListItem) };
    },
  );

  /** ① 참여 편집 폼 초기값 — 시즌 요약·브랜드 정보 포함 */
  app.get<{ Params: { id: string } }>('/admin/brand-campaigns/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const brandCampaign = await prisma.brandCampaign.findUnique({
      where: { id: req.params.id },
      include: { brandAccount: true, campaign: true },
    });
    if (!brandCampaign) return reply.code(404).send({ error: '참여를 찾을 수 없습니다' });
    return toBrandCampaignDetail(
      brandCampaign,
      await buildBrandAccountDto(brandCampaign.brandAccount),
    );
  });

  // ② 경품 목록 — id·확률·유형·코드 재고 포함
  app.get<{ Params: { id: string } }>('/admin/brand-campaigns/:id/prizes', async (req, reply) => {
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
    '/admin/brand-campaigns/:id/post-templates',
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

  app.patch<{ Params: { id: string } }>('/admin/brand-campaigns/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = AdminBrandCampaignPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const current = await prisma.brandCampaign.findUnique({
      where: { id: req.params.id },
      include: { brandAccount: true, campaign: true, prizes: true, postTemplates: true },
    });
    if (!current) return reply.code(404).send({ error: '참여를 찾을 수 없습니다' });

    // SETUP → ACTIVE 는 서버가 최종 검증한다. 미비된 채로 올라가면 매일 게시가 조용히 실패한다.
    if (parsed.data.status === 'ACTIVE' && current.status === 'SETUP') {
      const blockers = activationBlockers({
        campaign: {
          // 기간은 시즌에서 온다. DM 문구는 같은 요청에서 함께 바뀔 수 있어 새 값을 우선한다.
          startsAt: current.campaign.startsAt,
          endsAt: current.campaign.endsAt,
          dmTemplate:
            parsed.data.dmTemplate === undefined ? current.dmTemplate : parsed.data.dmTemplate,
        },
        brandAccount: current.brandAccount,
        prizes: current.prizes,
        postTemplates: current.postTemplates,
      });
      if (blockers.length > 0) {
        return reply
          .code(400)
          .send({ error: `캠페인을 시작할 수 없습니다 — ${blockers.join(' / ')}` });
      }
    }

    const brandCampaign = await prisma.brandCampaign.update({
      where: { id: current.id },
      data: parsed.data,
      include: { brandAccount: true, campaign: true },
    });
    await audit(admin, 'brandCampaign.update', brandCampaign.id, parsed.data);
    return toBrandCampaignDetail(
      brandCampaign,
      await buildBrandAccountDto(brandCampaign.brandAccount),
    );
  });

  /**
   * 참여 삭제 영향도 — 함께 사라지는 데이터 건수. 어드민 다이얼로그가 이 값을 보여주고
   * 응모·게시 이력이 있으면 한 번 더 확인받는다.
   */
  app.get<{ Params: { id: string } }>(
    '/admin/brand-campaigns/:id/delete-impact',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const campaignId = req.params.id;
      const brandCampaign = await prisma.brandCampaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          brandAccount: { select: { label: true } },
          campaign: { select: { name: true } },
        },
      });
      if (!brandCampaign) return reply.code(404).send({ error: '참여를 찾을 수 없습니다' });

      const [entryCount, winnerCount, postedCount, prizeCount, postTemplateCount] =
        await Promise.all([
          prisma.entry.count({ where: { campaignId } }),
          prisma.winner.count({ where: { entry: { campaignId } } }),
          prisma.campaignPost.count({ where: { campaignId, status: 'POSTED' } }),
          prisma.prize.count({ where: { campaignId } }),
          prisma.postTemplate.count({ where: { campaignId } }),
        ]);

      return {
        brandCampaignId: brandCampaign.id,
        campaignName: brandCampaign.campaign.name,
        brandName: brandCampaign.brandAccount.label,
        entryCount,
        winnerCount,
        postedCount,
        prizeCount,
        postTemplateCount,
      };
    },
  );

  /**
   * 참여 삭제 — 자식 행까지 한 트랜잭션으로 지운다.
   * 스키마에 onDelete 규칙이 없어(FK 기본 Restrict) 참조 역순으로 지워야 한다:
   * 코드 → 당첨자 → 응모 → 포스트 → 경품 → 포스팅 설정 → 참여.
   * 되돌릴 수 없으므로 확인은 어드민 화면이 책임진다(영향도 표시 + 재확인).
   */
  app.delete<{ Params: { id: string } }>('/admin/brand-campaigns/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const campaignId = req.params.id;
    const brandCampaign = await prisma.brandCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        campaignId: true,
        brandAccount: { select: { label: true } },
      },
    });
    if (!brandCampaign) return reply.code(404).send({ error: '참여를 찾을 수 없습니다' });

    await prisma.$transaction([
      prisma.prizeCode.deleteMany({ where: { prize: { campaignId } } }),
      prisma.winner.deleteMany({ where: { entry: { campaignId } } }),
      prisma.entry.deleteMany({ where: { campaignId } }),
      prisma.campaignPost.deleteMany({ where: { campaignId } }),
      prisma.prize.deleteMany({ where: { campaignId } }),
      prisma.postTemplate.deleteMany({ where: { campaignId } }),
      prisma.brandCampaign.delete({ where: { id: campaignId } }),
    ]);
    await audit(admin, 'brandCampaign.delete', campaignId, {
      campaignId: brandCampaign.campaignId,
      brandName: brandCampaign.brandAccount.label,
    });
    return { deleted: true };
  });

  // ── 포스팅 설정 (F-1.2 주 단위 교체, 미디어 첨부 F-2.3) ──
  const templateSchema = z
    .object({
      campaignId: z.string(),
      label: z.string().min(1),
      bodyText: z.string().min(1).max(500),
      mediaUrls: z.array(z.string().url()).max(POST_MEDIA_MAX).default([]),
      activeFrom: z.coerce.date(),
      activeTo: z.coerce.date(),
    })
    // 역전 구간은 어떤 날에도 선택되지 않아 조용히 게시가 빠진다
    .refine((value) => value.activeTo > value.activeFrom, {
      message: '유효 종료는 유효 시작 이후여야 합니다',
      path: ['activeTo'],
    });

  /** 정정은 campaignId 를 받지 않는다 — 다른 캠페인으로 옮기는 동작은 없다. */
  const templatePatchSchema = z
    .object({
      label: z.string().min(1),
      bodyText: z.string().min(1).max(500),
      mediaUrls: z.array(z.string().url()).max(POST_MEDIA_MAX).default([]),
      activeFrom: z.coerce.date(),
      activeTo: z.coerce.date(),
    })
    .refine((value) => value.activeTo > value.activeFrom, {
      message: '유효 종료는 유효 시작 이후여야 합니다',
      path: ['activeTo'],
    });

  app.post('/admin/post-templates', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    // 기간이 겹치면 스케줄러(materializeTodayPosts)가 배열 순서대로 첫 매치 하나만
    // 골라 나머지는 조용히 게시되지 않는다. 어느 쪽이 뽑힐지 보장이 없으므로
    // 등록 시점에 막는다. 경계가 닿는 것(A 종료 = B 시작)도 겹침으로 본다.
    const overlapping = await prisma.postTemplate.findFirst({
      where: {
        campaignId: parsed.data.campaignId,
        activeFrom: { lte: parsed.data.activeTo },
        activeTo: { gte: parsed.data.activeFrom },
      },
      orderBy: { activeFrom: 'asc' },
    });
    if (overlapping) {
      return reply
        .code(400)
        .send({ error: `유효 기간이 기존 포스트(${overlapping.label})와 겹칩니다` });
    }

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

  /**
   * 등록된 코드 목록 — 정정 화면에서 오기입을 확인할 수 있도록 원문을 복호화해 내려준다.
   * 평문 노출이므로 열람 자체를 감사 로그에 남긴다.
   */
  app.get<{ Params: { id: string } }>('/admin/prizes/:id/codes', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const rows = await prisma.prizeCode.findMany({
      where: { prizeId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    await audit(admin, 'prize.codes_view', req.params.id, { count: rows.length });
    return {
      codes: rows.map((row) => ({
        id: row.id,
        code: decrypt(row.encryptedCode),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    };
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

  // ③ 경품 정정 (확률·수량·이름·티어). 수량을 줄일 때 잔여 재고가 음수가 되지 않도록 검증.
  app.patch<{ Params: { id: string } }>('/admin/prizes/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        tier: z.number().int().min(1).optional(),
        totalQty: z.number().int().positive().optional(),
        winProbability: z.number().gt(0).lt(1).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const prize = await prisma.prize.findUnique({ where: { id: req.params.id } });
    if (!prize) return reply.code(404).send({ error: '경품을 찾을 수 없습니다' });

    // 수량 정정 시 이미 소진된 양(totalQty - remainingQty)보다 작게 줄일 수 없다.
    let remainingQty = prize.remainingQty;
    if (parsed.data.totalQty !== undefined) {
      if (prize.type === 'CODE' && parsed.data.totalQty !== prize.totalQty) {
        return reply.code(400).send({
          error: 'CODE 경품의 수량은 코드 등록(POST /admin/prizes/:id/codes)으로만 변경됩니다',
        });
      }
      const consumed = prize.totalQty - prize.remainingQty;
      if (parsed.data.totalQty < consumed) {
        return reply
          .code(400)
          .send({ error: `이미 배정된 수량(${consumed})보다 적게 줄일 수 없습니다` });
      }
      remainingQty = parsed.data.totalQty - consumed;
    }

    const updated = await prisma.prize.update({
      where: { id: prize.id },
      data: { ...parsed.data, remainingQty },
    });
    await audit(admin, 'prize.update', prize.id, parsed.data);

    const availableCodeCount =
      updated.type === 'CODE'
        ? await prisma.prizeCode.count({ where: { prizeId: updated.id, status: 'AVAILABLE' } })
        : 0;
    return toPrize(updated, availableCodeCount);
  });

  /**
   * 포스트 정정. 이미 게시에 사용된 포스트도 고칠 수 있다 — 나간 트윗은 그대로고
   * 앞으로의 게시에만 반영된다. 기간은 등록 때와 같은 겹침 규칙을 적용한다(자기 자신 제외).
   */
  app.patch<{ Params: { id: string } }>('/admin/post-templates/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = templatePatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const current = await prisma.postTemplate.findUnique({
      where: { id: req.params.id },
      select: { id: true, campaignId: true },
    });
    if (!current) return reply.code(404).send({ error: '포스트를 찾을 수 없습니다' });

    const overlapping = await prisma.postTemplate.findFirst({
      where: {
        campaignId: current.campaignId,
        id: { not: current.id },
        activeFrom: { lte: parsed.data.activeTo },
        activeTo: { gte: parsed.data.activeFrom },
      },
      orderBy: { activeFrom: 'asc' },
    });
    if (overlapping) {
      return reply
        .code(400)
        .send({ error: `유효 기간이 기존 포스트(${overlapping.label})와 겹칩니다` });
    }

    const template = await prisma.postTemplate.update({
      where: { id: current.id },
      data: parsed.data,
    });
    await audit(admin, 'template.update', template.id);
    return template;
  });

  // ⑤ 소재 삭제 — 이미 게시에 사용된 소재는 거부 (CampaignPost.templateId 참조)
  app.delete<{ Params: { id: string } }>('/admin/post-templates/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const usedCount = await prisma.campaignPost.count({ where: { templateId: req.params.id } });
    if (usedCount > 0) {
      return reply.code(409).send({ error: '이미 게시에 사용된 소재는 삭제할 수 없습니다' });
    }
    await prisma.postTemplate.delete({ where: { id: req.params.id } });
    await audit(admin, 'template.delete', req.params.id);
    return { deleted: true };
  });

  // ── 모니터링 대시보드 (참여 단위) ──
  app.get<{ Params: { id: string } }>('/admin/brand-campaigns/:id/stats', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const campaign = await prisma.brandCampaign.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: true,
        brandAccount: {
          select: { label: true, slug: true, xUsername: true, refreshFailedAt: true },
        },
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
      brandName: campaign.brandAccount.label,
      slug: campaign.brandAccount.slug,
      xUsername: campaign.brandAccount.xUsername,
      status: campaign.status,
      startsAt: campaign.campaign.startsAt.toISOString(),
      endsAt: campaign.campaign.endsAt.toISOString(),
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
      needsReconnect: !!campaign.brandAccount?.refreshFailedAt, // 브랜드 재연동 필요 알림
    };
  });

  // 당첨자 목록 (이행 처리용) — 배송지 평문/암호문 미노출 (D-11).
  // 필터는 서버에서 걸고 커서로 페이징한다. 화면이 전량 로드 후 거르면 데이터가
  // 늘었을 때 "보이는 목록 ≠ 실제 전체"가 되고 CSV가 조용히 일부만 담는다.
  app.get<{ Params: { id: string }; Querystring: Record<string, string | undefined> }>(
    '/admin/brand-campaigns/:id/winners',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const parsed = AdminWinnerFilterSchema.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const winners = await prisma.winner.findMany({
        where: winnerFilterWhere(req.params.id, parsed.data),
        select: WINNER_SELECT,
        orderBy: { createdAt: 'desc' },
        take: ADMIN_WINNER_PAGE_SIZE + 1, // 한 건 더 읽어 다음 페이지 유무를 판단
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const page = winners.slice(0, ADMIN_WINNER_PAGE_SIZE);
      const hasMore = winners.length > ADMIN_WINNER_PAGE_SIZE;
      return {
        winners: page.map(toWinner),
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      };
    },
  );

  // CSV 내보내기 — 필터에 걸린 **전체**를 배송지 평문까지 담아 내려준다.
  // 목록과 분리한 이유가 이것이고, 개인정보 반출이므로 열람과 동일하게 감사에 남긴다.
  app.get<{ Params: { id: string }; Querystring: Record<string, string | undefined> }>(
    '/admin/brand-campaigns/:id/winners/export',
    async (req, reply) => {
      const admin = requireAdmin(req, reply);
      if (!admin) return;
      const parsed = AdminWinnerFilterSchema.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const winners = await prisma.winner.findMany({
        where: winnerFilterWhere(req.params.id, parsed.data),
        select: WINNER_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      await audit(admin, 'winner.export', req.params.id, {
        filter: parsed.data,
        rows: winners.length,
      });
      return { rows: winners.map(toWinnerExportRow) };
    },
  );

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
        select: WINNER_SELECT,
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
