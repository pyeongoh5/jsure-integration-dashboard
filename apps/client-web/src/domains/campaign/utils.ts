import {
  usesOptionRewardSplit,
  type CampaignSubType,
  type InfluencerCampaignCard,
} from "@jsure/shared";

// 보수 범위 계산은 어드민과 공유한다 — @jsure/shared 의 rewardRangeJpy/formatRewardRange.
export { rewardRangeJpy, formatRewardRange } from "@jsure/shared";

export function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
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
