import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ApplicationStatus,
  CampaignResponse,
  CreateCampaignRequest,
  SnsRecruit,
  UpdateCampaignRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";

export function jstDayStartUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}

export function jstDayEndUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59+09:00`);
}

export function utcToJstDateStr(d: Date): string {
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

type SnsRecruitRow = {
  snsType: string;
  minFollowers: number;
  recruitCount: number;
};

type CampaignRow = {
  id: string;
  title: string;
  rewardJpy: number;
  recruitStartAt: Date;
  recruitEndAt: Date;
  closedAt: Date | null;
  postingPeriodDays: number;
  productSummary: string;
  productDetailUrl: string;
  guideline: string;
  referenceMediaUrls: string[];
  cautions: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  snsRecruits: SnsRecruitRow[];
};

type CampaignCounts = { approvedCount: number; appliedCount: number };

const EMPTY_COUNTS: CampaignCounts = { approvedCount: 0, appliedCount: 0 };

// "모집된 인원"은 응모 후 승인된 시점부터 카운트. 발송/배송/완료 상태도
// 이미 승인을 거친 인원이므로 포함. REJECTED/CANCELLED는 제외.
// "응모한 인원"은 아직 검토 전(APPLIED)만 카운트.
const APPROVED_LIKE_STATUSES: ApplicationStatus[] = [
  "APPROVED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
];

function toResponse(row: CampaignRow, counts: CampaignCounts): CampaignResponse {
  return {
    id: row.id,
    title: row.title,
    rewardJpy: row.rewardJpy,
    snsRecruits: row.snsRecruits.map((r) => ({
      snsType: r.snsType as SnsRecruit["snsType"],
      minFollowers: r.minFollowers,
      recruitCount: r.recruitCount,
    })),
    recruitStartDate: utcToJstDateStr(row.recruitStartAt),
    recruitEndDate: utcToJstDateStr(row.recruitEndAt),
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    postingPeriodDays: row.postingPeriodDays,
    productSummary: row.productSummary,
    productDetailUrl: row.productDetailUrl,
    guideline: row.guideline,
    referenceMediaUrls: row.referenceMediaUrls,
    cautions: row.cautions,
    thumbnailUrl: row.thumbnailUrl,
    approvedCount: counts.approvedCount,
    appliedCount: counts.appliedCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const RECRUITS_INCLUDE = {
  snsRecruits: {
    select: { snsType: true, minFollowers: true, recruitCount: true },
    orderBy: { snsType: "asc" as const },
  },
} as const;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  private async withResolvedThumbnail(
    response: CampaignResponse,
  ): Promise<CampaignResponse> {
    response.thumbnailUrl = await this.uploads.resolveCampaignThumbnailUrl(
      response.thumbnailUrl,
    );
    return response;
  }

  /**
   * 본문 (productSummary/guideline/cautions) 안의 r2: 이미지 키를
   * presigned URL 로 치환하고 data-r2-key 속성으로 보존.
   * 어드민 폼 재편집 시 round-trip 가능.
   */
  private async withResolved(
    response: CampaignResponse,
  ): Promise<CampaignResponse> {
    await this.withResolvedThumbnail(response);
    await this.withResolvedRich(response);
    return response;
  }

  private async withResolvedRich(
    response: CampaignResponse,
  ): Promise<CampaignResponse> {
    const [productSummary, guideline, cautions] = await Promise.all([
      this.uploads.resolveR2ImagesInHtml(response.productSummary),
      this.uploads.resolveR2ImagesInHtml(response.guideline),
      this.uploads.resolveR2ImagesInHtml(response.cautions),
    ]);
    response.productSummary = productSummary;
    response.guideline = guideline;
    response.cautions = cautions;
    return response;
  }

  private async loadCounts(
    campaignIds: string[],
  ): Promise<Map<string, CampaignCounts>> {
    const map = new Map<string, CampaignCounts>();
    if (campaignIds.length === 0) return map;
    for (const id of campaignIds) {
      map.set(id, { approvedCount: 0, appliedCount: 0 });
    }
    const grouped = await this.prisma.campaignApplication.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    });
    for (const g of grouped) {
      const entry = map.get(g.campaignId);
      if (!entry) continue;
      const status = g.status as ApplicationStatus;
      if (APPROVED_LIKE_STATUSES.includes(status)) {
        entry.approvedCount += g._count._all;
      } else if (status === "APPLIED") {
        entry.appliedCount += g._count._all;
      }
    }
    return map;
  }

  private async countsFor(id: string): Promise<CampaignCounts> {
    const map = await this.loadCounts([id]);
    return map.get(id) ?? EMPTY_COUNTS;
  }

  async create(input: CreateCampaignRequest): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.create({
      data: {
        title: input.title,
        rewardJpy: input.rewardJpy,
        recruitStartAt: jstDayStartUtc(input.recruitStartDate),
        recruitEndAt: jstDayEndUtc(input.recruitEndDate),
        postingPeriodDays: input.postingPeriodDays,
        productSummary: input.productSummary,
        productDetailUrl: input.productDetailUrl,
        guideline: input.guideline,
        referenceMediaUrls: input.referenceMediaUrls,
        cautions: input.cautions,
        thumbnailUrl: input.thumbnailUrl ?? null,
        snsRecruits: {
          create: input.snsRecruits.map((r) => ({
            snsType: r.snsType,
            minFollowers: r.minFollowers,
            recruitCount: r.recruitCount,
          })),
        },
      },
      include: RECRUITS_INCLUDE,
    });
    return this.withResolved(toResponse(row, EMPTY_COUNTS));
  }

  async findAll(): Promise<CampaignResponse[]> {
    const rows = await this.prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: RECRUITS_INCLUDE,
    });
    const counts = await this.loadCounts(rows.map((r) => r.id));
    return Promise.all(
      rows.map((row) =>
        this.withResolved(
          toResponse(row, counts.get(row.id) ?? EMPTY_COUNTS),
        ),
      ),
    );
  }

  async findById(id: string): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.findUnique({
      where: { id },
      include: RECRUITS_INCLUDE,
    });
    if (!row) throw new NotFoundException("Campaign not found");
    return this.withResolved(
      toResponse(row, await this.countsFor(id)),
    );
  }

  async update(
    id: string,
    input: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Campaign not found");

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.rewardJpy !== undefined) data.rewardJpy = input.rewardJpy;
    if (input.recruitStartDate !== undefined) {
      data.recruitStartAt = jstDayStartUtc(input.recruitStartDate);
    }
    if (input.recruitEndDate !== undefined) {
      data.recruitEndAt = jstDayEndUtc(input.recruitEndDate);
    }
    if (input.postingPeriodDays !== undefined) {
      data.postingPeriodDays = input.postingPeriodDays;
    }
    if (input.productSummary !== undefined) data.productSummary = input.productSummary;
    if (input.productDetailUrl !== undefined) data.productDetailUrl = input.productDetailUrl;
    if (input.guideline !== undefined) data.guideline = input.guideline;
    if (input.referenceMediaUrls !== undefined) data.referenceMediaUrls = input.referenceMediaUrls;
    if (input.cautions !== undefined) data.cautions = input.cautions;
    if (input.thumbnailUrl !== undefined) data.thumbnailUrl = input.thumbnailUrl;

    // snsRecruits is a full-replace operation when provided.
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.snsRecruits !== undefined) {
        await tx.campaignSnsRecruit.deleteMany({ where: { campaignId: id } });
        await tx.campaignSnsRecruit.createMany({
          data: input.snsRecruits.map((r) => ({
            campaignId: id,
            snsType: r.snsType,
            minFollowers: r.minFollowers,
            recruitCount: r.recruitCount,
          })),
        });
      }
      return tx.campaign.update({
        where: { id },
        data,
        include: RECRUITS_INCLUDE,
      });
    });
    return this.withResolved(
      toResponse(row, await this.countsFor(id)),
    );
  }

  async close(id: string): Promise<CampaignResponse> {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Campaign not found");
    if (existing.closedAt) {
      throw new ConflictException("Campaign already closed");
    }
    const row = await this.prisma.campaign.update({
      where: { id },
      data: { closedAt: new Date() },
      include: RECRUITS_INCLUDE,
    });
    return this.withResolved(
      toResponse(row, await this.countsFor(id)),
    );
  }
}
