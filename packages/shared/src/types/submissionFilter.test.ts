import { describe, expect, it } from "vitest";
import {
  deriveDraftViewStatus,
  parseSubmissionFilterParams,
  submissionFilterToParams,
  type SubmissionFilter,
} from "./submissionFilter.js";

/** 규칙표 도입 전 화면에 박혀 있던 판정. 이 함수와 규칙표가 갈라지면 안 된다. */
function legacyDerive(
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED",
  insightSubmitted: boolean,
  settlementStatus: "PENDING" | "COMPLETED" | null,
): string {
  if (reviewStatus === "PENDING") return "REVIEW_PENDING";
  if (reviewStatus === "REJECTED") {
    return insightSubmitted ? "REJECTED_LOCKED" : "REJECTED";
  }
  if (settlementStatus === "COMPLETED") return "SETTLED";
  if (settlementStatus === "PENDING") return "SETTLEMENT_PENDING";
  return insightSubmitted ? "INSIGHT_SUBMITTED" : "AWAITING_INSIGHT";
}

describe("deriveDraftViewStatus", () => {
  it("입력 조합 전수가 기존 판정과 일치한다", () => {
    const reviewStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
    const settlements = [null, "PENDING", "COMPLETED"] as const;
    for (const reviewStatus of reviewStatuses) {
      for (const insightSubmitted of [true, false]) {
        for (const settlementStatus of settlements) {
          const legacy = legacyDerive(
            reviewStatus,
            insightSubmitted,
            settlementStatus,
          );
          const derived = deriveDraftViewStatus({
            reviewStatus,
            insightSubmitted,
            hasSettlement: settlementStatus !== null,
          });
          // 정산 흐름 진입분은 검토 화면에서 숨긴다 → null
          const expected =
            legacy === "SETTLED" || legacy === "SETTLEMENT_PENDING"
              ? null
              : legacy;
          expect(derived).toBe(expected);
        }
      }
    }
  });

  it("정산이 있어도 검수 반려 건은 검토 목록에 남는다", () => {
    expect(
      deriveDraftViewStatus({
        reviewStatus: "REJECTED",
        insightSubmitted: false,
        hasSettlement: true,
      }),
    ).toBe("REJECTED");
  });
});

describe("submissionFilterToParams / parseSubmissionFilterParams", () => {
  it("왕복해도 값이 보존된다", () => {
    const filter: SubmissionFilter = {
      campaignId: "camp_1",
      mediaKeys: ["ig-feed", "yt"],
      viewStatuses: ["REVIEW_PENDING", "REJECTED"],
      category: "SNS",
    };
    expect(parseSubmissionFilterParams(submissionFilterToParams(filter))).toEqual(
      filter,
    );
  });

  it("알 수 없는 값은 버린다 — 링크로 들어오는 값이라 터지면 안 된다", () => {
    expect(
      parseSubmissionFilterParams({
        media: "ig-feed,없는키",
        status: "REVIEW_PENDING,SETTLED",
        category: "이상한카테고리",
      }),
    ).toEqual({
      campaignId: null,
      mediaKeys: ["ig-feed"],
      // SETTLED 는 검토 화면 상태가 아니라 버려진다
      viewStatuses: ["REVIEW_PENDING"],
      category: null,
    });
  });
});
