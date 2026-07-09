import type {
  ApplicationStatus,
  CampaignCategory,
  CampaignSubType,
  InstagramPostType,
} from "@jsure/shared";

// 검토/정산 단계로 넘어가지 않은 응모만 응모 관리에 노출한다.
// 검토 단계 = SubmittedPost 존재(application.hasSubmittedPost=true).
// 정산 단계 = ApplicationStatus.COMPLETED.
export type ApplicantStatus =
  | "APPLIED"
  | "PRE_SHIP"
  | "SHIPPING"
  | "DELIVERED"
  | "POST_DUE"
  | "AWAITING_ORDER"
  | "AWAITING_REVIEW"
  | "REJECTED";

export type Media = "ig" | "yt" | "tt" | "x" | "qoo10";

export type Applicant = {
  id: string;
  influencerId: string;
  name: string;
  handle: string;
  flagged: boolean;
  campaignId: string;
  campaign: string;
  category: CampaignCategory;
  subType: CampaignSubType;
  orderNumber: string | null;
  media: Media[];
  instagramPostType: InstagramPostType | null;
  followers: number;
  engagementRate: number;
  appliedAt: string;
  status: ApplicantStatus;
  rawStatus: ApplicationStatus;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  // 검색용 — 응모한 SNS 외 다른 SNS 핸들까지 포함해 부분일치 검색 가능하게 함.
  allHandles: string[];
};

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
  qoo10: { label: "Qoo10", icon: "fa-solid fa-bag-shopping", cls: "mediaQoo10" },
};

export const APPLICANT_STATUS_LABEL: Record<ApplicantStatus, string> = {
  APPLIED: "승인 대기",
  PRE_SHIP: "승인·배송전",
  SHIPPING: "배송중",
  DELIVERED: "수령 확인 대기",
  POST_DUE: "투고 대기",
  AWAITING_ORDER: "주문 대기",
  AWAITING_REVIEW: "리뷰 대기",
  REJECTED: "반려",
};

export const CATEGORY_LABEL_KO: Record<CampaignCategory, string> = {
  SNS: "SNS",
  FAKE_PURCHASE: "가구매",
};

export const CATEGORY_FILTER_OPTIONS: { key: CampaignCategory; label: string }[] = [
  { key: "SNS", label: CATEGORY_LABEL_KO.SNS },
  { key: "FAKE_PURCHASE", label: CATEGORY_LABEL_KO.FAKE_PURCHASE },
];

export const APPLICANT_STATUS_OPTIONS: { key: ApplicantStatus; label: string }[] = [
  { key: "APPLIED", label: APPLICANT_STATUS_LABEL.APPLIED },
  { key: "PRE_SHIP", label: APPLICANT_STATUS_LABEL.PRE_SHIP },
  { key: "SHIPPING", label: APPLICANT_STATUS_LABEL.SHIPPING },
  { key: "DELIVERED", label: APPLICANT_STATUS_LABEL.DELIVERED },
  { key: "POST_DUE", label: APPLICANT_STATUS_LABEL.POST_DUE },
  { key: "AWAITING_ORDER", label: APPLICANT_STATUS_LABEL.AWAITING_ORDER },
  { key: "AWAITING_REVIEW", label: APPLICANT_STATUS_LABEL.AWAITING_REVIEW },
  { key: "REJECTED", label: APPLICANT_STATUS_LABEL.REJECTED },
];
