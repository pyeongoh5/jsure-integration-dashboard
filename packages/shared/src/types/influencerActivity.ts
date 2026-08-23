import { z } from "zod";
import { AdminActivityLogSchema } from "./adminActivity.js";
import { ApplicationStatusSchema, type ApplicationStatus } from "./application.js";
import { CampaignSubTypeSchema } from "./influencer.js";

/**
 * 인플루언서 히스토리의 세부 탭. 응모 1건이 속하는 그룹이며, 이벤트 종류가
 * 아니라 그 응모의 현재 상태로 결정된다 — "승인 대기 중인 안건 / 완료된 안건 /
 * 탈락된 안건" 이라는 운영 기준을 그대로 옮긴 것이다.
 */
export const InfluencerHistoryTabSchema = z.enum([
  "APPLIED",
  "COMPLETED",
  "REJECTED",
]);
export type InfluencerHistoryTab = z.infer<typeof InfluencerHistoryTabSchema>;

/**
 * 응모 상태 → 세부 탭 매핑의 단일 표. 서버·클라 양쪽이 이 표만 참조한다.
 *
 * null 은 세부 탭 없음(= [전체] 에만 노출). 취소는 반려도 완결도 아니어서
 * 세 탭 어디에도 넣지 않는다.
 *
 * APPLIED 탭은 "아직 완결되지 않은 안건" 이다 — 승인 대기뿐 아니라 승인·배송·
 * 제출 대기 같은 진행 중 상태까지 포함해, 진행 중인 안건이 어느 세부 탭에도
 * 걸리지 않는 구멍을 만들지 않는다.
 */
export const INFLUENCER_HISTORY_TAB: Record<
  ApplicationStatus,
  InfluencerHistoryTab | null
> = {
  APPLIED: "APPLIED",
  APPROVED: "APPLIED",
  SHIPPED: "APPLIED",
  DELIVERED: "APPLIED",
  ORDER_SUBMITTED: "APPLIED",
  REVIEW_SUBMITTED: "APPLIED",
  COMPLETED: "COMPLETED",
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
