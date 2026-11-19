import {
  AdminCampaignBoardResponseSchema,
  DailyActionAlertTargetsResponseSchema,
  DailyActionAlertsResponseSchema,
  SendDailyActionRemindersResponseSchema,
  campaignBoardFilterToParams,
  type AdminCampaignBoardResponse,
  type CampaignBoardFilter,
  type DailyActionAlertKind,
  type DailyActionAlertTargetsResponse,
  type DailyActionAlertsResponse,
  type SendDailyActionRemindersResponse,
} from "@jsure/shared";
import { api } from "@/lib/api";

/** 통합 테이블 한 페이지. 필터·페이징은 전부 서버에서 적용된다. */
export async function getCampaignBoard(
  filter: CampaignBoardFilter,
): Promise<AdminCampaignBoardResponse> {
  const search = new URLSearchParams(campaignBoardFilterToParams(filter));
  const query = search.toString();
  const res = await api.get(
    `/admin/overview/campaign-board${query ? `?${query}` : ""}`,
  );
  return AdminCampaignBoardResponseSchema.parse(res.data);
}

export async function getDailyActionAlerts(): Promise<DailyActionAlertsResponse> {
  const res = await api.get("/admin/overview/daily-alerts");
  return DailyActionAlertsResponseSchema.parse(res.data);
}

export async function getDailyActionAlertTargets(
  kind: DailyActionAlertKind,
): Promise<DailyActionAlertTargetsResponse> {
  const res = await api.get(`/admin/overview/daily-alerts/${kind}/targets`);
  return DailyActionAlertTargetsResponseSchema.parse(res.data);
}

export async function sendDailyActionReminders(
  kind: DailyActionAlertKind,
  applicationIds: string[],
): Promise<SendDailyActionRemindersResponse> {
  const res = await api.post(`/admin/overview/daily-alerts/${kind}/reminders`, {
    applicationIds,
  });
  return SendDailyActionRemindersResponseSchema.parse(res.data);
}
