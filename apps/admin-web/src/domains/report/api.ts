import {
  CampaignParticipantsResponseSchema,
  CampaignReportResponseSchema,
  type CampaignParticipantsResponse,
  type CampaignReportResponse,
  type CampaignReportSortKey,
  type CampaignReportSortOrder,
} from "@jsure/shared";
import { api } from "@/lib/api";

/** 기간(JST YYYY-MM-DD)은 필수 — 서버가 모집기간이 겹치는 캠페인만 집계한다. */
export async function getCampaignReports(
  sort: CampaignReportSortKey,
  order: CampaignReportSortOrder,
  period: { from: string; to: string },
): Promise<CampaignReportResponse> {
  const search = new URLSearchParams();
  search.set("sort", sort);
  search.set("order", order);
  search.set("from", period.from);
  search.set("to", period.to);
  const res = await api.get(`/admin/reports/campaigns?${search.toString()}`);
  return CampaignReportResponseSchema.parse(res.data);
}

export async function getCampaignParticipants(
  campaignId: string,
  page: number,
  pageSize: number,
): Promise<CampaignParticipantsResponse> {
  const search = new URLSearchParams();
  search.set("page", String(page));
  search.set("pageSize", String(pageSize));
  const res = await api.get(
    `/admin/reports/campaigns/${encodeURIComponent(campaignId)}/participants?${search.toString()}`,
  );
  return CampaignParticipantsResponseSchema.parse(res.data);
}
