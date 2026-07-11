import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CampaignCategory,
  CampaignSubType,
  InfluencerCampaignCard,
  InfluencerCampaignDetail,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type CampaignRow = {
  id: string;
  category: CampaignCategory;
  title: string;
  productSummary: string;
  rewardJpy: number;
  thumbnailUrl: string | null;
  recruitStartAt: Date;
  recruitEndAt: Date;
  postingPeriodDays: number;
  createdAt: Date;
  closedAt: Date | null;
  recruits: {
    subType: CampaignSubType;
    minFollowers: number;
    recruitCount: number;
    subTypeOptions: string[];
    insightRequired: boolean;
    productPriceJpy: number | null;
    productUrl: string | null;
  }[];
};

function totalRecruitCount(recruits: { recruitCount: number }[]) {
  return recruits.reduce((acc, r) => acc + r.recruitCount, 0);
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
  const isUpcoming = !isEnded && row.recruitStartAt.getTime() > now.getTime();
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    productSummary: row.productSummary,
    thumbnailUrl: row.thumbnailUrl,
    rewardJpy: row.rewardJpy,
    recruits: row.recruits,
    recruitCount: totalRecruitCount(row.recruits),
    appliedCount,
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    postingPeriodDays: row.postingPeriodDays,
    isNew: !isEnded && !isUpcoming && isNew(row.createdAt, now),
    isEnded,
    isUpcoming,
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
    sns?: CampaignSubType;
  }): Promise<InfluencerCampaignCard[]> {
    const now = new Date();
    const rows = await this.prisma.campaign.findMany({
      where: args.sns
        ? { recruits: { some: { subType: args.sns } } }
        : {},
      orderBy: [{ createdAt: "desc" }],
      include: {
        recruits: {
          select: {
            subType: true,
            minFollowers: true,
            recruitCount: true,
            subTypeOptions: true,
            insightRequired: true,
            productPriceJpy: true,
            productUrl: true,
          },
          orderBy: { subType: "asc" },
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
    // DB orderBy 가 createdAt desc → stable sort 로 그룹 순서만 분리.
    // 우선순위: 진행중 → 개시전 → 종료
    return cards.sort((a, b) => {
      if (a.isEnded !== b.isEnded) return a.isEnded ? 1 : -1;
      if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? 1 : -1;
      return 0;
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
        recruits: {
          select: {
            subType: true,
            minFollowers: true,
            recruitCount: true,
            subTypeOptions: true,
            insightRequired: true,
            productPriceJpy: true,
            productUrl: true,
          },
          orderBy: { subType: "asc" },
        },
        exclusionsAsExcluding: { select: { excludedCampaignId: true } },
      },
    });
    if (!row) throw new NotFoundException("Campaign not found");

    const appliedCount = await this.prisma.campaignApplication.count({
      where: {
        campaignId: row.id,
        status: { in: ["APPROVED", "SHIPPED", "DELIVERED", "COMPLETED"] },
      },
    });

    const excludedCampaignIds = row.exclusionsAsExcluding.map(
      (exclusion) => exclusion.excludedCampaignId,
    );
    const [existing, applicationsOnExcludedCampaigns] = await Promise.all([
      // 취소된 응모도 재응모 불가 대상이므로 appliedCampaignSubTypes 에 포함시키고,
      // 취소 여부도 별도로 구분해 UI 에서 안내 문구를 달리 표시할 수 있게 한다.
      this.prisma.campaignApplication.findMany({
        where: {
          campaignId: row.id,
          influencerId: args.influencerId,
        },
        select: { subType: true, status: true },
      }),
      excludedCampaignIds.length > 0
        ? this.prisma.campaignApplication.findMany({
            where: {
              influencerId: args.influencerId,
              campaignId: { in: excludedCampaignIds },
              status: { not: "CANCELLED" },
            },
            select: { subType: true },
            distinct: ["subType"],
          })
        : Promise.resolve([] as { subType: CampaignSubType }[]),
    ]);
    const recruitedCampaignSubTypes = new Set(
      row.recruits.map((recruit) => recruit.subType),
    );
    const excludedCampaignSubTypes = applicationsOnExcludedCampaigns
      .map((application) => application.subType)
      .filter((subType) => recruitedCampaignSubTypes.has(subType));

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
      appliedSubTypes: existing.map((r) => r.subType),
      cancelledSubTypes: existing
        .filter((r) => r.status === "CANCELLED")
        .map((r) => r.subType),
      excludedSubTypes: excludedCampaignSubTypes,
    };
  }
}
