import {
  JwinMediaUploadPresignResponseSchema,
  JWIN_MEDIA_ALLOWED_CONTENT_TYPES,
  JWIN_MEDIA_MAX_BYTES,
  type JwinMediaContentType,
} from "@jsure/shared";
import { MEDIA_FORMAT_CONTENT_TYPES, sniffMediaFormat } from "@jsure/jwin-shared";
import { translate } from "@i18n/admin";
import { api } from "./api";
import { getStoredLanguage } from "./i18n";

export class JwinUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwinUploadError";
  }
}

/**
 * File.type 은 확장자로 추정한 값이라 믿을 수 없다 — AVIF 를 .png 로 올리면
 * image/png 으로 통과해 게시 시점에야 X 가 거부한다(운영 실측). 그래서
 * 실제 파일 앞 바이트(매직 바이트)로 포맷을 판별해 contentType 을 정한다.
 */
async function assertAllowed(file: File): Promise<JwinMediaContentType> {
  const language = getStoredLanguage();
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const format = sniffMediaFormat(head);
  const contentType = format === "unknown" ? null : MEDIA_FORMAT_CONTENT_TYPES[format];
  if (
    !contentType ||
    !JWIN_MEDIA_ALLOWED_CONTENT_TYPES.includes(contentType as JwinMediaContentType)
  ) {
    throw new JwinUploadError(translate("jwin.upload.invalidType", language));
  }
  if (file.size > JWIN_MEDIA_MAX_BYTES) {
    throw new JwinUploadError(
      translate("jwin.upload.tooLarge", language, {
        maxMb: (JWIN_MEDIA_MAX_BYTES / 1024 / 1024).toFixed(0),
      }),
    );
  }
  return contentType as JwinMediaContentType;
}

/**
 * J-WIN 포스트 미디어 업로드 (D-12: 대시보드 R2 재사용).
 *
 * presign → R2 로 직접 PUT → **만료 없는 공개 URL(viewUrl)** 반환.
 * jwin-api 가 게시 시각마다 이 URL 을 fetch 하므로 만료되는 uploadUrl 을 저장하면
 * 캠페인 후반 게시가 조용히 실패한다. 반드시 viewUrl 만 저장한다.
 */
export async function uploadJwinMedia(file: File): Promise<string> {
  const contentType = await assertAllowed(file);

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
