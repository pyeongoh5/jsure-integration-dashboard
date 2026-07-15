import { z } from "zod";
import { CampaignCategorySchema } from "./campaign.js";

export { CampaignCategorySchema };
export type { CampaignCategory } from "./campaign.js";

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
  "SNS_APPLICATION_DELIVERED",
  "SNS_APPLICATION_RECEIPT_CONFIRMED",
  "SNS_POST_SUBMITTED",
  "SNS_POST_DEADLINE_REMINDER",
  "SNS_POST_APPROVED",
  "SNS_POST_REJECTED",
  "SNS_POST_REJECTION_REMINDER",
  "SNS_INSIGHT_SUBMITTED",
  "SNS_INSIGHT_APPROVED",
  "SNS_INSIGHT_REMINDER",
  "SNS_INSIGHT_OVERDUE_REMINDER",
  "SNS_SETTLEMENT_COMPLETED",
  "SNS_CAMPAIGN_COMPLETED",
  "FAKE_PURCHASE_APPLICATION_APPLIED",
  "FAKE_PURCHASE_APPLICATION_APPROVED",
  "FAKE_PURCHASE_APPLICATION_REJECTED",
  "FAKE_PURCHASE_ORDER_SUBMITTED",
  "FAKE_PURCHASE_REVIEW_SUBMITTED",
  "FAKE_PURCHASE_REVIEW_APPROVED",
  "FAKE_PURCHASE_REVIEW_REJECTED",
  "FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER",
  "FAKE_PURCHASE_SETTLEMENT_COMPLETED",
  "FAKE_PURCHASE_CAMPAIGN_COMPLETED",
  "SIMPLE_REVIEW_APPLICATION_APPLIED",
  "SIMPLE_REVIEW_APPLICATION_APPROVED",
  "SIMPLE_REVIEW_APPLICATION_REJECTED",
  "SIMPLE_REVIEW_APPLICATION_SHIPPED",
  "SIMPLE_REVIEW_APPLICATION_DELIVERED",
  "SIMPLE_REVIEW_APPLICATION_RECEIPT_CONFIRMED",
  "SIMPLE_REVIEW_SUBMITTED",
  "SIMPLE_REVIEW_APPROVED",
  "SIMPLE_REVIEW_REJECTED",
  "SIMPLE_REVIEW_DEADLINE_REMINDER",
  "SIMPLE_REVIEW_REJECTION_REMINDER",
  "SIMPLE_REVIEW_SETTLEMENT_COMPLETED",
  "SIMPLE_REVIEW_CAMPAIGN_COMPLETED",
]);
export type LineTriggerKey = z.infer<typeof LineTriggerKeySchema>;

export const TriggerVariableSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  sample: z.string(),
});
export type TriggerVariable = z.infer<typeof TriggerVariableSchema>;

export const LineMessageTemplateResponseSchema = z.object({
  category: CampaignCategorySchema,
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
  category: CampaignCategorySchema,
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
