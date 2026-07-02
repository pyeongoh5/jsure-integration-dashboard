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
  SNS_APPLICATION_APPLIED: "1. 신청 접수",
  SNS_APPLICATION_APPROVED: "2-a. 신청 승인",
  SNS_APPLICATION_REJECTED: "2-b. 신청 반려",
  SNS_APPLICATION_SHIPPED: "3. 상품 발송",
  SNS_APPLICATION_DELIVERED: "4. 배송 완료",
  SNS_APPLICATION_RECEIPT_CONFIRMED: "5. 수령 확인",
  SNS_POST_SUBMITTED: "6. 게시물 제출",
  SNS_POST_DEADLINE_REMINDER: "6-R. 게시 마감 리마인더",
  SNS_POST_APPROVED: "7-a. 게시물 승인",
  SNS_POST_REJECTED: "7-b. 게시물 반려",
  SNS_POST_REJECTION_REMINDER: "7-R. 반려 재제출 리마인더",
  SNS_INSIGHT_SUBMITTED: "8. 인사이트 제출",
  SNS_INSIGHT_REMINDER: "8-R. 인사이트 리마인더",
  SNS_SETTLEMENT_COMPLETED: "9. 정산 완료",
  SNS_CAMPAIGN_COMPLETED: "10. 캠페인 종료",
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
