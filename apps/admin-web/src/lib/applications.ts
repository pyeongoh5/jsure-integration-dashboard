import {
  AdminApplicationListResponseSchema,
  AdminApplicationSchema,
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

export async function approveApplication(id: string): Promise<AdminApplication> {
  const res = await api.post(`/campaign-applications/${encodeURIComponent(id)}/approve`);
  return AdminApplicationSchema.parse(res.data);
}

export async function rejectApplication(
  id: string,
  reason: string,
): Promise<AdminApplication> {
  const res = await api.post(
    `/campaign-applications/${encodeURIComponent(id)}/reject`,
    { reason },
  );
  return AdminApplicationSchema.parse(res.data);
}

export async function undoApplication(id: string): Promise<AdminApplication> {
  const res = await api.post(`/campaign-applications/${encodeURIComponent(id)}/undo`);
  return AdminApplicationSchema.parse(res.data);
}
