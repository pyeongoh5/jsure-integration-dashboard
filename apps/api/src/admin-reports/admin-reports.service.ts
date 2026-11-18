import { Injectable, NotFoundException } from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  SurveyAnswersSchema,
  formatTitleWithTags,
  postUrls,
  type CampaignParticipantsResponse,
  type CampaignReportParticipant,
  type CampaignReportResponse,
  type CampaignReportRow,
  type CampaignReportSortKey,
  type CampaignReportSortOrder,
  type SurveyAnswers,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLISHED_CAMPAIGN_WHERE } from "../campaigns/published-campaign";
import {
  loadManagers,
  pickManagers,
  utcToJstDateStr,
} from "../campaigns/campaigns.service";
import { parseSurveyQuestions } from "../common/survey-questions";

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

    // 조회 인원(UV) — 캠페인 상세를 연 인플루언서 수.
    const viewGrouped = await this.prisma.campaignView.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: campaigns.map((campaign) => campaign.id) } },
      _count: { _all: true },
    });
    const viewerCountByCampaign = new Map<string, number>(
      viewGrouped.map((view) => [view.campaignId, view._count._all]),
    );

    const managersById = await loadManagers(this.prisma, campaigns);

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

      // 응모율의 분자는 전체 응모(탈락·취소 포함) — 측정 대상은 인플루언서의
      // 반응이지 어드민의 선발 결과가 아니다.
      const viewerCount = viewerCountByCampaign.get(campaign.id) ?? 0;
      const applicationRate =
        viewerCount > 0
          ? (campaign.applications.length / viewerCount) * 100
          : null;

      const totalEngagement = totalLikes + totalComments + totalSaves;
      const erByViews = totalViews > 0 ? (totalEngagement / totalViews) * 100 : null;
      const erByFollowers = totalFollowers > 0 ? (totalEngagement / totalFollowers) * 100 : null;

      return {
        campaignId: campaign.id,
        // 어드민 리포트 전용 응답이므로 제목 앞에 어드민 태그를 붙여 내려준다.
        campaignTitle: formatTitleWithTags(campaign.tags, campaign.title),
        category: campaign.category,
        recruitStartDate: utcToJstDateStr(campaign.recruitStartAt),
        recruitEndDate: utcToJstDateStr(campaign.recruitEndAt),
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
        viewerCount,
        applicationRate,
        managers: pickManagers(campaign.managerIds, managersById),
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
      select: { id: true, surveyId: true },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");

    const survey = await this.resolveSurveyQuestions(campaign.surveyId);
    const participants = await this.collectParticipants(campaignId, survey);
    const total = participants.length;
    const start = page * pageSize;
    return {
      total,
      participants: participants.slice(start, start + pageSize),
      survey,
    };
  }

  /**
   * 참여자 목록 — 응모가 승인된 이후 단계인 인플루언서를 참여 서브타입별 행으로 편다.
   * 아직 게시물을 제출하지 않았어도 행으로 나오며 인사이트는 빈 값이다.
   *
   * 앙케이트 응답은 응모(applicationId) 단위이므로 같은 응모가 펼쳐진 서브타입 행들에는
   * 같은 답이 반복된다. `survey` 가 null(설문 미연결)이면 응답 조회 자체를 생략한다.
   */
  private async collectParticipants(
    campaignId: string,
    survey: CampaignParticipantsResponse["survey"],
  ): Promise<CampaignReportParticipant[]> {
    const applications = await this.prisma.campaignApplication.findMany({
      where: { campaignId, status: { in: SLOT_CONSUMING_STATUSES } },
      orderBy: { appliedAt: "asc" },
      select: {
        id: true,
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

    const surveyAnswersByApplicationId = survey
      ? await this.surveyAnswersByApplicationIds(
          applications.map((application) => application.id),
        )
      : new Map<string, SurveyAnswers>();

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
            applicationId: application.id,
            influencerId: application.influencer.id,
            influencerName: application.influencer.name,
            handle: matchedAccount?.handle ?? "",
            subType,
            // 복수 URL 은 줄바꿈으로 잇는다 — URL 자체에 쉼표가 들어갈 수 있다.
            postUrl: post ? (postUrls(post).join("\n") || null) : null,
            submittedAt: post ? post.submittedAt.toISOString() : null,
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
            surveyAnswers: surveyAnswersByApplicationId.get(application.id) ?? null,
          };
        }),
    );
  }

  /**
   * 설문 응답을 응모 묶음으로 한 번에 읽는다(행마다 조회하면 N+1).
   * `builderSurveyResponse.applicationId` 는 FK 가 아니다(1차 §7 격리 규칙).
   */
  private async surveyAnswersByApplicationIds(
    applicationIds: string[],
  ): Promise<Map<string, SurveyAnswers>> {
    const surveyAnswersByApplicationId = new Map<string, SurveyAnswers>();
    if (applicationIds.length === 0) return surveyAnswersByApplicationId;
    const surveyResponses = await this.prisma.builderSurveyResponse.findMany({
      where: { applicationId: { in: applicationIds } },
      select: { applicationId: true, answers: true },
    });
    for (const surveyResponse of surveyResponses) {
      const answers = SurveyAnswersSchema.safeParse(surveyResponse.answers);
      if (answers.success) {
        surveyAnswersByApplicationId.set(surveyResponse.applicationId, answers.data);
      }
    }
    return surveyAnswersByApplicationId;
  }

  /**
   * 캠페인에 연결된 설문의 현재 문항. relation 이 없으므로(1차 §7 격리 규칙)
   * `builderSurvey.findUnique` 로 따로 읽는다. 미연결이거나 가리키는 설문이
   * 없으면 null — 리포트 엑셀은 이 경우 설문 컬럼을 전혀 붙이지 않는다.
   */
  private async resolveSurveyQuestions(
    surveyId: string | null,
  ): Promise<CampaignParticipantsResponse["survey"]> {
    if (!surveyId) return null;
    const survey = await this.prisma.builderSurvey.findUnique({
      where: { id: surveyId },
      select: { id: true, questions: true },
    });
    if (!survey) return null;
    const questions = parseSurveyQuestions(survey.questions, surveyId);
    if (questions === null) return null;
    return {
      id: survey.id,
      questions,
    };
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
