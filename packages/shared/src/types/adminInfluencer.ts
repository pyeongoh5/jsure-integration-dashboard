import { z } from "zod";
import { SnsTypeSchema } from "./influencer.js";
import {
  ApplicationStatusSchema,
  PostReviewStatusSchema,
} from "./application.js";
import { SubmittedPostAttachmentSchema } from "./uploads.js";

export { PostReviewStatusSchema };
export type { PostReviewStatus } from "./application.js";

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
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  memo: z.string().nullable(),
  flagged: z.boolean(),
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
  trackingCarrier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  shippedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  snsType: SnsTypeSchema,
  hasSubmittedPost: z.boolean(),

  campaign: z.object({
    id: z.string(),
    title: z.string(),
  }),

  influencer: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    flagged: z.boolean(),
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

export const ShipApplicationRequestSchema = z.object({
  trackingCarrier: z.string().min(1, "택배사를 입력하세요").max(50),
  trackingNumber: z.string().min(1, "운송장 번호를 입력하세요").max(100),
});
export type ShipApplicationRequest = z.infer<
  typeof ShipApplicationRequestSchema
>;

export const SubmittedPostRejectionSchema = z.object({
  id: z.string(),
  comment: z.string(),
  rejectedAt: z.string().datetime(),
});
export type SubmittedPostRejection = z.infer<
  typeof SubmittedPostRejectionSchema
>;

export const AdminSubmittedPostSchema = z.object({
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
  rejectionHistory: z.array(SubmittedPostRejectionSchema),
  attachments: z.array(SubmittedPostAttachmentSchema),

  settledAt: z.string().datetime().nullable(),
  settledAmountJpy: z.number().int().nonnegative().nullable(),
  settlementCompletedAt: z.string().datetime().nullable(),
  settlement: z
    .object({
      id: z.string(),
      status: z.enum(["PENDING", "COMPLETED"]),
      amountJpy: z.number().int().nonnegative(),
      createdAt: z.string().datetime(),
      completedAt: z.string().datetime().nullable(),
    })
    .nullable(),

  application: z.object({
    id: z.string(),
    status: ApplicationStatusSchema,
  }),

  campaign: z.object({
    id: z.string(),
    title: z.string(),
    thumbnailUrl: z.string().url().nullable(),
    rewardJpy: z.number().int().nonnegative(),
  }),

  influencer: z.object({
    id: z.string(),
    name: z.string(),
    flagged: z.boolean(),
    snsAccounts: z.array(AdminInfluencerSnsAccountSchema),
  }),
});
export type AdminSubmittedPost = z.infer<typeof AdminSubmittedPostSchema>;

export const AdminSubmittedPostListResponseSchema = z.object({
  posts: z.array(AdminSubmittedPostSchema),
});
export type AdminSubmittedPostListResponse = z.infer<
  typeof AdminSubmittedPostListResponseSchema
>;

export const RejectSubmittedPostRequestSchema = z.object({
  comment: z.string().min(1, "반려 사유를 입력하세요").max(1000),
});
export type RejectSubmittedPostRequest = z.infer<
  typeof RejectSubmittedPostRequestSchema
>;

export const SettlementStatusSchema = z.enum(["PENDING", "COMPLETED"]);
export type SettlementStatus = z.infer<typeof SettlementStatusSchema>;

export const AdminSettlementSchema = z.object({
  id: z.string(),
  postId: z.string(),
  amountJpy: z.number().int().nonnegative(),
  status: SettlementStatusSchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),

  influencer: z.object({
    id: z.string(),
    name: z.string(),
    handle: z.string(),
  }),
  campaign: z.object({
    id: z.string(),
    title: z.string(),
  }),
  post: z.object({
    id: z.string(),
    url: z.string().url(),
    snsType: SnsTypeSchema,
    submittedAt: z.string().datetime(),
    insightSubmittedAt: z.string().datetime().nullable(),
  }),
});
export type AdminSettlement = z.infer<typeof AdminSettlementSchema>;

export const AdminSettlementListResponseSchema = z.object({
  settlements: z.array(AdminSettlementSchema),
});
export type AdminSettlementListResponse = z.infer<
  typeof AdminSettlementListResponseSchema
>;
