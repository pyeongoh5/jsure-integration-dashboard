import type { AdminSubmittedPost } from "@jsure/shared";
import { SNS_TO_MEDIA, type DraftReview, type DraftStatus } from "./types";

function deriveStatus(
  reviewStatus: AdminSubmittedPost["reviewStatus"],
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
  post: AdminSubmittedPost,
  now: Date,
): DraftReview {
  const matchingAccount = post.influencer.snsAccounts.find(
    (account) => account.snsType === post.snsType,
  );
  const insightSubmitted = post.insightSubmittedAt !== null;
  const settlementStatus = post.settlement?.status ?? null;
  return {
    id: post.id,
    influencerId: post.influencer.id,
    influencerName: post.influencer.name,
    influencerHandle: matchingAccount?.handle ?? "",
    influencerFlagged: post.influencer.flagged,
    campaignId: post.campaign.id,
    campaignTitle: post.campaign.title,
    campaignThumbnailUrl: post.campaign.thumbnailUrl,
    snsType: post.snsType,
    media: SNS_TO_MEDIA[post.snsType],
    instagramPostType: post.instagramPostType,
    url: post.url,
    submittedAt: formatRelative(post.submittedAt, now),
    insightSubmitted,
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
    reviewStatus: post.reviewStatus,
    applicationStatus: post.application.status,
    status: deriveStatus(post.reviewStatus, insightSubmitted, settlementStatus),
    rejectionHistory: post.rejectionHistory.map((rejection) => ({
      id: rejection.id,
      comment: rejection.comment,
      rejectedAt: formatRelative(rejection.rejectedAt, now),
    })),
    settlement: post.settlement
      ? {
          status: post.settlement.status,
          amountJpy: post.settlement.amountJpy,
          completedAt: post.settlement.completedAt,
        }
      : null,
  };
}
