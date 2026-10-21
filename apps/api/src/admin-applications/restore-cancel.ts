import type { ApplicationStatus } from "@jsure/shared";

/**
 * 강제 취소 되돌리기를 막는 사유. null 이면 복원할 수 있다.
 *
 * 복원 대상 상태는 취소 시 감사 로그에 남긴 previousStatus 가 유일한 근거다
 * (강제 취소는 status 만 바꾸므로 나머지 필드는 그대로 남아 있다).
 */
export type RestoreCancelBlock =
  | "NOT_CANCELLED"
  | "SETTLEMENT_EXISTS"
  | "NO_CANCEL_HISTORY";

export function restoreCancelBlockedReason(input: {
  status: ApplicationStatus;
  hasSettlement: boolean;
  previousStatus: string | null;
}): RestoreCancelBlock | null {
  if (input.status !== "CANCELLED") return "NOT_CANCELLED";
  if (input.hasSettlement) return "SETTLEMENT_EXISTS";
  // 취소 기록이 없으면 어느 단계로 돌릴지 알 수 없다 — 임의 복원은 하지 않는다
  if (!input.previousStatus) return "NO_CANCEL_HISTORY";
  return null;
}

export const RESTORE_CANCEL_BLOCK_MESSAGE: Record<RestoreCancelBlock, string> = {
  NOT_CANCELLED: "취소된 응모만 되돌릴 수 있습니다",
  SETTLEMENT_EXISTS:
    "정산이 생성된 응모는 되돌릴 수 없습니다. 정산을 먼저 정리하세요",
  NO_CANCEL_HISTORY:
    "강제 취소 기록이 없어 이전 단계를 알 수 없습니다",
};
