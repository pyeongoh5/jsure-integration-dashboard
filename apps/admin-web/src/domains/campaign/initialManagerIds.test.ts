import { describe, expect, it } from "vitest";
import { initialManagerIds } from "./initialManagerIds";

describe("initialManagerIds", () => {
  it("신규는 본인 하나로 시작한다", () => {
    expect(initialManagerIds("new", null, "admin-1")).toEqual(["admin-1"]);
  });

  it("복사도 원본을 승계하지 않고 본인으로 시작한다", () => {
    const source = { managers: [{ id: "admin-9", name: "유나", email: "yuna@example.com" }] };
    expect(initialManagerIds("copy", source, "admin-1")).toEqual(["admin-1"]);
  });

  it("수정은 저장된 담당자를 그대로 복원한다", () => {
    const saved = { managers: [{ id: "admin-9", name: "유나", email: "yuna@example.com" }] };
    expect(initialManagerIds("edit", saved, "admin-1")).toEqual(["admin-9"]);
  });

  it("담당자가 없는 기존 캠페인을 수정하면 빈 배열이다 — 본인으로 채우지 않는다", () => {
    expect(initialManagerIds("edit", { managers: [] }, "admin-1")).toEqual([]);
  });

  it("로그인 정보가 없으면 신규도 빈 배열이다", () => {
    expect(initialManagerIds("new", null, null)).toEqual([]);
  });
});
