import type { CampaignCategory, CampaignListStatus } from "@jsure/shared";

/**
 * 캠페인 모집 인원(헤드카운트, 명 단위) 산정.
 * approvedCount(승인 인원)와 단위를 맞추기 위해 "서브타입 슬롯 합"이 아니라
 * "몇 명을 모집하는가"로 계산한다.
 *
 * - SIMPLE_REVIEW: 응모자가 전 서브타입에 동시 참여 → 공통 단일 정원(= max).
 * - 그 외(SNS/FAKE_PURCHASE): 필수 서브타입은 모든 응모자가 참여하므로 그 정원이
 *   곧 헤드카운트. 필수 정원은 동일해야 하지만(생성 검증), 미검증 데이터 대비
 *   실제 상한인 min 을 쓴다. 선택 서브타입 정원은 헤드카운트에 더하지 않는다
 *   (선택은 모집 완료 판정과 무관, 각자 옵션 상한으로만 통제).
 * - 필수 서브타입이 하나도 없으면(전부 선택) 단일 수치 폴백으로 max 를 쓴다.
 */
export function campaignHeadcount(
  category: CampaignCategory,
  recruits: { recruitCount: number; isRequired: boolean }[],
): number {
  if (recruits.length === 0) return 0;
  if (category === "SIMPLE_REVIEW") {
    return recruits.reduce((max, r) => Math.max(max, r.recruitCount), 0);
  }
  const required = recruits.filter((r) => r.isRequired);
  if (required.length > 0) {
    return required.reduce((min, r) => Math.min(min, r.recruitCount), Infinity);
  }
  return recruits.reduce((max, r) => Math.max(max, r.recruitCount), 0);
}

/**
 * 어드민 캠페인 목록의 파생 상태. 뱃지 표기와 정렬의 단일 소스(서버 계산).
 * 우선순위: 임시저장 > 비공개 > 마감·종료 > 정원 충족(모집 완료) > 모집중.
 */
export function deriveCampaignStatus(args: {
  publishState: string;
  category: CampaignCategory;
  closedAt: Date | null;
  hiddenAt: Date | null;
  recruitEndAt: Date;
  recruits: { recruitCount: number; isRequired: boolean }[];
  approvedCount: number;
  now: Date;
}): CampaignListStatus {
  if (args.publishState === "DRAFT") return "draft";
  if (args.hiddenAt !== null) return "hidden";
  if (args.closedAt !== null || args.now.getTime() > args.recruitEndAt.getTime()) {
    return "done";
  }
  const headcount = campaignHeadcount(args.category, args.recruits);
  if (headcount > 0 && args.approvedCount >= headcount) return "full";
  return "recruit";
}

/**
 * 비공개로 전환할 수 있는 상태 — 모집이 종결된 캠페인(모집 완료·모집 종료)만.
 * 모집중 캠페인은 먼저 종료해야 한다.
 */
export function canHideCampaignStatus(status: CampaignListStatus): boolean {
  return status === "full" || status === "done";
}

/** 목록 정렬 순위: 모집중 → 임시저장 → 모집 완료 → 모집 종료 → 비공개. */
export const CAMPAIGN_STATUS_ORDER: Record<CampaignListStatus, number> = {
  recruit: 0,
  draft: 1,
  full: 2,
  done: 3,
  hidden: 4,
};
