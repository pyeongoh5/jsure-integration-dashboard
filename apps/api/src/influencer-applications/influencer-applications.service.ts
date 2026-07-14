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
  SubmittedPost,
  ApplicationStatus,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";
import {
  deriveDisplayStage,
  postingDeadline,
} from "../influencer-campaigns/display-stage";
import { ensureSettlementForPost } from "../settlements/ensure-settlement";
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
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt: Date | null;
  rejections: { comment: string; rejectedAt: Date }[];
  settlement: {
    status: "PENDING" | "COMPLETED";
    amountJpy: number;
    completedAt: Date | null;
  } | null;
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
  subType: CampaignSubType;
  instagramPostType: InstagramPostType | null;
  orderNumber: string | null;
  orderSubmittedAt: Date | null;
  reviewSubmittedAt: Date | null;
  posts: PostRow[];
  campaign: {
    id: string;
    category: CampaignCategory;
    title: string;
    thumbnailUrl: string | null;
    rewardJpy: number;
    postingPeriodDays: number;
    recruits: { subType: CampaignSubType; insightRequired: boolean }[];
  };
};

function toPost(row: PostRow): SubmittedPost {
  const latestRejection =
    row.reviewStatus === "REJECTED" ? row.rejections[0] ?? null : null;
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
    reviewStatus: row.reviewStatus,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    lastRejectionComment: latestRejection ? latestRejection.comment : null,
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
  // 가장 최근에 완료된 정산을 대표로 사용 (1 application = 1 SNS = 1 post 흐름)
  const settledPost =
    row.posts.find((p) => p.settlement?.status === "COMPLETED") ??
    row.posts.find((p) => p.settlement != null);
  const settlement = settledPost?.settlement
    ? {
        status: settledPost.settlement.status,
        amountJpy: settledPost.settlement.amountJpy,
        completedAt: settledPost.settlement.completedAt
          ? settledPost.settlement.completedAt.toISOString()
          : null,
      }
    : null;
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignCategory: row.campaign.category,
    campaignTitle: row.campaign.title,
    campaignThumbnailUrl: row.campaign.thumbnailUrl,
    rewardJpy: row.campaign.rewardJpy,
    status: row.status,
    displayStage: deriveDisplayStage({
      status: row.status,
      category: row.campaign.category,
      receivedAt: row.receivedAt,
      posts: row.posts.map((p) => ({
        submittedAt: p.submittedAt,
        insightSubmittedAt: p.insightSubmittedAt,
        reviewStatus: p.reviewStatus,
        settlementStatus: p.settlement?.status ?? null,
        insightRequired:
          row.campaign.recruits.find((recruit) => recruit.subType === p.subType)
            ?.insightRequired ?? true,
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
    subType: row.subType,
    instagramPostType: row.instagramPostType,
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
  posts: {
    include: {
      rejections: {
        orderBy: { rejectedAt: "desc" as const },
        take: 1,
        select: { comment: true, rejectedAt: true },
      },
      settlement: {
        select: { status: true, amountJpy: true, completedAt: true },
      },
    },
  },
  campaign: {
    select: {
      id: true,
      category: true,
      title: true,
      thumbnailUrl: true,
      rewardJpy: true,
      postingPeriodDays: true,
      recruits: {
        select: { subType: true, insightRequired: true },
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
        select: { subType: true },
        distinct: ["subType"],
      });
      for (const application of priorOnExcluded) {
        excludedCampaignSubTypes.add(application.subType);
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

    // 각 subType 별로 신규 application row 를 생성한다.
    // 한 번이라도 응모했다가 취소된 경우 재응모 불가 — CANCELLED row 가 그대로 차단 역할.
    const results: InfluencerApplication[] = [];
    for (const subType of subTypes) {
      const existing = await this.prisma.campaignApplication.findUnique({
        where: {
          campaignId_influencerId_subType: {
            campaignId,
            influencerId,
            subType,
          },
        },
      });

      if (existing) {
        // 활성 응모 / 취소 이력 모두 재응모 차단. 신규 SNS 만 진행.
        continue;
      }

      const postTypeForRow =
        subType === "INSTAGRAM" ? instagramPostType : null;
      const row = await this.prisma.campaignApplication.create({
        data: {
          campaignId,
          influencerId,
          subType,
          status: "APPLIED",
          instagramPostType: postTypeForRow,
        },
        include: INCLUDE,
      });
      results.push(await this.resolveResponse(row));
    }

    if (results.length === 0) {
      throw new BadRequestException({
        code: "ALREADY_APPLIED",
        message: "선택한 SNS 는 이미 응모하셨습니다",
      });
    }
    const createdApplications = await this.prisma.campaignApplication.findMany({
      where: { id: { in: results.map((r) => r.id) } },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    const triggerKey =
      campaign.category === "FAKE_PURCHASE"
        ? "FAKE_PURCHASE_APPLICATION_APPLIED"
        : campaign.category === "SIMPLE_REVIEW"
          ? "SIMPLE_REVIEW_APPLICATION_APPLIED"
          : "SNS_APPLICATION_APPLIED";
    for (const application of createdApplications) {
      void this.dispatcher.dispatch(triggerKey, { application });
    }
    return results[0]!;
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

  async upsertPost(
    influencerId: string,
    applicationId: string,
    subType: CampaignSubType,
    url: string,
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
    // 이제 application 자체가 단일 subType 을 가지므로 단순 비교.
    if (app.subType !== subType) {
      throw new BadRequestException({
        code: "SNS_NOT_SELECTED",
        message: "응모한 SNS 와 일치하지 않습니다",
      });
    }

    const existing = await this.prisma.submittedPost.findUnique({
      where: { applicationId_subType: { applicationId, subType } },
      select: { reviewStatus: true },
    });
    if (existing?.reviewStatus === "APPROVED") {
      throw new BadRequestException({
        code: "POST_ALREADY_APPROVED",
        message: "이미 승인된 게시물은 변경할 수 없습니다",
      });
    }

    const post = await this.prisma.submittedPost.upsert({
      where: {
        applicationId_subType: { applicationId, subType },
      },
      create: { applicationId, subType, url },
      update: {
        url,
        submittedAt: new Date(),
        reviewStatus: "PENDING",
        reviewedAt: null,
        reviewedById: null,
      },
    });

    const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    void this.dispatcher.dispatch("SNS_POST_SUBMITTED", {
      application: refreshed,
      post,
    });

    return this.getForInfluencer(influencerId, applicationId);
  }

  async upsertInsight(
    influencerId: string,
    applicationId: string,
    subType: CampaignSubType,
    input: {
      likes: number;
      comments: number;
      shares: number;
      reposts: number;
      saves: number;
      views: number;
      reach: number;
      attachments?: {
        objectKey: string;
        contentType: "image/png" | "image/jpeg" | "image/webp";
        sizeBytes: number;
      }[];
    },
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwnedWithCampaign(influencerId, applicationId);
    if (app.campaign.category !== "SNS") {
      throw new BadRequestException({
        code: "CATEGORY_MISMATCH",
        message: "SNS 캠페인에서만 사용할 수 있습니다",
      });
    }
    const post = await this.prisma.submittedPost.findUnique({
      where: { applicationId_subType: { applicationId, subType } },
    });
    if (!post) {
      throw new BadRequestException({
        code: "POST_NOT_SUBMITTED",
        message: "먼저 게시물 URL 을 제출해주세요",
      });
    }
    const updatedPost = await this.prisma.submittedPost.update({
      where: { id: post.id },
      data: {
        insightLikes: input.likes,
        insightComments: input.comments,
        insightShares: input.shares,
        insightReposts: input.reposts,
        insightSaves: input.saves,
        insightViews: input.views,
        insightReach: input.reach,
        insightSubmittedAt: new Date(),
      },
    });
    if (input.attachments && input.attachments.length > 0) {
      await this.uploads.attachInsightUploads(post.id, input.attachments);
    }
    // 투고가 이미 승인된 상태라면 인사이트 제출 시점에 자동 정산.
    await ensureSettlementForPost(this.prisma, post.id);

    const refreshed = await this.prisma.campaignApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: DISPATCH_APPLICATION_INCLUDE,
    });
    void this.dispatcher.dispatch("SNS_INSIGHT_SUBMITTED", {
      application: refreshed,
      post: updatedPost,
    });

    return this.getForInfluencer(influencerId, applicationId);
  }

  async submitOrder(
    influencerId: string,
    applicationId: string,
    orderNumber: string,
    receipts: {
      objectKey: string;
      contentType: "image/png" | "image/jpeg" | "image/webp";
      sizeBytes: number;
    }[],
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
        posts: {
          select: { id: true, reviewStatus: true },
        },
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
      existingPost?.reviewStatus === "REJECTED";
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

    if (screenshots.length < 2) {
      throw new BadRequestException({
        code: "REVIEW_SCREENSHOTS_REQUIRED",
        message: "리뷰 스크린샷을 2장 이상 제출해주세요",
      });
    }

    await this.uploads.verifyAttachmentUploads(screenshots, "attachments/");

    const now = new Date();
    const subType = application.subType;
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
            reviewStatus: "PENDING",
            reviewedAt: null,
            reviewedById: null,
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
            subType,
            url: null,
            submissionData,
            submittedAt: now,
            reviewStatus: "PENDING",
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
   * 단순 리뷰(SIMPLE_REVIEW) 리뷰 URL 제출.
   * 최초 제출 또는 반려 후 재제출을 지원. URL만 저장하고 스크린샷/서브옵션은 사용하지 않는다.
   */
  async submitSimpleReview(
    influencerId: string,
    applicationId: string,
    url: string,
  ): Promise<InfluencerApplication> {
    const application = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: {
        campaign: { select: { category: true } },
        posts: { select: { id: true, reviewStatus: true } },
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
    const existingPost = application.posts[0] ?? null;
    const isResubmission =
      application.status === "REVIEW_SUBMITTED" &&
      existingPost?.reviewStatus === "REJECTED";
    const isFirstSubmission =
      application.status === "SHIPPED" || application.status === "DELIVERED";
    if (!isFirstSubmission && !isResubmission) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "현재 상태에서는 리뷰를 제출할 수 없습니다",
      });
    }

    const trimmed = url.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException({
        code: "REVIEW_URL_REQUIRED",
        message: "리뷰 URL 을 입력해주세요",
      });
    }
    if (!/^https:\/\//i.test(trimmed)) {
      throw new BadRequestException({
        code: "REVIEW_URL_INVALID",
        message: "https:// 로 시작하는 URL 을 입력해주세요",
      });
    }

    const now = new Date();
    const subType = application.subType;
    const postId = await this.prisma.$transaction(async (tx) => {
      let currentPostId: string;
      if (existingPost) {
        await tx.submittedPost.update({
          where: { id: existingPost.id },
          data: {
            url: trimmed,
            submittedAt: now,
            reviewStatus: "PENDING",
            reviewedAt: null,
            reviewedById: null,
          },
        });
        currentPostId = existingPost.id;
      } else {
        const created = await tx.submittedPost.create({
          data: {
            applicationId,
            subType,
            url: trimmed,
            submittedAt: now,
            reviewStatus: "PENDING",
          },
        });
        currentPostId = created.id;
      }
      await tx.campaignApplication.update({
        where: { id: applicationId },
        data: { status: "REVIEW_SUBMITTED" },
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
    void this.dispatcher.dispatch("SIMPLE_REVIEW_SUBMITTED", {
      application: refreshed,
      post,
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
