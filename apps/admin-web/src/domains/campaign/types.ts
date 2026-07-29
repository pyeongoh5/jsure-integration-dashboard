import type {
  CampaignCategory,
  CampaignForm,
  CampaignSubType,
  InstagramPostType,
} from "@jsure/shared";

export type {
  CampaignCategory,
  CampaignResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  InstagramPostType,
  CampaignRecruit,
  CampaignSubType,
} from "@jsure/shared";

/** CampaignForm.recruits 의 요소 타입 (SNS/가구매 공용). */
export type CampaignFormRecruit = CampaignForm["recruits"][number];
/** CampaignFormRecruit.subType (SNS 4종 또는 QOO10). */
export type CampaignFormRecruitSubType = CampaignFormRecruit["subType"];

/** 카드/필터용 파생 상태. draft 는 서버의 publishState=DRAFT 를 그대로 반영한다. */
export type CampaignStatus = "recruit" | "full" | "done" | "draft";

export type CampaignCardRecruit = {
  subType: CampaignSubType;
  minFollowers: number;
  subTypeOptions: string[];
};

export const INSTAGRAM_POST_TYPE_LABEL: Record<InstagramPostType, string> = {
  FEED: "피드",
  REELS: "릴스",
};

export type Campaign = {
  id: string;
  brand: string;
  name: string;
  description: string;
  category: CampaignCategory;
  status: CampaignStatus;
  thumbIcon: string;
  thumbnailUrl: string | null;
  period: string;
  reward: string;
  approved: number;
  applied: number;
  capacity: number;
  dday: number;
  updatedAt: string;
  recruits: CampaignCardRecruit[];
};

export const SNS_ICON_CLASS: Record<CampaignSubType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  X: "fa-brands fa-x-twitter",
  YOUTUBE: "fa-brands fa-youtube",
  QOO10: "fa-solid fa-bag-shopping",
  LIPS: "fa-solid fa-heart",
  ATCOSME: "fa-solid fa-star",
};

export const SNS_FOLLOWER_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "팔로워",
  TIKTOK: "팔로워",
  X: "팔로워",
  YOUTUBE: "구독자",
  QOO10: "팔로워",
  LIPS: "팔로워",
  ATCOSME: "팔로워",
};

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  recruit: "모집중",
  full: "모집 완료",
  done: "모집 종료",
  draft: "임시저장",
};
