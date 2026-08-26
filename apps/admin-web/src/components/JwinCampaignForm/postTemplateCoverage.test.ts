import { describe, expect, it } from "vitest";
import { formatCoverageGaps } from "./postTemplateCoverage";

describe("formatCoverageGaps", () => {
  it("하루짜리 빈틈은 날짜 하나로 쓴다", () => {
    expect(formatCoverageGaps([{ fromDateJst: "2026-09-08", toDateJst: "2026-09-08" }])).toBe("9/8");
  });

  it("여러 날 빈틈은 물결로 잇는다", () => {
    expect(formatCoverageGaps([{ fromDateJst: "2026-09-08", toDateJst: "2026-09-10" }])).toBe(
      "9/8 ~ 9/10",
    );
  });

  it("구간이 여러 개면 쉼표로 잇는다", () => {
    expect(
      formatCoverageGaps([
        { fromDateJst: "2026-09-01", toDateJst: "2026-09-02" },
        { fromDateJst: "2026-09-10", toDateJst: "2026-09-10" },
      ]),
    ).toBe("9/1 ~ 9/2, 9/10");
  });
});
