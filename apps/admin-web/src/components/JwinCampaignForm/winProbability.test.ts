import { describe, expect, it } from "vitest";
import { winProbabilityAutosave } from "./winProbability";

const MAX = 0.5;

describe("winProbabilityAutosave — 디바운스 자동 저장 판정", () => {
  it("유효하고 저장값과 다르면 저장", () => {
    expect(winProbabilityAutosave("0.05", 0, MAX)).toEqual({
      kind: "save",
      winProbability: 0.0005,
    });
  });

  it("저장값과 같으면 스킵 (불필요한 PATCH 방지)", () => {
    expect(winProbabilityAutosave("5", 0.05, MAX)).toEqual({ kind: "skip" });
  });

  it("빈 입력은 스킵 — 지우고 다시 입력하는 중에 0 을 저장하지 않는다", () => {
    expect(winProbabilityAutosave("", 0.05, MAX)).toEqual({ kind: "skip" });
    expect(winProbabilityAutosave("  ", 0.05, MAX)).toEqual({ kind: "skip" });
  });

  it("숫자가 아니거나 상한 초과면 invalid", () => {
    expect(winProbabilityAutosave("abc", 0, MAX)).toEqual({ kind: "invalid" });
    expect(winProbabilityAutosave("60", 0, MAX)).toEqual({ kind: "invalid" });
    expect(winProbabilityAutosave("-1", 0, MAX)).toEqual({ kind: "invalid" });
  });
});
