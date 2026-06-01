import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  InfluencerApplication,
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
  selectedSnsTypes: SnsType[];
  posts: PostRow[];
  campaign: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    rewardJpy: number;
    postingPeriodDays: number;
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
    selectedSnsTypes: row.selectedSnsTypes,
    posts: row.posts.map(toPost),
    postingPeriodDays: row.campaign.postingPeriodDays,
    postingDeadlineAt: deadline ? deadline.toISOString() : null,
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
    },
  },
  campaign: {
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      rewardJpy: true,
      postingPeriodDays: true,
    },
  },
} as const;

@Injectable()
export class InfluencerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
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
    const rows = await this.prisma.campaignApplication.findMany({
      where: { influencerId, status: { not: "CANCELLED" } },
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
  ): Promise<InfluencerApplication> {
    const now = new Date();
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        snsRecruits: {
          select: { snsType: true, minFollowers: true, recruitCount: true },
        },
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
    const invalid = snsTypes.filter((s) => !qualifyingSet.has(s));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: "SNS_NOT_QUALIFIED",
        message: "応募条件を満たさないSNSが含まれています",
      });
    }

    const existing = await this.prisma.campaignApplication.findUnique({
      where: {
        campaignId_influencerId: { campaignId, influencerId },
      },
    });

    if (existing && existing.status !== "CANCELLED") {
      throw new BadRequestException({
        code: "ALREADY_APPLIED",
        message: "すでに応募済みです",
      });
    }

    if (existing) {
      const reopened = await this.prisma.campaignApplication.update({
        where: { id: existing.id },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
          selectedSnsTypes: snsTypes,
          reviewedAt: null,
          reviewedById: null,
          rejectReason: null,
          trackingNumber: null,
          shippedAt: null,
          deliveredAt: null,
          receivedAt: null,
          completedAt: null,
        },
        include: INCLUDE,
      });
      return this.resolveResponse(reopened);
    }

    const created = await this.prisma.campaignApplication.create({
      data: {
        campaignId,
        influencerId,
        status: "APPLIED",
        selectedSnsTypes: snsTypes,
      },
      include: INCLUDE,
    });
    return this.resolveResponse(created);
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
    if (app.selectedSnsTypes.length > 0) {
      if (!app.selectedSnsTypes.includes(snsType)) {
        throw new BadRequestException({
          code: "SNS_NOT_SELECTED",
          message: "応募時に選択したSNSではありません",
        });
      }
    } else {
      // Legacy applications created before selectedSnsTypes existed: fall back
      // to the campaign's SNS recruit list.
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: app.campaignId },
        include: { snsRecruits: { select: { snsType: true } } },
      });
      if (!campaign) throw new NotFoundException();
      const allowed = new Set(campaign.snsRecruits.map((r) => r.snsType));
      if (!allowed.has(snsType)) {
        throw new BadRequestException({
          code: "SNS_NOT_IN_CAMPAIGN",
          message: "このキャンペーンの対象SNSではありません",
        });
      }
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
