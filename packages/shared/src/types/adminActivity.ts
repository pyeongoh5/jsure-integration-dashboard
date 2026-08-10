import { z } from "zod";

/**
 * 어드민 감사 로그의 액션 종류. DB 는 String 컬럼이고, 이 유니온이 유일한
 * 유효성 보장 지점이다 — AuditService 시그니처가 이 타입을 받으므로 오타나
 * 미등록 액션은 컴파일 타임에 걸린다.
 */
export const AdminActivityActionSchema = z.enum([
  // 응모
  "APPLICATION_APPROVE",
  "APPLICATION_REJECT",
  "APPLICATION_REVIEW_UNDO",
  "APPLICATION_SHIP",
  "APPLICATION_DELIVER",
  // 제출물
  "SUBMISSION_APPROVE",
  "SUBMISSION_REJECT",
  "SUBMISSION_REVIEW_UNDO",
  // 정산
  "SETTLEMENT_CREATE",
  "SETTLEMENT_REGISTER",
  "SETTLEMENT_COMPLETE",
  "SETTLEMENT_AUTO_COMPLETE",
  // 캠페인
  "CAMPAIGN_CREATE",
  "CAMPAIGN_UPDATE",
  "CAMPAIGN_CLOSE",
  "CAMPAIGN_HIDE",
  "CAMPAIGN_UNHIDE",
  "CAMPAIGN_DELETE",
  "CAMPAIGN_DRAFT_CREATE",
  "CAMPAIGN_DRAFT_UPDATE",
  "CAMPAIGN_DRAFT_PUBLISH",
  // 인플루언서
  "INFLUENCER_MEMO_CREATE",
  "INFLUENCER_FLAG_SET",
  "INFLUENCER_FLAG_CLEAR",
]);
export type AdminActivityAction = z.infer<typeof AdminActivityActionSchema>;

/**
 * ADMIN = 어드민 직접 액션, CASCADE = 어드민 액션에 연쇄된 자동 처리,
 * SYSTEM = 크론·인플루언서 행동이 유발한 자동 처리(actor 없음).
 */
export const AdminActivityOriginSchema = z.enum(["ADMIN", "CASCADE", "SYSTEM"]);
export type AdminActivityOrigin = z.infer<typeof AdminActivityOriginSchema>;

export const AdminActivityActorSchema = z.object({
  id: z.string(),
  /** 행위 시점의 이름 스냅샷. 현재 AdminUser 를 조인하지 않는다. */
  name: z.string().nullable(),
});
export type AdminActivityActor = z.infer<typeof AdminActivityActorSchema>;

export const AdminActivityLogSchema = z.object({
  id: z.string(),
  action: AdminActivityActionSchema,
  origin: AdminActivityOriginSchema,
  actor: AdminActivityActorSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type AdminActivityLog = z.infer<typeof AdminActivityLogSchema>;

export const ApplicationActivityResponseSchema = z.object({
  items: z.array(AdminActivityLogSchema),
});
export type ApplicationActivityResponse = z.infer<
  typeof ApplicationActivityResponseSchema
>;
