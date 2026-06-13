import {
  CampaignReportResponseSchema,
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
