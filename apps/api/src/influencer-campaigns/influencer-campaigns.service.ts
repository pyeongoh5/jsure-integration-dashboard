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
  closedAt: Date | null;
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
  closedAt: Date | null,
  now: Date,
): InfluencerCampaignCard {
  const isEnded = closedAt !== null || row.recruitEndAt.getTime() < now.getTime();
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
    isNew: !isEnded && isNew(row.createdAt, now),
    isEnded,
  };
}

@Injectable()
export class InfluencerCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  private async resolveCard(card: InfluencerCampaignCard): Promise<InfluencerCampaignCard> {
    const [thumbnailUrl, productSummary] = await Promise.all([
      this.uploads.resolveCampaignThumbnailUrl(card.thumbnailUrl),
      this.uploads.resolveR2ImagesInHtml(card.productSummary),
    ]);
    card.thumbnailUrl = thumbnailUrl;
    card.productSummary = productSummary;
    return card;
  }

  async list(args: {
    influencerId: string;
    sns?: SnsType;
  }): Promise<InfluencerCampaignCard[]> {
    const now = new Date();
    const rows = await this.prisma.campaign.findMany({
      where: args.sns
        ? { snsRecruits: { some: { snsType: args.sns } } }
        : {},
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

    const cards = await Promise.all(
      rows.map((r, i) => this.resolveCard(toCard(r, counts[i] ?? 0, r.closedAt, now))),
    );
    return cards.sort((a, b) => {
      if (a.isEnded !== b.isEnded) return a.isEnded ? 1 : -1;
      const aTime = new Date(a.recruitEndAt).getTime();
      const bTime = new Date(b.recruitEndAt).getTime();
      return a.isEnded ? bTime - aTime : aTime - bTime;
    });
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

    const card = await this.resolveCard(toCard(row, appliedCount, row.closedAt, now));
    const [guideline, cautions] = await Promise.all([
      this.uploads.resolveR2ImagesInHtml(row.guideline),
      this.uploads.resolveR2ImagesInHtml(row.cautions),
    ]);
    return {
      ...card,
      productDetailUrl: row.productDetailUrl,
      guideline,
      referenceMediaUrls: row.referenceMediaUrls,
      cautions,
      appliedSnsTypes: existing.map((r) => r.snsType),
    };
  }
}
