import { z } from "zod";
import { SnsTypeSchema } from "./influencer.js";

export const ApplicationStatusSchema = z.enum([
  "APPLIED",
  "REJECTED",
  "APPROVED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const ApplicationDisplayStageSchema = z.enum([
  "APPLIED",
  "APPROVED",
  "SHIPPED",
  "POSTING",
  "POSTED",
  "INSIGHT_DUE",
  "REVIEWING",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);
export type ApplicationDisplayStage = z.infer<
  typeof ApplicationDisplayStageSchema
>;

export const SubmittedPostSchema = z.object({
  id: z.string(),
  snsType: SnsTypeSchema,
  url: z.string().url(),
  submittedAt: z.string().datetime(),
  insightSaves: z.number().int().nullable(),
  insightReach: z.number().int().nullable(),
  insightProfileViews: z.number().int().nullable(),
  insightSubmittedAt: z.string().datetime().nullable(),
});
export type SubmittedPost = z.infer<typeof SubmittedPostSchema>;

export const SubmitPostRequestSchema = z.object({
  url: z.string().url(),
});
export type SubmitPostRequest = z.infer<typeof SubmitPostRequestSchema>;

export const SubmitInsightRequestSchema = z.object({
  saves: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  profileViews: z.number().int().nonnegative(),
});
export type SubmitInsightRequest = z.infer<typeof SubmitInsightRequestSchema>;

export const CreateApplicationRequestSchema = z.object({
  campaignId: z.string().min(1),
});
export type CreateApplicationRequest = z.infer<
  typeof CreateApplicationRequestSchema
>;

export const InfluencerApplicationSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  campaignTitle: z.string(),
  campaignThumbnailUrl: z.string().url().nullable(),
  rewardJpy: z.number().int().nonnegative(),
  status: ApplicationStatusSchema,
  displayStage: ApplicationDisplayStageSchema,
  appliedAt: z.string().datetime(),
  trackingNumber: z.string().nullable(),
  shippedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  rejectReason: z.string().nullable(),
  posts: z.array(SubmittedPostSchema),
  postingDeadlineAt: z.string().datetime().nullable(),
});
export type InfluencerApplication = z.infer<typeof InfluencerApplicationSchema>;

export const InfluencerApplicationListResponseSchema = z.object({
  applications: z.array(InfluencerApplicationSchema),
});
export type InfluencerApplicationListResponse = z.infer<
  typeof InfluencerApplicationListResponseSchema
>;
