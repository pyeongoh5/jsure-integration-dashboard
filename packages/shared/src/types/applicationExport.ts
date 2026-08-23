import { z } from "zod";
import { CampaignSubTypeSchema } from "./influencer.js";
import { ApplicationStatusSchema } from "./application.js";
import { CampaignCategorySchema } from "./campaign.js";

export const ApprovedApplicantExportRowSchema = z.object({
  applicationId: z.string(),
  influencerId: z.string(),
  name: z.string(),
  nameKana: z.string().nullable(),
  /** 참여 서브타입별 SNS 정보. */
  channels: z.array(
    z.object({
      subType: CampaignSubTypeSchema,
      /** 응모가 선택한 서브타입 옵션 (INSTAGRAM 이면 FEED/REELS). 없으면 null. */
      option: z.string().nullable(),
      snsHandle: z.string(),
      profileUrl: z.string(),
    }),
  ),
  phone: z.string(),
  postalCode: z.string(),
  address: z.string(),
  appliedAt: z.string(),
});
export type ApprovedApplicantExportRow = z.infer<
  typeof ApprovedApplicantExportRowSchema
>;

export const ApprovedApplicantExportResponseSchema = z.object({
  campaignTitle: z.string(),
  rows: z.array(ApprovedApplicantExportRowSchema),
});
export type ApprovedApplicantExportResponse = z.infer<
  typeof ApprovedApplicantExportResponseSchema
>;

/**
 * 응모자 관리 CSV 한 행. 승인자 명단(ApprovedApplicantExportRow)에 캠페인·상태·메모를 더한 것으로,
 * 화면에 보이는 페이지가 아니라 필터에 걸린 응모 전체를 대상으로 내려온다.
 * 화면 표시 상태(PRE_SHIP 등)는 status/category/receivedAt 에서 클라이언트가 파생시킨다.
 */
export const ApplicantExportRowSchema = ApprovedApplicantExportRowSchema.extend({
  campaignId: z.string(),
  campaignTitle: z.string(),
  campaignCategory: CampaignCategorySchema,
  status: ApplicationStatusSchema,
  receivedAt: z.string().nullable(),
  /** 응모한 서브타입 계정의 팔로워 합계 — 화면 팔로워 컬럼과 같은 기준. */
  followers: z.number().int().nonnegative(),
  /** 담당자 메모 — 인플루언서 메모를 최신순으로 이어붙인 값. 없으면 빈 문자열. */
  memo: z.string(),
  /** 응모 반려 사유. */
  rejectReason: z.string().nullable(),
});
export type ApplicantExportRow = z.infer<typeof ApplicantExportRowSchema>;

export const ApplicantExportResponseSchema = z.object({
  rows: z.array(ApplicantExportRowSchema),
  /** 상한(APPLICANT_EXPORT_MAX_ROWS)에 걸려 잘렸는지 여부. */
  truncated: z.boolean(),
});
export type ApplicantExportResponse = z.infer<
  typeof ApplicantExportResponseSchema
>;

/** CSV 한 번에 내보낼 수 있는 최대 행 수 — 메모리 보호용 상한. */
export const APPLICANT_EXPORT_MAX_ROWS = 20000;
