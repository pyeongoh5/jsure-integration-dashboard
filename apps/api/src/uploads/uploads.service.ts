import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  UPLOAD_MAX_BYTES,
  type CampaignThumbnailUploadPresignRequest,
  type CampaignThumbnailUploadPresignResponse,
  type InsightAttachmentInput,
  type InsightUploadPresignRequest,
  type InsightUploadPresignResponse,
  type SubmittedPostAttachment as SharedAttachment,
  type SnsType,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { R2Service } from "../r2/r2.service";

const PRESIGN_EXPIRES_SEC = 300;
const VIEW_EXPIRES_SEC = 300;

function extOf(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async presignInsightUpload(
    influencerId: string,
    body: InsightUploadPresignRequest,
  ): Promise<InsightUploadPresignResponse> {
    if (body.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException("파일 크기 한도를 초과했습니다");
    }
    const application = await this.prisma.campaignApplication.findUnique({
      where: { id: body.applicationId },
      select: { influencerId: true, snsType: true },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.influencerId !== influencerId) {
      throw new ForbiddenException();
    }
    if (application.snsType !== body.snsType) {
      throw new BadRequestException("応募のSNSと一致しません");
    }

    const objectKey =
      `insights/${body.applicationId}/${body.snsType}/` +
      `${randomUUID()}.${extOf(body.contentType)}`;

    const uploadUrl = await this.r2.presignPut(
      {
        objectKey,
        contentType: body.contentType,
        contentLength: body.sizeBytes,
      },
      PRESIGN_EXPIRES_SEC,
    );

    return { objectKey, uploadUrl, expiresInSec: PRESIGN_EXPIRES_SEC };
  }

  async presignCampaignThumbnailUpload(
    body: CampaignThumbnailUploadPresignRequest,
  ): Promise<CampaignThumbnailUploadPresignResponse> {
    if (body.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException("파일 크기 한도를 초과했습니다");
    }
    const objectKey = `campaigns/${randomUUID()}.${extOf(body.contentType)}`;
    const [uploadUrl, viewUrl] = await Promise.all([
      this.r2.presignPut(
        {
          objectKey,
          contentType: body.contentType,
          contentLength: body.sizeBytes,
        },
        PRESIGN_EXPIRES_SEC,
      ),
      this.r2.presignGet(objectKey, VIEW_EXPIRES_SEC),
    ]);
    return { objectKey, uploadUrl, viewUrl, expiresInSec: PRESIGN_EXPIRES_SEC };
  }

  /**
   * 캠페인 응답에서 썸네일 키를 presigned GET URL로 변환.
   * - 외부 URL이거나 빈 값이면 그대로 반환
   * - R2 객체 키(`campaigns/...`)면 5분짜리 presigned GET 발급
   */
  async resolveCampaignThumbnailUrl(
    raw: string | null,
  ): Promise<string | null> {
    if (!raw) return null;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return this.r2.presignGet(raw, 300);
  }

  /**
   * 인사이트 제출 시 첨부 키 목록을 받아 검증 후 DB에 attachment row 생성.
   * postId는 인사이트 저장된 직후의 SubmittedPost.id.
   */
  async attachInsightUploads(
    postId: string,
    attachments: InsightAttachmentInput[],
  ): Promise<void> {
    if (attachments.length === 0) return;

    for (const attachment of attachments) {
      if (!attachment.objectKey.startsWith("insights/")) {
        throw new BadRequestException("잘못된 객체 경로입니다");
      }
      const head = await this.r2.headObject(attachment.objectKey).catch(() => null);
      if (!head) {
        throw new BadRequestException(
          `업로드 객체를 찾을 수 없습니다: ${attachment.objectKey}`,
        );
      }
      if (head.contentLength !== null && head.contentLength > UPLOAD_MAX_BYTES) {
        throw new BadRequestException("파일 크기 한도를 초과했습니다");
      }
    }

    await this.prisma.submittedPostAttachment.createMany({
      data: attachments.map((attachment) => ({
        postId,
        objectKey: attachment.objectKey,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * admin 조회용 — DB에 저장된 attachment를 presigned GET URL과 함께 반환.
   */
  async listAttachmentsForPost(postId: string): Promise<SharedAttachment[]> {
    const rows = await this.prisma.submittedPostAttachment.findMany({
      where: { postId },
      orderBy: { uploadedAt: "asc" },
    });
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        objectKey: row.objectKey,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        uploadedAt: row.uploadedAt.toISOString(),
        viewUrl: await this.r2.presignGet(row.objectKey, VIEW_EXPIRES_SEC),
      })),
    );
  }
}
