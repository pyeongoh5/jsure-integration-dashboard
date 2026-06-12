import type { InfluencerCampaignDetail } from "@jsure/shared";

export function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * 캠페인이 모집 종료 상태인지 판정.
 * 서버에서 isEnded 를 내려주지만 모집인원 충족이나 만료일 도래 시도 종료로 본다.
 */
export function isCampaignClosed(
  card: Pick<InfluencerCampaignDetail, "isEnded" | "recruitEndAt" | "appliedCount" | "recruitCount">,
  now: Date = new Date(),
): boolean {
  return (
    card.isEnded ||
    new Date(card.recruitEndAt) < now ||
    card.appliedCount >= card.recruitCount
  );
}
