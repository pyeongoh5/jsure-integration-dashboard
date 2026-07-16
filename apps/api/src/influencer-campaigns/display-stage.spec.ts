import { deriveDisplayStage, postingDeadline } from "./display-stage";

const NOW = new Date("2026-06-01T00:00:00Z");

const NO_REVIEW = {
  submissionReviewStatus: "PENDING" as const,
  settlementStatus: null,
};

describe("deriveDisplayStage", () => {
  it("APPLIED → APPLIED", () => {
    expect(
      deriveDisplayStage({
        status: "APPLIED",
        category: "SNS",
        receivedAt: null,
        posts: [],
        ...NO_REVIEW,
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
        ...NO_REVIEW,
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
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("AWAITING_RECEIPT");
  });

  it("SHIPPED, receivedAt set, 미제출 → POSTING", () => {
    expect(
      deriveDisplayStage({
        status: "SHIPPED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 86400000),
        posts: [],
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("POSTING");
  });

  it("DELIVERED, receivedAt set, 미제출 → POSTING", () => {
    expect(
      deriveDisplayStage({
        status: "DELIVERED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 86400000),
        posts: [],
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("POSTING");
  });

  it("REVIEW_SUBMITTED, post submitted same JST day → POSTED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 3 * 86400000),
        posts: [
          {
            // 같은 JST 일자 안에서 제출된 경우 daysPassed=0 → POSTED
            // (INSIGHT_DUE_DAYS=0 테스트 설정에서는 INSIGHT_DUE 로 즉시 전환)
            submittedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
            insightSubmittedAt: null,
          },
        ],
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("INSIGHT_DUE");
  });

  it("REVIEW_SUBMITTED, post submitted ≥7d, no insight → INSIGHT_DUE", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 8 * 86400000),
            insightSubmittedAt: null,
          },
        ],
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("INSIGHT_DUE");
  });

  it("REVIEW_SUBMITTED, all insights submitted → REVIEWING", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 9 * 86400000),
            insightSubmittedAt: new Date(NOW.getTime() - 1 * 86400000),
          },
        ],
        submissionReviewStatus: "PENDING",
        settlementStatus: null,
        now: NOW,
      }),
    ).toBe("REVIEWING");
  });

  it("REVIEW_SUBMITTED, insightRequired=false + review APPROVED → COMPLETED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 8 * 86400000),
            insightSubmittedAt: null,
            insightRequired: false,
          },
        ],
        submissionReviewStatus: "APPROVED",
        settlementStatus: null,
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });

  it("REVIEW_SUBMITTED, insights submitted + APPROVED + settlement PENDING → COMPLETED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 9 * 86400000),
            insightSubmittedAt: new Date(NOW.getTime() - 1 * 86400000),
          },
        ],
        submissionReviewStatus: "APPROVED",
        settlementStatus: "PENDING",
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });

  it("REVIEW_SUBMITTED, 인사이트 미제출이어도 정산 COMPLETED 면 SETTLED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 8 * 86400000),
            insightSubmittedAt: null,
          },
        ],
        submissionReviewStatus: "APPROVED",
        settlementStatus: "COMPLETED",
        now: NOW,
      }),
    ).toBe("SETTLED");
  });

  it("REVIEW_SUBMITTED, 검토 REJECTED → POST_REJECTED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 3 * 86400000),
        posts: [
          {
            submittedAt: new Date(NOW.getTime() - 2 * 86400000),
            insightSubmittedAt: null,
          },
        ],
        submissionReviewStatus: "REJECTED",
        settlementStatus: null,
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
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("REJECTED");
    expect(
      deriveDisplayStage({
        status: "CANCELLED",
        category: "SNS",
        receivedAt: null,
        posts: [],
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("CANCELLED");
    expect(
      deriveDisplayStage({
        status: "COMPLETED",
        category: "SNS",
        receivedAt: null,
        posts: [],
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("COMPLETED");
  });
});

describe("deriveDisplayStage — 가구매 카테고리", () => {
  const base = { receivedAt: null, posts: [] as never[], ...NO_REVIEW };

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

  it("REVIEW_SUBMITTED + 검토 PENDING → REVIEW_PENDING", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        submissionReviewStatus: "PENDING",
      }),
    ).toBe("REVIEW_PENDING");
  });

  it("REVIEW_SUBMITTED + 검토 REJECTED → REVIEW_REJECTED", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        submissionReviewStatus: "REJECTED",
      }),
    ).toBe("REVIEW_REJECTED");
  });

  it("REVIEW_SUBMITTED + APPROVED + settlement PENDING → COMPLETED", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        submissionReviewStatus: "APPROVED",
        settlementStatus: "PENDING",
      }),
    ).toBe("COMPLETED");
  });

  it("REVIEW_SUBMITTED + APPROVED + settlement COMPLETED → SETTLED", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "REVIEW_SUBMITTED",
        category: "FAKE_PURCHASE",
        submissionReviewStatus: "APPROVED",
        settlementStatus: "COMPLETED",
      }),
    ).toBe("SETTLED");
  });

  it("COMPLETED (settlement COMPLETED) → SETTLED", () => {
    expect(
      deriveDisplayStage({
        ...base,
        status: "COMPLETED",
        category: "FAKE_PURCHASE",
        submissionReviewStatus: "APPROVED",
        settlementStatus: "COMPLETED",
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
