import { restoreCancelBlockedReason } from "./restore-cancel";

describe("강제 취소 되돌리기 가능 여부", () => {
  const base = {
    status: "CANCELLED" as const,
    hasSettlement: false,
    previousStatus: "REJECTED",
  };

  it("취소 상태 + 정산 없음 + 취소 기록 있음이면 되돌릴 수 있다", () => {
    expect(restoreCancelBlockedReason(base)).toBeNull();
  });

  it("취소 상태가 아니면 막는다", () => {
    expect(restoreCancelBlockedReason({ ...base, status: "APPROVED" })).toBe(
      "NOT_CANCELLED",
    );
  });

  it("정산이 생성됐으면 막는다 — 회계 기록과 어긋난다", () => {
    expect(restoreCancelBlockedReason({ ...base, hasSettlement: true })).toBe(
      "SETTLEMENT_EXISTS",
    );
  });

  it("취소 기록이 없으면 어느 단계로 돌릴지 알 수 없어 막는다", () => {
    expect(restoreCancelBlockedReason({ ...base, previousStatus: null })).toBe(
      "NO_CANCEL_HISTORY",
    );
  });
});
