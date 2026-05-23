import type {
  ApplicationDisplayStage,
  ApplicationStatus,
} from "@jsure/shared";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const POSTING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

interface DisplayStageInput {
  status: ApplicationStatus;
  posts: {
    submittedAt: Date;
    insightSubmittedAt: Date | null;
  }[];
  now?: Date;
}

export function deriveDisplayStage(
  input: DisplayStageInput,
): ApplicationDisplayStage {
  const { status, posts } = input;
  const now = input.now ?? new Date();

  if (status === "APPLIED") return "APPLIED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "SHIPPED") return "SHIPPED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELLED") return "CANCELLED";

  // DELIVERED — derive sub-stage from posts
  if (posts.length === 0) return "POSTING";

  const allInsightsSubmitted = posts.every((p) => p.insightSubmittedAt !== null);
  if (allInsightsSubmitted) return "REVIEWING";

  const first = posts[0]!.submittedAt;
  const earliest = posts.reduce(
    (acc, p) => (p.submittedAt < acc ? p.submittedAt : acc),
    first,
  );
  const sevenDaysPassed = now.getTime() - earliest.getTime() >= SEVEN_DAYS_MS;
  return sevenDaysPassed ? "INSIGHT_DUE" : "POSTED";
}

export function postingDeadline(deliveredAt: Date | null): Date | null {
  if (!deliveredAt) return null;
  return new Date(deliveredAt.getTime() + POSTING_WINDOW_MS);
}
