import type { AdminTranslationKey } from "@i18n/admin";
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
export type CampaignStatus = "recruit" | "full" | "done" | "draft" | "hidden";

export type CampaignCardRecruit = {
  subType: CampaignSubType;
  minFollowers: number;
  subTypeOptions: string[];
};

// 값은 i18n 키 — 표시 시점에 컴포넌트에서 t(...) 로 번역한다.
export const INSTAGRAM_POST_TYPE_LABEL: Record<InstagramPostType, AdminTranslationKey> = {
  FEED: "domains.campaign.instagramPostType.feed",
  REELS: "domains.campaign.instagramPostType.reels",
};

export type Campaign = {
  id: string;
  brand: string;
  name: string;
  /** 어드민 전용 관리 태그 — 카드에서 배지로만 표시한다. */
  tags: string[];
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

export const SNS_FOLLOWER_LABEL: Record<CampaignSubType, AdminTranslationKey> = {
  INSTAGRAM: "domains.campaign.followerLabel.follower",
  TIKTOK: "domains.campaign.followerLabel.follower",
  X: "domains.campaign.followerLabel.follower",
  YOUTUBE: "domains.campaign.followerLabel.subscriber",
  QOO10: "domains.campaign.followerLabel.follower",
  LIPS: "domains.campaign.followerLabel.follower",
  ATCOSME: "domains.campaign.followerLabel.follower",
};

export const STATUS_LABEL: Record<CampaignStatus, AdminTranslationKey> = {
  recruit: "domains.campaign.status.recruit",
  full: "domains.campaign.status.full",
  done: "domains.campaign.status.done",
  draft: "domains.campaign.status.draft",
  hidden: "domains.campaign.status.hidden",
};
