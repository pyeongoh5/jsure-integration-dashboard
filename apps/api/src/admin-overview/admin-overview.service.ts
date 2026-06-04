import { Injectable } from "@nestjs/common";
import type { AdminOverviewResponse } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(): Promise<AdminOverviewResponse> {
    const now = new Date();

    const [
      recruitingCampaignCount,
      pendingApplicationCount,
      pendingPostReviewCount,
      pendingSettlementAgg,
    ] = await Promise.all([
      // 모집 중: 모집 기간 안이고 closedAt 없음
      this.prisma.campaign.count({
        where: {
          closedAt: null,
          recruitStartAt: { lte: now },
          recruitEndAt: { gte: now },
        },
      }),
      // 응모자 검토 대기 = APPLIED
      this.prisma.campaignApplication.count({
        where: { status: "APPLIED" },
      }),
      // 게시물 검토 대기 = PENDING
      this.prisma.submittedPost.count({
        where: { reviewStatus: "PENDING" },
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
    };
  }
}
