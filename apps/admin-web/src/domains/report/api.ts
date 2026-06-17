import {
  CampaignParticipantsResponseSchema,
  CampaignReportResponseSchema,
  type CampaignParticipantsResponse,
  type CampaignReportResponse,
  type CampaignReportSortKey,
  type CampaignReportSortOrder,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function getCampaignReports(
  sort: CampaignReportSortKey,
  order: CampaignReportSortOrder,
): Promise<CampaignReportResponse> {
  const search = new URLSearchParams();
  search.set("sort", sort);
  search.set("order", order);
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
