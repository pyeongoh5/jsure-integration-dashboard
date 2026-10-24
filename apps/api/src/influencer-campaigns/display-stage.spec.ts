import { deriveDisplayStage, deadlineFrom } from "./display-stage";

const NOW = new Date("2026-06-01T00:00:00Z");

const NO_REVIEW = {
  submissionReviewStatus: "PENDING" as const,
  submissionReviewedAt: null,
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

  it("REVIEW_SUBMITTED, 검토 대기 중이면 기한이 시작되지 않아 POSTED", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [{ insightSubmittedAt: null }],
        // 제출한 지 8일이 지났어도 검토가 끝나지 않았으면 인사이트 단계가 아니다.
        ...NO_REVIEW,
        now: NOW,
      }),
    ).toBe("POSTED");
  });

  it("REVIEW_SUBMITTED, 검토 완료 후 기한 도래 + 인사이트 미제출 → INSIGHT_DUE", () => {
    expect(
      deriveDisplayStage({
        status: "REVIEW_SUBMITTED",
        category: "SNS",
        receivedAt: new Date(NOW.getTime() - 10 * 86400000),
        posts: [{ insightSubmittedAt: null }],
        submissionReviewStatus: "APPROVED",
        // INSIGHT_DUE_DAYS=0 인 테스트 설정에서는 검토 완료 즉시 전환.
        submissionReviewedAt: new Date(NOW.getTime() - 86400000),
        settlementStatus: null,
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
            insightSubmittedAt: new Date(NOW.getTime() - 1 * 86400000),
          },
        ],
        submissionReviewStatus: "PENDING",
        submissionReviewedAt: null,
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
            insightSubmittedAt: null,
            insightRequired: false,
          },
        ],
        submissionReviewStatus: "APPROVED",
        submissionReviewedAt: new Date(NOW.getTime() - 86400000),
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
            insightSubmittedAt: new Date(NOW.getTime() - 1 * 86400000),
          },
        ],
        submissionReviewStatus: "APPROVED",
        submissionReviewedAt: new Date(NOW.getTime() - 86400000),
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
            insightSubmittedAt: null,
          },
        ],
        submissionReviewStatus: "APPROVED",
        submissionReviewedAt: new Date(NOW.getTime() - 86400000),
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
            insightSubmittedAt: null,
          },
        ],
        submissionReviewStatus: "REJECTED",
        submissionReviewedAt: new Date(NOW.getTime() - 86400000),
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
        submissionReviewedAt: new Date(NOW.getTime() - 86400000),
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
        submissionReviewedAt: new Date(NOW.getTime() - 86400000),
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
        submissionReviewedAt: new Date(NOW.getTime() - 86400000),
        settlementStatus: "COMPLETED",
      }),
    ).toBe("SETTLED");
  });
});

describe("deadlineFrom", () => {
  it("null receivedAt → null", () => {
    expect(deadlineFrom(null, 14)).toBeNull();
  });
  it("adds N days based on postingPeriodDays", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    expect(deadlineFrom(d, 14)?.toISOString()).toBe(
      "2026-06-15T00:00:00.000Z",
    );
    expect(deadlineFrom(d, 7)?.toISOString()).toBe(
      "2026-06-08T00:00:00.000Z",
    );
  });
});
