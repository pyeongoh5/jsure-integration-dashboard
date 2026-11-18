import { Injectable } from "@nestjs/common";
import type { AdminOverviewResponse } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLISHED_CAMPAIGN_WHERE } from "../campaigns/published-campaign";

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(adminUserId: string): Promise<AdminOverviewResponse> {
    const now = new Date();

    const [
      recruitingCampaignCount,
      myRecruitingCampaignCount,
      pendingApplicationCount,
      pendingPostReviewCount,
      pendingSettlementAgg,
    ] = await Promise.all([
      // 모집 중: 모집 기간 안이고 closedAt 없음
      this.prisma.campaign.count({
        where: {
          ...PUBLISHED_CAMPAIGN_WHERE,
          closedAt: null,
          recruitStartAt: { lte: now },
          recruitEndAt: { gte: now },
        },
      }),
      // 모집 중 캠페인 중 로그인한 어드민이 담당자로 지정된 것만.
      this.prisma.campaign.count({
        where: {
          ...PUBLISHED_CAMPAIGN_WHERE,
          closedAt: null,
          recruitStartAt: { lte: now },
          recruitEndAt: { gte: now },
          managerIds: { has: adminUserId },
        },
      }),
      // 응모 관리 페이지에 노출되는 행 수와 일치시킨다.
      // - CANCELLED, COMPLETED 제외
      // - 검토 단계로 넘어간(SubmittedPost 존재) 항목 제외
      // = 응모/승인/배송/수령확인/반려 단계에 머무는 응모 전체.
      this.prisma.campaignApplication.count({
        where: {
          status: { in: ["APPLIED", "APPROVED", "SHIPPED", "DELIVERED", "REJECTED"] },
          posts: { none: {} },
        },
      }),
      // 검토 관리 페이지에 노출되는 행 수와 일치시킨다.
      // - 정산 단계로 넘어간(Settlement 존재) 항목 제외.
      this.prisma.campaignApplication.count({
        where: { posts: { some: {} }, settlement: null },
      }),
      // 지급 대기 금액 합계 + 건수
      this.prisma.settlement.aggregate({
        where: { status: "PENDING" },
        _sum: { amountJpy: true },
        _count: { _all: true },
      }),
    ]);

    return {
      recruitingCampaignCount,
      pendingApplicationCount,
      pendingPostReviewCount,
      pendingSettlementAmountJpy: pendingSettlementAgg._sum.amountJpy ?? 0,
      pendingSettlementCount: pendingSettlementAgg._count._all,
      myRecruitingCampaignCount,
    };
  }
}
