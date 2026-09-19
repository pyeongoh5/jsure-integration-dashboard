import { describe, expect, it } from "vitest";
import { carouselRatioIssue } from "./carouselRatio";

describe("carouselRatioIssue", () => {
  it("1:1 / 1.91:1 은 통과한다 (근사값 포함)", () => {
    expect(carouselRatioIssue([{ width: 1024, height: 1024 }])).toBeNull();
    expect(
      carouselRatioIssue([
        { width: 800, height: 419 },
        { width: 1910, height: 1000 },
      ]),
    ).toBeNull();
  });

  it("지원하지 않는 비율(9:16, 4:5)은 UNSUPPORTED — 운영 실측 사례", () => {
    expect(carouselRatioIssue([{ width: 1080, height: 1920 }])).toBe("UNSUPPORTED");
    expect(carouselRatioIssue([{ width: 1080, height: 1350 }])).toBe("UNSUPPORTED");
  });

  it("둘 다 지원 비율이어도 서로 다르면 MISMATCH", () => {
    expect(
      carouselRatioIssue([
        { width: 1000, height: 1000 },
        { width: 1910, height: 1000 },
      ]),
    ).toBe("MISMATCH");
  });
});
