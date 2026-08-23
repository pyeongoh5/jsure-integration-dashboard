import {
  AdminApplicantPageResponseSchema,
  AdminApplicationCountsResponseSchema,
  AdminApplicationListResponseSchema,
  AdminApplicationSchema,
  applicantFilterToParams,
  type AdminApplicantPageResponse,
  type AdminApplication,
  type ApplicantFilter,
  type ApplicationStatus,
} from "@jsure/shared";
import { api } from "@/lib/api";

/** 응모자 관리 한 페이지. 필터는 전부 서버에서 적용된다. */
export async function listApplicantsPage(
  filter: ApplicantFilter,
  cursor: string | null,
  limit: number,
): Promise<AdminApplicantPageResponse> {
  const search = new URLSearchParams(applicantFilterToParams(filter));
  if (cursor) search.set("cursor", cursor);
  search.set("limit", String(limit));
  const res = await api.get(`/campaign-applications/applicants?${search}`);
  return AdminApplicantPageResponseSchema.parse(res.data);
}

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

export async function getApplicationCounts(
  campaignId?: string,
): Promise<Record<ApplicationStatus, number>> {
  const search = new URLSearchParams();
  if (campaignId) search.set("campaignId", campaignId);
  const query = search.toString();
  const res = await api.get(
    `/campaign-applications/counts${query ? `?${query}` : ""}`,
  );
  const parsed = AdminApplicationCountsResponseSchema.parse(res.data);
  return {
    APPLIED: parsed.counts.APPLIED ?? 0,
    APPROVED: parsed.counts.APPROVED ?? 0,
    SHIPPED: parsed.counts.SHIPPED ?? 0,
    DELIVERED: parsed.counts.DELIVERED ?? 0,
    COMPLETED: parsed.counts.COMPLETED ?? 0,
    REJECTED: parsed.counts.REJECTED ?? 0,
    CANCELLED: parsed.counts.CANCELLED ?? 0,
    ORDER_SUBMITTED: parsed.counts.ORDER_SUBMITTED ?? 0,
    REVIEW_SUBMITTED: parsed.counts.REVIEW_SUBMITTED ?? 0,
  };
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

export async function shipApplication(
  id: string,
  trackingCarrier: string,
  trackingNumber: string,
): Promise<AdminApplication> {
  const res = await api.post(
    `/campaign-applications/${encodeURIComponent(id)}/ship`,
    { trackingCarrier, trackingNumber },
  );
  return AdminApplicationSchema.parse(res.data);
}

export async function deliverApplication(
  id: string,
): Promise<AdminApplication> {
  const res = await api.post(
    `/campaign-applications/${encodeURIComponent(id)}/deliver`,
  );
  return AdminApplicationSchema.parse(res.data);
}
