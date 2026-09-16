import { bucketMonthlyCounts, monthStartUtc9 } from "./monthly-counts";

describe("bucketMonthlyCounts", () => {
  // 2026-09-16 12:00 UTC (= UTC+9 21:00)
  const now = new Date("2026-09-16T12:00:00Z");

  it("최근 N개월을 빈 달 포함 오름차순으로 채운다", () => {
    const months = bucketMonthlyCounts([], now, 3);
    expect(months).toEqual([
      { month: "2026-07", count: 0 },
      { month: "2026-08", count: 0 },
      { month: "2026-09", count: 0 },
    ]);
  });

  it("UTC+9 기준으로 월을 가른다 — UTC 말일 15시 이후는 다음 달", () => {
    const months = bucketMonthlyCounts(
      [
        new Date("2026-08-31T14:59:00Z"), // UTC+9 8/31 23:59 → 8월
        new Date("2026-08-31T15:00:00Z"), // UTC+9 9/1 00:00 → 9월
        new Date("2026-09-01T00:00:00Z"), // 9월
      ],
      now,
      2,
    );
    expect(months).toEqual([
      { month: "2026-08", count: 1 },
      { month: "2026-09", count: 2 },
    ]);
  });

  it("연 경계를 넘어도 이어진다", () => {
    const january = new Date("2026-01-15T00:00:00Z");
    const months = bucketMonthlyCounts([new Date("2025-12-20T00:00:00Z")], january, 2);
    expect(months).toEqual([
      { month: "2025-12", count: 1 },
      { month: "2026-01", count: 0 },
    ]);
  });
});

describe("monthStartUtc9", () => {
  it("UTC+9 기준 그 달 1일 0시를 UTC 로 돌려준다", () => {
    const start = monthStartUtc9(new Date("2026-09-16T12:00:00Z"), 11);
    // 2025-10-01 00:00 UTC+9 = 2025-09-30 15:00 UTC
    expect(start.toISOString()).toBe("2025-09-30T15:00:00.000Z");
  });
});
