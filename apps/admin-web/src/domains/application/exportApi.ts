import {
  ApplicantExportResponseSchema,
  ApprovedApplicantExportResponseSchema,
  applicantFilterToParams,
  type ApplicantExportResponse,
  type ApplicantFilter,
  type ApprovedApplicantExportResponse,
} from "@jsure/shared";
import { api } from "@/lib/api";

/** 응모자 관리 CSV — 현재 페이지가 아니라 필터에 걸린 응모 전체를 받아온다. */
export async function exportApplicants(
  filter: ApplicantFilter,
): Promise<ApplicantExportResponse> {
  const search = new URLSearchParams(applicantFilterToParams(filter));
  const res = await api.get(
    `/campaign-applications/applicants/export?${search}`,
  );
  return ApplicantExportResponseSchema.parse(res.data);
}

export async function exportApprovedApplicants(
  campaignId: string,
): Promise<ApprovedApplicantExportResponse> {
  const res = await api.get("/campaign-applications/export/approved", {
    params: { campaignId },
  });
  return ApprovedApplicantExportResponseSchema.parse(res.data);
}
