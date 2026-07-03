import {
  InsightUploadPresignResponseSchema,
  UPLOAD_ALLOWED_CONTENT_TYPES,
  UPLOAD_MAX_BYTES,
  type InsightAttachmentInput,
  type InsightUploadPresignResponse,
  type UploadContentType,
} from "@jsure/shared";
import { api } from "../api";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

function assertAllowed(file: File): UploadContentType {
  if (!UPLOAD_ALLOWED_CONTENT_TYPES.includes(file.type as UploadContentType)) {
    throw new UploadError("PNG, JPEG, WebP 형식만 업로드할 수 있습니다");
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new UploadError(
      `파일 크기가 너무 큽니다 (${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)}MB 이하)`,
    );
  }
  return file.type as UploadContentType;
}

async function presignInsight(input: {
  applicationId: string;
  subType: "INSTAGRAM" | "TIKTOK" | "X" | "YOUTUBE";
  contentType: UploadContentType;
  sizeBytes: number;
}): Promise<InsightUploadPresignResponse> {
  const res = await api.post("/uploads/insight/presign", input);
  return InsightUploadPresignResponseSchema.parse(res.data);
}

/**
 * 인사이트 첨부 이미지 업로드:
 *  1) NestJS에서 presigned PUT URL 발급
 *  2) R2에 직접 PUT
 *  3) 인사이트 제출 API에 함께 보낼 attachment 메타데이터 반환
 */
export async function uploadInsightImage(
  applicationId: string,
  subType: "INSTAGRAM" | "TIKTOK" | "X" | "YOUTUBE",
  file: File,
): Promise<InsightAttachmentInput> {
  const contentType = assertAllowed(file);
  const presign = await presignInsight({
    applicationId,
    subType,
    contentType,
    sizeBytes: file.size,
  });

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new UploadError(`업로드에 실패했습니다 (HTTP ${putRes.status})`);
  }

  return {
    objectKey: presign.objectKey,
    contentType,
    sizeBytes: file.size,
  };
}
