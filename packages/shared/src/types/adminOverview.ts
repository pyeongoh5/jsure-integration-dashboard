import { z } from "zod";
import { CampaignCategorySchema } from "./campaign.js";

export const AdminOverviewResponseSchema = z.object({
  recruitingCampaignCount: z.number().int().nonnegative(),
  pendingApplicationCount: z.number().int().nonnegative(),
  pendingPostReviewCount: z.number().int().nonnegative(),
  pendingSettlementAmountJpy: z.number().int().nonnegative(),
  pendingSettlementCount: z.number().int().nonnegative(),
  /** 로그인한 어드민이 담당자로 지정된 모집중 캠페인 수. default 는 이 필드를 아직
   * 내려주지 않는 구 API 와의 배포 갭 대비. */
  myRecruitingCampaignCount: z.number().int().nonnegative().default(0),
});

export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;

/**
 * 캠페인 운영 라이프사이클 4단계. 어드민 대시보드의 파이프라인 카운터와
 * 통합 테이블이 같은 값을 쓴다.
 */
export const CampaignStageSchema = z.enum([
  "OPEN_PENDING",
  "IN_PROGRESS",
  "INSIGHT_COLLECTING",
  "SETTLEMENT_PENDING",
]);
export type CampaignStage = z.infer<typeof CampaignStageSchema>;

/** 파이프라인 표시 순서. 카운터 카드와 테이블 정렬이 공유한다. */
export const CAMPAIGN_STAGE_ORDER: readonly CampaignStage[] = [
  "OPEN_PENDING",
  "IN_PROGRESS",
  "INSIGHT_COLLECTING",
  "SETTLEMENT_PENDING",
];

/**
 * 단계 판정 입력. 집계는 서버가 하고 판정 규칙은 이 함수 하나에만 적는다 —
 * 카운터와 테이블이 서로 다른 단계를 말하는 일이 없도록.
 */
export type CampaignStageInput = {
  /** 모집 시작일이 도래했는가. */
  recruitStarted: boolean;
  /** 승인 이후 단계로 넘어간 응모 수(반려·취소 제외). */
  approvedCount: number;
  /** 인사이트를 1건이라도 제출한 응모 수. 인사이트가 없는 카테고리는 항상 0. */
  insightStartedCount: number;
  /** 정산 레코드가 생성된 응모 수 — 회수가 끝나야 생성되므로 "회수 완료" 수와 같다. */
  settledCount: number;
};

export function deriveCampaignStage(input: CampaignStageInput): CampaignStage {
  if (!input.recruitStarted) return "OPEN_PENDING";
  if (input.approvedCount > 0 && input.settledCount >= input.approvedCount) {
    return "SETTLEMENT_PENDING";
  }
  if (input.insightStartedCount > 0) return "INSIGHT_COLLECTING";
  return "IN_PROGRESS";
}

/**
 * 통합 테이블 1행. 진척도·긴급 이슈 컬럼은 기능 정의 전이라 화면에서 빈 칸으로
 * 두고, 응답에도 담지 않는다.
 */
export const CampaignBoardRowSchema = z.object({
  campaignId: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  category: CampaignCategorySchema,
  stage: CampaignStageSchema,
});
export type CampaignBoardRow = z.infer<typeof CampaignBoardRowSchema>;

export const AdminCampaignBoardResponseSchema = z.object({
  rows: z.array(CampaignBoardRowSchema),
});
export type AdminCampaignBoardResponse = z.infer<
  typeof AdminCampaignBoardResponseSchema
>;

/** 출고 후 이 일수가 지나도록 수령 확인이 없으면 미수령 알림 대상. */
export const DELIVERY_UNCONFIRMED_DAYS = 10;

export const DailyActionAlertsResponseSchema = z.object({
  postOverdueCount: z.number().int().nonnegative(),
  deliveryUnconfirmedCount: z.number().int().nonnegative(),
  withdrawalPendingCount: z.number().int().nonnegative(),
});
export type DailyActionAlertsResponse = z.infer<
  typeof DailyActionAlertsResponseSchema
>;

/** 목록·리마인드 발송을 지원하는 알림 종류. 탈퇴 대기는 발송이 아니라 이동이다. */
export const DailyActionAlertKindSchema = z.enum([
  "POST_OVERDUE",
  "DELIVERY_UNCONFIRMED",
]);
export type DailyActionAlertKind = z.infer<typeof DailyActionAlertKindSchema>;

export const DailyActionAlertTargetSchema = z.object({
  applicationId: z.string(),
  influencerName: z.string(),
  campaignTitle: z.string(),
  /** 기준일(투고 마감일 / 출고일)로부터 경과한 일수. */
  elapsedDays: z.number().int().nonnegative(),
  /** LINE 미연동이면 리마인드가 발송되지 않는다(발송 로그에 SKIP 으로 남는다). */
  lineLinked: z.boolean(),
});
export type DailyActionAlertTarget = z.infer<
  typeof DailyActionAlertTargetSchema
>;

export const DailyActionAlertTargetsResponseSchema = z.object({
  targets: z.array(DailyActionAlertTargetSchema),
});
export type DailyActionAlertTargetsResponse = z.infer<
  typeof DailyActionAlertTargetsResponseSchema
>;

export const SendDailyActionRemindersRequestSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1).max(300),
});
export type SendDailyActionRemindersRequest = z.infer<
  typeof SendDailyActionRemindersRequestSchema
>;

export const SendDailyActionRemindersResponseSchema = z.object({
  /** 발송을 요청한 건수. 개별 성공·실패는 LINE 발송 로그에 남는다. */
  requestedCount: z.number().int().nonnegative(),
});
export type SendDailyActionRemindersResponse = z.infer<
  typeof SendDailyActionRemindersResponseSchema
>;
