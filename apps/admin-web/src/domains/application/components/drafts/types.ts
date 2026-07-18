import type {
  ApplicationOption,
  ApplicationStatus,
  CampaignCategory,
  CampaignSubType,
  PostReviewStatus,
  Attachment,
} from "@jsure/shared";

export type Media = "ig" | "yt" | "tt" | "x" | "qoo10" | "lips" | "atcosme";

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

/** 응모에 속한 서브타입별 제출 데이터. */
export type DraftPost = {
  id: string;
  subType: CampaignSubType;
  media: Media;
  url: string | null;
  insightSubmitted: boolean;
  insight: InsightMetrics;
  attachments: Attachment[];
};

/** 검토 행 — 응모(Application) 단위. id = applicationId. */
export type DraftReview = {
  id: string;
  influencerId: string;
  influencerName: string;
  influencerHandle: string;
  influencerFlagged: boolean;
  campaignId: string;
  campaignTitle: string;
  campaignThumbnailUrl: string | null;
  category: CampaignCategory;
  subTypes: CampaignSubType[];
  media: Media[];
  /** 응모가 선택한 서브타입 옵션 (INSTAGRAM 이면 FEED/REELS). */
  selectedOptions: ApplicationOption[];
  posts: DraftPost[];
  reviewUrls: Partial<Record<"LIPS" | "ATCOSME", string>>;
  submittedAt: string; // relative
  /** 모든 게시물의 인사이트가 제출되었는지. */
  insightSubmitted: boolean;
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
  qoo10: { label: "Qoo10", icon: "fa-solid fa-bag-shopping" },
  lips: { label: "LIPS", icon: "fa-solid fa-heart" },
  atcosme: { label: "@cosme", icon: "fa-solid fa-star" },
};

export const SNS_TO_MEDIA: Record<CampaignSubType, Media> = {
  INSTAGRAM: "ig",
  YOUTUBE: "yt",
  TIKTOK: "tt",
  X: "x",
  QOO10: "qoo10",
  LIPS: "lips",
  ATCOSME: "atcosme",
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
