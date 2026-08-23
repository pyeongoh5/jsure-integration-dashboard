import { z } from "zod";

export const InfluencerMemoEntrySchema = z.object({
  id: z.string(),
  comment: z.string(),
  createdAt: z.string().datetime(),
  createdBy: z
    .object({ id: z.string(), name: z.string().nullable() })
    .nullable(),
  campaignId: z.string().nullable(),
  campaignTitle: z.string().nullable(),
});
export type InfluencerMemoEntry = z.infer<typeof InfluencerMemoEntrySchema>;

/** 반려/거절을 수행한 어드민. 계정 삭제 시 null — 이름은 스냅샷이 아니라 현재 값이다. */
const RejectedBySchema = z
  .object({ id: z.string(), name: z.string().nullable() })
  .nullable();

export const InfluencerApplicationRejectionEntrySchema = z.object({
  applicationId: z.string(),
  comment: z.string(),
  rejectedAt: z.string().datetime().nullable(),
  campaignTitle: z.string(),
  // 배포 갭 동안 구버전 api 응답에는 없으므로 default 로 견딘다.
  rejectedBy: RejectedBySchema.default(null),
});
export type InfluencerApplicationRejectionEntry = z.infer<
  typeof InfluencerApplicationRejectionEntrySchema
>;

export const InfluencerPostRejectionEntrySchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  comment: z.string(),
  rejectedAt: z.string().datetime(),
  campaignTitle: z.string(),
  rejectedBy: RejectedBySchema.default(null),
});
export type InfluencerPostRejectionEntry = z.infer<
  typeof InfluencerPostRejectionEntrySchema
>;

export const InfluencerNotesResponseSchema = z.object({
  memos: z.array(InfluencerMemoEntrySchema),
  /**
   * 반려 이력은 GET /influencers/:id/activity 로 옮겼다. 서버는 빈 배열만
   * 응답하며, 이 두 필드는 배포 갭 동안 구버전 admin-web 의 파싱을 위해서만
   * 남아 있다 — 다음 배포에서 관련 엔트리 스키마와 함께 제거한다.
   */
  applicationRejections: z.array(InfluencerApplicationRejectionEntrySchema),
  postRejections: z.array(InfluencerPostRejectionEntrySchema),
  flaggedAt: z.string().datetime().nullable(),
});
export type InfluencerNotesResponse = z.infer<
  typeof InfluencerNotesResponseSchema
>;

export const CreateInfluencerMemoRequestSchema = z.object({
  comment: z.string().min(1, "메모를 입력하세요").max(2000),
  campaignId: z.string().optional().nullable(),
});
export type CreateInfluencerMemoRequest = z.infer<
  typeof CreateInfluencerMemoRequestSchema
>;
