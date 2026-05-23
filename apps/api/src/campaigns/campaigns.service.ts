import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CampaignResponse,
  CreateCampaignRequest,
  SnsRecruit,
  UpdateCampaignRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

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
  condition: string;
  recruitCount: number;
};

type CampaignRow = {
  id: string;
  title: string;
  rewardJpy: number;
  recruitStartAt: Date;
  recruitEndAt: Date;
  closedAt: Date | null;
  productSummary: string;
  productDetailUrl: string;
  guideline: string;
  referenceMediaUrls: string[];
  cautions: string;
  thumbnailUrl: string | null;
  brandName: string | null;
  brandTagline: string | null;
  minFollowers: number | null;
  createdAt: Date;
  updatedAt: Date;
  snsRecruits: SnsRecruitRow[];
};

function toResponse(row: CampaignRow): CampaignResponse {
  return {
    id: row.id,
    title: row.title,
    rewardJpy: row.rewardJpy,
    snsRecruits: row.snsRecruits.map((r) => ({
      snsType: r.snsType as SnsRecruit["snsType"],
      condition: r.condition,
      recruitCount: r.recruitCount,
    })),
    recruitStartDate: utcToJstDateStr(row.recruitStartAt),
    recruitEndDate: utcToJstDateStr(row.recruitEndAt),
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    productSummary: row.productSummary,
    productDetailUrl: row.productDetailUrl,
    guideline: row.guideline,
    referenceMediaUrls: row.referenceMediaUrls,
    cautions: row.cautions,
    thumbnailUrl: row.thumbnailUrl,
    brandName: row.brandName,
    brandTagline: row.brandTagline,
    minFollowers: row.minFollowers,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const RECRUITS_INCLUDE = {
  snsRecruits: {
    select: { snsType: true, condition: true, recruitCount: true },
    orderBy: { snsType: "asc" as const },
  },
} as const;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCampaignRequest): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.create({
      data: {
        title: input.title,
        rewardJpy: input.rewardJpy,
        recruitStartAt: jstDayStartUtc(input.recruitStartDate),
        recruitEndAt: jstDayEndUtc(input.recruitEndDate),
        productSummary: input.productSummary,
        productDetailUrl: input.productDetailUrl,
        guideline: input.guideline,
        referenceMediaUrls: input.referenceMediaUrls,
        cautions: input.cautions,
        thumbnailUrl: input.thumbnailUrl ?? null,
        brandName: input.brandName ?? null,
        brandTagline: input.brandTagline ?? null,
        minFollowers: input.minFollowers ?? null,
        snsRecruits: {
          create: input.snsRecruits.map((r) => ({
            snsType: r.snsType,
            condition: r.condition,
            recruitCount: r.recruitCount,
          })),
        },
      },
      include: RECRUITS_INCLUDE,
    });
    return toResponse(row);
  }

  async findById(id: string): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.findUnique({
      where: { id },
      include: RECRUITS_INCLUDE,
    });
    if (!row) throw new NotFoundException("Campaign not found");
    return toResponse(row);
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
    if (input.productSummary !== undefined) data.productSummary = input.productSummary;
    if (input.productDetailUrl !== undefined) data.productDetailUrl = input.productDetailUrl;
    if (input.guideline !== undefined) data.guideline = input.guideline;
    if (input.referenceMediaUrls !== undefined) data.referenceMediaUrls = input.referenceMediaUrls;
    if (input.cautions !== undefined) data.cautions = input.cautions;
    if (input.thumbnailUrl !== undefined) data.thumbnailUrl = input.thumbnailUrl;
    if (input.brandName !== undefined) data.brandName = input.brandName;
    if (input.brandTagline !== undefined) data.brandTagline = input.brandTagline;
    if (input.minFollowers !== undefined) data.minFollowers = input.minFollowers;

    // snsRecruits is a full-replace operation when provided.
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.snsRecruits !== undefined) {
        await tx.campaignSnsRecruit.deleteMany({ where: { campaignId: id } });
        await tx.campaignSnsRecruit.createMany({
          data: input.snsRecruits.map((r) => ({
            campaignId: id,
            snsType: r.snsType,
            condition: r.condition,
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
    return toResponse(row);
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
    return toResponse(row);
  }
}
