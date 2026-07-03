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
  type CampaignImageUploadPresignRequest,
  type CampaignImageUploadPresignResponse,
  type NoticeImageUploadPresignRequest,
  type NoticeImageUploadPresignResponse,
  type SubmittedPostAttachment as SharedAttachment,
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
      select: { influencerId: true, subType: true },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.influencerId !== influencerId) {
      throw new ForbiddenException();
    }
    if (application.subType !== body.subType) {
      throw new BadRequestException("応募のSNSと一致しません");
    }

    const objectKey =
      `insights/${body.applicationId}/${body.subType}/` +
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

  async presignNoticeImageUpload(
    body: NoticeImageUploadPresignRequest,
  ): Promise<NoticeImageUploadPresignResponse> {
    if (body.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException("파일 크기 한도를 초과했습니다");
    }
    const objectKey = `notices/${randomUUID()}.${extOf(body.contentType)}`;
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

  async presignCampaignImageUpload(
    body: CampaignImageUploadPresignRequest,
  ): Promise<CampaignImageUploadPresignResponse> {
    if (body.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException("파일 크기 한도를 초과했습니다");
    }
    const objectKey =
      `campaigns/rich/${randomUUID()}.${extOf(body.contentType)}`;
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
   * 본문 HTML 의 `<img src="r2:<objectKey>">` 를 presigned GET URL 로 치환.
   * 재편집/재저장 라운드트립을 위해 `data-r2-key` 속성으로 원본 key 를 보존한다.
   * 공지/캠페인 등 r2 객체 키를 임베드한 HTML 전반에 사용 가능.
   */
  async resolveR2ImagesInHtml(html: string): Promise<string> {
    const matches = Array.from(html.matchAll(/r2:([A-Za-z0-9/_.\-]+)/g));
    if (matches.length === 0) return html;
    const keys = Array.from(
      new Set(matches.map((match) => match[1]).filter((key): key is string => Boolean(key))),
    );
    const entries = await Promise.all(
      keys.map(async (key) => [key, await this.r2.presignGet(key, 300)] as const),
    );
    const map = new Map(entries);

    // 1) <img src="r2:KEY" ...> → <img src="<presigned>" data-r2-key="KEY" ...>
    let out = html.replace(
      /<img\b([^>]*)\bsrc="r2:([A-Za-z0-9/_.\-]+)"([^>]*)>/g,
      (_full, before: string, key: string, after: string) => {
        const url = map.get(key);
        if (!url) return _full;
        return `<img${before} src="${url}" data-r2-key="${key}"${after}>`;
      },
    );
    // 2) <img> 밖에 있는 그대로의 r2:KEY 토큰 (anchor href 등) 도 치환
    out = out.replace(/r2:([A-Za-z0-9/_.\-]+)/g, (full, key: string) =>
      map.get(key) ?? full,
    );
    return out;
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

    const post = await this.prisma.submittedPost.findUnique({
      where: { id: postId },
      select: { applicationId: true },
    });
    if (!post) throw new NotFoundException("Post not found");
    await this.prisma.attachment.createMany({
      data: attachments.map((attachment) => ({
        kind: "INSIGHT_SCREENSHOT" as const,
        applicationId: post.applicationId,
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
    const rows = await this.prisma.attachment.findMany({
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
