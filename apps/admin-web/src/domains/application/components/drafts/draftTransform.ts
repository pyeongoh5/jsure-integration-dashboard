import { pickRepresentativeSnsAccount, type AdminSubmission } from "@jsure/shared";
import { SNS_TO_MEDIA, type DraftReview, type DraftStatus } from "./types";

function deriveStatus(
  reviewStatus: AdminSubmission["submissionReviewStatus"],
  insightSubmitted: boolean,
  settlementStatus: "PENDING" | "COMPLETED" | null,
): DraftStatus {
  if (reviewStatus === "PENDING") return "REVIEW_PENDING";
  if (reviewStatus === "REJECTED") {
    return insightSubmitted ? "REJECTED_LOCKED" : "REJECTED";
  }
  if (settlementStatus === "COMPLETED") return "SETTLED";
  if (settlementStatus === "PENDING") return "SETTLEMENT_PENDING";
  return insightSubmitted ? "INSIGHT_SUBMITTED" : "AWAITING_INSIGHT";
}

const REVIEW_URL_CHANNELS = ["LIPS", "ATCOSME"] as const;

function extractReviewUrls(
  submissionData: Record<string, unknown> | null,
): Partial<Record<"LIPS" | "ATCOSME", string>> {
  const result: Partial<Record<"LIPS" | "ATCOSME", string>> = {};
  if (!submissionData) return result;
  const raw = submissionData.reviewUrls;
  if (!raw || typeof raw !== "object") return result;
  for (const channel of REVIEW_URL_CHANNELS) {
    const value = (raw as Record<string, unknown>)[channel];
    if (typeof value === "string" && value.length > 0) {
      result[channel] = value;
    }
  }
  return result;
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function formatRelative(iso: string, now: Date): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return RELATIVE_TIME.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return RELATIVE_TIME.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return RELATIVE_TIME.format(-days, "day");
  return then.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function toDraftReview(
  submission: AdminSubmission,
  now: Date,
): DraftReview {
  const matchingAccount = submission.influencer.snsAccounts.find((account) =>
    submission.subTypes.includes(account.snsType),
  );
  const representative = pickRepresentativeSnsAccount(
    submission.influencer.snsAccounts,
  );
  // 모든 게시물의 인사이트가 제출돼야 "인사이트 제출" 상태로 본다.
  const insightSubmitted =
    submission.posts.length > 0 &&
    submission.posts.every((post) => post.insightSubmittedAt !== null);
  const settlementStatus = submission.settlement?.status ?? null;
  const qooPost = submission.posts.find((post) => post.subType === "QOO10");
  const latestSubmittedAt = submission.reviewSubmittedAt
    ?? submission.posts.map((post) => post.submittedAt).sort().at(-1)
    ?? new Date(0).toISOString();
  return {
    id: submission.id,
    influencerId: submission.influencer.id,
    influencerName: submission.influencer.name,
    influencerHandle: matchingAccount?.handle ?? "",
    representativeSns: representative
      ? { snsType: representative.snsType, handle: representative.handle }
      : null,
    influencerFlagged: submission.influencer.flagged,
    campaignId: submission.campaign.id,
    campaignTitle: submission.campaign.title,
    campaignThumbnailUrl: submission.campaign.thumbnailUrl,
    category: submission.campaign.category,
    subTypes: submission.subTypes,
    media: submission.subTypes.map((subType) => SNS_TO_MEDIA[subType]),
    selectedOptions: submission.selectedOptions,
    posts: submission.posts.map((post) => ({
      id: post.id,
      subType: post.subType,
      media: SNS_TO_MEDIA[post.subType],
      url: post.url,
      insightSubmitted: post.insightSubmittedAt !== null,
      insight: {
        likes: post.insightLikes,
        comments: post.insightComments,
        shares: post.insightShares,
        reposts: post.insightReposts,
        saves: post.insightSaves,
        views: post.insightViews,
        reach: post.insightReach,
        submittedAt: post.insightSubmittedAt,
      },
      attachments: post.attachments,
    })),
    reviewUrls: extractReviewUrls(qooPost?.submissionData ?? null),
    submittedAt: formatRelative(latestSubmittedAt, now),
    insightSubmitted,
    reviewStatus: submission.submissionReviewStatus,
    applicationStatus: submission.status,
    status: deriveStatus(
      submission.submissionReviewStatus,
      insightSubmitted,
      settlementStatus,
    ),
    rejectionHistory: submission.rejectionHistory.map((rejection) => ({
      id: rejection.id,
      comment: rejection.comment,
      rejectedAt: formatRelative(rejection.rejectedAt, now),
    })),
    settlement: submission.settlement
      ? {
          status: submission.settlement.status,
          amountJpy: submission.settlement.amountJpy,
          completedAt: submission.settlement.completedAt,
        }
      : null,
  };
}
