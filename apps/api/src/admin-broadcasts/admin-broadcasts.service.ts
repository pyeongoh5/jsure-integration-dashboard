import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { BroadcastJob, BroadcastMessageRequest } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { UploadsService } from "../uploads/uploads.service";
import { htmlToAltText, htmlToFlexBubble } from "./htmlToFlex";

type JobRow = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
};

const MULTICAST_CHUNK = 500;

function toResponse(row: JobRow): BroadcastJob {
  return {
    id: row.id,
    status: row.status,
    total: row.total,
    sent: row.sent,
    failed: row.failed,
    skipped: row.skipped,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    errorMessage: row.errorMessage,
  };
}

@Injectable()
export class AdminBroadcastsService {
  private readonly logger = new Logger(AdminBroadcastsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * 발송 요청 즉시 job row 생성, 백그라운드 실행 kick-off, job 응답.
   */
  async createBroadcast(
    input: BroadcastMessageRequest,
    creatorId: string,
  ): Promise<BroadcastJob> {
    const job = await this.prisma.broadcastJob.create({
      data: {
        status: "QUEUED",
        total: input.influencerIds.length,
        contentHtml: input.contentHtml,
        heroImageR2Key: input.heroImageR2Key ?? null,
        altText: input.altText ?? null,
        influencerIds: input.influencerIds,
        createdById: creatorId,
      },
    });

    // 백그라운드 실행. await 하지 않고 응답.
    setImmediate(() => {
      this.runJob(job.id).catch((err) => {
        this.logger.error(`broadcast job ${job.id} crashed`, err as Error);
      });
    });

    return toResponse(job);
  }

  async findById(id: string): Promise<BroadcastJob> {
    const row = await this.prisma.broadcastJob.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Broadcast job not found");
    return toResponse(row);
  }

  async listRecent(limit = 20): Promise<BroadcastJob[]> {
    const rows = await this.prisma.broadcastJob.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((row) => toResponse(row));
  }

  /** 실제 발송 루프. chunk 마다 카운터 업데이트. */
  private async runJob(jobId: string): Promise<void> {
    const job = await this.prisma.broadcastJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      // 1) lineUserId 조회 + skipped 카운트 확정
      const rows = await this.prisma.influencer.findMany({
        where: { id: { in: job.influencerIds } },
        select: { id: true, lineUserId: true },
      });
      const lineUserIds = rows
        .map((row) => row.lineUserId)
        .filter((id): id is string => Boolean(id));
      const skipped = job.influencerIds.length - lineUserIds.length;

      await this.prisma.broadcastJob.update({
        where: { id: jobId },
        data: { skipped },
      });

      if (lineUserIds.length === 0) {
        await this.prisma.broadcastJob.update({
          where: { id: jobId },
          data: { status: "COMPLETED", finishedAt: new Date() },
        });
        return;
      }

      // 2) 본문 r2:KEY → presigned URL + hero 이미지 resolve
      const resolvedHtml = await this.uploads.resolveR2ImagesInHtml(
        job.contentHtml,
      );
      const heroUrl = job.heroImageR2Key
        ? await this.uploads
            .resolveR2ImagesInHtml(`<img src="r2:${job.heroImageR2Key}">`)
            .then((html) => {
              const match = /src="([^"]+)"/.exec(html);
              return match ? match[1] : null;
            })
        : null;

      const bubble = htmlToFlexBubble(resolvedHtml, heroUrl);
      const altText = job.altText?.trim() || htmlToAltText(resolvedHtml);
      const messages = [
        { type: "flex" as const, altText, contents: bubble },
      ];

      // 3) 500명씩 chunk + 매 chunk 마다 진행률 업데이트
      let sent = 0;
      let failed = 0;
      for (let i = 0; i < lineUserIds.length; i += MULTICAST_CHUNK) {
        const chunk = lineUserIds.slice(i, i + MULTICAST_CHUNK);
        const result = await this.line.multicast(chunk, messages);
        sent += result.sent;
        failed += result.failed;
        await this.prisma.broadcastJob.update({
          where: { id: jobId },
          data: { sent, failed },
        });
      }

      await this.prisma.broadcastJob.update({
        where: { id: jobId },
        data: { status: "COMPLETED", finishedAt: new Date() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`broadcast job ${jobId} failed: ${message}`);
      await this.prisma.broadcastJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: message.slice(0, 1000),
          finishedAt: new Date(),
        },
      });
    }
  }
}
