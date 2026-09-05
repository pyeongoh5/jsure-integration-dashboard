import {
  CampaignThumbnailUploadPresignResponseSchema,
  InsightUploadPresignResponseSchema,
  UPLOAD_ALLOWED_CONTENT_TYPES,
  UPLOAD_MAX_BYTES,
  type AdminInsightScreenshotPresignRequest,
  type CampaignThumbnailUploadPresignResponse,
  type CampaignSubType,
  type InsightAttachmentInput,
  type UploadContentType,
} from "@jsure/shared";
import { translate } from "@i18n/admin";
import { api } from "./api";
import { getStoredLanguage } from "./i18n";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

function assertAllowed(file: File): UploadContentType {
  const language = getStoredLanguage();
  if (!UPLOAD_ALLOWED_CONTENT_TYPES.includes(file.type as UploadContentType)) {
    throw new UploadError(translate("components.uploads.invalidImageType", language));
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new UploadError(
      translate("components.uploads.fileTooLarge", language, {
        maxMb: (UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0),
      }),
    );
  }
  return file.type as UploadContentType;
}

async function presignThumbnail(input: {
  contentType: UploadContentType;
  sizeBytes: number;
}): Promise<CampaignThumbnailUploadPresignResponse> {
  const res = await api.post("/uploads/admin/campaign-thumbnail/presign", input);
  return CampaignThumbnailUploadPresignResponseSchema.parse(res.data);
}

export type CampaignThumbnailUploadResult = {
  objectKey: string; // 저장용 (DB의 thumbnailUrl 필드에 그대로 저장)
  viewUrl: string; // 표시용 (presigned GET, 5분 만료)
};

/**
 * 캠페인 썸네일 업로드:
 *  1) presigned PUT URL + viewUrl 발급
 *  2) R2에 직접 PUT
 *  3) { objectKey, viewUrl } 반환 — objectKey는 저장, viewUrl은 즉시 미리보기
 *
 * 저장된 objectKey는 다음 응답부터 백엔드가 presigned GET URL로 변환해서
 * `thumbnailUrl`로 노출하므로 표시 흐름은 기존과 동일.
 */
export async function uploadCampaignThumbnail(
  file: File,
): Promise<CampaignThumbnailUploadResult> {
  const contentType = assertAllowed(file);
  const presign = await presignThumbnail({
    contentType,
    sizeBytes: file.size,
  });

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new UploadError(
      translate("components.uploads.uploadFailedHttp", getStoredLanguage(), {
        status: putRes.status,
      }),
    );
  }

  return { objectKey: presign.objectKey, viewUrl: presign.viewUrl };
}

/**
 * 인사이트 스크린샷 업로드(어드민 보정용):
 *  1) presigned PUT URL 발급 → 2) R2 에 직접 PUT
 *  3) 인사이트 수정 요청의 `addAttachments` 에 그대로 실어 보낼 메타데이터 반환
 */
export async function uploadInsightScreenshot(
  applicationId: string,
  subType: CampaignSubType,
  file: File,
): Promise<InsightAttachmentInput> {
  const contentType = assertAllowed(file);
  const request: AdminInsightScreenshotPresignRequest = {
    applicationId,
    subType,
    contentType,
    sizeBytes: file.size,
  };
  const res = await api.post("/uploads/admin/insight-screenshot/presign", request);
  const presign = InsightUploadPresignResponseSchema.parse(res.data);

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new UploadError(
      translate("components.uploads.uploadFailedHttp", getStoredLanguage(), {
        status: putRes.status,
      }),
    );
  }

  return { objectKey: presign.objectKey, contentType, sizeBytes: file.size };
}
