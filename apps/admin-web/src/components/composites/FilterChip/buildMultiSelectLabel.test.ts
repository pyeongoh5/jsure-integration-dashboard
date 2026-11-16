import { describe, expect, it } from "vitest";
import { buildMultiSelectLabel } from "./buildMultiSelectLabel";

describe("buildMultiSelectLabel", () => {
  it("상한이 없으면 전부 이어 붙인다", () => {
    expect(buildMultiSelectLabel(["선희", "카린"])).toEqual({
      text: "선희, 카린",
      title: "선희, 카린",
    });
  });

  it("정확히 상한만큼이면 접지 않는다", () => {
    expect(buildMultiSelectLabel(["선희", "카린"], 2).text).toBe("선희, 카린");
  });

  it("상한을 넘으면 앞 N개만 보이고 나머지는 +M 으로 접는다", () => {
    expect(buildMultiSelectLabel(["선희", "카린", "치하루", "유나"], 2)).toEqual({
      text: "선희, 카린 +2",
      title: "선희, 카린, 치하루, 유나",
    });
  });

  it("빈 목록은 빈 문자열이다", () => {
    expect(buildMultiSelectLabel([], 2)).toEqual({ text: "", title: "" });
  });
});
