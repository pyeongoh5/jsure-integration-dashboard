import { z } from "zod";
import { CampaignSubTypeSchema, EnabledSnsTypeSchema } from "./influencer.js";
import { CampaignCategorySchema, InstagramPostTypeSchema } from "./campaign.js";

export const ApplicationStatusSchema = z.enum([
  "APPLIED",
  "REJECTED",
  "APPROVED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "ORDER_SUBMITTED",
  "REVIEW_SUBMITTED",
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
  "AWAITING_ORDER",
  "AWAITING_REVIEW",
  "REVIEW_PENDING",
  "REVIEW_REJECTED",
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
  subType: CampaignSubTypeSchema,
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

export const AttachmentUploadInputSchema = z.object({
  objectKey: z.string().min(1),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sizeBytes: z.number().int().positive(),
});
export type AttachmentUploadInput = z.infer<typeof AttachmentUploadInputSchema>;

export const SubmitOrderRequestSchema = z.object({
  orderNumber: z.string().min(1, "注文番号を入力してください").max(200),
  receipts: z
    .array(AttachmentUploadInputSchema)
    .min(1, "注文明細のスクリーンショットを1枚以上ご提出ください")
    .max(10),
});
export type SubmitOrderRequest = z.infer<typeof SubmitOrderRequestSchema>;

export const SubmitReviewRequestSchema = z.object({
  reviewUrl: z.string().url("有効なURLを入力してください"),
  screenshots: z
    .array(AttachmentUploadInputSchema)
    .min(2, "レビューのスクリーンショットを2枚以上ご提出ください")
    .max(10),
});
export type SubmitReviewRequest = z.infer<typeof SubmitReviewRequestSchema>;

export const CreateApplicationRequestSchema = z
  .object({
    campaignId: z.string().min(1),
    subTypes: z
      .array(EnabledSnsTypeSchema)
      .min(1, "1つ以上のSNSを選択してください")
      .refine(
        (arr) => new Set(arr).size === arr.length,
        "SNSが重複しています",
      ),
    /** INSTAGRAM 응모 시 1개만 선택. 다른 SNS만 응모하는 경우 undefined. */
    instagramPostType: InstagramPostTypeSchema.optional(),
  })
  .superRefine((dto, ctx) => {
    if (dto.subTypes.includes("INSTAGRAM") && !dto.instagramPostType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["instagramPostType"],
        message: "投稿タイプ（フィード/リール）を選択してください",
      });
    }
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
  campaignCategory: CampaignCategorySchema,
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
  subType: CampaignSubTypeSchema,
  /** INSTAGRAM 응모인 경우 FEED/REELS, 그 외는 null. */
  instagramPostType: InstagramPostTypeSchema.nullable(),
  posts: z.array(SubmittedPostSchema),
  postingPeriodDays: z.number().int().min(1),
  postingDeadlineAt: z.string().datetime().nullable(),
  settlement: InfluencerApplicationSettlementSchema.nullable(),
  /** 가구매 캠페인용: 주문 번호(인플루언서가 제출). SNS 캠페인은 null. */
  orderNumber: z.string().nullable(),
  /** 가구매 캠페인용: 주문 정보 제출 시각. */
  orderSubmittedAt: z.string().datetime().nullable(),
  /** 가구매 캠페인용: 리뷰 제출 시각. */
  reviewSubmittedAt: z.string().datetime().nullable(),
});
export type InfluencerApplication = z.infer<typeof InfluencerApplicationSchema>;

export const InfluencerApplicationListResponseSchema = z.object({
  applications: z.array(InfluencerApplicationSchema),
});
export type InfluencerApplicationListResponse = z.infer<
  typeof InfluencerApplicationListResponseSchema
>;
