import { z } from "zod";
import { CampaignCategorySchema } from "./campaign.js";

export { CampaignCategorySchema };
export type { CampaignCategory } from "./campaign.js";

/**
 * LINE 템플릿 관리 화면의 탭 단위. 캠페인 카테고리에 더해, 캠페인에 속하지 않는
 * 알림(탈퇴 승인·반려 등)을 담는 COMMON 을 갖는다.
 *
 * CampaignCategory 에 COMMON 을 넣지 않은 이유: 그 enum 은 캠페인 생성 API 의 입력
 * 검증에도 쓰여서, 값을 늘리면 category 가 COMMON 인 캠페인을 만들 수 있게 된다.
 * 템플릿 분류는 템플릿 도메인 안에서만 의미가 있으므로 별도 enum 으로 격리한다.
 */
export const LineTemplateCategorySchema = z.enum([
  "SNS",
  "FAKE_PURCHASE",
  "SIMPLE_REVIEW",
  "COMMON",
]);
export type LineTemplateCategory = z.infer<typeof LineTemplateCategorySchema>;

export const LineTriggerSubTypeSchema = z.enum([
  "INSTAGRAM",
  "X",
  "QOO10",
]);
export type LineTriggerSubType = z.infer<typeof LineTriggerSubTypeSchema>;

export const LineTriggerKeySchema = z.enum([
  "SNS_APPLICATION_APPLIED",
  "SNS_APPLICATION_APPROVED",
  "SNS_APPLICATION_REJECTED",
  "SNS_APPLICATION_SHIPPED",
  "SNS_APPLICATION_SHIPPED_TRACKING_PENDING",
  "SNS_APPLICATION_TRACKING_REGISTERED",
  "SNS_APPLICATION_DELIVERED",
  "SNS_APPLICATION_DELIVERY_REMINDER",
  "SNS_APPLICATION_RECEIPT_CONFIRMED",
  "SNS_POST_SUBMITTED",
  "SNS_POST_DEADLINE_REMINDER",
  "SNS_POST_FINAL_DEADLINE_REMINDER",
  "SNS_POST_OVERDUE_REMINDER",
  "SNS_POST_APPROVED",
  "SNS_POST_REJECTED",
  "SNS_POST_REJECTION_REMINDER",
  "SNS_INSIGHT_SUBMITTED",
  "SNS_INSIGHT_REMINDER",
  "SNS_INSIGHT_OVERDUE_REMINDER",
  "SNS_SETTLEMENT_COMPLETED",
  "SNS_CAMPAIGN_COMPLETED",
  "FAKE_PURCHASE_APPLICATION_APPLIED",
  "FAKE_PURCHASE_APPLICATION_APPROVED",
  "FAKE_PURCHASE_APPLICATION_REJECTED",
  "FAKE_PURCHASE_ORDER_DEADLINE_REMINDER",
  "FAKE_PURCHASE_ORDER_EXPIRED",
  "FAKE_PURCHASE_ORDER_SUBMITTED",
  "FAKE_PURCHASE_REVIEW_SUBMITTED",
  "FAKE_PURCHASE_REVIEW_APPROVED",
  "FAKE_PURCHASE_REVIEW_REJECTED",
  "FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER",
  "FAKE_PURCHASE_REVIEW_FINAL_DEADLINE_REMINDER",
  "FAKE_PURCHASE_REVIEW_OVERDUE_REMINDER",
  "FAKE_PURCHASE_SETTLEMENT_COMPLETED",
  "SIMPLE_REVIEW_APPLICATION_APPLIED",
  "SIMPLE_REVIEW_APPLICATION_APPROVED",
  "SIMPLE_REVIEW_APPLICATION_REJECTED",
  "SIMPLE_REVIEW_APPLICATION_SHIPPED",
  "SIMPLE_REVIEW_APPLICATION_SHIPPED_TRACKING_PENDING",
  "SIMPLE_REVIEW_APPLICATION_TRACKING_REGISTERED",
  "SIMPLE_REVIEW_APPLICATION_DELIVERED",
  "SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER",
  "SIMPLE_REVIEW_APPLICATION_RECEIPT_CONFIRMED",
  "SIMPLE_REVIEW_SUBMITTED",
  "SIMPLE_REVIEW_APPROVED",
  "SIMPLE_REVIEW_REJECTED",
  "SIMPLE_REVIEW_DEADLINE_REMINDER",
  "SIMPLE_REVIEW_FINAL_DEADLINE_REMINDER",
  "SIMPLE_REVIEW_OVERDUE_REMINDER",
  "SIMPLE_REVIEW_REJECTION_REMINDER",
  "SIMPLE_REVIEW_SETTLEMENT_COMPLETED",
  "SIMPLE_REVIEW_CAMPAIGN_COMPLETED",
  "COMMON_WITHDRAWAL_APPROVED",
  "COMMON_WITHDRAWAL_REJECTED",
]);
export type LineTriggerKey = z.infer<typeof LineTriggerKeySchema>;

/**
 * 캠페인 응모 맥락 없이 인플루언서에게 직접 보내는 트리거.
 * 발송 컨텍스트 모양이 캠페인 트리거와 다르므로(응모가 없다) 목록을 따로 둔다.
 */
export const COMMON_LINE_TRIGGER_KEYS = [
  "COMMON_WITHDRAWAL_APPROVED",
  "COMMON_WITHDRAWAL_REJECTED",
] as const satisfies readonly LineTriggerKey[];
export type CommonLineTriggerKey = (typeof COMMON_LINE_TRIGGER_KEYS)[number];

export function isCommonLineTriggerKey(
  triggerKey: LineTriggerKey,
): triggerKey is CommonLineTriggerKey {
  return (COMMON_LINE_TRIGGER_KEYS as readonly LineTriggerKey[]).includes(
    triggerKey,
  );
}

export const TriggerVariableSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  sample: z.string(),
});
export type TriggerVariable = z.infer<typeof TriggerVariableSchema>;

export const LineMessageTemplateResponseSchema = z.object({
  category: LineTemplateCategorySchema,
  triggerKey: LineTriggerKeySchema,
  enabled: z.boolean(),
  body: z.string(),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
  updatedById: z.string().nullable(),
  updatedByName: z.string().nullable(),
});
export type LineMessageTemplateResponse = z.infer<typeof LineMessageTemplateResponseSchema>;

export const LineMessageTemplateListItemSchema = z.object({
  triggerKey: LineTriggerKeySchema,
  enabled: z.boolean(),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
  updatedByName: z.string().nullable(),
});
export type LineMessageTemplateListItem = z.infer<typeof LineMessageTemplateListItemSchema>;

export const LineMessageTemplateListResponseSchema = z.object({
  category: LineTemplateCategorySchema,
  items: z.array(LineMessageTemplateListItemSchema),
});
export type LineMessageTemplateListResponse = z.infer<typeof LineMessageTemplateListResponseSchema>;

export const LineMessageTemplateDetailResponseSchema = z.object({
  template: LineMessageTemplateResponseSchema,
  variables: z.array(TriggerVariableSchema),
});
export type LineMessageTemplateDetailResponse = z.infer<typeof LineMessageTemplateDetailResponseSchema>;

export const UpdateLineMessageTemplateRequestSchema = z.object({
  body: z.string().max(5000),
});
export type UpdateLineMessageTemplateRequest = z.infer<typeof UpdateLineMessageTemplateRequestSchema>;

export const ToggleLineMessageTemplateEnabledRequestSchema = z.object({
  enabled: z.boolean(),
});
export type ToggleLineMessageTemplateEnabledRequest = z.infer<
  typeof ToggleLineMessageTemplateEnabledRequestSchema
>;

export const PreviewLineMessageTemplateRequestSchema = z.object({
  body: z.string().max(5000),
});
export type PreviewLineMessageTemplateRequest = z.infer<typeof PreviewLineMessageTemplateRequestSchema>;

export const PreviewLineMessageTemplateResponseSchema = z.object({
  renderedBody: z.string(),
});
export type PreviewLineMessageTemplateResponse = z.infer<typeof PreviewLineMessageTemplateResponseSchema>;

export const TestSendLineMessageTemplateRequestSchema = z.object({
  body: z.string().max(5000),
});
export type TestSendLineMessageTemplateRequest = z.infer<typeof TestSendLineMessageTemplateRequestSchema>;

export const TestSendLineMessageTemplateResponseSchema = z.object({
  sent: z.boolean(),
});
export type TestSendLineMessageTemplateResponse = z.infer<typeof TestSendLineMessageTemplateResponseSchema>;

export const UpdateAdminTestLineUserIdRequestSchema = z.object({
  testLineUserId: z.string().min(1).nullable(),
});
export type UpdateAdminTestLineUserIdRequest = z.infer<typeof UpdateAdminTestLineUserIdRequestSchema>;
