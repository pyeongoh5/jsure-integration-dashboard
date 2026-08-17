import type { AdminTranslationKey } from "@i18n/admin";
import type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListItem,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  TriggerVariable,
} from "@jsure/shared";

// 값은 i18n 키 — 표시 시점에 컴포넌트에서 t(...) 로 번역한다.
export const TRIGGER_LABELS: Record<LineTriggerKey, AdminTranslationKey> = {
  SNS_APPLICATION_APPLIED: "domains.messageTemplate.triggerLabels.snsApplicationApplied",
  SNS_APPLICATION_APPROVED: "domains.messageTemplate.triggerLabels.snsApplicationApproved",
  SNS_APPLICATION_REJECTED: "domains.messageTemplate.triggerLabels.snsApplicationRejected",
  SNS_APPLICATION_SHIPPED: "domains.messageTemplate.triggerLabels.snsApplicationShipped",
  SNS_APPLICATION_DELIVERED: "domains.messageTemplate.triggerLabels.snsApplicationDelivered",
  SNS_APPLICATION_DELIVERY_REMINDER:
    "domains.messageTemplate.triggerLabels.snsApplicationDeliveryReminder",
  SNS_APPLICATION_RECEIPT_CONFIRMED:
    "domains.messageTemplate.triggerLabels.snsApplicationReceiptConfirmed",
  SNS_POST_SUBMITTED: "domains.messageTemplate.triggerLabels.snsPostSubmitted",
  SNS_POST_DEADLINE_REMINDER: "domains.messageTemplate.triggerLabels.snsPostDeadlineReminder",
  SNS_POST_OVERDUE_REMINDER: "domains.messageTemplate.triggerLabels.snsPostOverdueReminder",
  SNS_POST_APPROVED: "domains.messageTemplate.triggerLabels.snsPostApproved",
  SNS_POST_REJECTED: "domains.messageTemplate.triggerLabels.snsPostRejected",
  SNS_POST_REJECTION_REMINDER: "domains.messageTemplate.triggerLabels.snsPostRejectionReminder",
  SNS_INSIGHT_REMINDER: "domains.messageTemplate.triggerLabels.snsInsightReminder",
  SNS_INSIGHT_SUBMITTED: "domains.messageTemplate.triggerLabels.snsInsightSubmitted",
  SNS_INSIGHT_OVERDUE_REMINDER:
    "domains.messageTemplate.triggerLabels.snsInsightOverdueReminder",
  SNS_SETTLEMENT_COMPLETED: "domains.messageTemplate.triggerLabels.snsSettlementCompleted",
  SNS_CAMPAIGN_COMPLETED: "domains.messageTemplate.triggerLabels.snsCampaignCompleted",
  FAKE_PURCHASE_APPLICATION_APPLIED:
    "domains.messageTemplate.triggerLabels.fakePurchaseApplicationApplied",
  FAKE_PURCHASE_APPLICATION_APPROVED:
    "domains.messageTemplate.triggerLabels.fakePurchaseApplicationApproved",
  FAKE_PURCHASE_APPLICATION_REJECTED:
    "domains.messageTemplate.triggerLabels.fakePurchaseApplicationRejected",
  FAKE_PURCHASE_ORDER_DEADLINE_REMINDER:
    "domains.messageTemplate.triggerLabels.fakePurchaseOrderDeadlineReminder",
  FAKE_PURCHASE_ORDER_EXPIRED: "domains.messageTemplate.triggerLabels.fakePurchaseOrderExpired",
  FAKE_PURCHASE_ORDER_SUBMITTED:
    "domains.messageTemplate.triggerLabels.fakePurchaseOrderSubmitted",
  FAKE_PURCHASE_REVIEW_SUBMITTED:
    "domains.messageTemplate.triggerLabels.fakePurchaseReviewSubmitted",
  FAKE_PURCHASE_REVIEW_APPROVED:
    "domains.messageTemplate.triggerLabels.fakePurchaseReviewApproved",
  FAKE_PURCHASE_REVIEW_REJECTED:
    "domains.messageTemplate.triggerLabels.fakePurchaseReviewRejected",
  FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER:
    "domains.messageTemplate.triggerLabels.fakePurchaseReviewDeadlineReminder",
  FAKE_PURCHASE_REVIEW_OVERDUE_REMINDER:
    "domains.messageTemplate.triggerLabels.fakePurchaseReviewOverdueReminder",
  FAKE_PURCHASE_SETTLEMENT_COMPLETED:
    "domains.messageTemplate.triggerLabels.fakePurchaseSettlementCompleted",
  SIMPLE_REVIEW_APPLICATION_APPLIED:
    "domains.messageTemplate.triggerLabels.simpleReviewApplicationApplied",
  SIMPLE_REVIEW_APPLICATION_APPROVED:
    "domains.messageTemplate.triggerLabels.simpleReviewApplicationApproved",
  SIMPLE_REVIEW_APPLICATION_REJECTED:
    "domains.messageTemplate.triggerLabels.simpleReviewApplicationRejected",
  SIMPLE_REVIEW_APPLICATION_SHIPPED:
    "domains.messageTemplate.triggerLabels.simpleReviewApplicationShipped",
  SIMPLE_REVIEW_APPLICATION_DELIVERED:
    "domains.messageTemplate.triggerLabels.simpleReviewApplicationDelivered",
  SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER:
    "domains.messageTemplate.triggerLabels.simpleReviewApplicationDeliveryReminder",
  SIMPLE_REVIEW_APPLICATION_RECEIPT_CONFIRMED:
    "domains.messageTemplate.triggerLabels.simpleReviewApplicationReceiptConfirmed",
  SIMPLE_REVIEW_SUBMITTED: "domains.messageTemplate.triggerLabels.simpleReviewSubmitted",
  SIMPLE_REVIEW_DEADLINE_REMINDER:
    "domains.messageTemplate.triggerLabels.simpleReviewDeadlineReminder",
  SIMPLE_REVIEW_OVERDUE_REMINDER:
    "domains.messageTemplate.triggerLabels.simpleReviewOverdueReminder",
  SIMPLE_REVIEW_APPROVED: "domains.messageTemplate.triggerLabels.simpleReviewApproved",
  SIMPLE_REVIEW_REJECTED: "domains.messageTemplate.triggerLabels.simpleReviewRejected",
  SIMPLE_REVIEW_REJECTION_REMINDER:
    "domains.messageTemplate.triggerLabels.simpleReviewRejectionReminder",
  SIMPLE_REVIEW_SETTLEMENT_COMPLETED:
    "domains.messageTemplate.triggerLabels.simpleReviewSettlementCompleted",
  SIMPLE_REVIEW_CAMPAIGN_COMPLETED:
    "domains.messageTemplate.triggerLabels.simpleReviewCampaignCompleted",
};

/**
 * 발송 시점이 제목만으로 드러나지 않는 트리거에만 붙이는 설명.
 * 대상은 크론으로 발송되는 리마인더뿐이다 — 나머지는 이벤트 발생 즉시 발송되고
 * 제목이 그 이벤트 이름이라 설명이 중복된다.
 * 발송 시점을 바꿀 때는 `apps/api/src/line-templates/line-reminders.service.ts` 와
 * 이 표를 함께 고쳐야 한다.
 * 값은 i18n 키 — 표시 시점에 컴포넌트에서 t(...) 로 번역한다.
 */
export const TRIGGER_DESCRIPTIONS: Partial<Record<LineTriggerKey, AdminTranslationKey>> = {
  SNS_APPLICATION_DELIVERY_REMINDER:
    "domains.messageTemplate.triggerDescriptions.deliveryReminder",
  SNS_POST_DEADLINE_REMINDER:
    "domains.messageTemplate.triggerDescriptions.postDeadlineReminder",
  SNS_POST_OVERDUE_REMINDER: "domains.messageTemplate.triggerDescriptions.postOverdueReminder",
  SNS_POST_REJECTION_REMINDER:
    "domains.messageTemplate.triggerDescriptions.postRejectionReminder",
  SNS_INSIGHT_REMINDER: "domains.messageTemplate.triggerDescriptions.insightReminder",
  SNS_INSIGHT_OVERDUE_REMINDER:
    "domains.messageTemplate.triggerDescriptions.insightOverdueReminder",
  FAKE_PURCHASE_ORDER_DEADLINE_REMINDER:
    "domains.messageTemplate.triggerDescriptions.orderDeadlineReminder",
  FAKE_PURCHASE_ORDER_EXPIRED: "domains.messageTemplate.triggerDescriptions.orderExpired",
  FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER:
    "domains.messageTemplate.triggerDescriptions.reviewDeadlineReminder",
  FAKE_PURCHASE_REVIEW_OVERDUE_REMINDER:
    "domains.messageTemplate.triggerDescriptions.reviewOverdueReminder",
  SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER:
    "domains.messageTemplate.triggerDescriptions.deliveryReminder",
  SIMPLE_REVIEW_DEADLINE_REMINDER:
    "domains.messageTemplate.triggerDescriptions.reviewDeadlineReminder",
  SIMPLE_REVIEW_OVERDUE_REMINDER:
    "domains.messageTemplate.triggerDescriptions.reviewOverdueReminder",
  SIMPLE_REVIEW_REJECTION_REMINDER:
    "domains.messageTemplate.triggerDescriptions.reviewRejectionReminder",
};

export type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListItem,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  TriggerVariable,
};
