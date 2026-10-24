import { shipTriggerKey } from "./ship-trigger";

describe("발송 안내 트리거 분기", () => {
  const base = {
    category: "SNS" as const,
    isLateTrackingEntry: false,
    hadTrackingNumber: false,
    hasTrackingNumber: true,
  };

  it("A: 송장을 넣고 배송 시작하면 기존 발송 안내", () => {
    expect(shipTriggerKey(base)).toBe("SNS_APPLICATION_SHIPPED");
  });

  it("B: 송장 없이 배송 시작하면 송장 준비 중 안내", () => {
    expect(shipTriggerKey({ ...base, hasTrackingNumber: false })).toBe(
      "SNS_APPLICATION_SHIPPED_TRACKING_PENDING",
    );
  });

  it("C: 비어 있던 건에 사후 등록하면 송장번호 안내", () => {
    expect(
      shipTriggerKey({ ...base, isLateTrackingEntry: true, hadTrackingNumber: false }),
    ).toBe("SNS_APPLICATION_TRACKING_REGISTERED");
  });

  it("이미 있던 번호의 정정은 알림을 보내지 않는다", () => {
    expect(
      shipTriggerKey({ ...base, isLateTrackingEntry: true, hadTrackingNumber: true }),
    ).toBeNull();
  });

  it("간단리뷰도 같은 규칙으로 분기한다", () => {
    expect(shipTriggerKey({ ...base, category: "SIMPLE_REVIEW" })).toBe(
      "SIMPLE_REVIEW_APPLICATION_SHIPPED",
    );
    expect(
      shipTriggerKey({
        ...base,
        category: "SIMPLE_REVIEW",
        hasTrackingNumber: false,
      }),
    ).toBe("SIMPLE_REVIEW_APPLICATION_SHIPPED_TRACKING_PENDING");
  });
});
