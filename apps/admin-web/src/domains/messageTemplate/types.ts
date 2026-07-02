import type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListItem,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  LineTriggerSubType,
  TriggerVariable,
} from "@jsure/shared";

export const TRIGGER_LABELS: Record<LineTriggerKey, string> = {
  SNS_APPLICATION_APPLIED: "1. Application Applied",
  SNS_APPLICATION_APPROVED: "2-a. Application Approved",
  SNS_APPLICATION_REJECTED: "2-b. Application Rejected",
  SNS_APPLICATION_SHIPPED: "3. Shipped",
  SNS_APPLICATION_DELIVERED: "4. Delivered",
  SNS_APPLICATION_RECEIPT_CONFIRMED: "5. Receipt Confirmed",
  SNS_POST_SUBMITTED: "6. Post Submitted",
  SNS_POST_DEADLINE_REMINDER: "6-R. Post Deadline Reminder",
  SNS_POST_APPROVED: "7-a. Post Approved",
  SNS_POST_REJECTED: "7-b. Post Rejected",
  SNS_POST_REJECTION_REMINDER: "7-R. Post Rejection Reminder",
  SNS_INSIGHT_SUBMITTED: "8. Insight Submitted",
  SNS_INSIGHT_REMINDER: "8-R. Insight Reminder",
  SNS_SETTLEMENT_COMPLETED: "9. Settlement Completed",
  SNS_CAMPAIGN_COMPLETED: "10. Campaign Completed",
};

export type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListItem,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  LineTriggerSubType,
  TriggerVariable,
};
