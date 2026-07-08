import type { CampaignCategory, CampaignSubType } from "../types/campaign.js";

export const CATEGORY_LABEL_JA: Record<CampaignCategory, string> = {
  SNS: "SNS",
  FAKE_PURCHASE: "買取レビュー",
};

export const SUB_TYPE_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  QOO10: "Qoo10",
};

/** 가구매(QOO10) 리뷰 채널 라벨. subTypeOptions 값에 대응. */
export const QOO10_REVIEW_CHANNEL_LABEL: Record<"LIPS" | "ATCOSME", string> = {
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

export const SNS_SUB_TYPES = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"] as const;
export const FAKE_PURCHASE_SUB_TYPES = ["QOO10"] as const satisfies readonly CampaignSubType[];

export function subTypesForCategory(
  category: CampaignCategory,
): readonly CampaignSubType[] {
  return category === "FAKE_PURCHASE" ? FAKE_PURCHASE_SUB_TYPES : SNS_SUB_TYPES;
}
