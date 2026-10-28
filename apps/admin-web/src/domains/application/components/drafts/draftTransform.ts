import {
  deriveDraftViewStatus,
  pickRepresentativeSnsAccount,
  postUrls,
  type AdminSubmission,
} from "@jsure/shared";
import type { AdminLanguage } from "@i18n/admin";
import { toHandleBySubType } from "@/domains/influencer/handleBySubType";
import { formatRelative } from "../applicants/applicantTransform";
import { SNS_TO_MEDIA, type DraftReview, type DraftStatus } from "./types";

/**
 * 화면 상태. 규칙은 shared 의 DRAFT_VIEW_STATUS_RULES 하나가 출처이고,
 * 서버의 목록 필터(SQL)도 같은 표를 읽는다.
 *
 * 규칙에 안 맞는 건 = 정산 흐름 진입분. 서버가 목록에서 걸러 주므로 여기까지
 * 오지 않지만, 정산 관리에서 같은 변환을 재사용할 때를 위해 분기는 남겨 둔다.
 */
function deriveStatus(
  reviewStatus: AdminSubmission["submissionReviewStatus"],
  insightSubmitted: boolean,
  settlementStatus: "PENDING" | "COMPLETED" | null,
): DraftStatus {
  const viewStatus = deriveDraftViewStatus({
    reviewStatus,
    insightSubmitted,
    hasSettlement: settlementStatus !== null,
  });
  if (viewStatus) return viewStatus;
  return settlementStatus === "COMPLETED" ? "SETTLED" : "SETTLEMENT_PENDING";
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

export function toDraftReview(
  submission: AdminSubmission,
  now: Date,
  language: AdminLanguage,
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
    influencerHandleSnsType: matchingAccount?.snsType ?? null,
    handleBySubType: toHandleBySubType(submission.influencer.snsAccounts),
    representativeSns: representative
      ? { snsType: representative.snsType, handle: representative.handle }
      : null,
    influencerFlagged: submission.influencer.flagged,
    influencerTags: submission.influencer.tags,
    campaignId: submission.campaign.id,
    campaignTitle: submission.campaign.title,
    campaignThumbnailUrl: submission.campaign.thumbnailUrl,
    category: submission.campaign.category,
    subTypes: submission.subTypes,
    media: submission.subTypes.map((subType) => SNS_TO_MEDIA[subType]),
    selectedOptions: submission.selectedOptions,
    orderNumber: submission.orderNumber,
    posts: submission.posts.map((post) => ({
      id: post.id,
      subType: post.subType,
      media: SNS_TO_MEDIA[post.subType],
      url: post.url,
      urls: postUrls(post),
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
    crossPosts: submission.crossPosts,
    submittedAt: formatRelative(latestSubmittedAt, now, language),
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
      rejectedAt: formatRelative(rejection.rejectedAt, now, language),
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
