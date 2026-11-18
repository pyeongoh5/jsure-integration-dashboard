import { describe, it, expect } from "vitest";
import { findProductByPath } from "./navigation";

describe("findProductByPath", () => {
  it("/builder 하위는 빌더 제품이다", () => {
    expect(findProductByPath("/builder/surveys").key).toBe("builder");
    expect(findProductByPath("/builder/surveys/abc/edit").key).toBe("builder");
  });

  it("빌더 탭 추가가 기존 제품 판정을 바꾸지 않는다", () => {
    expect(findProductByPath("/jwin/campaigns").key).toBe("jwin");
    expect(findProductByPath("/campaigns").key).toBe("influencer");
    expect(findProductByPath("/builders-note").key).toBe("influencer");
  });
});
