import { z } from "zod";
import { SnsTypeSchema } from "./influencer.js";
import { InstagramPostTypeSchema } from "./campaign.js";

export const CampaignReportParticipantSchema = z.object({
  influencerId: z.string(),
  influencerName: z.string(),
  handle: z.string(),
  snsType: SnsTypeSchema,
  instagramPostType: InstagramPostTypeSchema.nullable(),
  insight: z.object({
    likes: z.number().int().nullable(),
    comments: z.number().int().nullable(),
    shares: z.number().int().nullable(),
    reposts: z.number().int().nullable(),
    saves: z.number().int().nullable(),
    views: z.number().int().nullable(),
    reach: z.number().int().nullable(),
  }),
});
export type CampaignReportParticipant = z.infer<
  typeof CampaignReportParticipantSchema
>;

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
  participantCount: z.number().int(),
});

export const CampaignParticipantsResponseSchema = z.object({
  total: z.number().int(),
  participants: z.array(CampaignReportParticipantSchema),
});
export type CampaignParticipantsResponse = z.infer<
  typeof CampaignParticipantsResponseSchema
>;
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
