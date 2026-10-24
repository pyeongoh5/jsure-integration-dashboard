import { describe, expect, it } from "vitest";
import { CANCEL_REASON_CATEGORY_LABELS, toCancelInput } from "./cancelReason";

describe("toCancelInput", () => {
  it("대분류와 상세 사유가 모두 있으면 통과시킨다", () => {
    expect(
      toCancelInput({
        reasonCategory: "PRODUCT_LOGISTICS_ISSUE",
        reason: "  교환 재고 없음  ",
      }),
    ).toEqual({
      reasonCategory: "PRODUCT_LOGISTICS_ISSUE",
      reason: "교환 재고 없음",
    });
  });

  it("상세 사유가 비어 있으면 거른다", () => {
    expect(
      toCancelInput({ reasonCategory: "OTHER", reason: "   " }),
    ).toBeNull();
  });

  it("대분류가 없거나 알 수 없는 값이면 거른다", () => {
    expect(toCancelInput({ reason: "일정 불가" })).toBeNull();
    expect(
      toCancelInput({ reasonCategory: "UNKNOWN", reason: "일정 불가" }),
    ).toBeNull();
  });

  it("취소가 아닌 확정 입력(문자열·송장)은 거른다", () => {
    expect(toCancelInput("일정 불가")).toBeNull();
    expect(toCancelInput(undefined)).toBeNull();
    expect(
      toCancelInput({ trackingCarrier: "ヤマト運輸", trackingNumber: "1234" }),
    ).toBeNull();
  });

  it("대분류 4종 모두 라벨이 있다", () => {
    expect(Object.keys(CANCEL_REASON_CATEGORY_LABELS)).toHaveLength(4);
  });
});
