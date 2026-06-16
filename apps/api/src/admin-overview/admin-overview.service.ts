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
      this.prisma.submittedPost.count({
        where: { settlement: null },
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
