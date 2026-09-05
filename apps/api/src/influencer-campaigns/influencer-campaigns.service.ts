import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  type CampaignCategory,
  type CampaignSubType,
  type InfluencerCampaignCard,
  type InfluencerCampaignDetail,
  type RewardType,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";
import { campaignHeadcount } from "../campaigns/campaign-headcount";
import {
  optionCapacitySlots,
  subTypesWithAllOptionsFull,
} from "../campaigns/option-capacity";
import { VISIBLE_PUBLISHED_CAMPAIGN_WHERE } from "../campaigns/published-campaign";

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type CampaignRow = {
  id: string;
  category: CampaignCategory;
  title: string;
  productSummary: string;
  rewardType: RewardType;
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
    rewardJpy: number | null;
    subTypeOptions: string[];
    insightRequired: boolean;
    isRequired: boolean;
    productPriceJpy: number | null;
    productUrl: string | null;
    options: {
      option: string;
      recruitCount: number | null;
      rewardJpy: number | null;
    }[];
  }[];
};

function isNew(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() <= NEW_WINDOW_MS;
}

function toCard(
  row: CampaignRow,
  approvedCount: number,
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
    rewardType: row.rewardType,
    rewardJpy: row.rewardJpy,
    recruits: row.recruits,
    recruitCount: campaignHeadcount(row.category, row.recruits),
    approvedCount,
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    postingPeriodDays: row.postingPeriodDays,
    isNew: !isEnded && !isUpcoming && isNew(row.createdAt, now),
    isEnded,
    isUpcoming,
  };
}

// 목록 정렬 순위. 모집 완료(정원 충족)·종료는 모집중보다 뒤로 보낸다.
// full 판정은 카드의 헤드카운트(recruitCount) 대비 승인 인원(approvedCount)으로,
// CampaignCard 의 "모집 완료" 표기와 동일 기준.
function listSortRank(card: InfluencerCampaignCard): number {
  if (card.isEnded) return 3;
  if (card.isUpcoming) return 1;
  if (card.recruitCount > 0 && card.approvedCount >= card.recruitCount) return 2;
  return 0;
}

@Injectable()
export class InfluencerCampaignsService {
  private readonly logger = new Logger(InfluencerCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * 캠페인 상세 열람 기록. (캠페인, 인플루언서) 복합 PK 라 재조회는 무시되고
   * 조회 인원(UV)만 남는다. 기록 실패가 상세 조회를 막아서는 안 되므로 삼킨다.
   */
  private async recordView(
    campaignId: string,
    influencerId: string,
  ): Promise<void> {
    try {
      await this.prisma.campaignView.createMany({
        data: [{ campaignId, influencerId }],
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.warn(
        `캠페인 조회 기록 실패 (campaignId=${campaignId}, influencerId=${influencerId}): ${String(error)}`,
      );
    }
  }

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
    category?: CampaignCategory;
  }): Promise<InfluencerCampaignCard[]> {
    const now = new Date();
    const rows = await this.prisma.campaign.findMany({
      where: {
        ...VISIBLE_PUBLISHED_CAMPAIGN_WHERE,
        ...(args.category ? { category: args.category } : {}),
      },
      // 끌어올리기(bump)를 반영한 정렬. bumpedAt 은 생성 시 createdAt 과 같아
      // 끌어올린 적 없는 캠페인은 기존 최신순 그대로다.
      orderBy: [{ bumpedAt: "desc" }],
      include: {
        recruits: {
          select: {
            subType: true,
            minFollowers: true,
            recruitCount: true,
            rewardJpy: true,
            subTypeOptions: true,
            insightRequired: true,
            isRequired: true,
            productPriceJpy: true,
            productUrl: true,
            options: {
              select: { option: true, recruitCount: true, rewardJpy: true },
              orderBy: { option: "asc" },
            },
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
            status: { in: SLOT_CONSUMING_STATUSES },
          },
        }),
      ),
    );

    const cards = await Promise.all(
      rows.map((r, i) => this.resolveCard(toCard(r, counts[i] ?? 0, r.closedAt, now))),
    );
    // DB orderBy 가 createdAt desc → stable sort 로 그룹 순서만 분리.
    // 우선순위: 모집중 → 개시전 → 모집 완료(정원 충족) → 모집 종료.
    // 정렬은 API 에서 수행하므로, 페이지네이션 도입 시에도 이 정렬 뒤 slice 하면 순서가 유지된다.
    return cards.sort((first, second) => listSortRank(first) - listSortRank(second));
  }

  async detail(args: {
    influencerId: string;
    campaignId: string;
  }): Promise<InfluencerCampaignDetail> {
    const now = new Date();
    const row = await this.prisma.campaign.findFirst({
      where: { id: args.campaignId, ...VISIBLE_PUBLISHED_CAMPAIGN_WHERE },
      include: {
        recruits: {
          select: {
            subType: true,
            minFollowers: true,
            recruitCount: true,
            rewardJpy: true,
            subTypeOptions: true,
            insightRequired: true,
            isRequired: true,
            productPriceJpy: true,
            productUrl: true,
            options: {
              select: { option: true, recruitCount: true, rewardJpy: true },
              orderBy: { option: "asc" },
            },
          },
          orderBy: { subType: "asc" },
        },
        exclusionsAsExcluding: { select: { excludedCampaignId: true } },
      },
    });
    if (!row) throw new NotFoundException("Campaign not found");

    await this.recordView(row.id, args.influencerId);

    const approvedCount = await this.prisma.campaignApplication.count({
      where: {
        campaignId: row.id,
        status: { in: SLOT_CONSUMING_STATUSES },
      },
    });

    const excludedCampaignIds = row.exclusionsAsExcluding.map(
      (exclusion) => exclusion.excludedCampaignId,
    );
    const [existing, applicationsOnExcludedCampaigns] = await Promise.all([
      // 취소된 응모도 재응모 불가 대상. 취소 여부는 별도로 구분해 UI 에서
      // 안내 문구를 달리 표시할 수 있게 한다.
      this.prisma.campaignApplication.findUnique({
        where: {
          campaignId_influencerId: {
            campaignId: row.id,
            influencerId: args.influencerId,
          },
        },
        select: { status: true },
      }),
      excludedCampaignIds.length > 0
        ? // 참여 완료(제출물 승인)한 경우에만 제외 대상 — 응모/미완료 이력은 차단하지 않는다.
          this.prisma.campaignApplication.findMany({
            where: {
              influencerId: args.influencerId,
              campaignId: { in: excludedCampaignIds },
              status: { not: "CANCELLED" },
              submissionReviewStatus: "APPROVED",
            },
            select: { subTypes: true },
          })
        : Promise.resolve([] as { subTypes: CampaignSubType[] }[]),
    ]);
    const recruitedCampaignSubTypes = new Set(
      row.recruits.map((recruit) => recruit.subType),
    );
    const excludedCampaignSubTypes = Array.from(
      new Set(
        applicationsOnExcludedCampaigns.flatMap(
          (application) => application.subTypes,
        ),
      ),
    ).filter((subType) => recruitedCampaignSubTypes.has(subType));

    // 서브타입별 승인(슬롯 점유) 인원을 세어, 각자 정원이 찬 서브타입을 모은다.
    // 선택 서브타입은 여기서 "선택 마감"으로 표시된다(필수 서브타입이 차면 헤드카운트로
    // 캠페인 전체가 이미 마감).
    const subTypeApprovedCounts = await Promise.all(
      row.recruits.map((recruit) =>
        this.prisma.campaignApplication.count({
          where: {
            campaignId: row.id,
            subTypes: { has: recruit.subType },
            status: { in: SLOT_CONSUMING_STATUSES },
          },
        }),
      ),
    );
    // 옵션별 정원 분리(FEED/REELS 등)를 쓰는 recruit 은 서브타입 정원과 별개로
    // 옵션마다 마감이 온다.
    const splitOptions = optionCapacitySlots(row.recruits);
    const optionApprovedCounts = await Promise.all(
      splitOptions.map((entry) =>
        this.prisma.campaignApplication.count({
          where: {
            campaignId: row.id,
            status: { in: SLOT_CONSUMING_STATUSES },
            options: { some: { subType: entry.subType, option: entry.option } },
          },
        }),
      ),
    );
    const fullOptions = splitOptions
      .filter((entry, index) => (optionApprovedCounts[index] ?? 0) >= entry.recruitCount)
      .map((entry) => ({ subType: entry.subType, option: entry.option }));

    const allOptionsFullSubTypes = subTypesWithAllOptionsFull(
      row.recruits,
      fullOptions,
    );

    const fullSubTypes = row.recruits
      .filter(
        (recruit, index) =>
          (subTypeApprovedCounts[index] ?? 0) >= recruit.recruitCount ||
          allOptionsFullSubTypes.includes(recruit.subType),
      )
      .map((recruit) => recruit.subType);

    const card = await this.resolveCard(toCard(row, approvedCount, row.closedAt, now));
    const [guideline, cautions] = await Promise.all([
      this.uploads.resolveR2ImagesInHtml(row.guideline),
      this.uploads.resolveR2ImagesInHtml(row.cautions),
    ]);
    return {
      ...card,
      productDetailUrls: row.productDetailUrls,
      guideline,
      referenceMediaUrls: row.referenceMediaUrls,
      cautions,
      hasApplied: existing !== null,
      hasCancelled: existing?.status === "CANCELLED",
      excludedSubTypes: excludedCampaignSubTypes,
      fullSubTypes,
      fullOptions,
      publishStartAt: row.publishStartAt ? row.publishStartAt.toISOString() : null,
      publishEndAt: row.publishEndAt ? row.publishEndAt.toISOString() : null,
    };
  }
}
