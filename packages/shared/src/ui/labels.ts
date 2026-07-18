import type { CampaignCategory, CampaignSubType } from "../types/campaign.js";

export const CATEGORY_LABEL_JA: Record<CampaignCategory, string> = {
  SNS: "SNS",
  FAKE_PURCHASE: "買取レビュー",
  SIMPLE_REVIEW: "単純レビュー",
};

export const SUB_TYPE_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  QOO10: "Qoo10",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

/** 가구매(QOO10) 리뷰 채널 라벨. subTypeOptions 값에 대응. */
export const QOO10_REVIEW_CHANNEL_LABEL: Record<"LIPS" | "ATCOSME", string> = {
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

/** 서브타입 옵션 값의 라벨 — 어드민 표기·서버 메시지용. */
export const SUB_TYPE_OPTION_LABEL: Record<string, string> = {
  FEED: "피드",
  REELS: "릴스",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

export const SNS_SUB_TYPES = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"] as const;
export const FAKE_PURCHASE_SUB_TYPES = ["QOO10"] as const satisfies readonly CampaignSubType[];
export const SIMPLE_REVIEW_SUB_TYPES = ["LIPS", "ATCOSME"] as const satisfies readonly CampaignSubType[];

export function subTypesForCategory(
  category: CampaignCategory,
): readonly CampaignSubType[] {
  if (category === "FAKE_PURCHASE") return FAKE_PURCHASE_SUB_TYPES;
  if (category === "SIMPLE_REVIEW") return SIMPLE_REVIEW_SUB_TYPES;
  return SNS_SUB_TYPES;
}
