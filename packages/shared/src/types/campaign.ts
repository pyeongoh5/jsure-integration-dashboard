import { z } from "zod";
import {
  CampaignSubTypeSchema,
  EnabledSnsTypeSchema,
  type CampaignSubType,
} from "./influencer.js";

export { CampaignSubTypeSchema };
export type { CampaignSubType };

export const CampaignCategorySchema = z.enum(["SNS", "FAKE_PURCHASE"]);
export type CampaignCategory = z.infer<typeof CampaignCategorySchema>;

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

export const InstagramPostTypeSchema = z.enum(["FEED", "REELS"]);
export type InstagramPostType = z.infer<typeof InstagramPostTypeSchema>;

/**
 * INSTAGRAM 모집은 어떤 포스트 타입(FEED/REELS)을 받을지 1개 이상 지정해야 한다.
 * 비 INSTAGRAM 모집은 빈 배열로 응답·저장한다.
 * 가구매(QOO10/LIPS/ATCOSME) 모집은 `productPriceJpy`/`productUrl` 을 필수로 세팅한다.
 */
export const CampaignRecruitSchema = z.object({
  subType: CampaignSubTypeSchema,
  minFollowers: z.number().int().nonnegative("0 이상의 정수"),
  recruitCount: z.number().int().positive("1 이상"),
  instagramPostTypes: z.array(InstagramPostTypeSchema).default([]),
  /** false 면 인플루언서가 인사이트를 제출하지 않아도 정산이 진행될 수 있다. */
  insightRequired: z.boolean().default(true),
  /** 가구매 캠페인용: 상품 가격(JPY). SNS 캠페인은 null. */
  productPriceJpy: z.number().int().positive().nullable().default(null),
  /** 가구매 캠페인용: 상품 URL. SNS 캠페인은 null. */
  productUrl: z.string().url().nullable().default(null),
});
export type CampaignRecruit = z.infer<typeof CampaignRecruitSchema>;

const CampaignRecruitInputSchema = z
  .object({
    subType: EnabledSnsTypeSchema,
    minFollowers: z.number().int().nonnegative("0 이상의 정수"),
    recruitCount: z.number().int().positive("1 이상"),
    instagramPostTypes: z.array(InstagramPostTypeSchema).default([]),
    insightRequired: z.boolean().default(true),
    productPriceJpy: z.number().int().positive().nullable().default(null),
    productUrl: z.string().url().nullable().default(null),
  })
  .superRefine((recruit, ctx) => {
    if (recruit.subType === "INSTAGRAM") {
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

const CampaignRecruitInputArray = z
  .array(CampaignRecruitInputSchema)
  .min(1, "1개 이상의 모집을 지정해야 합니다")
  .refine(
    (arr) => new Set(arr.map((r) => r.subType)).size === arr.length,
    "서브타입이 중복되었습니다",
  );

export const CampaignFormSchema = z
  .object({
    category: CampaignCategorySchema.default("SNS"),
    title: z.string().min(1, "필수 입력").max(100),
    rewardJpy: z.number().int("정수만 입력").nonnegative(),
    recruitStartDate: DateOnly,
    recruitEndDate: DateOnly,
    postingPeriodDays: z
      .number()
      .int("정수만 입력")
      .min(1, "1 이상의 일수여야 합니다")
      .max(365),
    recruits: CampaignRecruitInputArray,
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
    category: CampaignCategorySchema.optional(),
    title: z.string().min(1).max(100).optional(),
    rewardJpy: z.number().int().nonnegative().optional(),
    recruitStartDate: DateOnly.optional(),
    recruitEndDate: DateOnly.optional(),
    postingPeriodDays: z.number().int().min(1).max(365).optional(),
    recruits: CampaignRecruitInputArray.optional(),
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
  category: CampaignCategorySchema,
  title: z.string(),
  rewardJpy: z.number().int().nonnegative(),
  recruits: z.array(CampaignRecruitSchema),
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
  category: CampaignCategorySchema,
  title: z.string(),
  productSummary: z.string(),
  thumbnailUrl: z.string().url().nullable(),
  rewardJpy: z.number().int().nonnegative(),
  recruits: z.array(CampaignRecruitSchema),
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
    /** 인플루언서가 이 캠페인에 이미 신청한(취소 포함) 서브타입 목록 — 신규 응모 차단용 */
    appliedSubTypes: z.array(CampaignSubTypeSchema),
    /** 이 캠페인에서 인플루언서가 직접 취소한 서브타입 목록 — 재응모 불가 안내용 */
    cancelledSubTypes: z.array(CampaignSubTypeSchema),
    /** 과거 응모 이력(제외 캠페인) 때문에 이 캠페인에서 응모할 수 없는 서브타입 목록 */
    excludedSubTypes: z.array(CampaignSubTypeSchema),
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
