import type { ApplicationStatus } from "../types/application.js";

/**
 * 모집 인원 슬롯을 차지하는 상태들.
 * APPLIED 는 아직 슬롯 미확보. REJECTED/CANCELLED 는 슬롯 해제.
 * 그 외 승인 이후 흐름은 모두 슬롯 점유 (검수/정산 대기 포함).
 */
export const SLOT_CONSUMING_STATUSES: ApplicationStatus[] = [
  "APPROVED",
  "SHIPPED",
  "DELIVERED",
  "ORDER_SUBMITTED",
  "REVIEW_SUBMITTED",
  "COMPLETED",
];
