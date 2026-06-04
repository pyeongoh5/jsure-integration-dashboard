import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  InfluencerNoticeDetail,
  InfluencerNoticeListResponse,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";

@Injectable()
export class InfluencerNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async list(): Promise<InfluencerNoticeListResponse> {
    const rows = await this.prisma.notice.findMany({
      where: { publishedAt: { lte: new Date() } },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, publishedAt: true },
    });
    return {
      items: rows.map((notice) => ({
        id: notice.id,
        title: notice.title,
        publishedAt: notice.publishedAt.toISOString(),
      })),
    };
  }

  async get(id: string): Promise<InfluencerNoticeDetail> {
    const notice = await this.prisma.notice.findFirst({
      where: { id, publishedAt: { lte: new Date() } },
      select: {
        id: true,
        title: true,
        contentHtml: true,
        publishedAt: true,
      },
    });
    if (!notice) throw new NotFoundException("공지사항을 찾을 수 없습니다");
    return {
      id: notice.id,
      title: notice.title,
      contentHtml: await this.uploads.resolveNoticeImageUrls(notice.contentHtml),
      publishedAt: notice.publishedAt.toISOString(),
    };
  }
}
