import {
  ApprovedApplicantExportResponseSchema,
  type ApprovedApplicantExportResponse,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function exportApprovedApplicants(
  campaignId: string,
): Promise<ApprovedApplicantExportResponse> {
  const res = await api.get("/campaign-applications/export/approved", {
    params: { campaignId },
  });
  return ApprovedApplicantExportResponseSchema.parse(res.data);
}
