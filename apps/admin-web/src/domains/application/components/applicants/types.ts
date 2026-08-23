import type { AdminTranslationKey } from "@i18n/admin";
import type {
  ApplicationOption,
  ApplicationStatus,
  CampaignCategory,
  CampaignSubType,
  SnsAccountSubType,
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

export type Media = "ig" | "yt" | "tt" | "x" | "qoo10" | "lips" | "atcosme";

/** 서브타입 필터 전용 키 — 인스타그램은 응모 옵션(FEED/REELS) 기준으로 세분화한다. */
export type MediaFilterKey = Exclude<Media, "ig"> | "ig-feed" | "ig-reels";

const INSTAGRAM_OPTION_BY_FILTER_KEY: Partial<Record<MediaFilterKey, string>> = {
  "ig-feed": "FEED",
  "ig-reels": "REELS",
};

/**
 * 서브타입 필터 매칭. 인스타그램 키는 참여 여부가 아니라 응모가 선택한
 * FEED/REELS 옵션으로 판정한다 (INSTAGRAM 응모는 옵션 선택이 필수라 누락 없음).
 */
export function matchesMediaFilter(
  media: Media[],
  selectedOptions: ApplicationOption[],
  filter: Set<MediaFilterKey>,
): boolean {
  if (filter.size === 0) return true;
  return [...filter].some((filterKey) => {
    const instagramOption = INSTAGRAM_OPTION_BY_FILTER_KEY[filterKey];
    if (instagramOption) {
      return selectedOptions.some(
        (selected) =>
          selected.subType === "INSTAGRAM" &&
          selected.option === instagramOption,
      );
    }
    return media.includes(filterKey as Media);
  });
}

export type Applicant = {
  id: string;
  influencerId: string;
  name: string;
  handle: string;
  /** 응모 SNS 핸들이 없을 때(가구매·단순리뷰) 표기할 대표 SNS. 우선순위 Instagram→X→TikTok. */
  representativeSns: { snsType: SnsAccountSubType; handle: string } | null;
  flagged: boolean;
  campaignId: string;
  campaign: string;
  category: CampaignCategory;
  subTypes: CampaignSubType[];
  orderNumber: string | null;
  media: Media[];
  /** 응모가 선택한 서브타입 옵션 (INSTAGRAM 이면 FEED/REELS). */
  selectedOptions: ApplicationOption[];
  followers: number;
  /** 참여 서브타입별 팔로워 수 — 다중 참여 시 세로 나열 표시용. */
  followersBySubType: { subType: CampaignSubType; followerCount: number }[];
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
  // 모집 종료 여부(수동 종료 또는 모집 마감일 경과). 상태 세그먼트를 쓰지 않는 화면은 생략 가능.
  closed?: boolean;
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
  lips: { label: "LIPS", icon: "fa-solid fa-heart", cls: "mediaQoo10" },
  atcosme: { label: "@cosme", icon: "fa-solid fa-star", cls: "mediaQoo10" },
};

// 값은 i18n 키 — 표시 시점에 컴포넌트에서 t(...) 로 번역한다.
export const APPLICANT_STATUS_LABEL: Record<ApplicantStatus, AdminTranslationKey> = {
  APPLIED: "domains.application.status.applied",
  PRE_SHIP: "domains.application.status.preShip",
  SHIPPING: "domains.application.status.shipping",
  DELIVERED: "domains.application.status.delivered",
  POST_DUE: "domains.application.status.postDue",
  AWAITING_ORDER: "domains.application.status.awaitingOrder",
  AWAITING_REVIEW: "domains.application.status.awaitingReview",
  REJECTED: "domains.application.status.rejected",
};

export const CATEGORY_LABEL_KO: Record<CampaignCategory, AdminTranslationKey> = {
  SNS: "domains.application.category.sns",
  FAKE_PURCHASE: "domains.application.category.fakePurchase",
  SIMPLE_REVIEW: "domains.application.category.simpleReview",
};

export const CATEGORY_FILTER_OPTIONS: {
  key: CampaignCategory;
  label: AdminTranslationKey;
}[] = [
  { key: "SNS", label: CATEGORY_LABEL_KO.SNS },
  { key: "FAKE_PURCHASE", label: CATEGORY_LABEL_KO.FAKE_PURCHASE },
  { key: "SIMPLE_REVIEW", label: CATEGORY_LABEL_KO.SIMPLE_REVIEW },
];

export const APPLICANT_STATUS_OPTIONS: {
  key: ApplicantStatus;
  label: AdminTranslationKey;
}[] = [
  { key: "APPLIED", label: APPLICANT_STATUS_LABEL.APPLIED },
  { key: "PRE_SHIP", label: APPLICANT_STATUS_LABEL.PRE_SHIP },
  { key: "SHIPPING", label: APPLICANT_STATUS_LABEL.SHIPPING },
  { key: "DELIVERED", label: APPLICANT_STATUS_LABEL.DELIVERED },
  { key: "POST_DUE", label: APPLICANT_STATUS_LABEL.POST_DUE },
  { key: "AWAITING_ORDER", label: APPLICANT_STATUS_LABEL.AWAITING_ORDER },
  { key: "AWAITING_REVIEW", label: APPLICANT_STATUS_LABEL.AWAITING_REVIEW },
  { key: "REJECTED", label: APPLICANT_STATUS_LABEL.REJECTED },
];
