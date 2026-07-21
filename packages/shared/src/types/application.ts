import { z } from "zod";
import { CampaignSubTypeSchema } from "./influencer.js";
import {
  CampaignCategorySchema,
  OPTION_SELECTABLE_SUB_TYPES,
} from "./campaign.js";

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
  url: z.string().url().nullable(),
  submissionData: z.record(z.unknown()).nullable().default(null),
  submittedAt: z.string().datetime(),
  insightLikes: z.number().int().nullable(),
  insightComments: z.number().int().nullable(),
  insightShares: z.number().int().nullable(),
  insightReposts: z.number().int().nullable(),
  insightSaves: z.number().int().nullable(),
  insightViews: z.number().int().nullable(),
  insightReach: z.number().int().nullable(),
  insightSubmittedAt: z.string().datetime().nullable(),
});
export type SubmittedPost = z.infer<typeof SubmittedPostSchema>;

export const AttachmentUploadInputSchema = z.object({
  objectKey: z.string().min(1),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sizeBytes: z.number().int().positive(),
});
export type AttachmentUploadInput = z.infer<typeof AttachmentUploadInputSchema>;

/** SNS 게시물 URL 일괄 제출 — 참여한 모든 SNS 서브타입의 URL 을 한 번에 제출한다. */
export const SubmitSubmissionRequestSchema = z.object({
  posts: z
    .array(
      z.object({
        subType: CampaignSubTypeSchema,
        url: z.string().url(),
      }),
    )
    .min(1, "投稿URLを入力してください")
    .refine(
      (arr) => new Set(arr.map((p) => p.subType)).size === arr.length,
      "投稿先が重複しています",
    ),
});
export type SubmitSubmissionRequest = z.infer<
  typeof SubmitSubmissionRequestSchema
>;

/** SNS 인사이트 일괄 제출 — 참여한 모든 SNS 서브타입의 지표를 한 번에 제출한다. */
export const SubmitInsightsRequestSchema = z.object({
  insights: z
    .array(
      z.object({
        subType: CampaignSubTypeSchema,
        likes: z.number().int().nonnegative(),
        comments: z.number().int().nonnegative(),
        shares: z.number().int().nonnegative(),
        reposts: z.number().int().nonnegative(),
        saves: z.number().int().nonnegative(),
        views: z.number().int().nonnegative(),
        reach: z.number().int().nonnegative(),
        attachments: z.array(AttachmentUploadInputSchema).max(10).optional(),
      }),
    )
    .min(1)
    .refine(
      (arr) => new Set(arr.map((i) => i.subType)).size === arr.length,
      "投稿先が重複しています",
    ),
});
export type SubmitInsightsRequest = z.infer<typeof SubmitInsightsRequestSchema>;

export const SubmitOrderRequestSchema = z.object({
  orderNumber: z.string().min(1, "注文番号を入力してください").max(200),
  receipts: z
    .array(AttachmentUploadInputSchema)
    .min(1, "注文明細のスクリーンショットを1枚以上ご提出ください")
    .max(10),
});
export type SubmitOrderRequest = z.infer<typeof SubmitOrderRequestSchema>;

export const SubmitReviewRequestSchema = z.object({
  screenshots: z
    .array(AttachmentUploadInputSchema)
    .min(2, "レビューのスクリーンショットを2枚以上ご提出ください")
    .max(10),
  reviewUrls: z
    .record(
      z.enum(["LIPS", "ATCOSME"]),
      z.string().url().startsWith("https://"),
    )
    .default({}),
});
export type SubmitReviewRequest = z.infer<typeof SubmitReviewRequestSchema>;

export const SubmitSimpleReviewRequestSchema = z.object({
  /** 참여한 모든 단순 리뷰 서브타입(LIPS/ATCOSME)의 리뷰 URL 을 한 번에 제출한다. */
  reviews: z
    .array(
      z.object({
        subType: CampaignSubTypeSchema,
        url: z.string().url().startsWith("https://"),
      }),
    )
    .min(1, "レビューURLを入力してください")
    .refine(
      (arr) => new Set(arr.map((r) => r.subType)).size === arr.length,
      "レビュー先が重複しています",
    ),
  screenshots: z
    .array(AttachmentUploadInputSchema)
    .min(1, "レビューのスクリーンショットを1枚以上ご提出ください")
    .max(10),
});
export type SubmitSimpleReviewRequest = z.infer<
  typeof SubmitSimpleReviewRequestSchema
>;

/** 응모가 선택한 서브타입 옵션 (구 instagramPostType 의 일반화). */
export const ApplicationOptionSchema = z.object({
  subType: CampaignSubTypeSchema,
  option: z.string().min(1),
});
export type ApplicationOption = z.infer<typeof ApplicationOptionSchema>;

export const CreateApplicationRequestSchema = z
  .object({
    campaignId: z.string().min(1),
    subTypes: z
      .array(CampaignSubTypeSchema)
      .min(1, "1つ以上の応募先を選択してください")
      .refine(
        (arr) => new Set(arr).size === arr.length,
        "応募先が重複しています",
      ),
    /** 옵션 선택형 서브타입(INSTAGRAM)의 선택 옵션. 서브타입당 1개. */
    options: z.array(ApplicationOptionSchema).default([]),
  })
  .superRefine((dto, ctx) => {
    const optionSubTypes = dto.options.map((entry) => entry.subType);
    if (new Set(optionSubTypes).size !== optionSubTypes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "応募先ごとに選択できるオプションは1つです",
      });
    }
    for (const entry of dto.options) {
      if (!dto.subTypes.includes(entry.subType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "応募していない応募先のオプションが含まれています",
        });
        break;
      }
    }
    for (const subType of OPTION_SELECTABLE_SUB_TYPES) {
      if (
        dto.subTypes.includes(subType) &&
        !dto.options.some((entry) => entry.subType === subType)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "投稿タイプ（フィード/リール）を選択してください",
        });
      }
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
  /** 이 응모가 참여하는 서브타입 목록. */
  subTypes: z.array(CampaignSubTypeSchema),
  /** 응모가 선택한 서브타입 옵션 (INSTAGRAM 이면 FEED/REELS 1개). */
  selectedOptions: z.array(ApplicationOptionSchema),
  /** 제출물(전체) 검토 상태 — 응모 단위 전체 승인/반려. */
  submissionReviewStatus: PostReviewStatusSchema,
  /** 제출물 반려 시 최신 반려 코멘트. */
  lastRejectionComment: z.string().nullable(),
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
