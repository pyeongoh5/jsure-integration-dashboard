import { z } from "zod";
import {
  SnsTypeSchema,
  EnabledSnsTypeSchema,
  type SnsType,
} from "./influencer.js";

export { SnsTypeSchema };
export type { SnsType };

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

export const InstagramPostTypeSchema = z.enum(["FEED", "REELS"]);
export type InstagramPostType = z.infer<typeof InstagramPostTypeSchema>;

/**
 * INSTAGRAM 모집은 어떤 포스트 타입(FEED/REELS)을 받을지 1개 이상 지정해야 한다.
 * 비 INSTAGRAM 모집은 빈 배열로 응답·저장한다.
 */
export const SnsRecruitSchema = z.object({
  snsType: SnsTypeSchema,
  minFollowers: z.number().int().nonnegative("0 이상의 정수"),
  recruitCount: z.number().int().positive("1 이상"),
  instagramPostTypes: z.array(InstagramPostTypeSchema).default([]),
  /** false 면 인플루언서가 인사이트를 제출하지 않아도 정산이 진행될 수 있다. */
  insightRequired: z.boolean().default(true),
});
export type SnsRecruit = z.infer<typeof SnsRecruitSchema>;

const SnsRecruitInputSchema = z
  .object({
    snsType: EnabledSnsTypeSchema,
    minFollowers: z.number().int().nonnegative("0 이상의 정수"),
    recruitCount: z.number().int().positive("1 이상"),
    instagramPostTypes: z.array(InstagramPostTypeSchema).default([]),
    insightRequired: z.boolean().default(true),
  })
  .superRefine((recruit, ctx) => {
    if (recruit.snsType === "INSTAGRAM") {
      const unique = new Set(recruit.instagramPostTypes);
      if (unique.size === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["instagramPostTypes"],
          message: "FEED 또는 REELS 중 1개 이상을 선택하세요",
        });
      }
      if (unique.size !== recruit.instagramPostTypes.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["instagramPostTypes"],
          message: "포스트 타입이 중복되었습니다",
        });
      }
    }
  });

const SnsRecruitInputArray = z
  .array(SnsRecruitInputSchema)
  .min(1, "1개 이상의 SNS를 모집해야 합니다")
  .refine(
    (arr) => new Set(arr.map((r) => r.snsType)).size === arr.length,
    "SNS가 중복되었습니다",
  );

export const CampaignFormSchema = z
  .object({
    title: z.string().min(1, "필수 입력").max(100),
    rewardJpy: z.number().int("정수만 입력").nonnegative(),
    recruitStartDate: DateOnly,
    recruitEndDate: DateOnly,
    postingPeriodDays: z
      .number()
      .int("정수만 입력")
      .min(1, "1 이상의 일수여야 합니다")
      .max(365),
    snsRecruits: SnsRecruitInputArray,
    // HTML 본문 (tiptap) 을 저장하므로 길이 제한을 크게 둠.
    productSummary: z.string().max(50000),
    productDetailUrl: z.string().url("URL 형식이어야 합니다"),
    guideline: z.string().max(50000),
    referenceMediaUrls: z.array(z.string().url()).max(10),
    cautions: z.string().max(50000),
    thumbnailUrl: z.string().min(1).nullable().optional(),
    /** 이 캠페인 응모를 막을 기존 캠페인 id 목록. */
    excludedCampaignIds: z.array(z.string()).max(50).optional().default([]),
  })
  .refine((d) => d.recruitStartDate <= d.recruitEndDate, {
    path: ["recruitEndDate"],
    message: "종료일은 시작일 이후여야 합니다",
  });
export type CampaignForm = z.infer<typeof CampaignFormSchema>;

export const CreateCampaignRequestSchema = CampaignFormSchema;
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

export const UpdateCampaignRequestSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    rewardJpy: z.number().int().nonnegative().optional(),
    recruitStartDate: DateOnly.optional(),
    recruitEndDate: DateOnly.optional(),
    postingPeriodDays: z.number().int().min(1).max(365).optional(),
    snsRecruits: SnsRecruitInputArray.optional(),
    productSummary: z.string().max(50000).optional(),
    productDetailUrl: z.string().url().optional(),
    guideline: z.string().max(50000).optional(),
    referenceMediaUrls: z.array(z.string().url()).max(10).optional(),
    cautions: z.string().max(50000).optional(),
    thumbnailUrl: z.string().min(1).nullable().optional(),
    excludedCampaignIds: z.array(z.string()).max(50).optional(),
  })
  .refine(
    (d) =>
      d.recruitStartDate === undefined ||
      d.recruitEndDate === undefined ||
      d.recruitStartDate <= d.recruitEndDate,
    { path: ["recruitEndDate"], message: "종료일은 시작일 이후여야 합니다" },
  );
export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequestSchema>;

export const CampaignResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  rewardJpy: z.number().int().nonnegative(),
  snsRecruits: z.array(SnsRecruitSchema),
  recruitStartDate: DateOnly,
  recruitEndDate: DateOnly,
  recruitStartAt: z.string().datetime(),
  recruitEndAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  postingPeriodDays: z.number().int().min(1),
  productSummary: z.string(),
  productDetailUrl: z.string().url(),
  guideline: z.string(),
  referenceMediaUrls: z.array(z.string().url()),
  cautions: z.string(),
  thumbnailUrl: z.string().url().nullable(),
  approvedCount: z.number().int().nonnegative(),
  appliedCount: z.number().int().nonnegative(),
  excludedCampaignIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;

export const CampaignListResponseSchema = z.object({
  campaigns: z.array(CampaignResponseSchema),
});
export type CampaignListResponse = z.infer<typeof CampaignListResponseSchema>;

export const InfluencerCampaignCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  productSummary: z.string(),
  thumbnailUrl: z.string().url().nullable(),
  rewardJpy: z.number().int().nonnegative(),
  snsRecruits: z.array(SnsRecruitSchema),
  recruitCount: z.number().int().nonnegative(),
  appliedCount: z.number().int().nonnegative(),
  recruitStartAt: z.string().datetime(),
  recruitEndAt: z.string().datetime(),
  postingPeriodDays: z.number().int().min(1),
  isNew: z.boolean(),
  isEnded: z.boolean(),
});
export type InfluencerCampaignCard = z.infer<
  typeof InfluencerCampaignCardSchema
>;

export const InfluencerCampaignDetailSchema =
  InfluencerCampaignCardSchema.extend({
    productDetailUrl: z.string().url(),
    guideline: z.string(),
    referenceMediaUrls: z.array(z.string().url()),
    cautions: z.string(),
    /** 인플루언서가 이 캠페인에 이미 신청한(취소 포함) SNS 목록 — 신규 응모 차단용 */
    appliedSnsTypes: z.array(SnsTypeSchema),
    /** 이 캠페인에서 인플루언서가 직접 취소한 SNS 목록 — 재응모 불가 안내용 */
    cancelledSnsTypes: z.array(SnsTypeSchema),
    /** 과거 응모 이력(제외 캠페인) 때문에 이 캠페인에서 응모할 수 없는 SNS 목록 */
    excludedSnsTypes: z.array(SnsTypeSchema),
  });
export type InfluencerCampaignDetail = z.infer<
  typeof InfluencerCampaignDetailSchema
>;

export const InfluencerCampaignListResponseSchema = z.object({
  campaigns: z.array(InfluencerCampaignCardSchema),
});
export type InfluencerCampaignListResponse = z.infer<
  typeof InfluencerCampaignListResponseSchema
>;
