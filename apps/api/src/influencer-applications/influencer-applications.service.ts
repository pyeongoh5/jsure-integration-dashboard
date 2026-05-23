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
import {
  deriveDisplayStage,
  postingDeadline,
} from "../influencer-campaigns/display-stage";

type PostRow = {
  id: string;
  snsType: SnsType;
  url: string;
  submittedAt: Date;
  insightSaves: number | null;
  insightReach: number | null;
  insightProfileViews: number | null;
  insightSubmittedAt: Date | null;
};

type ApplicationRow = {
  id: string;
  campaignId: string;
  status: ApplicationStatus;
  appliedAt: Date;
  trackingNumber: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  rejectReason: string | null;
  posts: PostRow[];
  campaign: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    rewardJpy: number;
  };
};

function toPost(row: PostRow): SubmittedPost {
  return {
    id: row.id,
    snsType: row.snsType,
    url: row.url,
    submittedAt: row.submittedAt.toISOString(),
    insightSaves: row.insightSaves,
    insightReach: row.insightReach,
    insightProfileViews: row.insightProfileViews,
    insightSubmittedAt: row.insightSubmittedAt
      ? row.insightSubmittedAt.toISOString()
      : null,
  };
}

function toResponse(row: ApplicationRow): InfluencerApplication {
  const deadline = postingDeadline(row.deliveredAt);
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaign.title,
    campaignThumbnailUrl: row.campaign.thumbnailUrl,
    rewardJpy: row.campaign.rewardJpy,
    status: row.status,
    displayStage: deriveDisplayStage({
      status: row.status,
      posts: row.posts.map((p) => ({
        submittedAt: p.submittedAt,
        insightSubmittedAt: p.insightSubmittedAt,
      })),
    }),
    appliedAt: row.appliedAt.toISOString(),
    trackingNumber: row.trackingNumber,
    shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    rejectReason: row.rejectReason,
    posts: row.posts.map(toPost),
    postingDeadlineAt: deadline ? deadline.toISOString() : null,
  };
}

const INCLUDE = {
  posts: true,
  campaign: {
    select: { id: true, title: true, thumbnailUrl: true, rewardJpy: true },
  },
} as const;

@Injectable()
export class InfluencerApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForInfluencer(
    influencerId: string,
  ): Promise<InfluencerApplication[]> {
    const rows = await this.prisma.campaignApplication.findMany({
      where: { influencerId },
      orderBy: { appliedAt: "desc" },
      include: INCLUDE,
    });
    return rows.map(toResponse);
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
    return toResponse(row);
  }

  async create(
    influencerId: string,
    campaignId: string,
  ): Promise<InfluencerApplication> {
    const now = new Date();
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        snsRecruits: { select: { snsType: true, recruitCount: true } },
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
    const campaignSnsTypes = new Set(
      campaign.snsRecruits.map((r) => r.snsType),
    );
    const matchingSns = influencerSns.filter((s) =>
      campaignSnsTypes.has(s.snsType),
    );
    if (matchingSns.length === 0) {
      throw new BadRequestException({
        code: "SNS_MISMATCH",
        message: "対象SNSのアカウントが登録されていません",
      });
    }

    if (campaign.minFollowers != null) {
      const hasEnough = matchingSns.some(
        (s) => s.followerCount >= (campaign.minFollowers ?? 0),
      );
      if (!hasEnough) {
        throw new BadRequestException({
          code: "INSUFFICIENT_FOLLOWERS",
          message: `フォロワー数が ${campaign.minFollowers} 以上必要です`,
        });
      }
    }

    try {
      const created = await this.prisma.campaignApplication.create({
        data: {
          campaignId,
          influencerId,
          status: "APPLIED",
        },
        include: INCLUDE,
      });
      return toResponse(created);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new BadRequestException({
          code: "ALREADY_APPLIED",
          message: "すでに応募済みです",
        });
      }
      throw err;
    }
  }

  async cancel(
    influencerId: string,
    applicationId: string,
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwned(influencerId, applicationId);
    if (
      app.status !== "APPLIED" &&
      app.status !== "APPROVED" &&
      app.status !== "SHIPPED"
    ) {
      throw new BadRequestException({
        code: "CANCEL_NOT_ALLOWED",
        message: "現在のステータスではキャンセルできません",
      });
    }
    const updated = await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: { status: "CANCELLED" },
      include: INCLUDE,
    });
    return toResponse(updated);
  }

  async confirmDelivery(
    influencerId: string,
    applicationId: string,
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwned(influencerId, applicationId);
    if (app.status !== "SHIPPED") {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "発送中の応募のみ受取完了にできます",
      });
    }
    const updated = await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: { status: "DELIVERED", deliveredAt: new Date() },
      include: INCLUDE,
    });
    return toResponse(updated);
  }

  async upsertPost(
    influencerId: string,
    applicationId: string,
    snsType: SnsType,
    url: string,
  ): Promise<InfluencerApplication> {
    const app = await this.assertOwned(influencerId, applicationId);
    if (app.status !== "DELIVERED") {
      throw new BadRequestException({
        code: "INVALID_TRANSITION",
        message: "受取完了後のみ投稿URLを提出できます",
      });
    }
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

    await this.prisma.submittedPost.upsert({
      where: {
        applicationId_snsType: { applicationId, snsType },
      },
      create: { applicationId, snsType, url },
      update: { url, submittedAt: new Date() },
    });

    return this.getForInfluencer(influencerId, applicationId);
  }

  async upsertInsight(
    influencerId: string,
    applicationId: string,
    snsType: SnsType,
    input: { saves: number; reach: number; profileViews: number },
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
        insightSaves: input.saves,
        insightReach: input.reach,
        insightProfileViews: input.profileViews,
        insightSubmittedAt: new Date(),
      },
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
}
