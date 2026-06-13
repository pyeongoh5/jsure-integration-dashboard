import type {
  ApplicationStatus,
  PostReviewStatus,
  SnsType,
  SubmittedPostAttachment,
} from "@jsure/shared";

export type Media = "ig" | "yt" | "tt" | "x";

export type DraftReviewTab = "pending" | "approved" | "rejected";

export type RejectionEntry = {
  id: string;
  comment: string;
  rejectedAt: string; // relative
};

export type InsightMetrics = {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
  views: number | null;
  reach: number | null;
  submittedAt: string | null; // ISO
};

export type DraftReview = {
  id: string;
  influencerName: string;
  influencerHandle: string;
  campaignTitle: string;
  campaignThumbnailUrl: string | null;
  snsType: SnsType;
  media: Media;
  url: string;
  submittedAt: string; // relative
  insightSubmitted: boolean;
  insight: InsightMetrics;
  attachments: SubmittedPostAttachment[];
  reviewStatus: PostReviewStatus;
  applicationStatus: ApplicationStatus;
  rejectionHistory: RejectionEntry[];
  settlement: {
    status: "PENDING" | "COMPLETED";
    amountJpy: number;
    completedAt: string | null;
  } | null;
};

export type DraftReviewCounts = Record<DraftReviewTab, number>;

export const MEDIA_META: Record<
  Media,
  { label: string; icon: string }
> = {
  ig: { label: "Instagram", icon: "fa-brands fa-instagram" },
  yt: { label: "YouTube", icon: "fa-brands fa-youtube" },
  tt: { label: "TikTok", icon: "fa-brands fa-tiktok" },
  x: { label: "X", icon: "fa-brands fa-x-twitter" },
};

export const SNS_TO_MEDIA: Record<SnsType, Media> = {
  INSTAGRAM: "ig",
  YOUTUBE: "yt",
  TIKTOK: "tt",
  X: "x",
};

export const TAB_TO_REVIEW_STATUS: Record<DraftReviewTab, PostReviewStatus> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
};

export const REVIEW_STATUS_TO_TAB: Record<PostReviewStatus, DraftReviewTab> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const DRAFT_TABS: { key: DraftReviewTab; label: string }[] = [
  { key: "pending", label: "검토 대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
];
