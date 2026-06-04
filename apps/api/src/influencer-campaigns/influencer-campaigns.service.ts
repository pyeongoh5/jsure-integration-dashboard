import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  InfluencerCampaignCard,
  InfluencerCampaignDetail,
  SnsType,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type CampaignRow = {
  id: string;
  title: string;
  productSummary: string;
  rewardJpy: number;
  thumbnailUrl: string | null;
  recruitStartAt: Date;
  recruitEndAt: Date;
  postingPeriodDays: number;
  createdAt: Date;
  snsRecruits: {
    snsType: SnsType;
    minFollowers: number;
    recruitCount: number;
  }[];
};

function totalRecruitCount(snsRecruits: { recruitCount: number }[]) {
  return snsRecruits.reduce((acc, r) => acc + r.recruitCount, 0);
}

function isNew(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() <= NEW_WINDOW_MS;
}

function toCard(
  row: CampaignRow,
  appliedCount: number,
  now: Date,
): InfluencerCampaignCard {
  return {
    id: row.id,
    title: row.title,
    productSummary: row.productSummary,
    thumbnailUrl: row.thumbnailUrl,
    rewardJpy: row.rewardJpy,
    snsRecruits: row.snsRecruits,
    recruitCount: totalRecruitCount(row.snsRecruits),
    appliedCount,
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    postingPeriodDays: row.postingPeriodDays,
    isNew: isNew(row.createdAt, now),
  };
}

@Injectable()
export class InfluencerCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  private async resolveCard(card: InfluencerCampaignCard): Promise<InfluencerCampaignCard> {
    card.thumbnailUrl = await this.uploads.resolveCampaignThumbnailUrl(card.thumbnailUrl);
    return card;
  }

  async list(args: {
    influencerId: string;
    sns?: SnsType;
  }): Promise<InfluencerCampaignCard[]> {
    const now = new Date();
    const rows = await this.prisma.campaign.findMany({
      where: {
        closedAt: null,
        recruitEndAt: { gte: now },
        ...(args.sns
          ? { snsRecruits: { some: { snsType: args.sns } } }
          : {}),
      },
      orderBy: [{ recruitEndAt: "asc" }],
      include: {
        snsRecruits: {
          select: { snsType: true, minFollowers: true, recruitCount: true },
          orderBy: { snsType: "asc" },
        },
      },
    });

    const counts = await Promise.all(
      rows.map((r) =>
        this.prisma.campaignApplication.count({
          where: {
            campaignId: r.id,
            status: { in: ["APPROVED", "SHIPPED", "DELIVERED", "COMPLETED"] },
          },
        }),
      ),
    );

    return Promise.all(
      rows.map((r, i) => this.resolveCard(toCard(r, counts[i] ?? 0, now))),
    );
  }

  async detail(args: {
    influencerId: string;
    campaignId: string;
  }): Promise<InfluencerCampaignDetail> {
    const now = new Date();
    const row = await this.prisma.campaign.findUnique({
      where: { id: args.campaignId },
      include: {
        snsRecruits: {
          select: { snsType: true, minFollowers: true, recruitCount: true },
          orderBy: { snsType: "asc" },
        },
      },
    });
    if (!row) throw new NotFoundException("Campaign not found");

    const appliedCount = await this.prisma.campaignApplication.count({
      where: {
        campaignId: row.id,
        status: { in: ["APPROVED", "SHIPPED", "DELIVERED", "COMPLETED"] },
      },
    });

    const existing = await this.prisma.campaignApplication.findMany({
      where: {
        campaignId: row.id,
        influencerId: args.influencerId,
        status: { not: "CANCELLED" },
      },
      select: { snsType: true },
    });

    const card = await this.resolveCard(toCard(row, appliedCount, now));
    return {
      ...card,
      productDetailUrl: row.productDetailUrl,
      guideline: row.guideline,
      referenceMediaUrls: row.referenceMediaUrls,
      cautions: row.cautions,
      appliedSnsTypes: existing.map((r) => r.snsType),
    };
  }
}
