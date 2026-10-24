import { describe, expect, it } from "vitest";
import { resolveSelectedId } from "./resolveSelectedId";

const rows = [{ id: "a" }, { id: "b" }];

describe("resolveSelectedId", () => {
  it("목록에 있는 선택은 유지한다", () => {
    expect(resolveSelectedId(rows, "b")).toBe("b");
  });

  it("다른 시즌에서 넘어온 선택은 버리고 첫 항목을 쓴다", () => {
    expect(resolveSelectedId(rows, "종료-브랜드-id")).toBe("a");
  });

  it("미선택이면 첫 항목을 쓴다", () => {
    expect(resolveSelectedId(rows, null)).toBe("a");
  });

  it("목록이 비면 null — 이전 선택으로 조회하지 않는다", () => {
    expect(resolveSelectedId([], "a")).toBeNull();
  });
});
