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

/**
 * 업로드 시작 시 즉시 사용 가능한 결과.
 * - previewUrl: 로컬 File 기반 objectURL (즉시 에디터 미리보기용)
 * - objectKey: 저장 직렬화에 사용할 R2 객체 키
 * - done: 실제 PUT 완료 Promise (실패 시 reject, 성공 시 R2 viewUrl 반환)
 */
export type NoticeImageUploadHandle = {
  previewUrl: string;
  objectKey: string;
  done: Promise<NoticeImageUploadResult>;
};

export function startNoticeImageUpload(file: File): NoticeImageUploadHandle {
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
  const previewUrl = URL.createObjectURL(file);

  // presign + PUT 을 백그라운드로 진행. objectKey 는 presign 응답이 와야 알 수
  // 있지만, 호출측에서는 done.then(...) 으로 받으면 되고, 직렬화에 사용할
  // dataR2Key 는 done 결과로 갱신한다.
  const done: Promise<NoticeImageUploadResult> = (async () => {
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
  })();

  return { previewUrl, objectKey: "", done };
}
