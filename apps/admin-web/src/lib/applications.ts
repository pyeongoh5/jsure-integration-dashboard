import {
  AdminApplicationListResponseSchema,
  type AdminApplication,
  type ApplicationStatus,
} from "@jsure/shared";
import { api } from "./api";

export type ListApplicationsParams = {
  campaignId?: string;
  statuses?: ApplicationStatus[];
};

export async function listApplications(
  params: ListApplicationsParams = {},
): Promise<AdminApplication[]> {
  const search = new URLSearchParams();
  if (params.campaignId) search.set("campaignId", params.campaignId);
  if (params.statuses && params.statuses.length > 0) {
    search.set("status", params.statuses.join(","));
  }
  const query = search.toString();
  const res = await api.get(`/campaign-applications${query ? `?${query}` : ""}`);
  return AdminApplicationListResponseSchema.parse(res.data).applications;
}
