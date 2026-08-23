import {
  JwinMediaUploadPresignResponseSchema,
  JWIN_MEDIA_ALLOWED_CONTENT_TYPES,
  JWIN_MEDIA_MAX_BYTES,
  type JwinMediaContentType,
} from "@jsure/shared";
import { translate } from "@i18n/admin";
import { api } from "./api";
import { getStoredLanguage } from "./i18n";

export class JwinUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwinUploadError";
  }
}

function assertAllowed(file: File): JwinMediaContentType {
  const language = getStoredLanguage();
  if (!JWIN_MEDIA_ALLOWED_CONTENT_TYPES.includes(file.type as JwinMediaContentType)) {
    throw new JwinUploadError(translate("jwin.upload.invalidType", language));
  }
  if (file.size > JWIN_MEDIA_MAX_BYTES) {
    throw new JwinUploadError(
      translate("jwin.upload.tooLarge", language, {
        maxMb: (JWIN_MEDIA_MAX_BYTES / 1024 / 1024).toFixed(0),
      }),
    );
  }
  return file.type as JwinMediaContentType;
}

/**
 * J-WIN 포스트 미디어 업로드 (D-12: 대시보드 R2 재사용).
 *
 * presign → R2 로 직접 PUT → **만료 없는 공개 URL(viewUrl)** 반환.
 * jwin-api 가 게시 시각마다 이 URL 을 fetch 하므로 만료되는 uploadUrl 을 저장하면
 * 캠페인 후반 게시가 조용히 실패한다. 반드시 viewUrl 만 저장한다.
 */
export async function uploadJwinMedia(file: File): Promise<string> {
  const contentType = assertAllowed(file);

  const presignResponse = await api.post("/uploads/admin/jwin-media/presign", {
    contentType,
    sizeBytes: file.size,
  });
  const presign = JwinMediaUploadPresignResponseSchema.parse(presignResponse.data);

  const putResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new JwinUploadError(
      translate("jwin.upload.failedHttp", getStoredLanguage(), { status: putResponse.status }),
    );
  }

  return presign.viewUrl;
}
