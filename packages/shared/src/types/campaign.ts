import { z } from "zod";
import {
  CampaignSubTypeSchema,
  EnabledSnsTypeSchema,
  type CampaignSubType,
} from "./influencer.js";

export { CampaignSubTypeSchema };
export type { CampaignSubType };

export const CampaignCategorySchema = z.enum(["SNS", "FAKE_PURCHASE", "SIMPLE_REVIEW"]);
export type CampaignCategory = z.infer<typeof CampaignCategorySchema>;

const SNS_SUB_TYPE_VALUES = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"] as const;
const FAKE_PURCHASE_SUB_TYPE_VALUES = ["QOO10"] as const;
const SIMPLE_REVIEW_SUB_TYPE_VALUES = ["LIPS", "ATCOSME"] as const;

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

export const InstagramPostTypeSchema = z.enum(["FEED", "REELS"]);
export type InstagramPostType = z.infer<typeof InstagramPostTypeSchema>;

const INSTAGRAM_SUB_TYPE_OPTION_VALUES = ["FEED", "REELS"] as const;
const QOO10_SUB_TYPE_OPTION_VALUES = ["LIPS", "ATCOSME"] as const;

const INSTAGRAM_SUB_TYPE_OPTION_SET = new Set<string>(
  INSTAGRAM_SUB_TYPE_OPTION_VALUES,
);
const QOO10_SUB_TYPE_OPTION_SET = new Set<string>(
  QOO10_SUB_TYPE_OPTION_VALUES,
);

/**
 * INSTAGRAM 모집은 어떤 포스트 타입(FEED/REELS)을 받을지 1개 이상 지정해야 한다.
 * QOO10 모집은 리뷰 채널(LIPS/ATCOSME)을 0-2개 지정한다.
 * 그 외 서브타입은 빈 배열로 응답·저장한다.
 * 가구매(QOO10) 모집은 `productPriceJpy`/`productUrl` 을 필수로 세팅한다.
 */
export const CampaignRecruitSchema = z.object({
  subType: CampaignSubTypeSchema,
  minFollowers: z.number().int().nonnegative("0 이상의 정수"),
  recruitCount: z.number().int().positive("1 이상"),
  subTypeOptions: z.array(z.string()).default([]),
  /** false 면 인플루언서가 인사이트를 제출하지 않아도 정산이 진행될 수 있다. */
  insightRequired: z.boolean().default(true),
  /** true 면 인플루언서 응모 시 이 서브타입이 자동 선택되며 해제 불가. */
  isRequired: z.boolean().default(false),
  /** 가구매 캠페인용: 상품 가격(JPY). SNS 캠페인은 null. */
  productPriceJpy: z.number().int().positive().nullable().default(null),
  /** 가구매 캠페인용: 상품 URL. SNS 캠페인은 null. */
  productUrl: z.string().url().nullable().default(null),
});
export type CampaignRecruit = z.infer<typeof CampaignRecruitSchema>;

const CampaignRecruitInputSchema = z
  .object({
    subType: CampaignSubTypeSchema,
    minFollowers: z
      .number({ invalid_type_error: "숫자를 입력해주세요" })
      .int("정수만 입력")
      .nonnegative("0 이상의 정수"),
    recruitCount: z
      .number({ invalid_type_error: "숫자를 입력해주세요" })
      .int("정수만 입력")
      .positive("1 이상"),
    subTypeOptions: z.array(z.string()).default([]),
    insightRequired: z.boolean().default(true),
    isRequired: z.boolean().default(false),
    productPriceJpy: z
      .number({ invalid_type_error: "숫자를 입력해주세요" })
      .int("정수만 입력")
      .positive("1 이상")
      .nullable()
      .default(null),
    productUrl: z.string().url("URL 형식이어야 합니다").nullable().default(null),
  })
  .superRefine((recruit, ctx) => {
    const unique = new Set(recruit.subTypeOptions);
    if (unique.size !== recruit.subTypeOptions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subTypeOptions"],
        message: "옵션이 중복되었습니다",
      });
    }
  });

const CampaignRecruitInputArray = z
  .array(CampaignRecruitInputSchema)
  .min(1, "1개 이상의 모집을 지정해야 합니다")
  .refine(
    (arr) => new Set(arr.map((r) => r.subType)).size === arr.length,
    "서브타입이 중복되었습니다",
  );

const SNS_SUB_TYPE_SET = new Set<CampaignSubType>(SNS_SUB_TYPE_VALUES);
const FAKE_PURCHASE_SUB_TYPE_SET = new Set<CampaignSubType>(
  FAKE_PURCHASE_SUB_TYPE_VALUES,
);
const SIMPLE_REVIEW_SUB_TYPE_SET = new Set<CampaignSubType>(
  SIMPLE_REVIEW_SUB_TYPE_VALUES,
);
const ENABLED_SNS_SUB_TYPE_SET = new Set<CampaignSubType>(
  EnabledSnsTypeSchema.options,
);

function refineRecruitsByCategory(
  category: CampaignCategory,
  recruits: z.infer<typeof CampaignRecruitInputSchema>[],
  ctx: z.RefinementCtx,
): void {
  recruits.forEach((recruit, index) => {
    if (category === "SNS") {
      if (!SNS_SUB_TYPE_SET.has(recruit.subType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "subType"],
          message: "SNS 캠페인에서 사용할 수 없는 서브타입입니다",
        });
        return;
      }
      if (!ENABLED_SNS_SUB_TYPE_SET.has(recruit.subType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "subType"],
          message: "현재 활성화되지 않은 SNS 서브타입입니다",
        });
      }
      if (recruit.productPriceJpy !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "productPriceJpy"],
          message: "SNS 캠페인에서는 상품 가격을 지정할 수 없습니다",
        });
      }
      if (recruit.productUrl !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "productUrl"],
          message: "SNS 캠페인에서는 상품 URL을 지정할 수 없습니다",
        });
      }
      if (recruit.subType === "INSTAGRAM") {
        const invalid = recruit.subTypeOptions.filter(
          (option) => !INSTAGRAM_SUB_TYPE_OPTION_SET.has(option),
        );
        if (invalid.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["recruits", index, "subTypeOptions"],
            message: "INSTAGRAM 옵션은 FEED/REELS 만 허용됩니다",
          });
        }
        if (recruit.subTypeOptions.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["recruits", index, "subTypeOptions"],
            message: "FEED 또는 REELS 중 1개 이상을 선택하세요",
          });
        }
      } else {
        if (recruit.subTypeOptions.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["recruits", index, "subTypeOptions"],
            message: "이 서브타입에서는 옵션을 지정할 수 없습니다",
          });
        }
      }
    } else if (category === "FAKE_PURCHASE") {
      if (!FAKE_PURCHASE_SUB_TYPE_SET.has(recruit.subType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "subType"],
          message: "가구매 캠페인에서 사용할 수 없는 서브타입입니다",
        });
        return;
      }
      if (recruit.isRequired) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "isRequired"],
          message: "가구매 캠페인에서는 필수 여부를 지정할 수 없습니다",
        });
      }
      if (recruit.subType === "QOO10") {
        const invalid = recruit.subTypeOptions.filter(
          (option) => !QOO10_SUB_TYPE_OPTION_SET.has(option),
        );
        if (invalid.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["recruits", index, "subTypeOptions"],
            message: "QOO10 리뷰 채널은 LIPS/ATCOSME 만 허용됩니다",
          });
        }
      }
      if (recruit.productPriceJpy === null || recruit.productPriceJpy <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "productPriceJpy"],
          message: "상품 가격은 1 이상의 정수를 입력하세요",
        });
      }
      if (recruit.productUrl === null || recruit.productUrl.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "productUrl"],
          message: "상품 URL을 입력하세요",
        });
      } else if (!/^https:\/\//i.test(recruit.productUrl)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "productUrl"],
          message: "https URL 을 입력하세요",
        });
      }
    } else {
      // SIMPLE_REVIEW
      if (!SIMPLE_REVIEW_SUB_TYPE_SET.has(recruit.subType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "subType"],
          message: "단순 리뷰 캠페인에서 사용할 수 없는 서브타입입니다",
        });
        return;
      }
      if (recruit.subTypeOptions.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "subTypeOptions"],
          message: "단순 리뷰에서는 옵션을 지정할 수 없습니다",
        });
      }
      if (recruit.productPriceJpy !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "productPriceJpy"],
          message: "단순 리뷰 캠페인에서는 상품 가격을 지정할 수 없습니다",
        });
      }
      if (recruit.productUrl !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "productUrl"],
          message: "단순 리뷰 캠페인에서는 상품 URL을 지정할 수 없습니다",
        });
      }
    }
  });
}

export const CampaignFormSchema = z
  .object({
    category: CampaignCategorySchema.default("SNS"),
    title: z.string().min(1, "필수 입력").max(100),
    rewardJpy: z
      .number({ invalid_type_error: "숫자를 입력해주세요" })
      .int("정수만 입력")
      .nonnegative("0 이상의 정수"),
    recruitStartDate: DateOnly,
    recruitEndDate: DateOnly,
    postingPeriodDays: z
      .number({ invalid_type_error: "숫자를 입력해주세요" })
      .int("정수만 입력")
      .min(1, "1 이상의 일수여야 합니다")
      .max(365, "365 이하의 일수여야 합니다"),
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
  })
  .superRefine((form, ctx) => {
    refineRecruitsByCategory(form.category, form.recruits, ctx);
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
  approvedCount: z.number().int().nonnegative(),
  recruitStartAt: z.string().datetime(),
  recruitEndAt: z.string().datetime(),
  postingPeriodDays: z.number().int().min(1),
  isNew: z.boolean(),
  isEnded: z.boolean(),
  isUpcoming: z.boolean(),
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
