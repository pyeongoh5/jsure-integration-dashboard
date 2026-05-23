import { deriveDisplayStage, postingDeadline } from "./display-stage";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("deriveDisplayStage", () => {
  it("APPLIED → APPLIED", () => {
    expect(deriveDisplayStage({ status: "APPLIED", posts: [], now: NOW })).toBe(
      "APPLIED",
    );
  });

  it("DELIVERED no posts → POSTING", () => {
    expect(
      deriveDisplayStage({ status: "DELIVERED", posts: [], now: NOW }),
    ).toBe("POSTING");
  });

  it("DELIVERED post submitted <7d → POSTED", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 2 * 86400000),
            insightSubmittedAt: null,
          },
        ],
        now: NOW,
      }),
    ).toBe("POSTED");
  });

  it("DELIVERED post submitted ≥7d, no insight → INSIGHT_DUE", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 8 * 86400000),
            insightSubmittedAt: null,
          },
        ],
        now: NOW,
      }),
    ).toBe("INSIGHT_DUE");
  });

  it("DELIVERED all insights submitted → REVIEWING", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 9 * 86400000),
            insightSubmittedAt: new Date(NOW.getTime() - 1 * 86400000),
          },
        ],
        now: NOW,
      }),
    ).toBe("REVIEWING");
  });

  it("REJECTED, CANCELLED, COMPLETED pass through", () => {
    expect(
      deriveDisplayStage({ status: "REJECTED", posts: [], now: NOW }),
    ).toBe("REJECTED");
    expect(
      deriveDisplayStage({ status: "CANCELLED", posts: [], now: NOW }),
    ).toBe("CANCELLED");
    expect(
      deriveDisplayStage({ status: "COMPLETED", posts: [], now: NOW }),
    ).toBe("COMPLETED");
  });
});

describe("postingDeadline", () => {
  it("null deliveredAt → null", () => {
    expect(postingDeadline(null)).toBeNull();
  });
  it("adds 14 days", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    expect(postingDeadline(d)?.toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });
});
