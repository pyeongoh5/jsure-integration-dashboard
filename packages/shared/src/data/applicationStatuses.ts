import type {
  ApplicationStatus,
  PostReviewStatus,
} from "../types/application.js";

/**
 * 승인 이후 아직 끝나지 않은 진행 구간.
 * 정산이 완료되면 여기서 COMPLETED 로 넘어간다.
 */
export const IN_PROGRESS_STATUSES: ApplicationStatus[] = [
  "APPROVED",
  "SHIPPED",
  "DELIVERED",
  "ORDER_SUBMITTED",
  "REVIEW_SUBMITTED",
];

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

/**
 * 탈퇴 신청을 막는 상태들 — 제품을 받았거나 받기로 확정된 뒤 아직 끝나지 않은 구간.
 * 여기서 탈퇴하면 미수령 리뷰·미반납 제품이 남는다.
 * COMPLETED 는 업무가 끝난 건이라 막지 않는다(미정산 잔액은 어드민이 승인 전에 확인).
 */
export const WITHDRAW_BLOCKING_STATUSES: ApplicationStatus[] =
  IN_PROGRESS_STATUSES;

/**
 * 이 응모가 탈퇴를 막는가.
 *
 * 상태만으로 판정하지 않는다. 제출물이 승인된 건은 인플루언서가 할 일이 끝났고,
 * 남은 건 정산뿐이다(미정산 잔액은 어드민이 탈퇴 승인 전에 확인한다). 정산 완료로
 * status 가 COMPLETED 로 넘어가기 전 구간에서도 탈퇴를 막지 않아야 한다.
 */
export function blocksWithdrawal(application: {
  status: ApplicationStatus;
  submissionReviewStatus: PostReviewStatus;
}): boolean {
  if (!WITHDRAW_BLOCKING_STATUSES.includes(application.status)) return false;
  return application.submissionReviewStatus !== "APPROVED";
}

/**
 * 탈퇴 신청 시 자동 취소되는 상태 — 아직 심사 중이라 중단해도 잃는 게 없다.
 * 신청 시점에 바로 취소해야 승인 대기 중 심사가 통과돼 진행 중으로 바뀌는 경합이 사라진다.
 */
export const WITHDRAW_AUTO_CANCEL_STATUSES: ApplicationStatus[] = ["APPLIED"];
