import type {
  ApplicationDisplayStage,
  ApplicationStatus,
} from "@jsure/shared";

// TEMP: 전체 흐름 테스트용으로 0초로 단축 (운영 시 7일로 복귀 필요)
const SEVEN_DAYS_MS = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DisplayStageInput {
  status: ApplicationStatus;
  receivedAt: Date | null;
  posts: {
    submittedAt: Date;
    insightSubmittedAt: Date | null;
    reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  }[];
  now?: Date;
}

export function deriveDisplayStage(
  input: DisplayStageInput,
): ApplicationDisplayStage {
  const { status, receivedAt, posts } = input;
  const now = input.now ?? new Date();

  if (status === "APPLIED") return "APPLIED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "COMPLETED";

  if (status === "SHIPPED" || status === "DELIVERED") {
    if (!receivedAt) return "AWAITING_RECEIPT";
    if (posts.length === 0) return "POSTING";

    if (posts.some((p) => p.reviewStatus === "REJECTED")) {
      return "POST_REJECTED";
    }

    const allInsightsSubmitted = posts.every(
      (p) => p.insightSubmittedAt !== null,
    );
    if (allInsightsSubmitted) return "REVIEWING";

    const first = posts[0]!.submittedAt;
    const earliest = posts.reduce(
      (acc, p) => (p.submittedAt < acc ? p.submittedAt : acc),
      first,
    );
    const sevenDaysPassed = now.getTime() - earliest.getTime() >= SEVEN_DAYS_MS;
    return sevenDaysPassed ? "INSIGHT_DUE" : "POSTED";
  }

  return "APPLIED";
}

export function postingDeadline(
  receivedAt: Date | null,
  postingPeriodDays: number,
): Date | null {
  if (!receivedAt) return null;
  return new Date(receivedAt.getTime() + postingPeriodDays * DAY_MS);
}
