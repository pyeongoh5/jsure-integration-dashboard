import { z } from "zod";
import { CampaignSubTypeSchema } from "./influencer.js";

export const ApprovedApplicantExportRowSchema = z.object({
  applicationId: z.string(),
  influencerId: z.string(),
  name: z.string(),
  nameKana: z.string().nullable(),
  /** 참여 서브타입별 SNS 정보. */
  channels: z.array(
    z.object({
      subType: CampaignSubTypeSchema,
      snsHandle: z.string(),
      profileUrl: z.string(),
    }),
  ),
  phone: z.string(),
  postalCode: z.string(),
  address: z.string(),
  appliedAt: z.string(),
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
