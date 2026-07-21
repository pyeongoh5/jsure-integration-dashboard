import type {
  ApplicationDisplayStage,
  ApplicationStatus,
  CampaignCategory,
} from "@jsure/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
// 운영: 투고 7일 후 인사이트 제출 가능. 로컬/개발: 즉시 제출 가능(테스트 편의).
const INSIGHT_DUE_DAYS = process.env.NODE_ENV === "production" ? 7 : 0;

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
  /** 제출물(전체) 검토 상태 — 응모 단위. */
  submissionReviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  /** 응모 단위 정산 상태. 정산 미생성이면 null. */
  settlementStatus: "PENDING" | "COMPLETED" | null;
  posts: {
    submittedAt: Date;
    insightSubmittedAt: Date | null;
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
  const { status, receivedAt, submissionReviewStatus, settlementStatus } =
    input;
  if (status === "APPLIED") return "APPLIED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "SHIPPED" || status === "DELIVERED") {
    // 수령 확인 이전엔 AWAITING_RECEIPT, 이후엔 리뷰 제출 대기(AWAITING_REVIEW).
    return receivedAt ? "AWAITING_REVIEW" : "AWAITING_RECEIPT";
  }
  if (status === "REVIEW_SUBMITTED") {
    if (submissionReviewStatus === "REJECTED") return "REVIEW_REJECTED";
    if (submissionReviewStatus === "PENDING") return "REVIEW_PENDING";
    if (settlementStatus === "COMPLETED") return "SETTLED";
    return "COMPLETED";
  }
  if (status === "COMPLETED") {
    return settlementStatus === "COMPLETED" ? "SETTLED" : "COMPLETED";
  }
  return "APPLIED";
}

function deriveFakePurchaseStage(
  input: DisplayStageInput,
): ApplicationDisplayStage {
  const { status, submissionReviewStatus, settlementStatus } = input;
  if (status === "APPLIED") return "APPLIED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "APPROVED") return "AWAITING_ORDER";
  if (status === "ORDER_SUBMITTED") return "AWAITING_REVIEW";
  if (status === "REVIEW_SUBMITTED") {
    if (submissionReviewStatus === "REJECTED") return "REVIEW_REJECTED";
    if (submissionReviewStatus === "PENDING") return "REVIEW_PENDING";
    if (settlementStatus === "COMPLETED") return "SETTLED";
    return "COMPLETED"; // 리뷰 APPROVED + 정산 대기(PENDING) 는 정산 대기 스텝
  }
  if (status === "COMPLETED") {
    return settlementStatus === "COMPLETED" ? "SETTLED" : "COMPLETED";
  }
  return "APPLIED";
}

function deriveSnsStage(input: DisplayStageInput): ApplicationDisplayStage {
  const {
    status,
    receivedAt,
    posts,
    submissionReviewStatus,
    settlementStatus,
  } = input;
  const now = input.now ?? new Date();

  if (status === "APPLIED") return "APPLIED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") {
    return settlementStatus === "COMPLETED" ? "SETTLED" : "COMPLETED";
  }

  if (status === "SHIPPED" || status === "DELIVERED") {
    // 제출 전에 관리자가 정산을 완료시킨 경우 캠페인 참여는 종료된 것으로 간주.
    if (settlementStatus === "COMPLETED") return "SETTLED";
    if (!receivedAt) return "AWAITING_RECEIPT";
    return "POSTING";
  }

  if (status === "REVIEW_SUBMITTED") {
    if (settlementStatus === "COMPLETED") return "SETTLED";
    if (submissionReviewStatus === "REJECTED") return "POST_REJECTED";

    // insightRequired=false 인 슬롯은 인사이트 미제출이어도 충족된 것으로 본다.
    const allInsightsSatisfied = posts.every(
      (post) => post.insightRequired === false || post.insightSubmittedAt !== null,
    );
    if (allInsightsSatisfied) {
      return submissionReviewStatus === "APPROVED" ? "COMPLETED" : "REVIEWING";
    }

    const first = posts[0]!.submittedAt;
    const earliest = posts.reduce(
      (acc, post) => (post.submittedAt < acc ? post.submittedAt : acc),
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
