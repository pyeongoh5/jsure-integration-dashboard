import { describe, expect, it } from "vitest";
import {
  formatProbabilityPercent,
  percentToProbability,
  prizeShare,
  probabilityToPercentInput,
} from "./winProbability";

describe("formatProbabilityPercent", () => {
  it("저장 값을 퍼센트 문자열로 바꾼다", () => {
    expect(formatProbabilityPercent(0.05)).toBe("5%");
    expect(formatProbabilityPercent(0.005)).toBe("0.5%");
    expect(formatProbabilityPercent(0.9999)).toBe("99.99%");
  });

  it("부동소수 잔재를 남기지 않는다", () => {
    expect(formatProbabilityPercent(0.1 + 0.2)).toBe("30%");
  });
});

describe("percentToProbability", () => {
  it("퍼센트 입력을 저장 값으로 바꾼다", () => {
    expect(percentToProbability("0.5")).toBeCloseTo(0.005, 10);
    expect(percentToProbability(" 50 ")).toBe(0.5);
    expect(percentToProbability("0")).toBe(0);
  });

  it("빈 값·숫자 아님·음수는 null", () => {
    expect(percentToProbability("")).toBeNull();
    expect(percentToProbability("abc")).toBeNull();
    expect(percentToProbability("-1")).toBeNull();
  });

  it("입력 변환과 표기 변환이 왕복한다", () => {
    expect(percentToProbability(probabilityToPercentInput(0.005))).toBeCloseTo(0.005, 10);
  });
});

describe("prizeShare", () => {
  const prizes = [{ remainingQty: 10 }, { remainingQty: 30 }, { remainingQty: 1 }];

  it("남은 수량 비율을 돌려준다", () => {
    expect(prizeShare(prizes[0]!, prizes)).toBeCloseTo(10 / 41, 10);
    expect(prizeShare(prizes[1]!, prizes)).toBeCloseTo(30 / 41, 10);
    expect(prizeShare(prizes[2]!, prizes)).toBeCloseTo(1 / 41, 10);
  });

  it("전체 재고가 없으면 0", () => {
    expect(prizeShare({ remainingQty: 0 }, [{ remainingQty: 0 }])).toBe(0);
    expect(prizeShare({ remainingQty: 0 }, [])).toBe(0);
  });
});
