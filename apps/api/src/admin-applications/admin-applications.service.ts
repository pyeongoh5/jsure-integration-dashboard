import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AdminApplication,
  AdminSettlement,
  AdminSubmittedPost,
  ApplicationStatus,
  SnsType,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { R2Service } from "../r2/r2.service";

type AdminApplicationRow = {
  id: string;
  status: ApplicationStatus;
  appliedAt: Date;
  reviewedAt: Date | null;
  rejectReason: string | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  receivedAt: Date | null;
  completedAt: Date | null;
  snsType: SnsType;
  campaign: { id: string; title: string };
  influencer: {
    id: string;
    name: string;
    email: string;
    snsAccounts: { snsType: string; handle: string; followerCount: number }[];
  };
  _count: { posts: number };
};

function toResponse(row: AdminApplicationRow): AdminApplication {
  return {
    id: row.id,
    status: row.status,
    appliedAt: row.appliedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    rejectReason: row.rejectReason,
    trackingCarrier: row.trackingCarrier,
    trackingNumber: row.trackingNumber,
    shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    snsType: row.snsType,
    hasSubmittedPost: row._count.posts > 0,
    campaign: row.campaign,
    influencer: {
      id: row.influencer.id,
      name: row.influencer.name,
      email: row.influencer.email,
      snsAccounts: row.influencer.snsAccounts.map((account) => ({
        snsType: account.snsType as AdminApplication["influencer"]["snsAccounts"][number]["snsType"],
        handle: account.handle,
        followerCount: account.followerCount,
      })),
    },
  };
}

const APPLICATION_INCLUDE = {
  campaign: { select: { id: true, title: true } },
  influencer: {
    select: {
      id: true,
      name: true,
      email: true,
      snsAccounts: {
        select: { snsType: true, handle: true, followerCount: true },
        orderBy: { snsType: "asc" as const },
      },
    },
  },
  _count: { select: { posts: true } },
} as const;

@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
    private readonly r2: R2Service,
  ) {}

  private async fetch(id: string): Promise<AdminApplication> {
    const row = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: APPLICATION_INCLUDE,
    });
    if (!row) throw new NotFoundException("Application not found");
    return toResponse(row);
  }

  async approve(id: string, reviewerId: string): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: { campaign: { select: { title: true } } },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPLIED") {
      throw new BadRequestException(
        `Cannot approve from status ${existing.status}`,
      );
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        rejectReason: null,
      },
    });
    void this.line.notifyApproved({
      influencerId: existing.influencerId,
      applicationId: id,
      campaignTitle: existing.campaign.title,
    });
    return this.fetch(id);
  }

  async reject(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: { campaign: { select: { title: true } } },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPLIED") {
      throw new BadRequestException(
        `Cannot reject from status ${existing.status}`,
      );
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        rejectReason: reason,
      },
    });
    void this.line.notifyRejected({
      influencerId: existing.influencerId,
      applicationId: id,
      campaignTitle: existing.campaign.title,
      reason,
    });
    return this.fetch(id);
  }

  async undo(id: string): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPROVED" && existing.status !== "REJECTED") {
      throw new BadRequestException(
        `Cannot undo from status ${existing.status}`,
      );
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "APPLIED",
        reviewedAt: null,
        reviewedById: null,
        rejectReason: null,
      },
    });
    return this.fetch(id);
  }

  async ship(
    id: string,
    trackingCarrier: string,
    trackingNumber: string,
  ): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: { campaign: { select: { title: true } } },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPROVED") {
      throw new BadRequestException(
        `Cannot ship from status ${existing.status}`,
      );
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "SHIPPED",
        trackingCarrier,
        trackingNumber,
        shippedAt: new Date(),
      },
    });
    void this.line.notifyShipped({
      influencerId: existing.influencerId,
      applicationId: id,
      campaignTitle: existing.campaign.title,
      trackingCarrier,
      trackingNumber,
    });
    return this.fetch(id);
  }

  async deliver(id: string): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: {
        campaign: { select: { title: true, postingPeriodDays: true } },
      },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "SHIPPED") {
      throw new BadRequestException(
        `Cannot deliver from status ${existing.status}`,
      );
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });
    void this.line.notifyDelivered({
      influencerId: existing.influencerId,
      applicationId: id,
      campaignTitle: existing.campaign.title,
      postingPeriodDays: existing.campaign.postingPeriodDays,
    });
    return this.fetch(id);
  }

  async counts(
    campaignId?: string,
  ): Promise<Record<ApplicationStatus, number>> {
    const grouped = await this.prisma.campaignApplication.groupBy({
      by: ["status"],
      where: campaignId ? { campaignId } : undefined,
      _count: { _all: true },
    });
    const out: Record<ApplicationStatus, number> = {
      APPLIED: 0,
      APPROVED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      COMPLETED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };
    for (const g of grouped) {
      out[g.status as ApplicationStatus] = g._count._all;
    }
    return out;
  }

  async list(filters: {
    campaignId?: string;
    statuses?: ApplicationStatus[];
  }): Promise<AdminApplication[]> {
    const rows = await this.prisma.campaignApplication.findMany({
      where: {
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.statuses && filters.statuses.length > 0
          ? { status: { in: filters.statuses } }
          : {}),
      },
      orderBy: { appliedAt: "desc" },
      include: APPLICATION_INCLUDE,
    });
    return rows.map(toResponse);
  }

  async listSubmittedPosts(): Promise<AdminSubmittedPost[]> {
    const rows = await this.prisma.submittedPost.findMany({
      orderBy: { submittedAt: "desc" },
      include: SUBMITTED_POST_INCLUDE,
    });
    return Promise.all(rows.map((row) => toSubmittedPostResponse(row, this.r2)));
  }

  async approveSubmittedPost(
    postId: string,
    reviewerId: string,
  ): Promise<AdminSubmittedPost> {
    const existing = await this.prisma.submittedPost.findUnique({
      where: { id: postId },
    });
    if (!existing) throw new NotFoundException("Post not found");
    await this.prisma.submittedPost.update({
      where: { id: postId },
      data: {
        reviewStatus: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });
    return this.fetchSubmittedPost(postId);
  }

  async rejectSubmittedPost(
    postId: string,
    reviewerId: string,
    comment: string,
  ): Promise<AdminSubmittedPost> {
    const existing = await this.prisma.submittedPost.findUnique({
      where: { id: postId },
    });
    if (!existing) throw new NotFoundException("Post not found");
    await this.prisma.$transaction([
      this.prisma.submittedPost.update({
        where: { id: postId },
        data: {
          reviewStatus: "REJECTED",
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      }),
      this.prisma.submittedPostRejection.create({
        data: {
          postId,
          comment,
          rejectedById: reviewerId,
        },
      }),
    ]);
    return this.fetchSubmittedPost(postId);
  }

  async undoSubmittedPostReview(
    postId: string,
  ): Promise<AdminSubmittedPost> {
    const existing = await this.prisma.submittedPost.findUnique({
      where: { id: postId },
    });
    if (!existing) throw new NotFoundException("Post not found");
    if (existing.reviewStatus === "PENDING") {
      throw new BadRequestException("Already pending");
    }
    if (existing.insightSubmittedAt) {
      throw new BadRequestException(
        "인사이트가 제출된 검토는 되돌릴 수 없습니다",
      );
    }
    await this.prisma.submittedPost.update({
      where: { id: postId },
      data: {
        reviewStatus: "PENDING",
        reviewedAt: null,
        reviewedById: null,
        settledAt: null,
        settledAmountJpy: null,
        settledById: null,
      },
    });
    return this.fetchSubmittedPost(postId);
  }

  async settleSubmittedPost(
    postId: string,
    settlerId: string,
  ): Promise<AdminSubmittedPost> {
    const existing = await this.prisma.submittedPost.findUnique({
      where: { id: postId },
      include: {
        application: {
          select: {
            id: true,
            influencerId: true,
            campaign: { select: { rewardJpy: true, title: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("Post not found");
    if (existing.reviewStatus !== "APPROVED") {
      throw new BadRequestException("승인된 초안만 정산할 수 있습니다");
    }
    // Settlement row 생성 (idempotent: 이미 있으면 그대로 유지)
    await this.prisma.settlement.upsert({
      where: { postId },
      create: {
        postId,
        amountJpy: existing.application.campaign.rewardJpy,
        status: "PENDING",
      },
      update: {},
    });
    return this.fetchSubmittedPost(postId);
  }

  private async fetchSubmittedPost(
    postId: string,
  ): Promise<AdminSubmittedPost> {
    const row = await this.prisma.submittedPost.findUnique({
      where: { id: postId },
      include: SUBMITTED_POST_INCLUDE,
    });
    if (!row) throw new NotFoundException("Post not found");
    return toSubmittedPostResponse(row, this.r2);
  }

  /**
   * Settlement 테이블 기반 정산 목록.
   * month 가 주어지면 해당 월(JST) 안에 insightSubmittedAt 이 찍힌 건만 반환.
   */
  async listSettlements(month?: string): Promise<AdminSettlement[]> {
    const where = month ? buildMonthWhere(month) : {};
    const rows = await this.prisma.settlement.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        post: {
          select: {
            id: true,
            url: true,
            snsType: true,
            application: {
              select: {
                influencerId: true,
                campaign: { select: { id: true, title: true } },
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
        },
      },
    });
    return rows.map((row) => toSettlementResponse(row));
  }

  /** PENDING Settlement 건수. 사이드바 뱃지용. */
  async pendingSettlementCount(): Promise<{ count: number }> {
    const count = await this.prisma.settlement.count({
      where: { status: "PENDING" },
    });
    return { count };
  }

  /** PENDING Settlement 들을 COMPLETED 로. ids 가 비어있으면 모든 PENDING 대상. */
  async completeSettlements(
    completerId: string,
    ids?: string[],
  ): Promise<{ completedCount: number }> {
    const where = {
      status: "PENDING" as const,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    };
    const targets = await this.prisma.settlement.findMany({
      where,
      include: {
        post: {
          select: {
            application: {
              select: {
                id: true,
                influencerId: true,
                campaign: { select: { title: true } },
              },
            },
          },
        },
      },
    });
    const now = new Date();
    await this.prisma.settlement.updateMany({
      where,
      data: {
        status: "COMPLETED",
        completedAt: now,
        completedById: completerId,
      },
    });
    for (const target of targets) {
      void this.line.notifySettlementComplete({
        influencerId: target.post.application.influencerId,
        applicationId: target.post.application.id,
        campaignTitle: target.post.application.campaign.title,
        rewardJpy: target.amountJpy,
      });
    }
    return { completedCount: targets.length };
  }
}

const SUBMITTED_POST_INCLUDE = {
  settlement: {
    select: {
      id: true,
      status: true,
      amountJpy: true,
      createdAt: true,
      completedAt: true,
    },
  },
  rejections: {
    orderBy: { rejectedAt: "desc" as const },
    select: { id: true, comment: true, rejectedAt: true },
  },
  attachments: {
    orderBy: { uploadedAt: "asc" as const },
    select: {
      id: true,
      objectKey: true,
      contentType: true,
      sizeBytes: true,
      uploadedAt: true,
    },
  },
  application: {
    select: {
      id: true,
      status: true,
      campaign: {
        select: { id: true, title: true, thumbnailUrl: true, rewardJpy: true },
      },
      influencer: {
        select: {
          id: true,
          name: true,
          snsAccounts: {
            select: {
              snsType: true,
              handle: true,
              followerCount: true,
            },
            orderBy: { snsType: "asc" as const },
          },
        },
      },
    },
  },
} as const;

type SubmittedPostRow = {
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
  settledAt: Date | null;
  settledAmountJpy: number | null;
  settlementCompletedAt: Date | null;
  settlement: {
    id: string;
    status: "PENDING" | "COMPLETED";
    amountJpy: number;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  rejections: { id: string; comment: string; rejectedAt: Date }[];
  attachments: {
    id: string;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    uploadedAt: Date;
  }[];
  application: {
    id: string;
    status: ApplicationStatus;
    campaign: { id: string; title: string; thumbnailUrl: string | null; rewardJpy: number };
    influencer: {
      id: string;
      name: string;
      snsAccounts: {
        snsType: string;
        handle: string;
        followerCount: number;
      }[];
    };
  };
};

async function resolveThumbnail(
  raw: string | null,
  r2: R2Service,
): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return r2.presignGet(raw, 300);
}

async function toSubmittedPostResponse(
  row: SubmittedPostRow,
  r2: R2Service,
): Promise<AdminSubmittedPost> {
  const [attachments, campaignThumbnailUrl] = await Promise.all([
    Promise.all(
      row.attachments.map(async (attachment) => ({
        id: attachment.id,
        objectKey: attachment.objectKey,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        uploadedAt: attachment.uploadedAt.toISOString(),
        viewUrl: await r2.presignGet(attachment.objectKey, 300),
      })),
    ),
    resolveThumbnail(row.application.campaign.thumbnailUrl, r2),
  ]);
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
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    settledAmountJpy: row.settledAmountJpy,
    settlementCompletedAt: row.settlementCompletedAt
      ? row.settlementCompletedAt.toISOString()
      : null,
    settlement: row.settlement
      ? {
          id: row.settlement.id,
          status: row.settlement.status,
          amountJpy: row.settlement.amountJpy,
          createdAt: row.settlement.createdAt.toISOString(),
          completedAt: row.settlement.completedAt
            ? row.settlement.completedAt.toISOString()
            : null,
        }
      : null,
    rejectionHistory: row.rejections.map((rejection) => ({
      id: rejection.id,
      comment: rejection.comment,
      rejectedAt: rejection.rejectedAt.toISOString(),
    })),
    attachments,
    application: {
      id: row.application.id,
      status: row.application.status,
    },
    campaign: {
      id: row.application.campaign.id,
      title: row.application.campaign.title,
      thumbnailUrl: campaignThumbnailUrl,
      rewardJpy: row.application.campaign.rewardJpy,
    },
    influencer: {
      id: row.application.influencer.id,
      name: row.application.influencer.name,
      snsAccounts: row.application.influencer.snsAccounts.map((account) => ({
        snsType: account.snsType as SnsType,
        handle: account.handle,
        followerCount: account.followerCount,
      })),
    },
  };
}


type SettlementRow = {
  id: string;
  postId: string;
  amountJpy: number;
  status: "PENDING" | "COMPLETED";
  createdAt: Date;
  completedAt: Date | null;
  post: {
    id: string;
    url: string;
    snsType: SnsType;
    application: {
      campaign: { id: string; title: string };
      influencer: {
        id: string;
        name: string;
        snsAccounts: { snsType: SnsType; handle: string }[];
      };
    };
  };
};

function toSettlementResponse(row: SettlementRow): AdminSettlement {
  const matchingAccount = row.post.application.influencer.snsAccounts.find(
    (a) => a.snsType === row.post.snsType,
  );
  return {
    id: row.id,
    postId: row.postId,
    amountJpy: row.amountJpy,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    influencer: {
      id: row.post.application.influencer.id,
      name: row.post.application.influencer.name,
      handle: matchingAccount?.handle ?? "",
    },
    campaign: {
      id: row.post.application.campaign.id,
      title: row.post.application.campaign.title,
    },
    post: {
      id: row.post.id,
      url: row.post.url,
      snsType: row.post.snsType,
    },
  };
}

/** "YYYY-MM" (JST) → Settlement where 절: post.insightSubmittedAt 가 해당 월 범위. */
function buildMonthWhere(monthStr: string): {
  post: { insightSubmittedAt: { gte: Date; lt: Date } };
} | Record<string, never> {
  const m = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (!m) return {};
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return {};
  const start = new Date(`${monthStr}-01T00:00:00+09:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`,
  );
  return {
    post: {
      insightSubmittedAt: { gte: start, lt: end },
    },
  };
}
