import { z } from "zod";
import {
  CampaignSubTypeSchema,
  SnsAccountSubTypeSchema,
} from "./influencer.js";
import { CampaignCategorySchema } from "./campaign.js";
import {
  ApplicationOptionSchema,
  ApplicationStatusSchema,
  PostReviewStatusSchema,
} from "./application.js";
import { AttachmentSchema } from "./uploads.js";

export { PostReviewStatusSchema };
export type { PostReviewStatus } from "./application.js";

export const AdminInfluencerSnsAccountSchema = z.object({
  snsType: SnsAccountSubTypeSchema,
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
  subTypes: z.array(CampaignSubTypeSchema),
  /** 응모가 선택한 서브타입 옵션 (INSTAGRAM 이면 FEED/REELS 1개). */
  selectedOptions: z.array(ApplicationOptionSchema),
  orderNumber: z.string().nullable(),
  orderSubmittedAt: z.string().datetime().nullable(),
  reviewSubmittedAt: z.string().datetime().nullable(),

  campaign: z.object({
    id: z.string(),
    category: CampaignCategorySchema,
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
  /** 응모 반려 사유 — 선택 입력. (제출물 검토 반려 RejectSubmissionRequest 는 필수 유지) */
  reason: z.string().max(500).default(""),
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

export const AdminSubmissionPostSchema = z.object({
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
  attachments: z.array(AttachmentSchema),
});
export type AdminSubmissionPost = z.infer<typeof AdminSubmissionPostSchema>;

/** 어드민 제출물 검토 행 — 응모(Application) 단위. */
export const AdminSubmissionSchema = z.object({
  /** 응모(CampaignApplication) id. */
  id: z.string(),
  status: ApplicationStatusSchema,
  subTypes: z.array(CampaignSubTypeSchema),
  /** 응모가 선택한 서브타입 옵션 (INSTAGRAM 이면 FEED/REELS 1개). */
  selectedOptions: z.array(ApplicationOptionSchema),
  reviewSubmittedAt: z.string().datetime().nullable(),

  submissionReviewStatus: PostReviewStatusSchema,
  submissionReviewedAt: z.string().datetime().nullable(),
  rejectionHistory: z.array(SubmittedPostRejectionSchema),

  posts: z.array(AdminSubmissionPostSchema),

  settlement: z
    .object({
      id: z.string(),
      status: z.enum(["PENDING", "COMPLETED"]),
      amountJpy: z.number().int().nonnegative(),
      createdAt: z.string().datetime(),
      completedAt: z.string().datetime().nullable(),
    })
    .nullable(),

  campaign: z.object({
    id: z.string(),
    category: CampaignCategorySchema,
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
export type AdminSubmission = z.infer<typeof AdminSubmissionSchema>;

export const AdminSubmissionListResponseSchema = z.object({
  submissions: z.array(AdminSubmissionSchema),
});
export type AdminSubmissionListResponse = z.infer<
  typeof AdminSubmissionListResponseSchema
>;

export const RejectSubmissionRequestSchema = z.object({
  comment: z.string().min(1, "반려 사유를 입력하세요").max(1000),
});
export type RejectSubmissionRequest = z.infer<
  typeof RejectSubmissionRequestSchema
>;

export const SettlementStatusSchema = z.enum(["PENDING", "COMPLETED"]);
export type SettlementStatus = z.infer<typeof SettlementStatusSchema>;

export const AdminSettlementSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  amountJpy: z.number().int().nonnegative(),
  rewardAmountJpy: z.number().int().nonnegative(),
  productRefundJpy: z.number().int().nonnegative(),
  status: SettlementStatusSchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),

  influencer: z.object({
    id: z.string(),
    name: z.string(),
    handle: z.string(),
    bankAccount: z
      .object({
        bankName: z.string(),
        bankCode: z.string(),
        branchName: z.string(),
        branchCode: z.string(),
        accountNumber: z.string(),
        accountHolderKana: z.string(),
        /** 適格請求書登録番号. 미지정이면 null. optional 은 구 API 응답 호환용. */
        invoiceRegistrationNumber: z.string().nullable().optional(),
      })
      .nullable(),
  }),
  campaign: z.object({
    id: z.string(),
    category: CampaignCategorySchema,
    title: z.string(),
  }),
  posts: z.array(
    z.object({
      id: z.string(),
      url: z.string().url().nullable(),
      subType: CampaignSubTypeSchema,
      submittedAt: z.string().datetime(),
      insightSubmittedAt: z.string().datetime().nullable(),
    }),
  ),
});
export type AdminSettlement = z.infer<typeof AdminSettlementSchema>;

export const AdminSettlementListResponseSchema = z.object({
  settlements: z.array(AdminSettlementSchema),
});
export type AdminSettlementListResponse = z.infer<
  typeof AdminSettlementListResponseSchema
>;
