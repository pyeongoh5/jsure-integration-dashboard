import { z } from "zod";

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const UPLOAD_ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const UploadContentTypeSchema = z.enum(UPLOAD_ALLOWED_CONTENT_TYPES);
export type UploadContentType = z.infer<typeof UploadContentTypeSchema>;

/**
 * 인플루언서가 인사이트 첨부 이미지를 업로드하기 전에 호출.
 * 서버는 R2 presigned PUT URL을 발급.
 */
export const InsightUploadPresignRequestSchema = z.object({
  applicationId: z.string().min(1),
  snsType: z.enum(["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"]),
  contentType: UploadContentTypeSchema,
  sizeBytes: z.number().int().positive().max(UPLOAD_MAX_BYTES),
});
export type InsightUploadPresignRequest = z.infer<
  typeof InsightUploadPresignRequestSchema
>;

export const InsightUploadPresignResponseSchema = z.object({
  objectKey: z.string(),
  uploadUrl: z.string().url(),
  expiresInSec: z.number().int().positive(),
});
export type InsightUploadPresignResponse = z.infer<
  typeof InsightUploadPresignResponseSchema
>;

/**
 * 업로드 성공 후, 인사이트 제출 시 본문에 첨부 메타데이터를 함께 전달.
 * 서버는 R2에 실제 업로드됐는지 HEAD로 검증 후 attachment row 생성.
 */
export const InsightAttachmentInputSchema = z.object({
  objectKey: z.string().min(1),
  contentType: UploadContentTypeSchema,
  sizeBytes: z.number().int().positive().max(UPLOAD_MAX_BYTES),
});
export type InsightAttachmentInput = z.infer<
  typeof InsightAttachmentInputSchema
>;

/**
 * admin이 캠페인 썸네일 업로드 전에 호출.
 */
export const CampaignThumbnailUploadPresignRequestSchema = z.object({
  contentType: UploadContentTypeSchema,
  sizeBytes: z.number().int().positive().max(UPLOAD_MAX_BYTES),
});
export type CampaignThumbnailUploadPresignRequest = z.infer<
  typeof CampaignThumbnailUploadPresignRequestSchema
>;

export const CampaignThumbnailUploadPresignResponseSchema = z.object({
  objectKey: z.string(),
  uploadUrl: z.string().url(),
  viewUrl: z.string().url(),
  expiresInSec: z.number().int().positive(),
});
export type CampaignThumbnailUploadPresignResponse = z.infer<
  typeof CampaignThumbnailUploadPresignResponseSchema
>;

/**
 * admin 조회용 — viewUrl은 presigned GET URL (단기 만료)
 */
export const SubmittedPostAttachmentSchema = z.object({
  id: z.string(),
  objectKey: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.string().datetime(),
  viewUrl: z.string().url(),
});
export type SubmittedPostAttachment = z.infer<
  typeof SubmittedPostAttachmentSchema
>;
