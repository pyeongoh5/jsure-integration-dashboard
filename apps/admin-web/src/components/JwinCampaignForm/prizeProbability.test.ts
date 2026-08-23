import { describe, expect, it } from "vitest";
import { probabilitySum, isProbabilityOverflow } from "./prizeProbability";

describe("prizeProbability", () => {
  it("경품이 없으면 합은 0", () => {
    expect(probabilitySum([])).toBe(0);
    expect(isProbabilityOverflow([])).toBe(false);
  });

  it("합이 1을 넘으면 경고 대상", () => {
    expect(isProbabilityOverflow([{ winProbability: 0.6 }, { winProbability: 0.5 }])).toBe(true);
  });

  it("합이 정확히 1이면 경고 대상이 아니다", () => {
    expect(isProbabilityOverflow([{ winProbability: 0.5 }, { winProbability: 0.5 }])).toBe(false);
  });

  it("부동소수 누적 오차로 잘못 경고하지 않는다", () => {
    const prizes = Array.from({ length: 10 }, () => ({ winProbability: 0.1 }));
    expect(isProbabilityOverflow(prizes)).toBe(false);
  });

  it("합이 1보다 작으면 경고 대상이 아니다", () => {
    expect(isProbabilityOverflow([{ winProbability: 0.01 }])).toBe(false);
  });
});
