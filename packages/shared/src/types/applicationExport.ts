import { z } from "zod";
import { SnsTypeSchema } from "./influencer.js";

export const ApprovedApplicantExportRowSchema = z.object({
  applicationId: z.string(),
  influencerId: z.string(),
  name: z.string(),
  nameKana: z.string().nullable(),
  snsType: SnsTypeSchema,
  snsHandle: z.string(),
  profileUrl: z.string(),
  phone: z.string(),
  postalCode: z.string(),
  address: z.string(),
});
export type ApprovedApplicantExportRow = z.infer<
  typeof ApprovedApplicantExportRowSchema
>;

export const ApprovedApplicantExportResponseSchema = z.object({
  campaignTitle: z.string(),
  rows: z.array(ApprovedApplicantExportRowSchema),
});
export type ApprovedApplicantExportResponse = z.infer<
  typeof ApprovedApplicantExportResponseSchema
>;
