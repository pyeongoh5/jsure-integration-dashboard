import { z } from "zod";
import { SnsTypeSchema, type SnsType } from "./influencer.js";

export { SnsTypeSchema };
export type { SnsType };

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

export const SnsRecruitSchema = z.object({
  snsType: SnsTypeSchema,
  minFollowers: z.number().int().nonnegative("0 이상의 정수"),
  recruitCount: z.number().int().positive("1 이상"),
});
export type SnsRecruit = z.infer<typeof SnsRecruitSchema>;

const SnsRecruitArray = z
  .array(SnsRecruitSchema)
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
    snsRecruits: SnsRecruitArray,
    productSummary: z.string().max(1000),
    productDetailUrl: z.string().url("URL 형식이어야 합니다"),
    guideline: z.string().max(2000),
    referenceMediaUrls: z.array(z.string().url()).max(10),
    cautions: z.string().max(2000),
    thumbnailUrl: z.string().url().nullable().optional(),
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
    snsRecruits: SnsRecruitArray.optional(),
    productSummary: z.string().max(1000).optional(),
    productDetailUrl: z.string().url().optional(),
    guideline: z.string().max(2000).optional(),
    referenceMediaUrls: z.array(z.string().url()).max(10).optional(),
    cautions: z.string().max(2000).optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
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
  productSummary: z.string(),
  productDetailUrl: z.string().url(),
  guideline: z.string(),
  referenceMediaUrls: z.array(z.string().url()),
  cautions: z.string(),
  thumbnailUrl: z.string().url().nullable(),
  approvedCount: z.number().int().nonnegative(),
  appliedCount: z.number().int().nonnegative(),
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
  isNew: z.boolean(),
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
    hasApplied: z.boolean(),
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
