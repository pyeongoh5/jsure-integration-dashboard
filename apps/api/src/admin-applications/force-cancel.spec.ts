import { forceCancelBlockedReason } from "./force-cancel";

describe("forceCancelBlockedReason", () => {
  it("정산이 없으면 어느 단계에서든 취소할 수 있다", () => {
    const statuses = [
      "APPLIED",
      "APPROVED",
      "SHIPPED",
      "DELIVERED",
      "ORDER_SUBMITTED",
      "REVIEW_SUBMITTED",
      "COMPLETED",
      "REJECTED",
    ] as const;
    for (const status of statuses) {
      expect(forceCancelBlockedReason({ status, hasSettlement: false })).toBeNull();
    }
  });

  it("정산이 있으면 막는다", () => {
    expect(
      forceCancelBlockedReason({ status: "REVIEW_SUBMITTED", hasSettlement: true }),
    ).toBe("SETTLEMENT_EXISTS");
  });

  it("이미 취소된 건은 막는다 — 정산 판정보다 앞선다", () => {
    expect(forceCancelBlockedReason({ status: "CANCELLED", hasSettlement: false })).toBe(
      "ALREADY_CANCELLED",
    );
    expect(forceCancelBlockedReason({ status: "CANCELLED", hasSettlement: true })).toBe(
      "ALREADY_CANCELLED",
    );
  });
});
