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
  xUserId: z.string().nullable(),
  xUsername: z.string().nullable(),
  /** 브랜드가 앱 연동을 끊어 재연동이 필요한 상태 */
  needsReconnect: z.boolean(),
  /** 브랜드에게 전달할 X 연동 링크 */
  connectUrl: z.string(),
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
