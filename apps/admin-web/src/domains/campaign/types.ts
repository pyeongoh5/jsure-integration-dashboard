import type { SnsType } from "@jsure/shared";

export type {
  CampaignResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  SnsRecruit,
  SnsType,
} from "@jsure/shared";

export type CampaignStatus = "recruit" | "done";

export type CampaignCardSnsRecruit = {
  snsType: SnsType;
  minFollowers: number;
};

export type Campaign = {
  id: string;
  brand: string;
  name: string;
  description: string;
  status: CampaignStatus;
  thumbIcon: string;
  thumbnailUrl: string | null;
  period: string;
  reward: string;
  approved: number;
  applied: number;
  capacity: number;
  dday: number;
  snsRecruits: CampaignCardSnsRecruit[];
};

export const SNS_ICON_CLASS: Record<SnsType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  X: "fa-brands fa-x-twitter",
  YOUTUBE: "fa-brands fa-youtube",
};

export const SNS_FOLLOWER_LABEL: Record<SnsType, string> = {
  INSTAGRAM: "팔로워",
  TIKTOK: "팔로워",
  X: "팔로워",
  YOUTUBE: "구독자",
};

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  recruit: "모집중",
  done: "완료",
};
