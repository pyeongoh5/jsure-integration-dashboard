import { describe, expect, it } from "vitest";
import { postTemplateCoverage, formatCoverageGaps } from "./postTemplateCoverage";

/** 2026-09-01 00:00 JST ~ 2026-09-05 23:59 JST (5일) */
const CAMPAIGN = {
  startsAt: "2026-08-31T15:00:00.000Z",
  endsAt: "2026-09-05T14:59:00.000Z",
};

/** JST 날짜·시각 → UTC ISO */
function jst(dateTime: string): string {
  return new Date(`${dateTime}+09:00`).toISOString();
}

describe("postTemplateCoverage", () => {
  it("소재가 하나도 없으면 기간 전체가 빈틈", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, []);
    expect(coverage.postingDates).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-01", toDateJst: "2026-09-05" }]);
  });

  it("소재 1개가 전 기간을 덮으면 빈틈이 없다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([]);
  });

  it("중간이 비면 그 구간만 빈틈으로 잡는다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-02T23:59:00") },
      { activeFrom: jst("2026-09-05T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-03", toDateJst: "2026-09-04" }]);
  });

  it("앞뒤가 모두 비면 빈틈 구간이 두 개", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-03T00:00:00"), activeTo: jst("2026-09-03T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([
      { fromDateJst: "2026-09-01", toDateJst: "2026-09-02" },
      { fromDateJst: "2026-09-04", toDateJst: "2026-09-05" },
    ]);
  });

  it("소재 기간이 겹쳐도 빈틈으로 세지 않는다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-04T23:59:00") },
      { activeFrom: jst("2026-09-03T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([]);
  });

  it("소재가 그날 낮부터 시작하면 그날은 빈틈이다 (스케줄러가 00:05 JST에 판정)", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-03T12:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-01", toDateJst: "2026-09-03" }]);
  });

  it("00:05 JST 시점이 하나도 없는 짧은 캠페인은 게시 예정일이 없다", () => {
    const coverage = postTemplateCoverage(
      { startsAt: jst("2026-09-01T10:00:00"), endsAt: jst("2026-09-01T20:00:00") },
      [],
    );
    expect(coverage.postingDates).toEqual([]);
    expect(coverage.gaps).toEqual([]);
  });

  it("종료가 시작보다 앞서면 빈 결과를 돌려준다", () => {
    const coverage = postTemplateCoverage(
      { startsAt: jst("2026-09-05T00:00:00"), endsAt: jst("2026-09-01T00:00:00") },
      [],
    );
    expect(coverage.postingDates).toEqual([]);
    expect(coverage.gaps).toEqual([]);
  });
});

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
