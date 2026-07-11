import { deriveDisplayStage, postingDeadline } from "./display-stage";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("deriveDisplayStage", () => {
  it("APPLIED → APPLIED", () => {
    expect(
      deriveDisplayStage({
        status: "APPLIED",
        category: "SNS",
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
        category: "SNS",
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
        category: "SNS",
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
        category: "SNS",
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
        category: "SNS",
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
        category: "SNS",
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
        category: "SNS",
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
        category: "SNS",
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

  it("DELIVERED, insightRequired=false + review APPROVED → COMPLETED", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 8 * 86400000),
            insightSubmittedAt: null,
            reviewStatus: "APPROVED",
            insightRequired: false,
          },
        ],
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });

  it("DELIVERED, all insights submitted + review APPROVED + settlement PENDING → COMPLETED", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 9 * 86400000),
            insightSubmittedAt: new Date(NOW.getTime() - 1 * 86400000),
            reviewStatus: "APPROVED",
            settlementStatus: "PENDING",
          },
        ],
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });

  it("DELIVERED, 인사이트 미제출이어도 정산 COMPLETED 면 SETTLED", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 8 * 86400000),
            insightSubmittedAt: null,
            reviewStatus: "APPROVED",
            settlementStatus: "COMPLETED",
          },
        ],
        now: NOW,
      }),
    ).toBe("SETTLED");
  });

  it("DELIVERED, any post REJECTED → POST_REJECTED", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        category: "SNS",
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
        category: "SNS",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("REJECTED");
    expect(
      deriveDisplayStage({
        status: "CANCELLED",
        category: "SNS",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("CANCELLED");
    expect(
      deriveDisplayStage({
        status: "COMPLETED",
        category: "SNS",
        receivedAt: null,
        posts: [],
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });
});

describe("deriveDisplayStage — 가구매 카테고리", () => {
  const base = { receivedAt: null, posts: [] as never[] };

  it("APPROVED → AWAITING_ORDER", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "APPROVED",
        category: "FAKE_PURCHASE",
      }),
    ).toBe("AWAITING_ORDER");
  });

  it("ORDER_SUBMITTED → AWAITING_REVIEW", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "ORDER_SUBMITTED",
        category: "FAKE_PURCHASE",
      }),
    ).toBe("AWAITING_REVIEW");
  });

  it("REVIEW_SUBMITTED + post PENDING → REVIEW_PENDING", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          { submittedAt: new Date(), insightSubmittedAt: null, reviewStatus: "PENDING" },
        ],
      }),
    ).toBe("REVIEW_PENDING");
  });

  it("REVIEW_SUBMITTED + post REJECTED → REVIEW_REJECTED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          { submittedAt: new Date(), insightSubmittedAt: null, reviewStatus: "REJECTED" },
        ],
      }),
    ).toBe("REVIEW_REJECTED");
  });

  it("REVIEW_SUBMITTED + post APPROVED + settlement PENDING → COMPLETED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          {
            submittedAt: new Date(),
            insightSubmittedAt: null,
            reviewStatus: "APPROVED",
            settlementStatus: "PENDING",
          },
        ],
      }),
    ).toBe("COMPLETED");
  });

  it("REVIEW_SUBMITTED + post APPROVED + settlement COMPLETED → SETTLED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          {
            submittedAt: new Date(),
            insightSubmittedAt: null,
            reviewStatus: "APPROVED",
            settlementStatus: "COMPLETED",
          },
        ],
      }),
    ).toBe("SETTLED");
  });

  it("COMPLETED (settlement COMPLETED) → SETTLED", () => {
    expect(
      deriveDisplayStage({
        status: "COMPLETED",
        category: "FAKE_PURCHASE",
        receivedAt: null,
        posts: [
          {
            submittedAt: new Date(),
            insightSubmittedAt: null,
            reviewStatus: "APPROVED",
            settlementStatus: "COMPLETED",
          },
        ],
      }),
    ).toBe("SETTLED");
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
