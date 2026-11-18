import {
  AdminCampaignBoardResponseSchema,
  AdminOverviewResponseSchema,
  DailyActionAlertTargetsResponseSchema,
  DailyActionAlertsResponseSchema,
  SendDailyActionRemindersResponseSchema,
  type AdminCampaignBoardResponse,
  type AdminOverviewResponse,
  type DailyActionAlertKind,
  type DailyActionAlertTargetsResponse,
  type DailyActionAlertsResponse,
  type SendDailyActionRemindersResponse,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function getOverviewStats(): Promise<AdminOverviewResponse> {
  const res = await api.get("/admin/overview");
  return AdminOverviewResponseSchema.parse(res.data);
}

export async function getCampaignBoard(): Promise<AdminCampaignBoardResponse> {
  const res = await api.get("/admin/overview/campaign-board");
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
