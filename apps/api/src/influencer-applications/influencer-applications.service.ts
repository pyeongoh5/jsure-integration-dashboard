import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AttachmentUploadInput,
  CampaignCategory,
  CampaignSubType,
  InfluencerApplication,
  InstagramPostType,
  RewardType,
  SubmittedPost,
  ApplicationStatus,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";
import {
  deriveDisplayStage,
  postingDeadline,
} from "../influencer-campaigns/display-stage";
import {
  applicationRewardJpy,
  ensureSettlementForApplication,
} from "../settlements/ensure-settlement";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { LineDispatcherService } from "../line-templates/line-dispatcher.service";
import { DISPATCH_APPLICATION_INCLUDE } from "../line-templates/trigger-meta";

/** 응모 후 인플루언서가 직접 취소할 수 있는 기간(2일, 밀리초). */
const CANCEL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

const SNS_SUB_TYPES: CampaignSubType[] = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"];

type PostRow = {
  id: string;
  subType: CampaignSubType;
  url: string | null;
  submissionData: unknown;
  submittedAt: Date;
  insightLikes: number | null;
  insightComments: number | null;
  insightShares: number | null;
  insightReposts: number | null;
  insightSaves: number | null;
  insightViews: number | null;
  insightReach: number | null;
  insightSubmittedAt: Date | null;
};

type ApplicationRow = {
  id: string;
  campaignId: string;
  status: ApplicationStatus;
  appliedAt: Date;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  receivedAt: Date | null;
  completedAt: Date | null;
  rejectReason: string | null;
  subTypes: CampaignSubType[];
  instagramPostType: InstagramPostType | null;
  submissionReviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  submissionRejections: { comment: string; rejectedAt: Date }[];
  orderNumber: string | null;
  orderSubmittedAt: Date | null;
  reviewSubmittedAt: Date | null;
  posts: PostRow[];
  settlement: {
    status: "PENDING" | "COMPLETED";
    amountJpy: number;
    completedAt: Date | null;
  } | null;
  campaign: {
    id: string;
    category: CampaignCategory;
    title: string;
    thumbnailUrl: string | null;
    rewardType: RewardType;
    rewardJpy: number;
    postingPeriodDays: number;
    recruits: {
      subType: CampaignSubType;
      insightRequired: boolean;
      rewardJpy: number | null;
    }[];
  };
};

function toPost(row: PostRow): SubmittedPost {
  return {
    id: row.id,
    subType: row.subType,
    url: row.url,
    submissionData:
      row.submissionData &&
      typeof row.submissionData === "object" &&
      !Array.isArray(row.submissionData)
        ? (row.submissionData as Record<string, unknown>)
        : null,
    submittedAt: row.submittedAt.toISOString(),
    insightLikes: row.insightLikes,
    insightComments: row.insightComments,
    insightShares: row.insightShares,
    insightReposts: row.insightReposts,
    insightSaves: row.insightSaves,
    insightViews: row.insightViews,
    insightReach: row.insightReach,
    insightSubmittedAt: row.insightSubmittedAt
      ? row.insightSubmittedAt.toISOString()
      : null,
  };
}

function toResponse(row: ApplicationRow): InfluencerApplication {
  const deadlineAnchor =
    row.campaign.category === "FAKE_PURCHASE"
      ? row.orderSubmittedAt
      : row.receivedAt;
  const deadline = postingDeadline(
    deadlineAnchor,
    row.campaign.postingPeriodDays,
  );
  const settlement = row.settlement
    ? {
        status: row.settlement.status,
        amountJpy: row.settlement.amountJpy,
        completedAt: row.settlement.completedAt
          ? row.settlement.completedAt.toISOString()
          : null,
      }
    : null;
  const latestRejection =
    row.submissionReviewStatus === "REJECTED"
      ? row.submissionRejections[0] ?? null
      : null;
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignCategory: row.campaign.category,
    campaignTitle: row.campaign.title,
    campaignThumbnailUrl: row.campaign.thumbnailUrl,
    rewardJpy: applicationRewardJpy(row.campaign, row.subTypes),
    status: row.status,
    displayStage: deriveDisplayStage({
      status: row.status,
      category: row.campaign.category,
      receivedAt: row.receivedAt,
      submissionReviewStatus: row.submissionReviewStatus,
      settlementStatus: row.settlement?.status ?? null,
      posts: row.posts.map((post) => ({
        submittedAt: post.submittedAt,
        insightSubmittedAt: post.insightSubmittedAt,
        insightRequired:
          row.campaign.recruits.find(
            (recruit) => recruit.subType === post.subType,
          )?.insightRequired ?? true,
      })),
    }),
    appliedAt: row.appliedAt.toISOString(),
    trackingCarrier: row.trackingCarrier,
    trackingNumber: row.trackingNumber,
    shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    rejectReason: row.rejectReason,
    subTypes: row.subTypes,
    instagramPostType: row.instagramPostType,
    submissionReviewStatus: row.submissionReviewStatus,
    lastRejectionComment: latestRejection ? latestRejection.comment : null,
    posts: row.posts.map(toPost),
    postingPeriodDays: row.campaign.postingPeriodDays,
    postingDeadlineAt: deadline ? deadline.toISOString() : null,
    settlement,
    orderNumber: row.orderNumber,
    orderSubmittedAt: row.orderSubmittedAt ? row.orderSubmittedAt.toISOString() : null,
    reviewSubmittedAt: row.reviewSubmittedAt ? row.reviewSubmittedAt.toISOString() : null,
  };
}

const INCLUDE = {
  posts: true,
  submissionRejections: {
    orderBy: { rejectedAt: "desc" as const },
    take: 1,
    select: { comment: true, rejectedAt: true },
  },
  settlement: {
    select: { status: true, amountJpy: true, completedAt: true },
  },
  campaign: {
    select: {
      id: true,
      category: true,
      title: true,
      thumbnailUrl: true,
      rewardType: true,
      rewardJpy: true,
      postingPeriodDays: true,
      recruits: {
        select: { subType: true, insightRequired: true, rewardJpy: true },
      },
    },
  },
} as const;

@Injectable()
export class InfluencerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly line: LineMessagingService,
    private readonly dispatcher: LineDispatcherService,
  ) {}

  private async resolveResponse(
    row: ApplicationRow,
  ): Promise<InfluencerApplication> {
    const response = toResponse(row);
    response.campaignThumbnailUrl =
      await this.uploads.resolveCampaignThumbnailUrl(
        response.campaignThumbnailUrl,
      );
    return response;
  }

  async listForInfluencer(
    influencerId: string,
  ): Promise<InfluencerApplication[]> {
    // 취소된 응모도 재응모 불가 이력으로 노출되어야 하므로 목록에 포함.
    const rows = await this.prisma.campaignApplication.findMany({
      where: { influencerId },
      orderBy: { appliedAt: "desc" },
      include: INCLUDE,
    });
    return Promise.all(rows.map((row) => this.resolveResponse(row)));
  }

  async getForInfluencer(
    influencerId: string,
    applicationId: string,
  ): Promise<InfluencerApplication> {
    const row = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException("Application not found");
    if (row.influencerId !== influencerId) throw new ForbiddenException();
    // 취소된 응모는 인플루언서에게 "응모하지 않은 상태"로 보이도록 숨김
    if (row.status === "CANCELLED") {
      throw new NotFoundException("Application not found");
    }
    return this.resolveResponse(row);
  }

  async create(
    influencerId: string,
    campaignId: string,
    subTypesInput: CampaignSubType[],
    instagramPostType: InstagramPostType | null,
  ): Promise<InfluencerApplication> {
    let subTypes = subTypesInput;
    const now = new Date();
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        recruits: {
          select: {
            subType: true,
            minFollowers: true,
            recruitCount: true,
            subTypeOptions: true,
            isRequired: true,
          },
        },
        exclusionsAsExcluding: { select: { excludedCampaignId: true } },
      },
    });
    if (!campaign) {
      throw new BadRequestException({
        code: "CAMPAIGN_NOT_FOUND",
        message: "캠페인을 찾을 수 없습니다",
      });
    }
    if (campaign.closedAt || campaign.recruitEndAt < now) {
      throw new BadRequestException({
        code: "OUT_OF_RECRUIT_PERIOD",
        message: "모집 기간이 아닙니다",
      });
    }
    if (campaign.recruitStartAt > now) {
      throw new BadRequestException({
        code: "OUT_OF_RECRUIT_PERIOD",
        message: "모집이 아직 시작되지 않았습니다",
      });
    }

    if (campaign.category === "FAKE_PURCHASE") {
      subTypes = ["QOO10"];
    } else if (campaign.category === "SIMPLE_REVIEW") {
      const recruitSubTypes = campaign.recruits.map((recruit) => recruit.subType);
      const invalidSubTypes = subTypes.filter(
        (subType) => !recruitSubTypes.includes(subType),
      );
      if (invalidSubTypes.length > 0) {
        throw new BadRequestException({
          code: "SUBTYPE_CATEGORY_MISMATCH",
          message: "이 캠페인에서 모집하지 않는 서브타입이 포함되어 있습니다",
        });
      }
    } else {
      const invalidSubTypes = subTypes.filter(
        (subType) => !SNS_SUB_TYPES.includes(subType),
      );
      if (invalidSubTypes.length > 0) {
        throw new BadRequestException({
          code: "SUBTYPE_CATEGORY_MISMATCH",
          message: "선택한 SNS 는 이 캠페인에서 모집하지 않습니다",
        });
      }
    }

    // 필수 서브타입은 응모 요청에 반드시 포함되어야 한다. UI 는 자동 선택·잠금하지만
    // API 직접 호출 우회를 방지하기 위한 서버 측 방어. FAKE_PURCHASE 는 refine 에서
    // isRequired=true 를 이미 금지하므로 자동으로 빈 집합이 된다.
    const requiredSubTypes = campaign.recruits
      .filter((recruit) => recruit.isRequired)
      .map((recruit) => recruit.subType as CampaignSubType);
    const missingRequired = requiredSubTypes.filter(
      (subType) => !subTypes.includes(subType),
    );
    if (missingRequired.length > 0) {
      throw new BadRequestException({
        code: "REQUIRED_SUBTYPE_MISSING",
        message: "필수 참여 서브타입이 응모에 포함되지 않았습니다",
      });
    }

    // 한 캠페인에는 (취소 이력 포함) 1회만 응모할 수 있다.
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { campaignId_influencerId: { campaignId, influencerId } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException({
        code: "ALREADY_APPLIED",
        message: "이미 응모한 캠페인입니다",
      });
    }

    // 제외 캠페인에 "같은 SNS"로 응모한 이력이 있으면 그 SNS 응모만 차단 (CANCELLED 제외)
    const excludedCampaignIds = campaign.exclusionsAsExcluding.map(
      (exclusion) => exclusion.excludedCampaignId,
    );
    const excludedCampaignSubTypes = new Set<CampaignSubType>();
    if (excludedCampaignIds.length > 0) {
      const priorOnExcluded = await this.prisma.campaignApplication.findMany({
        where: {
          influencerId,
          campaignId: { in: excludedCampaignIds },
          status: { not: "CANCELLED" },
        },
        select: { subTypes: true },
      });
      for (const application of priorOnExcluded) {
        for (const subType of application.subTypes) {
          excludedCampaignSubTypes.add(subType);
        }
      }
    }

    if (campaign.category === "SNS") {
      const influencerSns = await this.prisma.influencerSnsAccount.findMany({
        where: { influencerId },
      });
      const minFollowersBySubType = new Map(
        campaign.recruits.map((recruit) => [recruit.subType, recruit.minFollowers]),
      );
      const followerByMySubType = new Map(
        influencerSns.map((account) => [
          account.snsType as CampaignSubType,
          account.followerCount,
        ]),
      );

      const qualifyingSubTypes = Array.from(minFollowersBySubType.entries())
        .filter(([subType, min]) => {
          const followerCount = followerByMySubType.get(subType);
          return followerCount !== undefined && followerCount >= min;
        })
        .map(([subType]) => subType);

      if (qualifyingSubTypes.length === 0) {
        throw new BadRequestException({
          code: "SNS_MISMATCH",
          message: "대상 SNS 응모 조건을 만족하는 계정이 없습니다",
        });
      }

      const qualifyingSet = new Set(qualifyingSubTypes);
      // 필수 서브타입이 자격 조건을 만족하지 않으면 응모 자체 불가 — 코드를 별도로
      // 구분해 프론트에서 안내 문구를 달리 노출한다.
      const requiredNotQualified = requiredSubTypes.filter(
        (subType) => !qualifyingSet.has(subType),
      );
      if (requiredNotQualified.length > 0) {
        throw new BadRequestException({
          code: "REQUIRED_SUBTYPE_NOT_QUALIFIED",
          message: "필수 참여 서브타입의 자격 조건을 만족하지 않습니다",
        });
      }
      const invalid = subTypes.filter((subType) => !qualifyingSet.has(subType));
      if (invalid.length > 0) {
        throw new BadRequestException({
          code: "SNS_NOT_QUALIFIED",
          message: "응모 조건을 만족하지 않는 SNS 가 포함되어 있습니다",
        });
      }
    }

    // INSTAGRAM 응모는 캠페인이 허용한 subTypeOptions(FEED/REELS) 중 정확히 1개를 선택해야 한다.
    const instagramRecruit = campaign.recruits.find(
      (recruit) => recruit.subType === "INSTAGRAM",
    );
    const wantsInstagram = subTypes.includes("INSTAGRAM");
    if (wantsInstagram) {
      if (!instagramPostType) {
        throw new BadRequestException({
          code: "INSTAGRAM_POST_TYPE_REQUIRED",
          message: "게시물 타입(피드/릴스) 을 선택해주세요",
        });
      }
      if (
        !instagramRecruit ||
        !instagramRecruit.subTypeOptions.includes(instagramPostType)
      ) {
        throw new BadRequestException({
          code: "INSTAGRAM_POST_TYPE_NOT_ALLOWED",
          message: "선택한 게시물 타입은 이 캠페인에서 모집하지 않습니다",
        });
      }
    }

    const blockedByExclusion = subTypes.filter((subType) =>
      excludedCampaignSubTypes.has(subType),
    );
    if (blockedByExclusion.length > 0) {
      throw new BadRequestException({
        code: "EXCLUDED_BY_PREVIOUS_APPLICATION",
        message:
          "동일 유형의 캠페인에 이미 응모한 이력이 있어 이 SNS 로는 응모할 수 없습니다",
      });
    }

    const row = await this.prisma.campaignApplication.create({
      data: {
        campaignId,
        influencerId,
        subTypes,
        status: "APPLIED",
        instagramPostType: wantsInstagram ? instagramPostType : null,
      },
      include: INCLUDE,
    });

    const created = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: row.id },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    const triggerKey =
      campaign.category === "FAKE_PURCHASE"
        ? "FAKE_PURCHASE_APPLICATION_APPLIED"
        : campaign.category === "SIMPLE_REVIEW"
          ? "SIMPLE_REVIEW_APPLICATION_APPLIED"
          : "SNS_APPLICATION_APPLIED";
    void this.dispatcher.dispatch(triggerKey, { application: created });
    return this.resolveResponse(row);
  }

  async cancel(
    influencerId: string,
    applicationId: string,
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwned(influencerId, applicationId);
    if (app.status !== "APPLIED") {
      throw new BadRequestException({
        code: "CANCEL_NOT_ALLOWED",
        message: "승인 이후에는 취소할 수 없습니다",
      });
    }
    // 응모 후 2일 이내에만 취소 가능. 이 시점이 지나면 취소 불가.
    const elapsedMs = Date.now() - app.appliedAt.getTime();
    if (elapsedMs > CANCEL_WINDOW_MS) {
      throw new BadRequestException({
        code: "CANCEL_WINDOW_EXPIRED",
        message: "응모 후 2일이 지나 취소할 수 없습니다",
      });
    }
    const updated = await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: { status: "CANCELLED" },
      include: INCLUDE,
    });
    return this.resolveResponse(updated);
  }

  async confirmReceipt(
    influencerId: string,
    applicationId: string,
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwnedWithCampaign(influencerId, applicationId);
    if (app.campaign.category !== "SNS" && app.campaign.category !== "SIMPLE_REVIEW") {
      throw new BadRequestException({
        code: "CATEGORY_MISMATCH",
        message: "이 카테고리 캠페인에서는 사용할 수 없습니다",
      });
    }
    if (app.status !== "SHIPPED" && app.status !== "DELIVERED") {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "발송 중 또는 배송 완료 상태에서만 수령 확인이 가능합니다",
      });
    }
    if (app.receivedAt) {
      throw new BadRequestException({
        code: "ALREADY_RECEIVED",
        message: "이미 수령 확인이 완료된 응모입니다",
      });
    }
    const updated = await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: { receivedAt: new Date() },
      include: INCLUDE,
    });
    const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    const receiptTriggerKey =
      app.campaign.category === "SIMPLE_REVIEW"
        ? "SIMPLE_REVIEW_APPLICATION_RECEIPT_CONFIRMED"
        : "SNS_APPLICATION_RECEIPT_CONFIRMED";
    void this.dispatcher.dispatch(receiptTriggerKey, {
      application: refreshed,
    });
    return this.resolveResponse(updated);
  }

  /**
   * SNS 게시물 URL 일괄 제출 — 참여한 모든 SNS 서브타입의 URL 을 한 번에 제출한다.
   * 제출 시 상태가 REVIEW_SUBMITTED 로 전환되고, 검토 상태는 PENDING 으로 리셋된다.
   */
  async submitSubmission(
    influencerId: string,
    applicationId: string,
    posts: { subType: CampaignSubType; url: string }[],
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwnedWithCampaign(influencerId, applicationId);
    if (app.campaign.category !== "SNS") {
      throw new BadRequestException({
        code: "CATEGORY_MISMATCH",
        message: "SNS 캠페인에서만 사용할 수 있습니다",
      });
    }
    if (!app.receivedAt) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "수령 확인 후에만 게시물 URL 을 제출할 수 있습니다",
      });
    }
    const isFirstSubmission =
      app.status === "SHIPPED" || app.status === "DELIVERED";
    const isResubmission =
      app.status === "REVIEW_SUBMITTED" &&
      app.submissionReviewStatus !== "APPROVED";
    if (!isFirstSubmission && !isResubmission) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "현재 상태에서는 게시물 URL 을 제출할 수 없습니다",
      });
    }

    const submittedSubTypes = new Set(posts.map((post) => post.subType));
    const participating = new Set(app.subTypes);
    const missing = app.subTypes.filter(
      (subType) => !submittedSubTypes.has(subType),
    );
    const extra = posts.filter((post) => !participating.has(post.subType));
    if (missing.length > 0 || extra.length > 0) {
      throw new BadRequestException({
        code: "SNS_NOT_SELECTED",
        message: "참여한 모든 SNS 의 게시물 URL 을 한 번에 제출해주세요",
      });
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const post of posts) {
        await tx.submittedPost.upsert({
          where: {
            applicationId_subType: { applicationId, subType: post.subType },
          },
          create: { applicationId, subType: post.subType, url: post.url },
          update: { url: post.url, submittedAt: now },
        });
      }
      await tx.campaignApplication.update({
        where: { id: applicationId },
        data: {
          status: "REVIEW_SUBMITTED",
          reviewSubmittedAt: now,
          submissionReviewStatus: "PENDING",
          submissionReviewedAt: null,
          submissionReviewedById: null,
        },
      });
    });

    const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    void this.dispatcher.dispatch("SNS_POST_SUBMITTED", {
      application: refreshed,
    });

    return this.getForInfluencer(influencerId, applicationId);
  }

  /**
   * SNS 인사이트 일괄 제출 — 참여한 모든 SNS 서브타입의 지표를 한 번에 제출한다.
   */
  async submitInsights(
    influencerId: string,
    applicationId: string,
    insights: {
      subType: CampaignSubType;
      likes: number;
      comments: number;
      shares: number;
      reposts: number;
      saves: number;
      views: number;
      reach: number;
      attachments?: AttachmentUploadInput[];
    }[],
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwnedWithCampaign(influencerId, applicationId);
    if (app.campaign.category !== "SNS") {
      throw new BadRequestException({
        code: "CATEGORY_MISMATCH",
        message: "SNS 캠페인에서만 사용할 수 있습니다",
      });
    }
    const existingPosts = await this.prisma.submittedPost.findMany({
      where: { applicationId },
      select: { id: true, subType: true },
    });
    const postBySubType = new Map(
      existingPosts.map((post) => [post.subType, post]),
    );
    const submittedSubTypes = new Set(insights.map((insight) => insight.subType));
    const missing = app.subTypes.filter(
      (subType) => !submittedSubTypes.has(subType),
    );
    if (missing.length > 0) {
      throw new BadRequestException({
        code: "INSIGHT_INCOMPLETE",
        message: "참여한 모든 SNS 의 인사이트를 한 번에 제출해주세요",
      });
    }
    for (const insight of insights) {
      if (!postBySubType.has(insight.subType)) {
        throw new BadRequestException({
          code: "POST_NOT_SUBMITTED",
          message: "먼저 게시물 URL 을 제출해주세요",
        });
      }
    }

    const now = new Date();
    for (const insight of insights) {
      const post = postBySubType.get(insight.subType)!;
      await this.prisma.submittedPost.update({
        where: { id: post.id },
        data: {
          insightLikes: insight.likes,
          insightComments: insight.comments,
          insightShares: insight.shares,
          insightReposts: insight.reposts,
          insightSaves: insight.saves,
          insightViews: insight.views,
          insightReach: insight.reach,
          insightSubmittedAt: now,
        },
      });
      if (insight.attachments && insight.attachments.length > 0) {
        await this.uploads.attachInsightUploads(post.id, insight.attachments);
      }
    }
    // 제출물이 이미 승인된 상태라면 인사이트 제출 시점에 자동 정산.
    await ensureSettlementForApplication(this.prisma, applicationId);

    const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    void this.dispatcher.dispatch("SNS_INSIGHT_SUBMITTED", {
      application: refreshed,
    });

    return this.getForInfluencer(influencerId, applicationId);
  }

  async submitOrder(
    influencerId: string,
    applicationId: string,
    orderNumber: string,
    receipts: AttachmentUploadInput[],
  ): Promise<InfluencerApplication> {
    const application = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: { campaign: { select: { category: true } } },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.influencerId !== influencerId) {
      throw new ForbiddenException();
    }
    if (application.campaign.category !== "FAKE_PURCHASE") {
      throw new BadRequestException({
        code: "CATEGORY_MISMATCH",
        message: "가구매 리뷰 캠페인에서만 사용할 수 있습니다",
      });
    }
    if (
      application.status !== "APPROVED" &&
      application.status !== "ORDER_SUBMITTED"
    ) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "현재 상태에서는 주문 정보를 제출할 수 없습니다",
      });
    }
    const trimmedOrderNumber = orderNumber.trim();
    if (trimmedOrderNumber.length === 0) {
      throw new BadRequestException({
        code: "ORDER_NUMBER_REQUIRED",
        message: "주문번호를 입력해주세요",
      });
    }
    if (receipts.length < 1) {
      throw new BadRequestException({
        code: "RECEIPT_REQUIRED",
        message: "주문 명세 스크린샷을 1장 이상 제출해주세요",
      });
    }

    await this.uploads.verifyAttachmentUploads(receipts, "attachments/");

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.deleteMany({
        where: { applicationId, kind: "ORDER_RECEIPT" },
      });
      await tx.attachment.createMany({
        data: receipts.map((receipt) => ({
          kind: "ORDER_RECEIPT" as const,
          applicationId,
          postId: null,
          objectKey: receipt.objectKey,
          contentType: receipt.contentType,
          sizeBytes: receipt.sizeBytes,
        })),
        skipDuplicates: true,
      });
      await tx.campaignApplication.update({
        where: { id: applicationId },
        data: {
          orderNumber: trimmedOrderNumber,
          orderSubmittedAt: now,
          status: "ORDER_SUBMITTED",
        },
      });
    });

    const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    void this.dispatcher.dispatch("FAKE_PURCHASE_ORDER_SUBMITTED", {
      application: refreshed,
    });
    return this.getForInfluencer(influencerId, applicationId);
  }

  async submitReview(
    influencerId: string,
    applicationId: string,
    screenshots: AttachmentUploadInput[],
    reviewUrls: Partial<Record<"LIPS" | "ATCOSME", string>>,
  ): Promise<InfluencerApplication> {
    const application = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: {
        campaign: {
          select: {
            category: true,
            recruits: {
              select: { subType: true, subTypeOptions: true },
            },
          },
        },
        posts: { select: { id: true } },
      },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.influencerId !== influencerId) {
      throw new ForbiddenException();
    }
    if (application.campaign.category !== "FAKE_PURCHASE") {
      throw new BadRequestException({
        code: "CATEGORY_MISMATCH",
        message: "가구매 리뷰 캠페인에서만 사용할 수 있습니다",
      });
    }

    const existingPost = application.posts[0] ?? null;
    const isResubmission =
      application.status === "REVIEW_SUBMITTED" &&
      application.submissionReviewStatus === "REJECTED";
    const isFirstSubmission = application.status === "ORDER_SUBMITTED";

    if (!isFirstSubmission && !isResubmission) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "현재 상태에서는 리뷰를 제출할 수 없습니다",
      });
    }

    const qooRecruit = application.campaign.recruits.find(
      (recruit) => recruit.subType === "QOO10",
    );
    const requiredChannels = (qooRecruit?.subTypeOptions ?? []).filter(
      (option): option is "LIPS" | "ATCOSME" =>
        option === "LIPS" || option === "ATCOSME",
    );
    const requiredChannelSet = new Set<"LIPS" | "ATCOSME">(requiredChannels);

    const normalizedReviewUrls: Partial<Record<"LIPS" | "ATCOSME", string>> = {};
    for (const channel of ["LIPS", "ATCOSME"] as const) {
      const rawValue = reviewUrls[channel];
      if (rawValue === undefined) continue;
      const trimmed = rawValue.trim();
      if (trimmed.length === 0) continue;
      if (!requiredChannelSet.has(channel)) {
        throw new BadRequestException({
          code: "REVIEW_URL_NOT_REQUESTED",
          message: "이 캠페인에서 요구하지 않는 리뷰 URL 이 포함되어 있습니다",
        });
      }
      normalizedReviewUrls[channel] = trimmed;
    }
    for (const channel of requiredChannels) {
      if (!normalizedReviewUrls[channel]) {
        throw new BadRequestException({
          code: "REVIEW_URL_REQUIRED",
          message: "리뷰 URL 을 입력해주세요",
        });
      }
    }

    // Qoo10 기본 2장 + 요구 채널(LIPS/@cosme)당 1장
    const requiredScreenshotCount = 2 + requiredChannels.length;
    if (screenshots.length < requiredScreenshotCount) {
      throw new BadRequestException({
        code: "REVIEW_SCREENSHOTS_REQUIRED",
        message: `리뷰 스크린샷을 ${requiredScreenshotCount}장 이상 제출해주세요`,
      });
    }

    await this.uploads.verifyAttachmentUploads(screenshots, "attachments/");

    const now = new Date();
    const submissionData = { reviewUrls: normalizedReviewUrls };

    const postId = await this.prisma.$transaction(async (tx) => {
      let currentPostId: string;
      if (existingPost) {
        await tx.submittedPost.update({
          where: { id: existingPost.id },
          data: {
            url: null,
            submissionData,
            submittedAt: now,
          },
        });
        await tx.attachment.deleteMany({
          where: { postId: existingPost.id, kind: "REVIEW_SCREENSHOT" },
        });
        currentPostId = existingPost.id;
      } else {
        const created = await tx.submittedPost.create({
          data: {
            applicationId,
            subType: "QOO10",
            url: null,
            submissionData,
            submittedAt: now,
          },
        });
        currentPostId = created.id;
      }
      await tx.attachment.createMany({
        data: screenshots.map((screenshot) => ({
          kind: "REVIEW_SCREENSHOT" as const,
          applicationId,
          postId: currentPostId,
          objectKey: screenshot.objectKey,
          contentType: screenshot.contentType,
          sizeBytes: screenshot.sizeBytes,
        })),
        skipDuplicates: true,
      });
      await tx.campaignApplication.update({
        where: { id: applicationId },
        data: {
          reviewSubmittedAt: now,
          status: "REVIEW_SUBMITTED",
          submissionReviewStatus: "PENDING",
          submissionReviewedAt: null,
          submissionReviewedById: null,
        },
      });
      return currentPostId;
    });

    const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    const post = await this.prisma.submittedPost.findUnique({
      where: { id: postId },
    });
    void this.dispatcher.dispatch("FAKE_PURCHASE_REVIEW_SUBMITTED", {
      application: refreshed,
      post,
    });
    return this.getForInfluencer(influencerId, applicationId);
  }

  /**
   * 단순 리뷰(SIMPLE_REVIEW) 리뷰 일괄 제출.
   * 참여한 모든 서브타입(LIPS/ATCOSME)의 리뷰 URL 을 한 번에 제출하고,
   * 스크린샷은 응모 공용으로 첨부한다. 최초 제출 또는 반려 후 재제출을 지원.
   */
  async submitSimpleReview(
    influencerId: string,
    applicationId: string,
    reviews: { subType: CampaignSubType; url: string }[],
    screenshots: AttachmentUploadInput[],
  ): Promise<InfluencerApplication> {
    const application = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: {
        campaign: { select: { category: true } },
        posts: { select: { id: true, subType: true } },
      },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.influencerId !== influencerId) {
      throw new ForbiddenException();
    }
    if (application.campaign.category !== "SIMPLE_REVIEW") {
      throw new BadRequestException({
        code: "CATEGORY_MISMATCH",
        message: "단순 리뷰 캠페인에서만 사용할 수 있습니다",
      });
    }

    if (!application.receivedAt) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "수령 확인 후에만 리뷰를 제출할 수 있습니다",
      });
    }
    const isResubmission =
      application.status === "REVIEW_SUBMITTED" &&
      application.submissionReviewStatus === "REJECTED";
    const isFirstSubmission =
      application.status === "SHIPPED" || application.status === "DELIVERED";
    if (!isFirstSubmission && !isResubmission) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "현재 상태에서는 리뷰를 제출할 수 없습니다",
      });
    }

    const submittedSubTypes = new Set(reviews.map((review) => review.subType));
    const participating = new Set(application.subTypes);
    const missing = application.subTypes.filter(
      (subType) => !submittedSubTypes.has(subType),
    );
    const extra = reviews.filter(
      (review) => !participating.has(review.subType),
    );
    if (missing.length > 0 || extra.length > 0) {
      throw new BadRequestException({
        code: "REVIEW_URL_REQUIRED",
        message: "참여한 모든 리뷰 채널의 URL 을 한 번에 제출해주세요",
      });
    }
    const normalizedReviews = reviews.map((review) => {
      const trimmed = review.url.trim();
      if (!/^https:\/\//i.test(trimmed)) {
        throw new BadRequestException({
          code: "REVIEW_URL_INVALID",
          message: "https:// 로 시작하는 URL 을 입력해주세요",
        });
      }
      return { subType: review.subType, url: trimmed };
    });
    if (screenshots.length < 1) {
      throw new BadRequestException({
        code: "REVIEW_SCREENSHOTS_REQUIRED",
        message: "리뷰 스크린샷을 1장 이상 제출해주세요",
      });
    }

    await this.uploads.verifyAttachmentUploads(screenshots, "attachments/");

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const review of normalizedReviews) {
        await tx.submittedPost.upsert({
          where: {
            applicationId_subType: {
              applicationId,
              subType: review.subType,
            },
          },
          create: {
            applicationId,
            subType: review.subType,
            url: review.url,
            submittedAt: now,
          },
          update: { url: review.url, submittedAt: now },
        });
      }
      // 스크린샷은 응모 공용(post 미지정)으로 교체 저장.
      await tx.attachment.deleteMany({
        where: { applicationId, kind: "REVIEW_SCREENSHOT" },
      });
      await tx.attachment.createMany({
        data: screenshots.map((screenshot) => ({
          kind: "REVIEW_SCREENSHOT" as const,
          applicationId,
          postId: null,
          objectKey: screenshot.objectKey,
          contentType: screenshot.contentType,
          sizeBytes: screenshot.sizeBytes,
        })),
        skipDuplicates: true,
      });
      await tx.campaignApplication.update({
        where: { id: applicationId },
        data: {
          status: "REVIEW_SUBMITTED",
          reviewSubmittedAt: now,
          submissionReviewStatus: "PENDING",
          submissionReviewedAt: null,
          submissionReviewedById: null,
        },
      });
    });

    const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    void this.dispatcher.dispatch("SIMPLE_REVIEW_SUBMITTED", {
      application: refreshed,
    });
    return this.getForInfluencer(influencerId, applicationId);
  }

  private async assertOwned(influencerId: string, applicationId: string) {
    const app = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException("Application not found");
    if (app.influencerId !== influencerId) throw new ForbiddenException();
    return app;
  }

  private async assertOwnedWithCampaign(
    influencerId: string,
    applicationId: string,
  ) {
    const application = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: { campaign: { select: { category: true } } },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.influencerId !== influencerId) throw new ForbiddenException();
    return application;
  }
}
