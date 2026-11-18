import { Injectable } from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  deriveCampaignStage,
  type AdminCampaignBoardResponse,
  type CampaignBoardRow,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLISHED_CAMPAIGN_WHERE } from "../campaigns/published-campaign";

/** 캠페인별 응모 수 집계 결과를 캠페인 id 로 찾기 쉬운 모양으로 바꾼다. */
function countsByCampaign(
  groups: { campaignId: string; _count: { _all: number } }[],
): Map<string, number> {
  return new Map(groups.map((group) => [group.campaignId, group._count._all]));
}

/**
 * 어드민 메인 대시보드의 '진행 중 캠페인 실시간 현황' 테이블.
 * 단계 판정은 @jsure/shared 의 deriveCampaignStage 하나가 맡고, 여기서는
 * 그 입력이 되는 집계만 만든다.
 */
@Injectable()
export class AdminCampaignBoardService {
  constructor(private readonly prisma: PrismaService) {}

  async board(): Promise<AdminCampaignBoardResponse> {
    const now = new Date();
    // 승인 이후 단계로 넘어간 응모 = 그 캠페인이 책임지는 인원.
    const approvedWhere = { status: { in: SLOT_CONSUMING_STATUSES } };

    const [campaigns, approvedGroups, insightGroups, settledGroups, completedGroups] =
      await Promise.all([
        this.prisma.campaign.findMany({
          // 비공개(hiddenAt) 캠페인은 운영에서 내린 건이라 관제 대상이 아니다.
          where: { ...PUBLISHED_CAMPAIGN_WHERE, hiddenAt: null },
          select: {
            id: true,
            title: true,
            tags: true,
            category: true,
            recruitStartAt: true,
          },
          orderBy: { recruitStartAt: "desc" },
        }),
        this.prisma.campaignApplication.groupBy({
          by: ["campaignId"],
          where: approvedWhere,
          _count: { _all: true },
        }),
        this.prisma.campaignApplication.groupBy({
          by: ["campaignId"],
          where: {
            ...approvedWhere,
            posts: { some: { insightSubmittedAt: { not: null } } },
          },
          _count: { _all: true },
        }),
        this.prisma.campaignApplication.groupBy({
          by: ["campaignId"],
          where: { ...approvedWhere, settlement: { isNot: null } },
          _count: { _all: true },
        }),
        this.prisma.campaignApplication.groupBy({
          by: ["campaignId"],
          where: { status: "COMPLETED" },
          _count: { _all: true },
        }),
      ]);

    const approvedCounts = countsByCampaign(approvedGroups);
    const insightCounts = countsByCampaign(insightGroups);
    const settledCounts = countsByCampaign(settledGroups);
    const completedCounts = countsByCampaign(completedGroups);

    const rows: CampaignBoardRow[] = [];
    for (const campaign of campaigns) {
      const approvedCount = approvedCounts.get(campaign.id) ?? 0;
      const completedCount = completedCounts.get(campaign.id) ?? 0;
      // 승인 인원이 전부 정산까지 끝난 캠페인은 할 일이 없다 — 관제 뷰에서 뺀다.
      // 빼지 않으면 '정산/종료 대기' 카운터가 과거 캠페인으로 계속 불어난다.
      if (approvedCount > 0 && completedCount >= approvedCount) continue;

      rows.push({
        campaignId: campaign.id,
        title: campaign.title,
        tags: campaign.tags,
        category: campaign.category,
        stage: deriveCampaignStage({
          recruitStarted: campaign.recruitStartAt <= now,
          approvedCount,
          insightStartedCount: insightCounts.get(campaign.id) ?? 0,
          settledCount: settledCounts.get(campaign.id) ?? 0,
        }),
      });
    }

    return { rows };
  }
}
