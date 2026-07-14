import type {
  ApplicationDisplayStage,
  ApplicationStatus,
  CampaignCategory,
} from "@jsure/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
// 테스트 중: 0 (투고 직후 인사이트 제출 가능). 운영 복귀 시 7 로 돌릴 것.
const INSIGHT_DUE_DAYS = 0;

/** JST 기준 그 날 00:00 UTC 타임스탬프 (ms). */
function startOfJstDay(d: Date): number {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const shifted = d.getTime() + jstOffsetMs;
  const dayStartUtcShifted = shifted - (shifted % DAY_MS);
  return dayStartUtcShifted - jstOffsetMs;
}

interface DisplayStageInput {
  status: ApplicationStatus;
  category: CampaignCategory;
  receivedAt: Date | null;
  posts: {
    submittedAt: Date;
    insightSubmittedAt: Date | null;
    reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
    settlementStatus?: "PENDING" | "COMPLETED" | null;
    /** 이 SNS 슬롯이 인사이트 제출을 요구하는지. 기본 true(기존 동작 유지). */
    insightRequired?: boolean;
  }[];
  now?: Date;
}

export function deriveDisplayStage(
  input: DisplayStageInput,
): ApplicationDisplayStage {
  if (input.category === "FAKE_PURCHASE") {
    return deriveFakePurchaseStage(input);
  }
  if (input.category === "SIMPLE_REVIEW") {
    return deriveSimpleReviewStage(input);
  }
  return deriveSnsStage(input);
}

function deriveSimpleReviewStage(
  input: DisplayStageInput,
): ApplicationDisplayStage {
  const { status, receivedAt, posts } = input;
  if (status === "APPLIED") return "APPLIED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "SHIPPED" || status === "DELIVERED") {
    // 수령 확인 이전엔 AWAITING_RECEIPT, 이후엔 리뷰 제출 대기(AWAITING_REVIEW).
    return receivedAt ? "AWAITING_REVIEW" : "AWAITING_RECEIPT";
  }
  if (status === "REVIEW_SUBMITTED") {
    const post = posts[0];
    if (!post) return "AWAITING_REVIEW";
    if (post.reviewStatus === "REJECTED") return "REVIEW_REJECTED";
    if (post.reviewStatus === "PENDING") return "REVIEW_PENDING";
    if (post.settlementStatus === "COMPLETED") return "SETTLED";
    return "COMPLETED";
  }
  if (status === "COMPLETED") {
    const anySettled = posts.some((p) => p.settlementStatus === "COMPLETED");
    return anySettled ? "SETTLED" : "COMPLETED";
  }
  return "APPLIED";
}

function deriveFakePurchaseStage(
  input: DisplayStageInput,
): ApplicationDisplayStage {
  const { status, posts } = input;
  if (status === "APPLIED") return "APPLIED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "APPROVED") return "AWAITING_ORDER";
  if (status === "ORDER_SUBMITTED") return "AWAITING_REVIEW";
  if (status === "REVIEW_SUBMITTED") {
    const post = posts[0];
    if (!post) return "AWAITING_REVIEW";
    if (post.reviewStatus === "REJECTED") return "REVIEW_REJECTED";
    if (post.reviewStatus === "PENDING") return "REVIEW_PENDING";
    if (post.settlementStatus === "COMPLETED") return "SETTLED";
    return "COMPLETED"; // new — 리뷰 APPROVED + 정산 대기(PENDING) 는 정산 대기 스텝
  }
  if (status === "COMPLETED") {
    const anySettled = posts.some((p) => p.settlementStatus === "COMPLETED");
    return anySettled ? "SETTLED" : "COMPLETED";
  }
  return "APPLIED";
}

function deriveSnsStage(input: DisplayStageInput): ApplicationDisplayStage {
  const { status, receivedAt, posts } = input;
  const now = input.now ?? new Date();

  if (status === "APPLIED") return "APPLIED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") {
    // 검토 완료된 게시물의 정산이 COMPLETED 면 "支払完了" 단계로 진입
    const anySettled = posts.some(
      (p) => p.settlementStatus === "COMPLETED",
    );
    return anySettled ? "SETTLED" : "COMPLETED";
  }

  if (status === "SHIPPED" || status === "DELIVERED") {
    // 인사이트 미제출 상태에서도 관리자가 정산을 완료시킨 경우 캠페인 참여는 종료된 것으로 간주.
    if (posts.some((p) => p.settlementStatus === "COMPLETED")) {
      return "SETTLED";
    }
    if (!receivedAt) return "AWAITING_RECEIPT";
    if (posts.length === 0) return "POSTING";

    if (posts.some((p) => p.reviewStatus === "REJECTED")) {
      return "POST_REJECTED";
    }

    // insightRequired=false 인 슬롯은 인사이트 미제출이어도 충족된 것으로 본다.
    const allInsightsSatisfied = posts.every(
      (p) => p.insightRequired === false || p.insightSubmittedAt !== null,
    );
    if (allInsightsSatisfied) {
      const anySettled = posts.some(
        (p) => p.settlementStatus === "COMPLETED",
      );
      if (anySettled) return "SETTLED";
      const allReviewsApproved = posts.every( // new — 리뷰 승인 여부로 검수/정산 단계 분리
        (p) => p.reviewStatus === "APPROVED",
      );
      return allReviewsApproved ? "COMPLETED" : "REVIEWING"; // new — 리뷰 APPROVED 면 정산 대기 스텝
    }

    const first = posts[0]!.submittedAt;
    const earliest = posts.reduce(
      (acc, p) => (p.submittedAt < acc ? p.submittedAt : acc),
      first,
    );
    // JST 일자 기준으로 N일째 되는 날(자정 이후)에 INSIGHT_DUE 로 전환.
    const daysPassed = Math.round(
      (startOfJstDay(now) - startOfJstDay(earliest)) / DAY_MS,
    );
    return daysPassed >= INSIGHT_DUE_DAYS ? "INSIGHT_DUE" : "POSTED";
  }

  return "APPLIED";
}

export function postingDeadline(
  anchor: Date | null,
  postingPeriodDays: number,
): Date | null {
  if (!anchor) return null;
  return new Date(anchor.getTime() + postingPeriodDays * DAY_MS);
}
