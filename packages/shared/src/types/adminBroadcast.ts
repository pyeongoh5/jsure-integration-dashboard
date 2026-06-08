import { z } from "zod";

export const BroadcastMessageRequestSchema = z.object({
  /** 발송 대상 influencer.id 목록 (1명 이상). */
  influencerIds: z.array(z.string()).min(1, "수신자를 1명 이상 선택해 주세요"),
  /** tiptap HTML 본문. */
  contentHtml: z.string().min(1, "내용을 입력해 주세요").max(50000),
  /** Flex 알림 미리보기 텍스트. 비우면 본문에서 추출. */
  altText: z.string().max(400).optional(),
  /** Flex bubble hero 로 사용할 이미지의 R2 objectKey (선택). */
  heroImageR2Key: z.string().max(500).nullable().optional(),
});
export type BroadcastMessageRequest = z.infer<typeof BroadcastMessageRequestSchema>;

export const BroadcastJobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);
export type BroadcastJobStatus = z.infer<typeof BroadcastJobStatusSchema>;

export const BroadcastJobSchema = z.object({
  id: z.string(),
  status: BroadcastJobStatusSchema,
  total: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
});
export type BroadcastJob = z.infer<typeof BroadcastJobSchema>;

/** 발송 요청은 즉시 job row 만 만들고 응답. 실제 발송은 백그라운드에서 진행. */
export const BroadcastMessageResponseSchema = BroadcastJobSchema;
export type BroadcastMessageResponse = z.infer<typeof BroadcastMessageResponseSchema>;

export const BroadcastJobListResponseSchema = z.object({
  jobs: z.array(BroadcastJobSchema),
});
export type BroadcastJobListResponse = z.infer<typeof BroadcastJobListResponseSchema>;
