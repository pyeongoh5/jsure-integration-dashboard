import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  InfluencerApplication,
  InstagramPostType,
  SnsType,
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

/** 응모 후 인플루언서가 직접 취소할 수 있는 기간(2일, 밀리초). */
const CANCEL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

type PostRow = {
  id: string;
  snsType: SnsType;
  url: string;
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
  snsType: SnsType;
  instagramPostType: InstagramPostType | null;
  posts: PostRow[];
  campaign: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    rewardJpy: number;
    postingPeriodDays: number;
    snsRecruits: { snsType: SnsType; insightRequired: boolean }[];
  };
};

function toPost(row: PostRow): SubmittedPost {
  const latestRejection =
    row.reviewStatus === "REJECTED" ? row.rejections[0] ?? null : null;
  return {
    id: row.id,
    snsType: row.snsType,
    url: row.url,
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
  const deadline = postingDeadline(
    row.receivedAt,
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
    campaignTitle: row.campaign.title,
    campaignThumbnailUrl: row.campaign.thumbnailUrl,
    rewardJpy: row.campaign.rewardJpy,
    status: row.status,
    displayStage: deriveDisplayStage({
      status: row.status,
      receivedAt: row.receivedAt,
      posts: row.posts.map((p) => ({
        submittedAt: p.submittedAt,
        insightSubmittedAt: p.insightSubmittedAt,
        reviewStatus: p.reviewStatus,
        settlementStatus: p.settlement?.status ?? null,
        insightRequired:
          row.campaign.snsRecruits.find((recruit) => recruit.snsType === p.snsType)
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
    snsType: row.snsType,
    instagramPostType: row.instagramPostType,
    posts: row.posts.map(toPost),
    postingPeriodDays: row.campaign.postingPeriodDays,
    postingDeadlineAt: deadline ? deadline.toISOString() : null,
    settlement,
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
      title: true,
      thumbnailUrl: true,
      rewardJpy: true,
      postingPeriodDays: true,
      snsRecruits: {
        select: { snsType: true, insightRequired: true },
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
    snsTypes: SnsType[],
    instagramPostType: InstagramPostType | null,
  ): Promise<InfluencerApplication> {
    const now = new Date();
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        snsRecruits: {
          select: {
            snsType: true,
            minFollowers: true,
            recruitCount: true,
            instagramPostTypes: true,
          },
        },
        exclusionsAsExcluding: { select: { excludedCampaignId: true } },
      },
    });
    if (!campaign) {
      throw new BadRequestException({
        code: "CAMPAIGN_NOT_FOUND",
        message: "キャンペーンが見つかりません",
      });
    }
    if (campaign.closedAt || campaign.recruitEndAt < now) {
      throw new BadRequestException({
        code: "OUT_OF_RECRUIT_PERIOD",
        message: "募集期間外です",
      });
    }
    if (campaign.recruitStartAt > now) {
      throw new BadRequestException({
        code: "OUT_OF_RECRUIT_PERIOD",
        message: "募集はまだ開始していません",
      });
    }

    // 제외 캠페인에 "같은 SNS"로 응모한 이력이 있으면 그 SNS 응모만 차단 (CANCELLED 제외)
    const excludedCampaignIds = campaign.exclusionsAsExcluding.map(
      (exclusion) => exclusion.excludedCampaignId,
    );
    const excludedSnsTypes = new Set<SnsType>();
    if (excludedCampaignIds.length > 0) {
      const priorOnExcluded = await this.prisma.campaignApplication.findMany({
        where: {
          influencerId,
          campaignId: { in: excludedCampaignIds },
          status: { not: "CANCELLED" },
        },
        select: { snsType: true },
        distinct: ["snsType"],
      });
      for (const application of priorOnExcluded) {
        excludedSnsTypes.add(application.snsType);
      }
    }

    const influencerSns = await this.prisma.influencerSnsAccount.findMany({
      where: { influencerId },
    });
    const minFollowersBySns = new Map(
      campaign.snsRecruits.map((r) => [r.snsType, r.minFollowers]),
    );
    const followerByMySns = new Map(
      influencerSns.map((s) => [s.snsType, s.followerCount]),
    );

    const qualifyingSns = Array.from(minFollowersBySns.entries())
      .filter(([sns, min]) => {
        const f = followerByMySns.get(sns);
        return f !== undefined && f >= min;
      })
      .map(([sns]) => sns);

    if (qualifyingSns.length === 0) {
      throw new BadRequestException({
        code: "SNS_MISMATCH",
        message: "対象SNSの応募条件を満たすアカウントがありません",
      });
    }

    const qualifyingSet = new Set(qualifyingSns);
    const invalid = snsTypes.filter((snsType) => !qualifyingSet.has(snsType));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: "SNS_NOT_QUALIFIED",
        message: "応募条件を満たさないSNSが含まれています",
      });
    }

    // INSTAGRAM 응모는 캠페인이 허용한 instagramPostTypes 중 정확히 1개를 선택해야 한다.
    const instagramRecruit = campaign.snsRecruits.find(
      (recruit) => recruit.snsType === "INSTAGRAM",
    );
    const wantsInstagram = snsTypes.includes("INSTAGRAM");
    if (wantsInstagram) {
      if (!instagramPostType) {
        throw new BadRequestException({
          code: "INSTAGRAM_POST_TYPE_REQUIRED",
          message: "投稿タイプ（フィード/リール）を選択してください",
        });
      }
      if (
        !instagramRecruit ||
        !instagramRecruit.instagramPostTypes.includes(instagramPostType)
      ) {
        throw new BadRequestException({
          code: "INSTAGRAM_POST_TYPE_NOT_ALLOWED",
          message: "選択した投稿タイプはこのキャンペーンで募集していません",
        });
      }
    }

    const blockedByExclusion = snsTypes.filter((snsType) =>
      excludedSnsTypes.has(snsType),
    );
    if (blockedByExclusion.length > 0) {
      throw new BadRequestException({
        code: "EXCLUDED_BY_PREVIOUS_APPLICATION",
        message:
          "同種のキャンペーンに既に応募済みのため、このSNSでは応募できません",
      });
    }

    // 각 snsType 별로 신규 application row 를 생성한다.
    // 한 번이라도 응모했다가 취소된 경우 재응모 불가 — CANCELLED row 가 그대로 차단 역할.
    const results: InfluencerApplication[] = [];
    for (const snsType of snsTypes) {
      const existing = await this.prisma.campaignApplication.findUnique({
        where: {
          campaignId_influencerId_snsType: {
            campaignId,
            influencerId,
            snsType,
          },
        },
      });

      if (existing) {
        // 활성 응모 / 취소 이력 모두 재응모 차단. 신규 SNS 만 진행.
        continue;
      }

      const postTypeForRow =
        snsType === "INSTAGRAM" ? instagramPostType : null;
      const row = await this.prisma.campaignApplication.create({
        data: {
          campaignId,
          influencerId,
          snsType,
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
        message: "選択したSNSはすでに応募済みです",
      });
    }
    await this.line.notifyApplied({
      influencerId,
      campaignTitle: campaign.title,
    });
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
        message: "承認後はキャンセルできません",
      });
    }
    // 응모 후 2일 이내에만 취소 가능. 이 시점이 지나면 취소 불가.
    const elapsedMs = Date.now() - app.appliedAt.getTime();
    if (elapsedMs > CANCEL_WINDOW_MS) {
      throw new BadRequestException({
        code: "CANCEL_WINDOW_EXPIRED",
        message: "応募から2日を過ぎたためキャンセルできません",
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
    const app = await this.assertOwned(influencerId, applicationId);
    if (app.status !== "SHIPPED" && app.status !== "DELIVERED") {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "発送中または配送完了の応募のみ受領確認できます",
      });
    }
    if (app.receivedAt) {
      throw new BadRequestException({
        code: "ALREADY_RECEIVED",
        message: "すでに受領確認済みです",
      });
    }
    const updated = await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: { receivedAt: new Date() },
      include: INCLUDE,
    });
    return this.resolveResponse(updated);
  }

  async upsertPost(
    influencerId: string,
    applicationId: string,
    snsType: SnsType,
    url: string,
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwned(influencerId, applicationId);
    if (!app.receivedAt) {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "受領確認後のみ投稿URLを提出できます",
      });
    }
    // 이제 application 자체가 단일 snsType 을 가지므로 단순 비교.
    if (app.snsType !== snsType) {
      throw new BadRequestException({
        code: "SNS_NOT_SELECTED",
        message: "応募のSNSと一致しません",
      });
    }

    const existing = await this.prisma.submittedPost.findUnique({
      where: { applicationId_snsType: { applicationId, snsType } },
      select: { reviewStatus: true },
    });
    if (existing?.reviewStatus === "APPROVED") {
      throw new BadRequestException({
        code: "POST_ALREADY_APPROVED",
        message: "承認済みの投稿は変更できません",
      });
    }

    await this.prisma.submittedPost.upsert({
      where: {
        applicationId_snsType: { applicationId, snsType },
      },
      create: { applicationId, snsType, url },
      update: {
        url,
        submittedAt: new Date(),
        reviewStatus: "PENDING",
        reviewedAt: null,
        reviewedById: null,
      },
    });

    return this.getForInfluencer(influencerId, applicationId);
  }

  async upsertInsight(
    influencerId: string,
    applicationId: string,
    snsType: SnsType,
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
    await this.assertOwned(influencerId, applicationId);
    const post = await this.prisma.submittedPost.findUnique({
      where: { applicationId_snsType: { applicationId, snsType } },
    });
    if (!post) {
      throw new BadRequestException({
        code: "POST_NOT_SUBMITTED",
        message: "先に投稿URLを提出してください",
      });
    }
    await this.prisma.submittedPost.update({
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
}
