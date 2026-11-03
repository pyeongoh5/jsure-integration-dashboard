import { describe, expect, it } from "vitest";
import { residenceOf } from "./residence.js";

describe("residenceOf", () => {
  it("우편번호가 비어 있으면 국가와 무관하게 미등록이다", () => {
    // addressCountry 기본값이 JP 라 주소 미입력 회원이 일본 거주자로 보이는 것을 막는다.
    expect(residenceOf({ addressCountry: "JP", postalCode: "" })).toBe("NONE");
    expect(residenceOf({ addressCountry: "KR", postalCode: "" })).toBe("NONE");
  });

  it("주소가 등록돼 있으면 국가로 가른다", () => {
    expect(residenceOf({ addressCountry: "KR", postalCode: "06236" })).toBe("KR");
    expect(residenceOf({ addressCountry: "JP", postalCode: "150-0001" })).toBe("JP");
  });
});
