import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AdminApplication, ApplicationStatus } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

type AdminApplicationRow = {
  id: string;
  status: ApplicationStatus;
  appliedAt: Date;
  reviewedAt: Date | null;
  rejectReason: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  campaign: { id: string; title: string };
  influencer: {
    id: string;
    name: string;
    email: string;
    snsAccounts: { snsType: string; handle: string; followerCount: number }[];
  };
};

function toResponse(row: AdminApplicationRow): AdminApplication {
  return {
    id: row.id,
    status: row.status,
    appliedAt: row.appliedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    rejectReason: row.rejectReason,
    trackingNumber: row.trackingNumber,
    shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    campaign: row.campaign,
    influencer: {
      id: row.influencer.id,
      name: row.influencer.name,
      email: row.influencer.email,
      snsAccounts: row.influencer.snsAccounts.map((s) => ({
        snsType: s.snsType as AdminApplication["influencer"]["snsAccounts"][number]["snsType"],
        handle: s.handle,
        followerCount: s.followerCount,
      })),
    },
  };
}

const APPLICATION_INCLUDE = {
  campaign: { select: { id: true, title: true } },
  influencer: {
    select: {
      id: true,
      name: true,
      email: true,
      snsAccounts: {
        select: { snsType: true, handle: true, followerCount: true },
        orderBy: { snsType: "asc" as const },
      },
    },
  },
} as const;

@Injectable()
export class AdminApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async fetch(id: string): Promise<AdminApplication> {
    const row = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: APPLICATION_INCLUDE,
    });
    if (!row) throw new NotFoundException("Application not found");
    return toResponse(row);
  }

  async approve(id: string, reviewerId: string): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPLIED") {
      throw new BadRequestException(
        `Cannot approve from status ${existing.status}`,
      );
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        rejectReason: null,
      },
    });
    return this.fetch(id);
  }

  async reject(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPLIED") {
      throw new BadRequestException(
        `Cannot reject from status ${existing.status}`,
      );
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        rejectReason: reason,
      },
    });
    return this.fetch(id);
  }

  async undo(id: string): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPROVED" && existing.status !== "REJECTED") {
      throw new BadRequestException(
        `Cannot undo from status ${existing.status}`,
      );
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "APPLIED",
        reviewedAt: null,
        reviewedById: null,
        rejectReason: null,
      },
    });
    return this.fetch(id);
  }

  async list(filters: {
    campaignId?: string;
    statuses?: ApplicationStatus[];
  }): Promise<AdminApplication[]> {
    const rows = await this.prisma.campaignApplication.findMany({
      where: {
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.statuses && filters.statuses.length > 0
          ? { status: { in: filters.statuses } }
          : {}),
      },
      orderBy: { appliedAt: "desc" },
      include: APPLICATION_INCLUDE,
    });
    return rows.map(toResponse);
  }
}
