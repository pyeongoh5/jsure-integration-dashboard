import type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListItem,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
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
  SNS_POST_OVERDUE_REMINDER: "6-r. 게시 마감 다음날 독촉",
  SNS_POST_APPROVED: "7-a. 게시물 승인",
  SNS_POST_REJECTED: "7-b. 게시물 반려",
  SNS_POST_REJECTION_REMINDER: "7-R. 반려 재제출 리마인더",
  SNS_INSIGHT_REMINDER: "8. 인사이트 제출 당일 리마인더",
  SNS_INSIGHT_SUBMITTED: "8-a. 인사이트 제출 완료",
  SNS_INSIGHT_OVERDUE_REMINDER: "8-r. 인사이트 제출 다음날 독촉",
  SNS_SETTLEMENT_COMPLETED: "9. 정산 완료",
  SNS_CAMPAIGN_COMPLETED: "10. 무보수 캠페인 종료 안내",
  FAKE_PURCHASE_APPLICATION_APPLIED: "1. 신청 접수",
  FAKE_PURCHASE_APPLICATION_APPROVED: "2-a. 신청 승인",
  FAKE_PURCHASE_APPLICATION_REJECTED: "2-b. 신청 반려",
  FAKE_PURCHASE_ORDER_SUBMITTED: "3. 주문 제출",
  FAKE_PURCHASE_REVIEW_SUBMITTED: "4. 리뷰 제출",
  FAKE_PURCHASE_REVIEW_APPROVED: "5-a. 리뷰 승인",
  FAKE_PURCHASE_REVIEW_REJECTED: "5-b. 리뷰 반려",
  FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER: "5-R. 리뷰 마감 리마인더",
  FAKE_PURCHASE_REVIEW_OVERDUE_REMINDER: "5-r. 리뷰 마감 다음날 독촉",
  FAKE_PURCHASE_SETTLEMENT_COMPLETED: "6. 정산 완료",
  SIMPLE_REVIEW_APPLICATION_APPLIED: "1. 신청 접수",
  SIMPLE_REVIEW_APPLICATION_APPROVED: "2-a. 신청 승인",
  SIMPLE_REVIEW_APPLICATION_REJECTED: "2-b. 신청 반려",
  SIMPLE_REVIEW_APPLICATION_SHIPPED: "3. 상품 발송",
  SIMPLE_REVIEW_APPLICATION_DELIVERED: "4. 배송 완료",
  SIMPLE_REVIEW_APPLICATION_RECEIPT_CONFIRMED: "5. 수령 확인",
  SIMPLE_REVIEW_SUBMITTED: "6. 리뷰 제출",
  SIMPLE_REVIEW_DEADLINE_REMINDER: "6-R. 리뷰 마감 리마인더",
  SIMPLE_REVIEW_OVERDUE_REMINDER: "6-r. 리뷰 마감 다음날 독촉",
  SIMPLE_REVIEW_APPROVED: "7-a. 리뷰 승인",
  SIMPLE_REVIEW_REJECTED: "7-b. 리뷰 반려",
  SIMPLE_REVIEW_REJECTION_REMINDER: "7-R. 반려 재제출 리마인더",
  SIMPLE_REVIEW_SETTLEMENT_COMPLETED: "8. 정산 완료",
  SIMPLE_REVIEW_CAMPAIGN_COMPLETED: "9. 무보수 캠페인 종료 안내",
};

/**
 * 발송 시점이 제목만으로 드러나지 않는 트리거에만 붙이는 설명.
 * 대상은 크론으로 발송되는 리마인더뿐이다 — 나머지는 이벤트 발생 즉시 발송되고
 * 제목이 그 이벤트 이름이라 설명이 중복된다.
 * 발송 시점을 바꿀 때는 `apps/api/src/line-templates/line-reminders.service.ts` 와
 * 이 표를 함께 고쳐야 한다.
 */
export const TRIGGER_DESCRIPTIONS: Partial<Record<LineTriggerKey, string>> = {
  SNS_POST_DEADLINE_REMINDER: "게시 마감 3일 전·1일 전 발송",
  SNS_POST_OVERDUE_REMINDER: "게시 마감 다음날 발송 (미제출자 독촉)",
  SNS_POST_REJECTION_REMINDER: "게시물 반려 다음날 발송 (재제출 독려)",
  SNS_INSIGHT_REMINDER: "게시물 제출 7일 후 발송",
  SNS_INSIGHT_OVERDUE_REMINDER: "게시물 제출 8일 후 발송 (미제출자 독촉)",
  FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER: "리뷰 마감 3일 전·1일 전 발송",
  FAKE_PURCHASE_REVIEW_OVERDUE_REMINDER: "리뷰 마감 다음날 발송 (미제출자 독촉)",
  SIMPLE_REVIEW_DEADLINE_REMINDER: "리뷰 마감 3일 전·1일 전 발송",
  SIMPLE_REVIEW_OVERDUE_REMINDER: "리뷰 마감 다음날 발송 (미제출자 독촉)",
  SIMPLE_REVIEW_REJECTION_REMINDER: "리뷰 반려 다음날 발송 (재제출 독려)",
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
