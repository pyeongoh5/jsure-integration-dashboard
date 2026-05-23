import { z } from "zod";
import { SnsTypeSchema } from "./influencer.js";
import { ApplicationStatusSchema } from "./application.js";

export const AdminInfluencerSnsAccountSchema = z.object({
  snsType: SnsTypeSchema,
  handle: z.string(),
  followerCount: z.number().int().nonnegative(),
});
export type AdminInfluencerSnsAccount = z.infer<
  typeof AdminInfluencerSnsAccountSchema
>;

export const AdminInfluencerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  nameKana: z.string().nullable(),
  phone: z.string(),
  entityType: z.enum(["INDIVIDUAL", "CORPORATE"]),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  memo: z.string().nullable(),
  snsAccounts: z.array(AdminInfluencerSnsAccountSchema),
  createdAt: z.string().datetime(),
});
export type AdminInfluencer = z.infer<typeof AdminInfluencerSchema>;

export const AdminInfluencerListResponseSchema = z.object({
  influencers: z.array(AdminInfluencerSchema),
});
export type AdminInfluencerListResponse = z.infer<
  typeof AdminInfluencerListResponseSchema
>;

export const AdminApplicationSchema = z.object({
  id: z.string(),
  status: ApplicationStatusSchema,
  appliedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
  rejectReason: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  shippedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),

  campaign: z.object({
    id: z.string(),
    title: z.string(),
  }),

  influencer: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    snsAccounts: z.array(AdminInfluencerSnsAccountSchema),
  }),
});
export type AdminApplication = z.infer<typeof AdminApplicationSchema>;

export const AdminApplicationListResponseSchema = z.object({
  applications: z.array(AdminApplicationSchema),
});
export type AdminApplicationListResponse = z.infer<
  typeof AdminApplicationListResponseSchema
>;

export const AdminApplicationCountsResponseSchema = z.object({
  counts: z.record(ApplicationStatusSchema, z.number().int().nonnegative()),
});
export type AdminApplicationCountsResponse = z.infer<
  typeof AdminApplicationCountsResponseSchema
>;

export const RejectApplicationRequestSchema = z.object({
  reason: z.string().min(1, "사유를 입력하세요").max(500),
});
export type RejectApplicationRequest = z.infer<
  typeof RejectApplicationRequestSchema
>;
