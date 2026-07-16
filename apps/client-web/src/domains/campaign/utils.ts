import type {
  InfluencerCampaignCard,
  InfluencerCampaignDetail,
} from "@jsure/shared";

export function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

/**
 * 인플루언서에게 표시할 보수 범위.
 * - UNIFIED: min = max = 캠페인 고정 보수.
 * - PER_SUBTYPE: 최대 = 전 서브타입 보수 합.
 *   최소 = 필수 응모 서브타입이 있으면 그 보수 합, 없으면 가장 저렴한 서브타입 보수.
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
  const rewards = campaign.recruits.map((recruit) => recruit.rewardJpy ?? 0);
  const max = rewards.reduce((sum, reward) => sum + reward, 0);
  const requiredRecruits = campaign.recruits.filter(
    (recruit) => recruit.isRequired,
  );
  const min =
    requiredRecruits.length > 0
      ? requiredRecruits.reduce(
          (sum, recruit) => sum + (recruit.rewardJpy ?? 0),
          0,
        )
      : Math.min(...rewards);
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
