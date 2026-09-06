import { z } from 'zod';

/**
 * 어드민 API 계약 (D-11) — 요청/응답의 단일 소스.
 * jwin-api는 Prisma 모델을 이 모양으로 매핑해 반환하고, admin-web은 `.parse()`로 받는다.
 * 날짜는 경계에서 ISO 문자열로 주고받는다.
 */

export const CampaignStatusSchema = z.enum(['SETUP', 'ACTIVE', 'PAUSED', 'ENDED']);
export const PrizeTypeSchema = z.enum(['PHYSICAL', 'CODE']);
export const VerificationStatusSchema = z.enum([
  'PENDING',
  'FOLLOW_FAILED',
  'REPOST_FAILED',
  'PASSED',
]);
export const FulfillmentStatusSchema = z.enum([
  'NOT_READY',
  'AWAITING_INFO',
  'READY',
  'DM_SENT',
  'SHIPPED',
  'FAILED',
]);

export const AdminBrandAccountStatusSchema = z.enum([
  'PENDING',         // xUserId 없음 (브랜드 승인 전)
  'CONNECTED',       // 연동됨, refresh 정상
  'NEEDS_RECONNECT', // refresh 실패 — 재연동 필요
]);

export const AdminBrandAccountSchema = z.object({
  id: z.string(),
  /** 브랜드 표시명 */
  label: z.string(),
  /** 참여 LP URL 조각: /c/{campaignSlug}/{slug} */
  slug: z.string(),
  logoUrl: z.string().nullable(),
  xUserId: z.string().nullable(),
  xUsername: z.string().nullable(),
  status: AdminBrandAccountStatusSchema,
  refreshFailCount: z.number().int(),
  accessTokenExpiresAt: z.string().nullable(),
  /** 이 브랜드가 참여 중인 캠페인 수 */
  campaignCount: z.number().int(),
  /** 브랜드에게 전달할(추가·재연동 공용) 연동 링크 */
  connectUrl: z.string(),
});
export type AdminBrandAccount = z.infer<typeof AdminBrandAccountSchema>;

export const AdminBrandAccountListSchema = z.object({
  accounts: z.array(AdminBrandAccountSchema),
});
export type AdminBrandAccountList = z.infer<typeof AdminBrandAccountListSchema>;

const BrandSlugSchema = z.string().regex(/^[a-z0-9-]+$/);

export const AdminBrandAccountCreateSchema = z.object({
  label: z.string().min(1),
  slug: BrandSlugSchema,
  logoUrl: z.string().url().nullable().optional(),
});
export type AdminBrandAccountCreate = z.infer<typeof AdminBrandAccountCreateSchema>;

export const AdminBrandAccountPatchSchema = z.object({
  label: z.string().min(1).optional(),
  slug: BrandSlugSchema.optional(),
  logoUrl: z.string().url().nullable().optional(),
});
export type AdminBrandAccountPatch = z.infer<typeof AdminBrandAccountPatchSchema>;

/**
 * GET /admin/campaigns — 시즌 목록 항목.
 * 경고(재연동 필요·게시 실패)는 참여 브랜드들에서 합산한다.
 */
export const AdminCampaignListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  /** 참여 브랜드 수 */
  brandCount: z.number().int(),
  entryCount: z.number().int(),
  /** 재연동이 필요한 참여 브랜드 수 */
  needsReconnectCount: z.number().int(),
  /** 게시 실패한 포스트 수 (F-1.5 운영 감지) */
  failedPostCount: z.number().int(),
});
export type AdminCampaignListItem = z.infer<typeof AdminCampaignListItemSchema>;

export const AdminCampaignListSchema = z.object({
  campaigns: z.array(AdminCampaignListItemSchema),
});
export type AdminCampaignList = z.infer<typeof AdminCampaignListSchema>;

/** POST /admin/campaigns (요청) — 시즌. 날짜는 ISO 문자열 */
export const AdminCampaignCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  startsAt: z.string(),
  endsAt: z.string(),
});
export type AdminCampaignCreate = z.infer<typeof AdminCampaignCreateSchema>;

/** PATCH /admin/campaigns/:id (요청) — 시즌 */
export const AdminCampaignPatchSchema = AdminCampaignCreateSchema.partial();
export type AdminCampaignPatch = z.infer<typeof AdminCampaignPatchSchema>;

/** 시즌 상세의 참여 브랜드 행. */
export const AdminBrandCampaignListItemSchema = z.object({
  id: z.string(),
  status: CampaignStatusSchema,
  brandAccountId: z.string(),
  brandName: z.string(),
  brandSlug: z.string(),
  brandLogoUrl: z.string().nullable(),
  xUsername: z.string().nullable(),
  needsReconnect: z.boolean(),
  entryCount: z.number().int(),
  failedPostCount: z.number().int(),
});
export type AdminBrandCampaignListItem = z.infer<typeof AdminBrandCampaignListItemSchema>;

export const AdminBrandCampaignListSchema = z.object({
  brandCampaigns: z.array(AdminBrandCampaignListItemSchema),
});
export type AdminBrandCampaignList = z.infer<typeof AdminBrandCampaignListSchema>;

/** ① GET /admin/campaigns/:id — 시즌 + 참여 브랜드 목록 */
export const AdminCampaignDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  brands: z.array(AdminBrandCampaignListItemSchema),
});
export type AdminCampaignDetail = z.infer<typeof AdminCampaignDetailSchema>;

/** POST /admin/brand-campaigns (요청) — 브랜드를 시즌에 참여시킨다 */
export const AdminBrandCampaignCreateSchema = z.object({
  campaignId: z.string(),
  brandAccountId: z.string(),
  dailyPostTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('11:00'),
  dailyWinCap: z.number().int().positive().nullable().optional(),
});
export type AdminBrandCampaignCreate = z.infer<typeof AdminBrandCampaignCreateSchema>;

/** PATCH /admin/brand-campaigns/:id (요청) — 게시 설정·결과화면·상태 전환 */
export const AdminBrandCampaignPatchSchema = z.object({
  status: CampaignStatusSchema.optional(),
  dailyPostTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  dailyWinCap: z.number().int().positive().nullable().optional(),
  /** 링크 카드 이미지 (LP 의 og:image) */
  cardImageUrl: z.string().url().nullable().optional(),
  /** 이벤트 규칙 가이드 URL — 포스트 본문에 텍스트 링크로 나간다 */
  rulesUrl: z.string().url().nullable().optional(),
  prUrl: z.string().url().nullable().optional(),
  winMediaUrl: z.string().url().nullable().optional(),
  loseMediaUrl: z.string().url().nullable().optional(),
  dmTemplate: z.string().max(1000).nullable().optional(),
});
export type AdminBrandCampaignPatch = z.infer<typeof AdminBrandCampaignPatchSchema>;

/** 참여가 속한 시즌 요약 — 기간 판정과 화면 상단 표시에 쓴다. */
export const AdminCampaignSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});
export type AdminCampaignSummary = z.infer<typeof AdminCampaignSummarySchema>;

/** GET /admin/brand-campaigns/:id — 참여 상세 (기존 캠페인 상세 자리) */
export const AdminBrandCampaignDetailSchema = z.object({
  id: z.string(),
  status: CampaignStatusSchema,
  dailyPostTime: z.string(),
  dailyWinCap: z.number().int().nullable(),
  cardImageUrl: z.string().nullable(),
  rulesUrl: z.string().nullable(),
  prUrl: z.string().nullable(),
  winMediaUrl: z.string().nullable(),
  loseMediaUrl: z.string().nullable(),
  dmTemplate: z.string().nullable(),
  campaign: AdminCampaignSummarySchema,
  brandAccountId: z.string(),
  brandAccount: AdminBrandAccountSchema,
});
export type AdminBrandCampaignDetail = z.infer<typeof AdminBrandCampaignDetailSchema>;

/** ② GET /admin/campaigns/:id/prizes */
export const AdminPrizeSchema = z.object({
  id: z.string(),
  type: PrizeTypeSchema,
  name: z.string(),
  tier: z.number().int(),
  totalQty: z.number().int(),
  remainingQty: z.number().int(),
  winProbability: z.number(),
  /** CODE 경품의 사용 가능한 코드 재고 수 (PHYSICAL은 0) */
  availableCodeCount: z.number().int(),
});
export type AdminPrize = z.infer<typeof AdminPrizeSchema>;

export const AdminPrizeListSchema = z.object({ prizes: z.array(AdminPrizeSchema) });
export type AdminPrizeList = z.infer<typeof AdminPrizeListSchema>;

/**
 * 등록된 기프트코드 1건. 코드 원문은 DB 에 암호화 저장돼 있고, 이 응답에서만
 * 복호화해 내려간다 — 정정 화면에서 오기입을 확인할 수 있어야 하기 때문이다.
 */
export const AdminPrizeCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'SENT', 'REVOKED']),
  createdAt: z.string(),
});
export type AdminPrizeCode = z.infer<typeof AdminPrizeCodeSchema>;

export const AdminPrizeCodeListSchema = z.object({ codes: z.array(AdminPrizeCodeSchema) });
export type AdminPrizeCodeList = z.infer<typeof AdminPrizeCodeListSchema>;

/** ③ PATCH /admin/prizes/:id (요청) — 확률·수량 정정 */
export const AdminPrizePatchSchema = z.object({
  name: z.string().min(1).optional(),
  tier: z.number().int().min(1).optional(),
  totalQty: z.number().int().positive().optional(),
  winProbability: z.number().gt(0).lt(1).optional(),
});
export type AdminPrizePatch = z.infer<typeof AdminPrizePatchSchema>;

/** ④ GET /admin/campaigns/:id/post-templates */
/** 트윗 1건에 붙일 수 있는 미디어 최대 개수 (X 제한). */
export const POST_MEDIA_MAX = 4;

export const AdminPostTemplateSchema = z.object({
  id: z.string(),
  label: z.string(),
  bodyText: z.string(),
  /** @deprecated mediaUrls 로 대체. 구버전 API 응답 호환용. */
  mediaUrl: z.string().nullable(),
  /** 첨부 미디어 URL 목록 (최대 4장). default 는 이 필드를 아직 안 주는 구 API 대비. */
  mediaUrls: z.array(z.string()).default([]),
  activeFrom: z.string(),
  activeTo: z.string(),
  /** 이미 게시에 사용됨 → 삭제 불가 */
  used: z.boolean(),
});
export type AdminPostTemplate = z.infer<typeof AdminPostTemplateSchema>;

export const AdminPostTemplateListSchema = z.object({
  postTemplates: z.array(AdminPostTemplateSchema),
});
export type AdminPostTemplateList = z.infer<typeof AdminPostTemplateListSchema>;

/** POST /admin/prizes (요청) — 서버 admin.ts prizeSchema 와 같은 모양 (F-1.3, F-7.3) */
export const AdminPrizeCreateSchema = z.object({
  campaignId: z.string(),
  type: PrizeTypeSchema,
  name: z.string().min(1),
  tier: z.number().int().min(1),
  totalQty: z.number().int().positive(),
  winProbability: z.number().gt(0).lt(1),
  /** CODE 경품: 엑셀 붙여넣기 원문(개행/탭/쉼표 구분). 코드 개수는 totalQty 와 같아야 한다 */
  codesText: z.string().optional(),
});
export type AdminPrizeCreate = z.infer<typeof AdminPrizeCreateSchema>;

/** POST /admin/post-templates (요청) — 날짜는 ISO 문자열 (F-1.2) */
export const AdminPostTemplateCreateSchema = z
  .object({
    campaignId: z.string(),
    label: z.string().min(1),
    bodyText: z.string().min(1).max(500),
    mediaUrls: z.array(z.string().url()).max(POST_MEDIA_MAX).default([]),
    activeFrom: z.string(),
    activeTo: z.string(),
  })
  // 역전 구간은 어떤 날에도 선택되지 않아 조용히 게시가 빠진다
  .refine((value) => new Date(value.activeTo) > new Date(value.activeFrom), {
    message: '유효 종료는 유효 시작 이후여야 합니다',
    path: ['activeTo'],
  });
export type AdminPostTemplateCreate = z.infer<typeof AdminPostTemplateCreateSchema>;

/**
 * ⑥ PATCH /admin/post-templates/:id — 등록한 포스트 정정.
 * 전체 필드를 다시 보낸다(부분 갱신이 아니다) — 화면이 폼 값을 통째로 들고 있다.
 * mediaUrl 을 null 로 보내면 첨부를 제거한다.
 */
export const AdminPostTemplatePatchSchema = z
  .object({
    label: z.string().min(1),
    bodyText: z.string().min(1).max(500),
    mediaUrls: z.array(z.string().url()).max(POST_MEDIA_MAX).default([]),
    activeFrom: z.string(),
    activeTo: z.string(),
  })
  .refine((value) => new Date(value.activeTo) > new Date(value.activeFrom), {
    message: '유효 종료는 유효 시작 이후여야 합니다',
    path: ['activeTo'],
  });
export type AdminPostTemplatePatch = z.infer<typeof AdminPostTemplatePatchSchema>;

/** 당첨자 목록 항목 — 배송지 평문/암호문 없이 유무(hasShipping)만 노출 */
export const AdminWinnerSchema = z.object({
  id: z.string(),
  dateJst: z.string(),
  xUsername: z.string().nullable(),
  prizeName: z.string(),
  prizeType: PrizeTypeSchema,
  verification: VerificationStatusSchema,
  fulfillment: FulfillmentStatusSchema,
  hasShipping: z.boolean(),
  dmSentAt: z.string().nullable(),
  dmError: z.string().nullable(),
});
export type AdminWinner = z.infer<typeof AdminWinnerSchema>;

/**
 * 목록 필터. 서버(SQL)에서 거르고 커서로 페이징한다 — 화면이 전량 로드 후 거르면
 * 데이터가 늘었을 때 "보이는 목록 ≠ 실제 전체"가 되고 CSV가 조용히 일부만 담는다.
 * 값들이 파생 없는 raw enum이라 별도 판정 표는 두지 않는다.
 */
export const AdminWinnerFilterSchema = z.object({
  verification: VerificationStatusSchema.optional(),
  fulfillment: FulfillmentStatusSchema.optional(),
  prizeType: PrizeTypeSchema.optional(),
});
export type AdminWinnerFilter = z.infer<typeof AdminWinnerFilterSchema>;

export const ADMIN_WINNER_PAGE_SIZE = 50;

export const AdminWinnerListSchema = z.object({
  winners: z.array(AdminWinnerSchema),
  /** 다음 페이지 커서(마지막 항목 id). 더 없으면 null */
  nextCursor: z.string().nullable(),
});
export type AdminWinnerList = z.infer<typeof AdminWinnerListSchema>;

/** LP 배송지 입력 폼과 같은 모양 (public.ts shippingSchema) */
export const AdminShippingAddressSchema = z.object({
  postalCode: z.string(),
  prefecture: z.string(),
  address1: z.string(),
  address2: z.string().optional(),
  fullName: z.string(),
  phone: z.string(),
});
export type AdminShippingAddress = z.infer<typeof AdminShippingAddressSchema>;

/** ⑥ GET /admin/winners/:id/shipping — 복호화 배송지 (열람 감사 대상) */
export const AdminShippingSchema = z.object({
  winnerId: z.string(),
  shipping: AdminShippingAddressSchema.nullable(),
  shippingEnteredAt: z.string().nullable(),
});
export type AdminShipping = z.infer<typeof AdminShippingSchema>;

/**
 * CSV 내보내기 행 — 배송지 평문을 포함하므로 목록과 분리된 전용 엔드포인트로만 내려간다.
 * 필터에 걸린 **전체**를 담는다(현재 로드된 페이지가 아니라).
 */
export const AdminWinnerExportRowSchema = AdminWinnerSchema.extend({
  shipping: AdminShippingAddressSchema.nullable(),
});
export type AdminWinnerExportRow = z.infer<typeof AdminWinnerExportRowSchema>;

export const AdminWinnerExportSchema = z.object({
  rows: z.array(AdminWinnerExportRowSchema),
});
export type AdminWinnerExport = z.infer<typeof AdminWinnerExportSchema>;

/** GET /admin/campaigns/:id/stats — 통계 탭 */
export const AdminCampaignStatsSchema = z.object({
  campaignId: z.string(),
  brandName: z.string(),
  slug: z.string(),
  xUsername: z.string().nullable(),
  status: CampaignStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  entries: z.number().int(),
  winConfirmed: z.number().int(),
  winPendingToday: z.number().int(),
  /** 당첨됐지만 당일 내 검증을 못 끝낸 건. 재고는 이미 차감됨 (D-2 개정) */
  unfulfilledWins: z.number().int(),
  prizeStock: z.array(
    z.object({ name: z.string(), total: z.number().int(), remaining: z.number().int() }),
  ),
  failedPosts: z.number().int(),
  needsReconnect: z.boolean(),
});
export type AdminCampaignStats = z.infer<typeof AdminCampaignStatsSchema>;

/**
 * DELETE 전 영향도 — 참여를 지우면 함께 사라지는 데이터의 건수.
 * 응모·게시 이력이 있으면 어드민에게 한 번 더 확인받는 데 쓴다.
 */
export const AdminBrandCampaignDeleteImpactSchema = z.object({
  brandCampaignId: z.string(),
  campaignName: z.string(),
  brandName: z.string(),
  entryCount: z.number().int(),
  winnerCount: z.number().int(),
  /** 실제로 X 에 게시된 포스트 수 (게시 전 예약분은 제외) */
  postedCount: z.number().int(),
  prizeCount: z.number().int(),
  postTemplateCount: z.number().int(),
});
export type AdminBrandCampaignDeleteImpact = z.infer<
  typeof AdminBrandCampaignDeleteImpactSchema
>;

/** 시즌 삭제 영향도 — 참여 브랜드들의 데이터를 합산한다. */
export const AdminCampaignDeleteImpactSchema = z.object({
  campaignId: z.string(),
  name: z.string(),
  slug: z.string(),
  brandCount: z.number().int(),
  entryCount: z.number().int(),
  winnerCount: z.number().int(),
  postedCount: z.number().int(),
});
export type AdminCampaignDeleteImpact = z.infer<typeof AdminCampaignDeleteImpactSchema>;

/** ⑦ PATCH /admin/winners/:id/fulfillment (요청) */
export const AdminFulfillmentPatchSchema = z.object({
  fulfillment: FulfillmentStatusSchema,
});
export type AdminFulfillmentPatch = z.infer<typeof AdminFulfillmentPatchSchema>;
