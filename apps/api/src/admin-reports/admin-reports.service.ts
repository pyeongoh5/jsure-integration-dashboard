import { Injectable } from "@nestjs/common";
import type {
  CampaignReportResponse,
  CampaignReportRow,
  CampaignReportSortKey,
  CampaignReportSortOrder,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async campaignReports(
    sort: CampaignReportSortKey,
    order: CampaignReportSortOrder,
  ): Promise<CampaignReportResponse> {
    const campaigns = await this.prisma.campaign.findMany({
      include: {
        applications: {
          include: {
            influencer: {
              include: { snsAccounts: true },
            },
            posts: {
              include: { settlement: true },
            },
          },
        },
      },
    });

    const rows: CampaignReportRow[] = campaigns.map((campaign) => {
      const influencerSet = new Set<string>();
      let totalFollowers = 0;
      let postCount = 0;
      let totalRewardJpy = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalReposts = 0;
      let totalSaves = 0;
      let totalViews = 0;
      let totalReach = 0;

      for (const application of campaign.applications) {
        influencerSet.add(application.influencerId);
        const matchedAccount = application.influencer.snsAccounts.find(
          (account) => account.snsType === application.snsType,
        );
        totalFollowers += matchedAccount?.followerCount ?? 0;

        for (const post of application.posts) {
          postCount += 1;
          if (post.settlement) totalRewardJpy += post.settlement.amountJpy;
          totalLikes += post.insightLikes ?? 0;
          totalComments += post.insightComments ?? 0;
          totalShares += post.insightShares ?? 0;
          totalReposts += post.insightReposts ?? 0;
          totalSaves += post.insightSaves ?? 0;
          totalViews += post.insightViews ?? 0;
          totalReach += post.insightReach ?? 0;
        }
      }

      const totalEngagement = totalLikes + totalComments + totalSaves;
      const erByViews =
        totalViews > 0 ? (totalEngagement / totalViews) * 100 : null;
      const erByFollowers =
        totalFollowers > 0 ? (totalEngagement / totalFollowers) * 100 : null;

      return {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        influencerCount: influencerSet.size,
        totalFollowers,
        postCount,
        totalRewardJpy,
        totalLikes,
        totalComments,
        totalShares,
        totalReposts,
        totalSaves,
        totalViews,
        totalReach,
        totalEngagement,
        erByViews,
        erByFollowers,
      };
    });

    rows.sort((rowA, rowB) => compareRows(rowA, rowB, sort, order));

    return { rows };
  }
}

function compareRows(
  rowA: CampaignReportRow,
  rowB: CampaignReportRow,
  sort: CampaignReportSortKey,
  order: CampaignReportSortOrder,
): number {
  const valueA = rowA[sort];
  const valueB = rowB[sort];
  const direction = order === "asc" ? 1 : -1;

  // null 은 항상 마지막
  if (valueA === null && valueB === null) return 0;
  if (valueA === null) return 1;
  if (valueB === null) return -1;

  if (typeof valueA === "string" && typeof valueB === "string") {
    return valueA.localeCompare(valueB) * direction;
  }
  if (typeof valueA === "number" && typeof valueB === "number") {
    return (valueA - valueB) * direction;
  }
  return 0;
}
