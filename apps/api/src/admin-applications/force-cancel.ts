import type { ApplicationStatus } from "@jsure/shared";

/**
 * 강제 취소를 막는 사유. null 이면 취소할 수 있다.
 *
 * 정산이 생성된 뒤에는 막는다 — 지급 대기든 완료든 회계 기록과 어긋나기 때문이다.
 * 그 건은 정산 쪽을 먼저 정리한 다음 취소해야 한다.
 */
export type ForceCancelBlock = "ALREADY_CANCELLED" | "SETTLEMENT_EXISTS";

export function forceCancelBlockedReason(input: {
  status: ApplicationStatus;
  hasSettlement: boolean;
}): ForceCancelBlock | null {
  if (input.status === "CANCELLED") return "ALREADY_CANCELLED";
  if (input.hasSettlement) return "SETTLEMENT_EXISTS";
  return null;
}

/** 차단 사유 → 사용자에게 보여줄 한국어 메시지. */
export const FORCE_CANCEL_BLOCK_MESSAGE: Record<ForceCancelBlock, string> = {
  ALREADY_CANCELLED: "이미 취소된 응모입니다",
  SETTLEMENT_EXISTS:
    "정산이 생성된 응모는 취소할 수 없습니다. 정산을 먼저 정리하세요",
};
