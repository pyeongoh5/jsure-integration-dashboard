import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CampaignParticipantsResponse,
  CampaignReportParticipant,
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
      let participantCount = 0;

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

          if (post.settlement?.status === "COMPLETED") {
            participantCount += 1;
          }
        }
      }

      const totalEngagement = totalLikes + totalComments + totalSaves;
      const erByViews = totalViews > 0 ? (totalEngagement / totalViews) * 100 : null;
      const erByFollowers = totalFollowers > 0 ? (totalEngagement / totalFollowers) * 100 : null;

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
        participantCount,
      };
    });

    rows.sort((rowA, rowB) => compareRows(rowA, rowB, sort, order));

    return { rows };
  }

  /**
   * 캠페인 단위 정산 완료 참여자 목록. page 는 0-base, pageSize 는 1 이상.
   * pageSize 를 매우 크게 주면 전체를 한 번에 받을 수 있어 다운로드 시점에도 그대로 사용한다.
   */
  async campaignParticipants(
    campaignId: string,
    page: number,
    pageSize: number,
  ): Promise<CampaignParticipantsResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");

    const participants = await this.collectParticipants(campaignId);
    const total = participants.length;
    const start = page * pageSize;
    return {
      total,
      participants: participants.slice(start, start + pageSize),
    };
  }

  private async collectParticipants(campaignId: string): Promise<CampaignReportParticipant[]> {
    const posts = await this.prisma.submittedPost.findMany({
      where: {
        application: { campaignId },
        settlement: { status: "COMPLETED" },
      },
      orderBy: { submittedAt: "asc" },
      include: {
        application: {
          select: {
            snsType: true,
            instagramPostType: true,
            influencer: {
              select: {
                id: true,
                name: true,
                snsAccounts: {
                  select: { snsType: true, handle: true },
                },
              },
            },
          },
        },
      },
    });

    return posts.map((post) => {
      const matchedAccount = post.application.influencer.snsAccounts.find(
        (account) => account.snsType === post.application.snsType,
      );
      return {
        influencerId: post.application.influencer.id,
        influencerName: post.application.influencer.name,
        handle: matchedAccount?.handle ?? "",
        snsType: post.application.snsType,
        instagramPostType: post.application.instagramPostType,
        insight: {
          likes: post.insightLikes,
          comments: post.insightComments,
          shares: post.insightShares,
          reposts: post.insightReposts,
          saves: post.insightSaves,
          views: post.insightViews,
          reach: post.insightReach,
        },
      };
    });
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
