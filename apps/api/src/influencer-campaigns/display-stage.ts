import type { ApplicationDisplayStage, ApplicationStatus } from "@jsure/shared";

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
  receivedAt: Date | null;
  posts: {
    submittedAt: Date;
    insightSubmittedAt: Date | null;
    reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
    settlementStatus?: "PENDING" | "COMPLETED" | null;
  }[];
  now?: Date;
}

export function deriveDisplayStage(input: DisplayStageInput): ApplicationDisplayStage {
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
    if (!receivedAt) return "AWAITING_RECEIPT";
    if (posts.length === 0) return "POSTING";

    if (posts.some((p) => p.reviewStatus === "REJECTED")) {
      return "POST_REJECTED";
    }

    const allInsightsSubmitted = posts.every((p) => p.insightSubmittedAt !== null);
    if (allInsightsSubmitted) {
      const anySettled = posts.some(
        (p) => p.settlementStatus === "COMPLETED",
      );
      return anySettled ? "SETTLED" : "REVIEWING";
    }

    const first = posts[0]!.submittedAt;
    const earliest = posts.reduce((acc, p) => (p.submittedAt < acc ? p.submittedAt : acc), first);
    // JST 일자 기준으로 N일째 되는 날(자정 이후)에 INSIGHT_DUE 로 전환.
    const daysPassed = Math.round((startOfJstDay(now) - startOfJstDay(earliest)) / DAY_MS);
    return daysPassed >= INSIGHT_DUE_DAYS ? "INSIGHT_DUE" : "POSTED";
  }

  return "APPLIED";
}

export function postingDeadline(receivedAt: Date | null, postingPeriodDays: number): Date | null {
  if (!receivedAt) return null;
  return new Date(receivedAt.getTime() + postingPeriodDays * DAY_MS);
}
