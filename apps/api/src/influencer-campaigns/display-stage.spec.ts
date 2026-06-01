import { deriveDisplayStage, postingDeadline } from "./display-stage";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("deriveDisplayStage", () => {
  it("APPLIED → APPLIED", () => {
    expect(
      deriveDisplayStage({
        status: "APPLIED",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("APPLIED");
  });

  it("SHIPPED, receivedAt null → AWAITING_RECEIPT", () => {
    expect(
      deriveDisplayStage({
        status: "SHIPPED",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("AWAITING_RECEIPT");
  });

  it("DELIVERED, receivedAt null → AWAITING_RECEIPT", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("AWAITING_RECEIPT");
  });

  it("SHIPPED, receivedAt set, no posts → POSTING", () => {
    expect(
      deriveDisplayStage({
        status: "SHIPPED",
        receivedAt: new Date(NOW.getTime() - 86400000),
        posts: [],
        now: NOW,
      }),
    ).toBe("POSTING");
  });

  it("DELIVERED, receivedAt set, no posts → POSTING", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        receivedAt: new Date(NOW.getTime() - 86400000),
        posts: [],
        now: NOW,
      }),
    ).toBe("POSTING");
  });

  it("DELIVERED, post submitted same JST day → POSTED", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        receivedAt: new Date(NOW.getTime() - 3 * 86400000),
        posts: [
          {
            // 같은 JST 일자 안에서 제출된 경우 daysPassed=0 → POSTED
            submittedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
            insightSubmittedAt: null,
            reviewStatus: "PENDING",
          },
        ],
        now: NOW,
      }),
    ).toBe("POSTED");
  });

  it("DELIVERED, post submitted ≥7d, no insight → INSIGHT_DUE", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 8 * 86400000),
            insightSubmittedAt: null, reviewStatus: "PENDING",
          },
        ],
        now: NOW,
      }),
    ).toBe("INSIGHT_DUE");
  });

  it("DELIVERED, all insights submitted → REVIEWING", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 9 * 86400000),
            insightSubmittedAt: new Date(NOW.getTime() - 1 * 86400000), reviewStatus: "PENDING",
          },
        ],
        now: NOW,
      }),
    ).toBe("REVIEWING");
  });

  it("DELIVERED, any post REJECTED → POST_REJECTED", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        receivedAt: new Date(NOW.getTime() - 3 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 2 * 86400000),
            insightSubmittedAt: null,
            reviewStatus: "REJECTED",
          },
        ],
        now: NOW,
      }),
    ).toBe("POST_REJECTED");
  });

  it("REJECTED, CANCELLED, COMPLETED pass through", () => {
    expect(
      deriveDisplayStage({
        status: "REJECTED",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("REJECTED");
    expect(
      deriveDisplayStage({
        status: "CANCELLED",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("CANCELLED");
    expect(
      deriveDisplayStage({
        status: "COMPLETED",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });
});

describe("postingDeadline", () => {
  it("null receivedAt → null", () => {
    expect(postingDeadline(null, 14)).toBeNull();
  });
  it("adds N days based on postingPeriodDays", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    expect(postingDeadline(d, 14)?.toISOString()).toBe(
      "2026-06-15T00:00:00.000Z",
    );
    expect(postingDeadline(d, 7)?.toISOString()).toBe(
      "2026-06-08T00:00:00.000Z",
    );
  });
});
