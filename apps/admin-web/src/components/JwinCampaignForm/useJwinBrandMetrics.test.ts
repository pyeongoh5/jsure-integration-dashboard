import { describe, expect, it } from "vitest";
import type { AdminMetricSnapshot } from "@/domains/jwin";
import { summarizeMetrics } from "./useJwinBrandMetrics";

const snapshot = (
  overrides: Partial<AdminMetricSnapshot> & Pick<AdminMetricSnapshot, "dateJst" | "kind">,
): AdminMetricSnapshot => ({
  followerCount: 0,
  repostCount: null,
  likeCount: null,
  replyCount: null,
  ...overrides,
});

describe("summarizeMetrics", () => {
  it("빈 목록이면 전부 null/0", () => {
    const summary = summarizeMetrics([]);
    expect(summary.baselineFollowers).toBeNull();
    expect(summary.followerDelta).toBeNull();
    expect(summary.totalReposts).toBe(0);
  });

  it("기준점 대비 팔로워 순증과 일별 반응 합계를 낸다", () => {
    const summary = summarizeMetrics([
      snapshot({ dateJst: "2026-10-01", kind: "BASELINE", followerCount: 1000 }),
      snapshot({
        dateJst: "2026-10-01",
        kind: "DAILY",
        followerCount: 1040,
        repostCount: 12,
        likeCount: 30,
        replyCount: 3,
      }),
      snapshot({
        dateJst: "2026-10-02",
        kind: "DAILY",
        followerCount: 1100,
        repostCount: 20,
        likeCount: 50,
        replyCount: 5,
      }),
    ]);
    expect(summary.baselineFollowers).toBe(1000);
    expect(summary.latestFollowers).toBe(1100);
    expect(summary.followerDelta).toBe(100);
    expect(summary.totalReposts).toBe(32);
    expect(summary.totalLikes).toBe(80);
    expect(summary.totalReplies).toBe(8);
  });
});
