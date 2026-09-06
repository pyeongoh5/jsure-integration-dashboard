import { z } from "zod";
import {
  AddressCountrySchema,
  CampaignSubTypeSchema,
  SnsAccountSubTypeSchema,
} from "./influencer.js";
import { CampaignCategorySchema } from "./campaign.js";
import {
  ApplicationOptionSchema,
  ApplicationStatusSchema,
  CrossPostSchema,
  PostReviewStatusSchema,
} from "./application.js";
import { AttachmentSchema, InsightAttachmentInputSchema } from "./uploads.js";

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

export const AdminInfluencerAddressSchema = z.object({
  /** 주소 형식의 국가. 라벨과 표시 형식을 고르는 근거. */
  country: AddressCountrySchema,
  postalCode: z.string(),
  prefecture: z.string(),
  city: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string(),
});
export type AdminInfluencerAddress = z.infer<
  typeof AdminInfluencerAddressSchema
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
  address: AdminInfluencerAddressSchema,
  /**
   * 지금까지 제출한 추가 공유(크로스포스팅) 누적 건수. 선정 우대 판단용.
   * default 는 이 필드를 아직 내려주지 않는 구 API 와의 배포 갭 대비.
   */
  crossPostCount: z.number().int().nonnegative().default(0),
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

/**
 * 응모자 관리 목록 한 페이지. nextCursor 가 null 이면 마지막 페이지.
 * total 은 커서와 무관하게 필터 전체에 걸린 건수.
 */
export const AdminApplicantPageResponseSchema = z.object({
  applications: z.array(AdminApplicationSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
});
export type AdminApplicantPageResponse = z.infer<
  typeof AdminApplicantPageResponseSchema
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
  extraUrls: z.array(z.string().url()).default([]),
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
  /** 가구매 주문번호. default 는 이 필드를 아직 내려주지 않는 구 API 와의 배포 갭 대비. */
  orderNumber: z.string().nullable().default(null),
  reviewSubmittedAt: z.string().datetime().nullable(),

  submissionReviewStatus: PostReviewStatusSchema,
  submissionReviewedAt: z.string().datetime().nullable(),
  rejectionHistory: z.array(SubmittedPostRejectionSchema),

  posts: z.array(AdminSubmissionPostSchema),
  /**
   * 응모하지 않은 플랫폼에 함께 공유한 기록. 참고 표시용이며 승인·반려 대상이 아니다.
   * default 는 이 필드를 아직 내려주지 않는 구 API 와의 배포 갭 대비.
   */
  crossPosts: z.array(CrossPostSchema).default([]),

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

/** 어드민 인사이트 보정에서 다루는 지표 필드. 빈칸(미입력)은 null 로 저장한다. */
export const ADMIN_INSIGHT_METRIC_KEYS = [
  "likes",
  "comments",
  "shares",
  "reposts",
  "saves",
  "views",
  "reach",
] as const;
export type AdminInsightMetricKey = (typeof ADMIN_INSIGHT_METRIC_KEYS)[number];

const AdminInsightMetricValueSchema = z
  .number()
  .int()
  .nonnegative()
  .nullable();

/**
 * 어드민이 인플루언서가 제출한 인사이트를 보정한다 — 오기입·오타 정정용.
 * 생략한 필드는 건드리지 않는다(PATCH 시맨틱). 첨부는 추가/삭제만 다루며
 * 교체는 "추가 + 삭제"의 조합으로 표현한다.
 */
export const AdminUpdateInsightRequestSchema = z.object({
  url: z.string().url().nullable().optional(),
  likes: AdminInsightMetricValueSchema.optional(),
  comments: AdminInsightMetricValueSchema.optional(),
  shares: AdminInsightMetricValueSchema.optional(),
  reposts: AdminInsightMetricValueSchema.optional(),
  saves: AdminInsightMetricValueSchema.optional(),
  views: AdminInsightMetricValueSchema.optional(),
  reach: AdminInsightMetricValueSchema.optional(),
  addAttachments: z.array(InsightAttachmentInputSchema).max(10).optional(),
  removeAttachmentIds: z.array(z.string().min(1)).max(50).optional(),
});
export type AdminUpdateInsightRequest = z.infer<
  typeof AdminUpdateInsightRequestSchema
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
    /** 응모 서브타입과 일치하는 SNS 계정의 핸들. 일치하는 계정이 없으면 빈 문자열. */
    handle: z.string(),
    /** 인플루언서가 보유한 SNS 계정 전체 — 정산 화면의 SNS ID 표시·검색용. */
    snsAccounts: z.array(
      z.object({
        snsType: SnsAccountSubTypeSchema,
        handle: z.string(),
      }),
    ),
    bankAccount: z
      .object({
        /** 계좌 형식의 국가. 스냅샷 도입 전 정산 건은 일본으로 간주한다. */
        bankCountry: AddressCountrySchema,
        bankName: z.string(),
        bankCode: z.string(),
        branchName: z.string(),
        branchCode: z.string(),
        accountNumber: z.string(),
        accountHolder: z.string(),
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
      extraUrls: z.array(z.string().url()).default([]),
      subType: CampaignSubTypeSchema,
      submittedAt: z.string().datetime(),
      insightSubmittedAt: z.string().datetime().nullable(),
      // 인사이트 수치 — 정산 화면 열람·CSV 내보내기용. 미제출 서브타입은 null.
      insightLikes: z.number().int().nullable(),
      insightComments: z.number().int().nullable(),
      insightShares: z.number().int().nullable(),
      insightReposts: z.number().int().nullable(),
      insightSaves: z.number().int().nullable(),
      insightViews: z.number().int().nullable(),
      insightReach: z.number().int().nullable(),
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
