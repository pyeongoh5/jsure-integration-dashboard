export type ApplicantStatus = "pending" | "approved" | "rejected";

export type Media = "ig" | "yt" | "tt" | "x";

export type Applicant = {
  id: string;
  name: string;
  handle: string;
  campaign: string;
  media: Media[];
  followers: number;
  engagementRate: number;
  appliedAt: string;
  status: ApplicantStatus;
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
  ig: { label: "Instagram", icon: "fa-brands fa-instagram", cls: "apl-media--ig" },
  yt: { label: "YouTube", icon: "fa-brands fa-youtube", cls: "apl-media--yt" },
  tt: { label: "TikTok", icon: "fa-brands fa-tiktok", cls: "apl-media--tt" },
  x: { label: "X", icon: "fa-brands fa-x-twitter", cls: "apl-media--x" },
};

export const STATUS_TABS: { key: ApplicantStatus; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
];
