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
  label: z.string(),
  xUserId: z.string().nullable(),
  xUsername: z.string().nullable(),
  status: AdminBrandAccountStatusSchema,
  refreshFailCount: z.number().int(),
  accessTokenExpiresAt: z.string().nullable(),
  /** 이 계정을 참조하는 캠페인 수 */
  campaignCount: z.number().int(),
  /** 브랜드에게 전달할(추가·재연동 공용) 연동 링크 */
  connectUrl: z.string(),
});
export type AdminBrandAccount = z.infer<typeof AdminBrandAccountSchema>;

export const AdminBrandAccountListSchema = z.object({
  accounts: z.array(AdminBrandAccountSchema),
});
export type AdminBrandAccountList = z.infer<typeof AdminBrandAccountListSchema>;

export const AdminBrandAccountCreateSchema = z.object({
  label: z.string().min(1),
});
export type AdminBrandAccountCreate = z.infer<typeof AdminBrandAccountCreateSchema>;

/** GET /admin/campaigns — 목록 항목 (S1). 경고 판정에 필요한 필드만 포함 */
export const AdminCampaignListItemSchema = z.object({
  id: z.string(),
  brandName: z.string(),
  slug: z.string(),
  status: CampaignStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  xUserId: z.string().nullable(),
  xUsername: z.string().nullable(),
  needsReconnect: z.boolean(),
  entryCount: z.number().int(),
  /** 게시 실패한 포스트 수 (F-1.5 운영 감지) */
  failedPostCount: z.number().int(),
});
export type AdminCampaignListItem = z.infer<typeof AdminCampaignListItemSchema>;

export const AdminCampaignListSchema = z.object({
  campaigns: z.array(AdminCampaignListItemSchema),
});
export type AdminCampaignList = z.infer<typeof AdminCampaignListSchema>;

/** POST /admin/campaigns (요청) — 날짜는 ISO 문자열 */
export const AdminCampaignCreateSchema = z.object({
  brandName: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  startsAt: z.string(),
  endsAt: z.string(),
  dailyPostTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('11:00'),
  dailyWinCap: z.number().int().positive().nullable().optional(),
  brandAccountId: z.string().nullable().optional(),
});
export type AdminCampaignCreate = z.infer<typeof AdminCampaignCreateSchema>;

/** PATCH /admin/campaigns/:id (요청) — 결과화면·상태 전환 포함 */
export const AdminCampaignPatchSchema = AdminCampaignCreateSchema.partial().extend({
  status: CampaignStatusSchema.optional(),
  prUrl: z.string().url().nullable().optional(),
  winMediaUrl: z.string().url().nullable().optional(),
  loseMediaUrl: z.string().url().nullable().optional(),
  dmTemplate: z.string().max(1000).nullable().optional(),
});
export type AdminCampaignPatch = z.infer<typeof AdminCampaignPatchSchema>;

/** ① GET /admin/campaigns/:id */
export const AdminCampaignDetailSchema = z.object({
  id: z.string(),
  brandName: z.string(),
  slug: z.string(),
  status: CampaignStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  dailyPostTime: z.string(),
  dailyWinCap: z.number().int().nullable(),
  prUrl: z.string().nullable(),
  winMediaUrl: z.string().nullable(),
  loseMediaUrl: z.string().nullable(),
  dmTemplate: z.string().nullable(),
  brandAccountId: z.string().nullable(),
  brandAccount: AdminBrandAccountSchema.nullable(),
});
export type AdminCampaignDetail = z.infer<typeof AdminCampaignDetailSchema>;

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

/** ③ PATCH /admin/prizes/:id (요청) — 확률·수량 정정 */
export const AdminPrizePatchSchema = z.object({
  name: z.string().min(1).optional(),
  tier: z.number().int().min(1).optional(),
  totalQty: z.number().int().positive().optional(),
  winProbability: z.number().gt(0).lt(1).optional(),
});
export type AdminPrizePatch = z.infer<typeof AdminPrizePatchSchema>;

/** ④ GET /admin/campaigns/:id/post-templates */
export const AdminPostTemplateSchema = z.object({
  id: z.string(),
  label: z.string(),
  bodyText: z.string(),
  mediaUrl: z.string().nullable(),
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
export const AdminPostTemplateCreateSchema = z.object({
  campaignId: z.string(),
  label: z.string().min(1),
  bodyText: z.string().min(1).max(500),
  mediaUrl: z.string().url().optional(),
  activeFrom: z.string(),
  activeTo: z.string(),
});
export type AdminPostTemplateCreate = z.infer<typeof AdminPostTemplateCreateSchema>;

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

export const AdminWinnerListSchema = z.object({ winners: z.array(AdminWinnerSchema) });
export type AdminWinnerList = z.infer<typeof AdminWinnerListSchema>;

/** ⑥ GET /admin/winners/:id/shipping — 복호화 배송지 (열람 감사 대상) */
export const AdminShippingSchema = z.object({
  winnerId: z.string(),
  shipping: z.record(z.string(), z.unknown()).nullable(),
  shippingEnteredAt: z.string().nullable(),
});
export type AdminShipping = z.infer<typeof AdminShippingSchema>;

/** ⑦ PATCH /admin/winners/:id/fulfillment (요청) */
export const AdminFulfillmentPatchSchema = z.object({
  fulfillment: FulfillmentStatusSchema,
});
export type AdminFulfillmentPatch = z.infer<typeof AdminFulfillmentPatchSchema>;
