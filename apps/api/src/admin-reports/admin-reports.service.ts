import { Injectable, NotFoundException } from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  type CampaignParticipantsResponse,
  type CampaignReportParticipant,
  type CampaignReportResponse,
  type CampaignReportRow,
  type CampaignReportSortKey,
  type CampaignReportSortOrder,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLISHED_CAMPAIGN_WHERE } from "../campaigns/published-campaign";

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async campaignReports(
    sort: CampaignReportSortKey,
    order: CampaignReportSortOrder,
  ): Promise<CampaignReportResponse> {
    const campaigns = await this.prisma.campaign.findMany({
      where: PUBLISHED_CAMPAIGN_WHERE,
      include: {
        applications: {
          include: {
            influencer: {
              include: { snsAccounts: true },
            },
            posts: true,
            settlement: true,
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
        // 인플루언서 수·팔로워·참여자 수는 응모가 승인된(승인 이후 상태 포함) 인플루언서만 대상.
        const isParticipant = SLOT_CONSUMING_STATUSES.includes(
          application.status,
        );
        if (isParticipant) {
          participantCount += 1;
          influencerSet.add(application.influencerId);
          // 참여한 모든 서브타입 계정의 팔로워를 합산.
          for (const account of application.influencer.snsAccounts) {
            if (
              application.subTypes.includes(
                account.snsType as (typeof application.subTypes)[number],
              )
            ) {
              totalFollowers += account.followerCount;
            }
          }
        }

        // 정산 대기(PENDING) 포함 — 정산 흐름에 들어간 응모의 보수는 리포트 대상.
        if (application.settlement) {
          totalRewardJpy += application.settlement.amountJpy;
        }

        // 콘텐츠 수·인사이트 합계는 제출된 게시물 전체 기준.
        // 취소된 응모와 검수 반려된 제출물은 실제 게재물이 아니므로 뺀다.
        if (!isParticipant || application.submissionReviewStatus === "REJECTED") {
          continue;
        }
        for (const post of application.posts) {
          postCount += 1;
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
   * 캠페인 단위 참여자 목록(정산 대기 포함). page 는 0-base, pageSize 는 1 이상.
   * pageSize 를 매우 크게 주면 전체를 한 번에 받을 수 있어 다운로드 시점에도 그대로 사용한다.
   */
  async campaignParticipants(
    campaignId: string,
    page: number,
    pageSize: number,
  ): Promise<CampaignParticipantsResponse> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, ...PUBLISHED_CAMPAIGN_WHERE },
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

  /**
   * 참여자 목록 — 응모가 승인된 이후 단계인 인플루언서를 참여 서브타입별 행으로 편다.
   * 아직 게시물을 제출하지 않았어도 행으로 나오며 인사이트는 빈 값이다.
   */
  private async collectParticipants(campaignId: string): Promise<CampaignReportParticipant[]> {
    const applications = await this.prisma.campaignApplication.findMany({
      where: { campaignId, status: { in: SLOT_CONSUMING_STATUSES } },
      orderBy: { appliedAt: "asc" },
      select: {
        status: true,
        subTypes: true,
        submissionReviewStatus: true,
        options: { select: { subType: true, option: true } },
        posts: true,
        influencer: {
          select: {
            id: true,
            name: true,
            snsAccounts: { select: { snsType: true, handle: true } },
          },
        },
      },
    });

    return applications.flatMap((application) =>
      [...application.subTypes]
        .sort()
        .map((subType): CampaignReportParticipant => {
          const post = application.posts.find(
            (entry) => entry.subType === subType,
          );
          const matchedAccount = application.influencer.snsAccounts.find(
            (account) => account.snsType === subType,
          );
          return {
            influencerId: application.influencer.id,
            influencerName: application.influencer.name,
            handle: matchedAccount?.handle ?? "",
            subType,
            option:
              application.options.find((entry) => entry.subType === subType)
                ?.option ?? null,
            status: application.status,
            // 제출 전에는 검수 상태가 의미 없으므로 null 로 내린다.
            submissionReviewStatus: post
              ? application.submissionReviewStatus
              : null,
            insight: {
              likes: post?.insightLikes ?? null,
              comments: post?.insightComments ?? null,
              shares: post?.insightShares ?? null,
              reposts: post?.insightReposts ?? null,
              saves: post?.insightSaves ?? null,
              views: post?.insightViews ?? null,
              reach: post?.insightReach ?? null,
            },
          };
        }),
    );
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
