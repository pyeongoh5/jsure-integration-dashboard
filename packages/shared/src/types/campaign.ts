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

/**
 * 보수 체계.
 * - UNIFIED: 참여 서브타입 수와 무관하게 Campaign.rewardJpy 고정 지급.
 * - PER_SUBTYPE: 참여한 서브타입별 CampaignRecruit.rewardJpy 합산 지급.
 */
export const RewardTypeSchema = z.enum(["UNIFIED", "PER_SUBTYPE"]);
export type RewardType = z.infer<typeof RewardTypeSchema>;

const SNS_SUB_TYPE_VALUES = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"] as const;
const FAKE_PURCHASE_SUB_TYPE_VALUES = ["QOO10"] as const;
const SIMPLE_REVIEW_SUB_TYPE_VALUES = ["LIPS", "ATCOSME"] as const;

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

export const InstagramPostTypeSchema = z.enum(["FEED", "REELS"]);
export type InstagramPostType = z.infer<typeof InstagramPostTypeSchema>;

/**
 * 옵션 선택형 서브타입 — 응모 시 인플루언서가 옵션(FEED/REELS 등) 1개를 골라야
 * 하는 서브타입. QOO10 의 subTypeOptions(LIPS/ATCOSME)는 캠페인이 강제하는 요구
 * 채널이라 선택 대상이 아니므로 포함하지 않는다.
 */
export const OPTION_SELECTABLE_SUB_TYPES: readonly CampaignSubType[] = [
  "INSTAGRAM",
];

/**
 * recruit 옵션 세부 설정 — 옵션 행 집합은 subTypeOptions 전체와 1:1 이어야 하고,
 * recruitCount(정원 분리)·rewardJpy(보수 분리)는 속성별 all-or-nothing.
 * 보수 분리 시 부모 recruit.rewardJpy 는 null 강제.
 */
export const CampaignRecruitOptionConfigSchema = z.object({
  option: z.string().min(1),
  recruitCount: z.number().int().positive().nullable().default(null),
  rewardJpy: z.number().int().nonnegative().nullable().default(null),
});
export type CampaignRecruitOptionConfig = z.infer<
  typeof CampaignRecruitOptionConfigSchema
>;

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
  /** 개별 보수(PER_SUBTYPE) 캠페인용: 이 서브타입 참여 보수(JPY). UNIFIED 캠페인은 null. */
  rewardJpy: z.number().int().nonnegative().nullable().default(null),
  subTypeOptions: z.array(z.string()).default([]),
  /** false 면 인플루언서가 인사이트를 제출하지 않아도 정산이 진행될 수 있다. */
  insightRequired: z.boolean().default(true),
  /** true 면 인플루언서 응모 시 이 서브타입이 자동 선택되며 해제 불가. */
  isRequired: z.boolean().default(false),
  /** 가구매 캠페인용: 상품 가격(JPY). SNS 캠페인은 null. */
  productPriceJpy: z.number().int().positive().nullable().default(null),
  /** 가구매 캠페인용: 상품 URL. SNS 캠페인은 null. */
  productUrl: z.string().url().nullable().default(null),
  /** 옵션별 정원·보수 세부 설정. 빈 배열이면 완전 통합 모드. */
  options: z.array(CampaignRecruitOptionConfigSchema).default([]),
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
    rewardJpy: z
      .number({ invalid_type_error: "숫자를 입력해주세요" })
      .int("정수만 입력")
      .nonnegative("0 이상의 정수")
      .nullable()
      .default(null),
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
    options: z
      .array(
        z.object({
          option: z.string().min(1),
          recruitCount: z
            .number({ invalid_type_error: "숫자를 입력해주세요" })
            .int("정수만 입력")
            .positive("1 이상")
            .nullable()
            .default(null),
          rewardJpy: z
            .number({ invalid_type_error: "숫자를 입력해주세요" })
            .int("정수만 입력")
            .nonnegative("0 이상의 정수")
            .nullable()
            .default(null),
        }),
      )
      .default([]),
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

/** recruit 가 옵션별 보수 분리를 사용하는지 (모든 옵션 행에 rewardJpy 존재). */
function usesOptionRewardSplit(recruit: {
  options: { rewardJpy: number | null }[];
}): boolean {
  return (
    recruit.options.length > 0 &&
    recruit.options.every((option) => option.rewardJpy !== null)
  );
}

function refineRecruitsByRewardType(
  rewardType: z.infer<typeof RewardTypeSchema>,
  recruits: z.infer<typeof CampaignRecruitInputSchema>[],
  ctx: z.RefinementCtx,
): void {
  recruits.forEach((recruit, index) => {
    const optionRewardSplit = usesOptionRewardSplit(recruit);
    if (rewardType === "PER_SUBTYPE") {
      if (recruit.rewardJpy === null && !optionRewardSplit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "rewardJpy"],
          message: "서브타입별 보수 금액을 입력하세요",
        });
      }
      // 보수 분리 시 부모 보수는 비워야 한다 — 응모는 옵션 1개만 고르므로
      // 서브타입 보수에 어떤 대표값을 남겨도 거짓이 된다.
      if (recruit.rewardJpy !== null && optionRewardSplit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "rewardJpy"],
          message: "옵션별 보수 사용 시 서브타입 보수는 비워야 합니다",
        });
      }
    } else if (recruit.rewardJpy !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recruits", index, "rewardJpy"],
        message: "통합 보수 캠페인에서는 서브타입별 보수를 지정할 수 없습니다",
      });
    }
  });
}

/** 옵션별 정원·보수 설정 검증 — 속성별 all-or-nothing, subTypeOptions 와 1:1. */
function refineRecruitOptionConfigs(
  rewardType: z.infer<typeof RewardTypeSchema>,
  recruits: z.infer<typeof CampaignRecruitInputSchema>[],
  ctx: z.RefinementCtx,
): void {
  recruits.forEach((recruit, index) => {
    if (recruit.options.length === 0) return;
    const path = ["recruits", index, "options"];
    if (!OPTION_SELECTABLE_SUB_TYPES.includes(recruit.subType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "이 서브타입에서는 옵션별 설정을 사용할 수 없습니다",
      });
      return;
    }
    const names = recruit.options.map((option) => option.option);
    const nameSet = new Set(names);
    const allowedSet = new Set(recruit.subTypeOptions);
    const sameAsAllowed =
      nameSet.size === names.length &&
      nameSet.size === allowedSet.size &&
      names.every((name) => allowedSet.has(name));
    if (!sameAsAllowed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "옵션별 설정은 모집하는 모든 옵션과 정확히 일치해야 합니다",
      });
      return;
    }
    const withCount = recruit.options.filter(
      (option) => option.recruitCount !== null,
    );
    if (withCount.length !== 0 && withCount.length !== recruit.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "옵션별 정원은 전부 입력하거나 전부 비워야 합니다",
      });
    }
    const withReward = recruit.options.filter(
      (option) => option.rewardJpy !== null,
    );
    if (
      withReward.length !== 0 &&
      withReward.length !== recruit.options.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "옵션별 보수는 전부 입력하거나 전부 비워야 합니다",
      });
    }
    if (withReward.length > 0 && rewardType !== "PER_SUBTYPE") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "통합 보수 캠페인에서는 옵션별 보수를 지정할 수 없습니다",
      });
    }
    if (withCount.length === 0 && withReward.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "옵션별 정원 또는 보수를 입력하세요",
      });
    }
  });
}

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
      // 단순 리뷰는 서브타입 선택 자체가 필수 응모다.
      if (!recruit.isRequired) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruits", index, "isRequired"],
          message: "단순 리뷰는 선택한 서브타입이 모두 필수 응모입니다",
        });
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

  // 단순 리뷰는 캠페인 단위 모집 인원 하나 — 전 서브타입 recruitCount 가 동일해야 한다.
  if (category === "SIMPLE_REVIEW" && recruits.length > 1) {
    const distinctCounts = new Set(recruits.map((recruit) => recruit.recruitCount));
    if (distinctCounts.size > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recruits"],
        message: "단순 리뷰는 모든 서브타입의 모집 인원이 같아야 합니다",
      });
    }
  }
}

export const CampaignFormSchema = z
  .object({
    category: CampaignCategorySchema.default("SNS"),
    title: z.string().min(1, "필수 입력").max(100),
    rewardType: RewardTypeSchema.default("UNIFIED"),
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
    productDetailUrls: z
      .array(z.string().url("URL 형식이어야 합니다"))
      .min(1, "상품 상세 URL을 1개 이상 입력해주세요")
      .max(10),
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
    refineRecruitsByRewardType(form.rewardType, form.recruits, ctx);
    refineRecruitOptionConfigs(form.rewardType, form.recruits, ctx);
  });
export type CampaignForm = z.infer<typeof CampaignFormSchema>;

export const CreateCampaignRequestSchema = CampaignFormSchema;
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

export const UpdateCampaignRequestSchema = z
  .object({
    category: CampaignCategorySchema.optional(),
    title: z.string().min(1).max(100).optional(),
    rewardType: RewardTypeSchema.optional(),
    rewardJpy: z.number().int().nonnegative().optional(),
    recruitStartDate: DateOnly.optional(),
    recruitEndDate: DateOnly.optional(),
    postingPeriodDays: z.number().int().min(1).max(365).optional(),
    recruits: CampaignRecruitInputArray.optional(),
    productSummary: z.string().max(50000).optional(),
    productDetailUrls: z
      .array(z.string().url("URL 형식이어야 합니다"))
      .min(1, "상품 상세 URL을 1개 이상 입력해주세요")
      .max(10)
      .optional(),
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
  rewardType: RewardTypeSchema,
  rewardJpy: z.number().int().nonnegative(),
  recruits: z.array(CampaignRecruitSchema),
  recruitStartDate: DateOnly,
  recruitEndDate: DateOnly,
  recruitStartAt: z.string().datetime(),
  recruitEndAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  postingPeriodDays: z.number().int().min(1),
  productSummary: z.string(),
  productDetailUrls: z.array(z.string().url()),
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
  rewardType: RewardTypeSchema,
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
    productDetailUrls: z.array(z.string().url()),
    guideline: z.string(),
    referenceMediaUrls: z.array(z.string().url()),
    cautions: z.string(),
    /** 인플루언서가 이 캠페인에 이미 응모(취소 포함)했는지 — 신규 응모 차단용 */
    hasApplied: z.boolean(),
    /** 이 캠페인 응모를 인플루언서가 직접 취소했는지 — 재응모 불가 안내용 */
    hasCancelled: z.boolean(),
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
