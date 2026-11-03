import { z } from "zod";
import { AdminActivityLogSchema } from "./adminActivity.js";
import {
  ApplicationDisplayStageSchema,
  ApplicationStatusSchema,
  type ApplicationDisplayStage,
} from "./application.js";
import { CampaignSubTypeSchema } from "./influencer.js";

/**
 * 인플루언서 히스토리의 세부 탭. 응모 1건이 속하는 그룹이며, 이벤트 종류가
 * 아니라 그 응모의 현재 표시 단계로 결정된다 — "승인 대기 / 진행 중 / 참가완료 /
 * 탈락" 이라는 운영 기준을 그대로 옮긴 것이다.
 */
export const InfluencerHistoryTabSchema = z.enum([
  "APPLIED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
]);
export type InfluencerHistoryTab = z.infer<typeof InfluencerHistoryTabSchema>;

/**
 * 표시 단계 → 세부 탭 매핑의 단일 표. 서버·클라 양쪽이 이 표만 참조한다.
 *
 * 응모 상태(ApplicationStatus) 가 아니라 표시 단계(ApplicationDisplayStage) 를
 * 기준으로 삼는다 — 참가를 마친 건 대부분이 상태상으로는 REVIEW_SUBMITTED 에
 * 머물고 정산 상태로만 완결 여부가 갈리므로, 상태만으로는 [참가완료] 탭이
 * 영영 비어 있게 된다.
 *
 * null 은 세부 탭 없음(= [전체] 에만 노출). 취소는 반려도 완결도 아니어서
 * 어느 탭에도 넣지 않는다.
 */
export const INFLUENCER_HISTORY_TAB: Record<
  ApplicationDisplayStage,
  InfluencerHistoryTab | null
> = {
  APPLIED: "APPLIED",
  APPROVED: "IN_PROGRESS",
  SHIPPED: "IN_PROGRESS",
  AWAITING_RECEIPT: "IN_PROGRESS",
  AWAITING_ORDER: "IN_PROGRESS",
  AWAITING_REVIEW: "IN_PROGRESS",
  POSTING: "IN_PROGRESS",
  POSTED: "IN_PROGRESS",
  INSIGHT_DUE: "IN_PROGRESS",
  REVIEWING: "IN_PROGRESS",
  REVIEW_PENDING: "IN_PROGRESS",
  REVIEW_REJECTED: "IN_PROGRESS",
  POST_REJECTED: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  SETTLED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: null,
};

/**
 * 인플루언서의 응모 1건과 그 안에서 일어난 모든 이벤트.
 *
 * events 는 감사 로그 행과 응모 타임스탬프에서 합성한 인플루언서 액션이 섞인
 * 최신순 목록이다 (응모 단위 이력 화면과 동일한 조립).
 */
export const InfluencerActivityGroupSchema = z.object({
  applicationId: z.string(),
  campaignId: z.string(),
  campaignTitle: z.string(),
  subTypes: z.array(CampaignSubTypeSchema),
  status: ApplicationStatusSchema,
  /** 세부 탭 분류와 상태 뱃지의 기준. 정산 여부까지 반영한 현재 표시 단계. */
  displayStage: ApplicationDisplayStageSchema,
  /** 응모 반려 사유. 반려가 아니거나 undo 된 응모는 null. */
  rejectReason: z.string().nullable(),
  events: z.array(AdminActivityLogSchema),
});
export type InfluencerActivityGroup = z.infer<
  typeof InfluencerActivityGroupSchema
>;

export const InfluencerActivityResponseSchema = z.object({
  groups: z.array(InfluencerActivityGroupSchema),
});
export type InfluencerActivityResponse = z.infer<
  typeof InfluencerActivityResponseSchema
>;
