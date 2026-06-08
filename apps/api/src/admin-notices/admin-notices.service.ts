import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminNoticeListResponse,
  CreateNoticeRequest,
  NoticeResponse,
  UpdateNoticeRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeNoticeHtml } from "../common/sanitize-html";
import { UploadsService } from "../uploads/uploads.service";

type NoticeRow = {
  id: string;
  title: string;
  contentHtml: string;
  startAt: Date; endAt: Date;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string | null } | null;
};

@Injectable()
export class AdminNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  private async toResponse(row: NoticeRow): Promise<NoticeResponse> {
    return {
      id: row.id,
      title: row.title,
      contentHtml: await this.uploads.resolveR2ImagesInHtml(row.contentHtml),
      startAt: row.startAt.toISOString(), endAt: row.endAt.toISOString(),
      authorName: row.author?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(): Promise<AdminNoticeListResponse> {
    const [rows, total] = await Promise.all([
      this.prisma.notice.findMany({
        orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
        include: { author: { select: { name: true } } },
      }),
      this.prisma.notice.count(),
    ]);
    const items = await Promise.all(rows.map((notice) => this.toResponse(notice)));
    return { items, total };
  }

  async get(id: string): Promise<NoticeResponse> {
    const row = await this.prisma.notice.findUnique({
      where: { id },
      include: { author: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException("공지사항을 찾을 수 없습니다");
    return this.toResponse(row);
  }

  async create(
    authorId: string,
    input: CreateNoticeRequest,
  ): Promise<NoticeResponse> {
    const row = await this.prisma.notice.create({
      data: {
        title: input.title,
        contentHtml: sanitizeNoticeHtml(input.contentHtml),
        startAt: new Date(input.startAt), endAt: new Date(input.endAt),
        authorId,
      },
      include: { author: { select: { name: true } } },
    });
    return this.toResponse(row);
  }

  async update(
    id: string,
    input: UpdateNoticeRequest,
  ): Promise<NoticeResponse> {
    await this.ensureExists(id);
    const row = await this.prisma.notice.update({
      where: { id },
      data: {
        title: input.title,
        contentHtml: sanitizeNoticeHtml(input.contentHtml),
        startAt: new Date(input.startAt), endAt: new Date(input.endAt),
      },
      include: { author: { select: { name: true } } },
    });
    return this.toResponse(row);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.notice.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.notice.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("공지사항을 찾을 수 없습니다");
  }
}
