import {
  UPLOAD_ALLOWED_CONTENT_TYPES,
  UPLOAD_MAX_BYTES,
  type UploadContentType,
} from "@jsure/shared";
import { api } from "./api";

export class RichTextImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RichTextImageUploadError";
  }
}

export type RichTextImageUploadResult = {
  objectKey: string;
  viewUrl: string;
};

export type RichTextImageUploadHandle = {
  /** File 기반 objectURL — 즉시 에디터 미리보기. */
  previewUrl: string;
  /** 업로드 완료 Promise. 성공 시 R2 objectKey/viewUrl 반환. */
  done: Promise<RichTextImageUploadResult>;
};

type PresignResponse = {
  objectKey: string;
  uploadUrl: string;
  viewUrl: string;
};

/**
 * 리치 텍스트 본문에 사용할 이미지를 R2 로 백그라운드 업로드.
 * presign 엔드포인트는 호출측이 지정 (e.g. /uploads/admin/notice-image/presign,
 * /uploads/admin/campaign-image/presign).
 */
export function startRichTextImageUpload(
  file: File,
  presignEndpoint: string,
): RichTextImageUploadHandle {
  if (!UPLOAD_ALLOWED_CONTENT_TYPES.includes(file.type as UploadContentType)) {
    throw new RichTextImageUploadError(
      "PNG, JPEG, WebP 형식만 업로드할 수 있습니다",
    );
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new RichTextImageUploadError(
      `파일 크기가 너무 큽니다 (${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)}MB 이하)`,
    );
  }
  const contentType = file.type as UploadContentType;
  const previewUrl = URL.createObjectURL(file);

  const done: Promise<RichTextImageUploadResult> = (async () => {
    const res = await api.post(presignEndpoint, {
      contentType,
      sizeBytes: file.size,
    });
    const presign = res.data as PresignResponse;
    const putRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!putRes.ok) {
      throw new RichTextImageUploadError(
        `업로드에 실패했습니다 (HTTP ${putRes.status})`,
      );
    }
    return { objectKey: presign.objectKey, viewUrl: presign.viewUrl };
  })();

  return { previewUrl, done };
}

/**
 * 에디터에서 사용한 src=blob URL + data-r2-key 형태를
 * 저장용 src="r2:<key>" 로 되돌리고 data-r2-key 속성은 제거.
 */
export function serializeRichTextHtml(html: string): string {
  return html.replace(
    /<img\b([^>]*)\bdata-r2-key="([^"]+)"([^>]*)>/g,
    (_match, before: string, key: string, after: string) => {
      const restored = `${before}${after}`.replace(
        /\bsrc="[^"]*"/,
        `src="r2:${key}"`,
      );
      return `<img${restored}>`;
    },
  );
}
