import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CampaignResponse,
  CreateCampaignRequest,
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

type CampaignRow = {
  id: string;
  title: string;
  rewardJpy: number;
  snsTypes: string[];
  condition: string;
  recruitCount: number;
  recruitStartAt: Date;
  recruitEndAt: Date;
  productSummary: string;
  productDetailUrl: string;
  guideline: string;
  referenceMediaUrls: string[];
  cautions: string;
  createdAt: Date;
  updatedAt: Date;
};

function toResponse(row: CampaignRow): CampaignResponse {
  return {
    id: row.id,
    title: row.title,
    rewardJpy: row.rewardJpy,
    snsTypes: row.snsTypes as CampaignResponse["snsTypes"],
    condition: row.condition,
    recruitCount: row.recruitCount,
    recruitStartDate: utcToJstDateStr(row.recruitStartAt),
    recruitEndDate: utcToJstDateStr(row.recruitEndAt),
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    productSummary: row.productSummary,
    productDetailUrl: row.productDetailUrl,
    guideline: row.guideline,
    referenceMediaUrls: row.referenceMediaUrls,
    cautions: row.cautions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCampaignRequest): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.create({
      data: {
        title: input.title,
        rewardJpy: input.rewardJpy,
        snsTypes: input.snsTypes,
        condition: input.condition,
        recruitCount: input.recruitCount,
        recruitStartAt: jstDayStartUtc(input.recruitStartDate),
        recruitEndAt: jstDayEndUtc(input.recruitEndDate),
        productSummary: input.productSummary,
        productDetailUrl: input.productDetailUrl,
        guideline: input.guideline,
        referenceMediaUrls: input.referenceMediaUrls,
        cautions: input.cautions,
      },
    });
    return toResponse(row);
  }

  async findById(id: string): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.findUnique({ where: { id } });
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
    if (input.snsTypes !== undefined) data.snsTypes = input.snsTypes;
    if (input.condition !== undefined) data.condition = input.condition;
    if (input.recruitCount !== undefined) data.recruitCount = input.recruitCount;
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

    const row = await this.prisma.campaign.update({ where: { id }, data });
    return toResponse(row);
  }
}
