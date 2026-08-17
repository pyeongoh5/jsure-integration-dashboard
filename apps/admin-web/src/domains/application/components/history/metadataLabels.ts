import type { AdminTranslationKey } from "@i18n/admin";

/**
 * 감사 로그 metadata 키의 표시명 i18n 키. 부분 매핑이다 — 미등록 키는 원문을
 * 그대로 보여준다. 전체 키 필수 Record 로 만들면 백엔드가 metadata 키를 추가할
 * 때마다 프론트 빌드가 깨지는데, metadata 는 자유 형식이라 그 결합이 부적절하다.
 */
export const METADATA_KEY_LABEL: Record<string, AdminTranslationKey> = {
  reason: "domains.application.history.metadata.reason",
  trackingCarrier: "domains.application.history.metadata.trackingCarrier",
  trackingNumber: "domains.application.history.metadata.trackingNumber",
  amountJpy: "domains.application.history.metadata.amountJpy",
  batchSize: "domains.application.history.metadata.batchSize",
  autoCompleted: "domains.application.history.metadata.autoCompleted",
  previousStatus: "domains.application.history.metadata.previousStatus",
  previousReviewerId: "domains.application.history.metadata.previousReviewerId",
  triggeredBy: "domains.application.history.metadata.triggeredBy",
  changedFields: "domains.application.history.metadata.changedFields",
  title: "domains.application.history.metadata.title",
  category: "domains.application.applicants.table.category",
  publishState: "domains.application.history.metadata.publishState",
  hardDeleted: "domains.application.history.metadata.hardDeleted",
  memoId: "domains.application.history.metadata.memoId",
  subTypes: "domains.application.applicants.table.subType",
  previousFlaggedById: "domains.application.history.metadata.previousFlaggedById",
};
