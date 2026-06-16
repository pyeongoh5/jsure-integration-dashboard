import type {
  ApplicationStatus,
  PostReviewStatus,
  SnsType,
  SubmittedPostAttachment,
} from "@jsure/shared";

export type Media = "ig" | "yt" | "tt" | "x";

// reviewStatus + 인사이트 제출 여부 + 정산 상태를 통합한 단일 상태값.
export type DraftStatus =
  | "REVIEW_PENDING"
  | "AWAITING_INSIGHT"
  | "INSIGHT_SUBMITTED"
  | "SETTLEMENT_PENDING"
  | "SETTLED"
  | "REJECTED"
  | "REJECTED_LOCKED";

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
  influencerId: string;
  influencerName: string;
  influencerHandle: string;
  influencerFlagged: boolean;
  campaignId: string;
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
  status: DraftStatus;
  rejectionHistory: RejectionEntry[];
  settlement: {
    status: "PENDING" | "COMPLETED";
    amountJpy: number;
    completedAt: string | null;
  } | null;
};

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

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  REVIEW_PENDING: "검토 대기",
  AWAITING_INSIGHT: "인사이트 대기",
  INSIGHT_SUBMITTED: "인사이트 제출",
  SETTLEMENT_PENDING: "정산 대기",
  SETTLED: "정산 완료",
  REJECTED: "반려",
  REJECTED_LOCKED: "반려·인사이트 제출",
};

// 검토 페이지에 노출되는 상태만. SETTLEMENT_PENDING/SETTLED 는 정산 관리 페이지에서 처리.
export const DRAFT_STATUS_OPTIONS: { key: DraftStatus; label: string }[] = [
  { key: "REVIEW_PENDING", label: DRAFT_STATUS_LABEL.REVIEW_PENDING },
  { key: "AWAITING_INSIGHT", label: DRAFT_STATUS_LABEL.AWAITING_INSIGHT },
  { key: "INSIGHT_SUBMITTED", label: DRAFT_STATUS_LABEL.INSIGHT_SUBMITTED },
  { key: "REJECTED", label: DRAFT_STATUS_LABEL.REJECTED },
  { key: "REJECTED_LOCKED", label: DRAFT_STATUS_LABEL.REJECTED_LOCKED },
];
