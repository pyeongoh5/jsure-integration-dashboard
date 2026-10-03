import { describe, expect, it } from "vitest";
import { entriesByWeekday } from "./useJwinBrandMetrics";

describe("entriesByWeekday", () => {
  it("월~일 7칸으로 요일별 응모를 집계한다", () => {
    // 2026-10-05 = 월요일, 10-06 = 화요일, 10-11 = 일요일
    const result = entriesByWeekday([
      { dateJst: "2026-10-05", count: 3 },
      { dateJst: "2026-10-06", count: 2 },
      { dateJst: "2026-10-11", count: 5 },
      { dateJst: "2026-10-12", count: 1 }, // 다음 주 월요일 — 같은 칸에 합산
    ]);
    expect(result).toEqual([4, 2, 0, 0, 0, 0, 5]);
  });

  it("빈 입력이면 전부 0", () => {
    expect(entriesByWeekday([])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
