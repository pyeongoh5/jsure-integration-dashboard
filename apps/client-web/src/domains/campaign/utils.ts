import type {
  CampaignSubType,
  InfluencerCampaignCard,
} from "@jsure/shared";

export function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

type RewardRangeRecruit = InfluencerCampaignCard["recruits"][number];

/** recruit 가 옵션별 보수 분리를 사용하는지 (모든 옵션 행에 rewardJpy 존재). */
function usesOptionRewardSplit(recruit: RewardRangeRecruit): boolean {
  return (
    recruit.options.length > 0 &&
    recruit.options.every((option) => option.rewardJpy !== null)
  );
}

/**
 * 서브타입 1개의 보수 기여 구간.
 * 옵션별 보수 분리 recruit(모든 옵션에 rewardJpy 존재)은 응모가 옵션 1개를 고르므로
 * [옵션 최소, 옵션 최대], 아니면 고정 recruit.rewardJpy.
 */
function recruitRewardBounds(recruit: RewardRangeRecruit): {
  min: number;
  max: number;
} {
  if (usesOptionRewardSplit(recruit)) {
    const optionRewards = recruit.options.map((option) => option.rewardJpy ?? 0);
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

/**
 * 응모가 선택한 서브타입/옵션 기준 실지급 보수(JPY).
 * 서버 정산 계산(applicationRewardJpy)과 동일 규칙.
 * 아직 확정할 수 없으면(서브타입 미선택, 옵션별 보수 분리인데 옵션 미선택) null.
 */
export function selectedRewardJpy(
  campaign: Pick<
    InfluencerCampaignCard,
    "rewardType" | "rewardJpy" | "recruits"
  >,
  selectedSubTypes: readonly CampaignSubType[],
  selectedOptions: readonly { subType: CampaignSubType; option: string }[],
): number | null {
  if (selectedSubTypes.length === 0) return null;
  if (campaign.rewardType !== "PER_SUBTYPE") return campaign.rewardJpy;
  let total = 0;
  for (const recruit of campaign.recruits) {
    if (!selectedSubTypes.includes(recruit.subType)) continue;
    if (!usesOptionRewardSplit(recruit)) {
      total += recruit.rewardJpy ?? 0;
      continue;
    }
    const chosen = selectedOptions.find(
      (entry) => entry.subType === recruit.subType,
    )?.option;
    const matched = recruit.options.find((option) => option.option === chosen);
    if (matched?.rewardJpy == null) return null;
    total += matched.rewardJpy;
  }
  return total;
}

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export type CampaignRecruitClosure =
  | { closed: false; reason: null }
  | { closed: true; reason: "ended" | "full" };

/**
 * 캠페인 응모 마감 여부와 사유. (상세 열람은 항상 가능하고, 이 판정은 응모 가능 여부·라벨에만 쓴다.)
 * - ended: 수동 종료(isEnded) 또는 모집 마감일 경과
 * - full: 총정원(approvedCount) 충족 — recruitCount 0(무제한/미설정)이면 full 아님
 * 우선순위 ended > full.
 */
export function campaignRecruitClosure(
  card: Pick<
    InfluencerCampaignCard,
    "isEnded" | "recruitEndAt" | "approvedCount" | "recruitCount"
  >,
  now: Date = new Date(),
): CampaignRecruitClosure {
  if (card.isEnded || new Date(card.recruitEndAt) < now) {
    return { closed: true, reason: "ended" };
  }
  if (card.recruitCount > 0 && card.approvedCount >= card.recruitCount) {
    return { closed: true, reason: "full" };
  }
  return { closed: false, reason: null };
}
