import { z } from "zod";

export const SnsTypeSchema = z.enum(["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"]);
export type SnsType = z.infer<typeof SnsTypeSchema>;

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

export const CampaignFormSchema = z
  .object({
    title: z.string().min(1, "필수 입력").max(100),
    rewardJpy: z.number().int("정수만 입력").nonnegative(),
    snsTypes: z.array(SnsTypeSchema).min(1, "1개 이상 선택"),
    condition: z.string().max(500),
    recruitCount: z.number().int().positive("1 이상"),
    recruitStartDate: DateOnly,
    recruitEndDate: DateOnly,
    productSummary: z.string().max(1000),
    productDetailUrl: z.string().url("URL 형식이어야 합니다"),
    guideline: z.string().max(2000),
    referenceMediaUrls: z.array(z.string().url()).max(10),
    cautions: z.string().max(2000),
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
    snsTypes: z.array(SnsTypeSchema).min(1).optional(),
    condition: z.string().max(500).optional(),
    recruitCount: z.number().int().positive().optional(),
    recruitStartDate: DateOnly.optional(),
    recruitEndDate: DateOnly.optional(),
    productSummary: z.string().max(1000).optional(),
    productDetailUrl: z.string().url().optional(),
    guideline: z.string().max(2000).optional(),
    referenceMediaUrls: z.array(z.string().url()).max(10).optional(),
    cautions: z.string().max(2000).optional(),
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
  snsTypes: z.array(SnsTypeSchema),
  condition: z.string(),
  recruitCount: z.number().int().positive(),
  recruitStartDate: DateOnly,
  recruitEndDate: DateOnly,
  recruitStartAt: z.string().datetime(),
  recruitEndAt: z.string().datetime(),
  productSummary: z.string(),
  productDetailUrl: z.string().url(),
  guideline: z.string(),
  referenceMediaUrls: z.array(z.string().url()),
  cautions: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;
