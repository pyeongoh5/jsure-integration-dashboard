import type { ApplicationStatus } from "@jsure/shared";

export type ApplicantStatus = "pending" | "approved" | "rejected";

export type Media = "ig" | "yt" | "tt" | "x";

export type ApplicantStage =
  | "PRE_SHIP"
  | "SHIPPING"
  | "DELIVERED"
  | "POST_DUE"
  | "REVIEW_DUE"
  | "COMPLETED";

export type Applicant = {
  id: string;
  influencerId: string;
  name: string;
  handle: string;
  flagged: boolean;
  campaign: string;
  media: Media[];
  followers: number;
  engagementRate: number;
  appliedAt: string;
  status: ApplicantStatus;
  rawStatus: ApplicationStatus;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  stage: ApplicantStage | null;
};

export type StatusCounts = Record<ApplicantStatus, number>;

export type CampaignOption = {
  id: string;
  title: string;
};

export const MEDIA_META: Record<
  Media,
  { label: string; icon: string; cls: string }
> = {
  ig: { label: "Instagram", icon: "fa-brands fa-instagram", cls: "mediaIg" },
  yt: { label: "YouTube", icon: "fa-brands fa-youtube", cls: "mediaYt" },
  tt: { label: "TikTok", icon: "fa-brands fa-tiktok", cls: "mediaTt" },
  x: { label: "X", icon: "fa-brands fa-x-twitter", cls: "mediaX" },
};

export const STATUS_TABS: { key: ApplicantStatus; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
];

export const STAGE_OPTIONS: { key: ApplicantStage; label: string }[] = [
  { key: "PRE_SHIP", label: "배송전" },
  { key: "SHIPPING", label: "배송중" },
  { key: "DELIVERED", label: "배송완료" },
  { key: "POST_DUE", label: "게시 대기" },
  { key: "REVIEW_DUE", label: "검토 대기" },
  { key: "COMPLETED", label: "완료" },
];
