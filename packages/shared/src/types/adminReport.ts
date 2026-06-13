import { z } from "zod";

export const CampaignReportRowSchema = z.object({
  campaignId: z.string(),
  campaignTitle: z.string(),
  influencerCount: z.number().int(),
  totalFollowers: z.number().int(),
  postCount: z.number().int(),
  totalRewardJpy: z.number().int(),
  totalLikes: z.number().int(),
  totalComments: z.number().int(),
  totalShares: z.number().int(),
  totalReposts: z.number().int(),
  totalSaves: z.number().int(),
  totalViews: z.number().int(),
  totalReach: z.number().int(),
  totalEngagement: z.number().int(),
  erByViews: z.number().nullable(),
  erByFollowers: z.number().nullable(),
});
export type CampaignReportRow = z.infer<typeof CampaignReportRowSchema>;

export const CampaignReportSortKeySchema = z.enum([
  "campaignTitle",
  "influencerCount",
  "totalFollowers",
  "postCount",
  "totalRewardJpy",
  "totalLikes",
  "totalComments",
  "totalShares",
  "totalReposts",
  "totalSaves",
  "totalViews",
  "totalReach",
  "totalEngagement",
  "erByViews",
  "erByFollowers",
]);
export type CampaignReportSortKey = z.infer<typeof CampaignReportSortKeySchema>;

export const CampaignReportSortOrderSchema = z.enum(["asc", "desc"]);
export type CampaignReportSortOrder = z.infer<
  typeof CampaignReportSortOrderSchema
>;

export const CampaignReportResponseSchema = z.object({
  rows: z.array(CampaignReportRowSchema),
});
export type CampaignReportResponse = z.infer<
  typeof CampaignReportResponseSchema
>;
