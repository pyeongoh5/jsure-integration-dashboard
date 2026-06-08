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

  /** 현재 게시 기간(startAt ≤ now < endAt) 안에 있는 공지만 반환. */
  async list(): Promise<InfluencerNoticeListResponse> {
    const now = new Date();
    const rows = await this.prisma.notice.findMany({
      where: { startAt: { lte: now }, endAt: { gt: now } },
      orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, startAt: true, endAt: true },
    });
    return {
      items: rows.map((notice) => ({
        id: notice.id,
        title: notice.title,
        startAt: notice.startAt.toISOString(),
        endAt: notice.endAt.toISOString(),
      })),
    };
  }

  async get(id: string): Promise<InfluencerNoticeDetail> {
    const now = new Date();
    const notice = await this.prisma.notice.findFirst({
      where: { id, startAt: { lte: now }, endAt: { gt: now } },
      select: {
        id: true,
        title: true,
        contentHtml: true,
        startAt: true,
        endAt: true,
      },
    });
    if (!notice) throw new NotFoundException("공지사항을 찾을 수 없습니다");
    return {
      id: notice.id,
      title: notice.title,
      contentHtml: await this.uploads.resolveR2ImagesInHtml(notice.contentHtml),
      startAt: notice.startAt.toISOString(),
      endAt: notice.endAt.toISOString(),
    };
  }
}
