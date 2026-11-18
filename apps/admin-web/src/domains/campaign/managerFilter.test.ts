import { describe, expect, it } from "vitest";
import { matchesManagerFilter, parseManagerFilter } from "./managerFilter";

describe("parseManagerFilter", () => {
  it("null 은 빈 필터다", () => {
    expect(parseManagerFilter(null)).toEqual([]);
  });

  it("쉼표로 이은 id 를 가른다", () => {
    expect(parseManagerFilter("admin-1,admin-2")).toEqual(["admin-1", "admin-2"]);
  });

  it("me 를 그대로 보존한다 — id 로 치환하지 않는다", () => {
    expect(parseManagerFilter("me,admin-2")).toEqual(["me", "admin-2"]);
  });
});

describe("matchesManagerFilter", () => {
  it("필터가 비면 전부 통과한다", () => {
    expect(matchesManagerFilter([], [], "admin-1")).toBe(true);
    expect(matchesManagerFilter(["admin-9"], [], "admin-1")).toBe(true);
  });

  it("담당자가 없는 캠페인은 필터가 걸리면 탈락한다", () => {
    expect(matchesManagerFilter([], ["admin-1"], "admin-1")).toBe(false);
  });

  it("여러 담당자를 고르면 OR 이다", () => {
    expect(matchesManagerFilter(["admin-2"], ["admin-1", "admin-2"], null)).toBe(true);
  });

  it("me 는 현재 로그인 id 로 푼다", () => {
    expect(matchesManagerFilter(["admin-1"], ["me"], "admin-1")).toBe(true);
    expect(matchesManagerFilter(["admin-9"], ["me"], "admin-1")).toBe(false);
  });

  it("로그인 정보가 없으면 me 는 아무것도 매치하지 않는다", () => {
    expect(matchesManagerFilter(["admin-1"], ["me"], null)).toBe(false);
  });
});
