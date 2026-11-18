import { describe, expect, it } from "vitest";
import { copyTitle } from "./copyTitle";

describe("copyTitle", () => {
  it("접미사를 괄호로 덧붙인다", () => {
    expect(copyTitle("7월 설문", "사본")).toBe("7월 설문 (사본)");
  });

  it("이미 복사본인 제목에도 그대로 덧붙인다", () => {
    expect(copyTitle("7월 설문 (사본)", "사본")).toBe("7월 설문 (사본) (사본)");
  });

  it("200자를 넘기지 않도록 원본 제목을 자른다", () => {
    const long = "가".repeat(200);
    const result = copyTitle(long, "사본");
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(" (사본)")).toBe(true);
  });
});
