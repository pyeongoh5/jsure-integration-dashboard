import type {
  InfluencerCampaignCard,
  InfluencerCampaignDetail,
} from "@jsure/shared";

export function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

type RewardRangeRecruit = InfluencerCampaignCard["recruits"][number];

/**
 * 서브타입 1개의 보수 기여 구간.
 * 옵션별 보수 분리 recruit(모든 옵션에 rewardJpy 존재)은 응모가 옵션 1개를 고르므로
 * [옵션 최소, 옵션 최대], 아니면 고정 recruit.rewardJpy.
 */
function recruitRewardBounds(recruit: RewardRangeRecruit): {
  min: number;
  max: number;
} {
  const optionRewards = recruit.options
    .map((option) => option.rewardJpy)
    .filter((reward): reward is number => reward !== null);
  if (
    recruit.options.length > 0 &&
    optionRewards.length === recruit.options.length
  ) {
    return {
      min: Math.min(...optionRewards),
      max: Math.max(...optionRewards),
    };
  }
  const fixed = recruit.rewardJpy ?? 0;
  return { min: fixed, max: fixed };
}

/**
 * 인플루언서에게 표시할 보수 범위.
 * - UNIFIED: min = max = 캠페인 고정 보수.
 * - PER_SUBTYPE: 최대 = 전 서브타입 기여 최대 합.
 *   최소 = 필수 응모 서브타입이 있으면 그 기여 최소 합, 없으면 가장 저렴한 기여.
 */
export function rewardRangeJpy(
  campaign: Pick<
    InfluencerCampaignCard,
    "rewardType" | "rewardJpy" | "recruits"
  >,
): { min: number; max: number } {
  if (
    campaign.rewardType !== "PER_SUBTYPE" ||
    campaign.recruits.length === 0
  ) {
    return { min: campaign.rewardJpy, max: campaign.rewardJpy };
  }
  const bounds = campaign.recruits.map(recruitRewardBounds);
  const max = bounds.reduce((sum, bound) => sum + bound.max, 0);
  const requiredBounds = campaign.recruits
    .filter((recruit) => recruit.isRequired)
    .map(recruitRewardBounds);
  const min =
    requiredBounds.length > 0
      ? requiredBounds.reduce((sum, bound) => sum + bound.min, 0)
      : Math.min(...bounds.map((bound) => bound.min));
  return { min, max };
}

/** 보수 표시 문자열 — 개별보수 범위면 "¥1,000〜¥4,000" 형태. */
export function formatRewardRange(
  campaign: Pick<
    InfluencerCampaignCard,
    "rewardType" | "rewardJpy" | "recruits"
  >,
): string {
  const { min, max } = rewardRangeJpy(campaign);
  return min === max ? formatYen(min) : `${formatYen(min)}〜${formatYen(max)}`;
}

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * 캠페인이 모집 종료 상태인지 판정.
 * 서버에서 isEnded 를 내려주지만 모집인원 충족이나 만료일 도래 시도 종료로 본다.
 */
export function isCampaignClosed(
  card: Pick<InfluencerCampaignDetail, "isEnded" | "recruitEndAt" | "approvedCount" | "recruitCount">,
  now: Date = new Date(),
): boolean {
  return (
    card.isEnded ||
    new Date(card.recruitEndAt) < now ||
    card.approvedCount >= card.recruitCount
  );
}
