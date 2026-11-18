import type { CampaignManager } from "@jsure/shared";

/** 담당자 초기값 계산에 필요한 최소 모양 — CampaignResponse 전체를 요구하지 않는다. */
type ManagerSource = { managers: CampaignManager[] } | null;

/**
 * 캠페인 폼 진입 경로별 담당자 초기값.
 * 신규·복사는 로그인한 본인으로 시작하고(복사는 원본 담당자를 승계하지 않는다 —
 * 담당자는 R&R 이지 캠페인 내용이 아니다), 수정만 저장된 담당자를 복원한다.
 */
export function initialManagerIds(
  mode: "new" | "copy" | "edit",
  campaign: ManagerSource,
  currentAdminUserId: string | null,
): string[] {
  switch (mode) {
    case "new":
    case "copy":
      return currentAdminUserId ? [currentAdminUserId] : [];
    case "edit":
      return campaign ? campaign.managers.map((manager) => manager.id) : [];
  }
}
