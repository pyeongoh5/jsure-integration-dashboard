import {
  AdminNoticeListResponseSchema,
  NoticeImageUploadPresignResponseSchema,
  NoticeResponseSchema,
  UPLOAD_ALLOWED_CONTENT_TYPES,
  UPLOAD_MAX_BYTES,
  type AdminNoticeListResponse,
  type CreateNoticeRequest,
  type NoticeImageUploadPresignResponse,
  type NoticeResponse,
  type UpdateNoticeRequest,
  type UploadContentType,
} from "@jsure/shared";
import { api } from "./api";

export async function listNotices(): Promise<AdminNoticeListResponse> {
  const res = await api.get("/admin/notices");
  return AdminNoticeListResponseSchema.parse(res.data);
}

export async function getNotice(id: string): Promise<NoticeResponse> {
  const res = await api.get(`/admin/notices/${encodeURIComponent(id)}`);
  return NoticeResponseSchema.parse(res.data);
}

export async function createNotice(
  input: CreateNoticeRequest,
): Promise<NoticeResponse> {
  const res = await api.post("/admin/notices", input);
  return NoticeResponseSchema.parse(res.data);
}

export async function updateNotice(
  id: string,
  input: UpdateNoticeRequest,
): Promise<NoticeResponse> {
  const res = await api.put(`/admin/notices/${encodeURIComponent(id)}`, input);
  return NoticeResponseSchema.parse(res.data);
}

export async function deleteNotice(id: string): Promise<void> {
  await api.delete(`/admin/notices/${encodeURIComponent(id)}`);
}

export class NoticeImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoticeImageUploadError";
  }
}

async function presignNoticeImage(input: {
  contentType: UploadContentType;
  sizeBytes: number;
}): Promise<NoticeImageUploadPresignResponse> {
  const res = await api.post("/uploads/admin/notice-image/presign", input);
  return NoticeImageUploadPresignResponseSchema.parse(res.data);
}

export type NoticeImageUploadResult = {
  objectKey: string;
  viewUrl: string;
};

export async function uploadNoticeImage(
  file: File,
): Promise<NoticeImageUploadResult> {
  if (!UPLOAD_ALLOWED_CONTENT_TYPES.includes(file.type as UploadContentType)) {
    throw new NoticeImageUploadError(
      "PNG, JPEG, WebP 형식만 업로드할 수 있습니다",
    );
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new NoticeImageUploadError(
      `파일 크기가 너무 큽니다 (${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)}MB 이하)`,
    );
  }
  const contentType = file.type as UploadContentType;
  const presign = await presignNoticeImage({
    contentType,
    sizeBytes: file.size,
  });
  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new NoticeImageUploadError(
      `업로드에 실패했습니다 (HTTP ${putRes.status})`,
    );
  }
  return { objectKey: presign.objectKey, viewUrl: presign.viewUrl };
}
