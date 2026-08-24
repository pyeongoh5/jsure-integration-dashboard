import type { AdminTranslationKey } from "@i18n/admin";
import type {
  ApplicantMediaFilterKey,
  ApplicantViewStatus,
  ApplicationOption,
  ApplicationStatus,
  CampaignCategory,
  CampaignSubType,
  SnsAccountSubType,
} from "@jsure/shared";
import type { HandleBySubType } from "@/domains/influencer/handleBySubType";

// 화면 노출 상태와 서브타입 필터 키는 서버 필터(SQL)와 같은 규칙을 써야 하므로
// shared 의 정의를 그대로 쓴다. 규칙 표는 shared/types/applicantFilter.ts.
export type ApplicantStatus = ApplicantViewStatus;

export type Media = "ig" | "yt" | "tt" | "x" | "qoo10" | "lips" | "atcosme";

/** 서브타입 필터 전용 키 — 인스타그램은 응모 옵션(FEED/REELS) 기준으로 세분화한다. */
export type MediaFilterKey = ApplicantMediaFilterKey;

const INSTAGRAM_OPTION_BY_FILTER_KEY: Partial<Record<MediaFilterKey, string>> = {
  "ig-feed": "FEED",
  "ig-reels": "REELS",
};

/**
 * 서브타입 필터 매칭(클라이언트 판정). 응모자 관리는 같은 규칙을 서버에서 처리하므로
 * 아직 클라이언트에서 거르는 검토(Drafts) 화면 전용이다.
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
  /** `handle` 이 속한 SNS 채널 — 프로필 아웃링크 조합용. 핸들이 없으면 null. */
  handleSnsType: SnsAccountSubType | null;
  /** SNS 채널별 핸들 — 채널 아이콘 프로필 아웃링크용. */
  handleBySubType: HandleBySubType;
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
  // 어드민 전용 관리 태그. 필터 목록에서 제목 앞의 배지로 표시한다.
  // 정산처럼 태그를 모르는 화면은 생략 가능.
  tags?: string[];
  // 모집 종료 여부(수동 종료 또는 모집 마감일 경과). 상태 세그먼트를 쓰지 않는 화면은 생략 가능.
  closed?: boolean;
};

/** 미디어 필터 칩 표기용. 테이블의 SNS 배지는 composites/SubTypeIcon 이 담당한다. */
export const MEDIA_META: Record<Media, { label: string; icon: string }> = {
  ig: { label: "Instagram", icon: "fa-brands fa-instagram" },
  yt: { label: "YouTube", icon: "fa-brands fa-youtube" },
  tt: { label: "TikTok", icon: "fa-brands fa-tiktok" },
  x: { label: "X", icon: "fa-brands fa-x-twitter" },
  qoo10: { label: "Qoo10", icon: "fa-solid fa-bag-shopping" },
  lips: { label: "LIPS", icon: "fa-solid fa-heart" },
  atcosme: { label: "@cosme", icon: "fa-solid fa-star" },
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
  FAKE_PURCHASE: "domains.application.category.pendingPurchase",
  SIMPLE_REVIEW: "domains.application.category.quickReview",
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
