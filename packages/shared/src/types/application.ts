import { z } from "zod";
import { SnsTypeSchema, EnabledSnsTypeSchema } from "./influencer.js";

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
  "AWAITING_RECEIPT",
  "POSTING",
  "POSTED",
  "POST_REJECTED",
  "INSIGHT_DUE",
  "REVIEWING",
  "COMPLETED",
  "SETTLED",
  "REJECTED",
  "CANCELLED",
]);
export type ApplicationDisplayStage = z.infer<
  typeof ApplicationDisplayStageSchema
>;

export const PostReviewStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
export type PostReviewStatus = z.infer<typeof PostReviewStatusSchema>;

export const SubmittedPostSchema = z.object({
  id: z.string(),
  snsType: SnsTypeSchema,
  url: z.string().url(),
  submittedAt: z.string().datetime(),
  insightLikes: z.number().int().nullable(),
  insightComments: z.number().int().nullable(),
  insightShares: z.number().int().nullable(),
  insightReposts: z.number().int().nullable(),
  insightSaves: z.number().int().nullable(),
  insightViews: z.number().int().nullable(),
  insightReach: z.number().int().nullable(),
  insightSubmittedAt: z.string().datetime().nullable(),
  reviewStatus: PostReviewStatusSchema,
  reviewedAt: z.string().datetime().nullable(),
  lastRejectionComment: z.string().nullable(),
});
export type SubmittedPost = z.infer<typeof SubmittedPostSchema>;

export const SubmitPostRequestSchema = z.object({
  url: z.string().url(),
});
export type SubmitPostRequest = z.infer<typeof SubmitPostRequestSchema>;

export const SubmitInsightRequestSchema = z.object({
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
  reposts: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
  views: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  attachments: z
    .array(
      z.object({
        objectKey: z.string().min(1),
        contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .max(10)
    .optional(),
});
export type SubmitInsightRequest = z.infer<typeof SubmitInsightRequestSchema>;

export const CreateApplicationRequestSchema = z.object({
  campaignId: z.string().min(1),
  snsTypes: z
    .array(EnabledSnsTypeSchema)
    .min(1, "1つ以上のSNSを選択してください")
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "SNSが重複しています",
    ),
});
export type CreateApplicationRequest = z.infer<
  typeof CreateApplicationRequestSchema
>;

export const InfluencerApplicationSettlementSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED"]),
  amountJpy: z.number().int().nonnegative(),
  completedAt: z.string().datetime().nullable(),
});
export type InfluencerApplicationSettlement = z.infer<
  typeof InfluencerApplicationSettlementSchema
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
  trackingCarrier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  shippedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  rejectReason: z.string().nullable(),
  snsType: SnsTypeSchema,
  posts: z.array(SubmittedPostSchema),
  postingPeriodDays: z.number().int().min(1),
  postingDeadlineAt: z.string().datetime().nullable(),
  settlement: InfluencerApplicationSettlementSchema.nullable(),
});
export type InfluencerApplication = z.infer<typeof InfluencerApplicationSchema>;

export const InfluencerApplicationListResponseSchema = z.object({
  applications: z.array(InfluencerApplicationSchema),
});
export type InfluencerApplicationListResponse = z.infer<
  typeof InfluencerApplicationListResponseSchema
>;
