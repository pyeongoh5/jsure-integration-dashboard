import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  SLOT_CONSUMING_STATUSES,
  SUB_TYPE_OPTION_LABEL,
  buildSnsProfileUrl,
  type AdminApplication,
  type AdminSettlement,
  type AdminSubmission,
  type ApplicationStatus,
  type ApprovedApplicantExportResponse,
  type CampaignCategory,
  type CampaignSubType,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { LineDispatcherService } from "../line-templates/line-dispatcher.service";
import {
  DISPATCH_APPLICATION_INCLUDE,
  campaignCompletedTriggerKeyFor,
} from "../line-templates/trigger-meta";
import { R2Service } from "../r2/r2.service";
import {
  ensureSettlementForApplication,
  settlementAmounts,
} from "../settlements/ensure-settlement";

const POST_REJECTION_RESUBMIT_DAYS = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  subTypes: CampaignSubType[];
  options: { subType: CampaignSubType; option: string }[];
  orderNumber: string | null;
  orderSubmittedAt: Date | null;
  reviewSubmittedAt: Date | null;
  campaign: { id: string; title: string; category: CampaignCategory };
  influencer: {
    id: string;
    name: string;
    email: string;
    flaggedAt: Date | null;
    snsAccounts: { snsType: string; handle: string; followerCount: number }[];
  };
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
    subTypes: row.subTypes,
    selectedOptions: row.options.map((entry) => ({
      subType: entry.subType,
      option: entry.option,
    })),
    orderNumber: row.orderNumber,
    orderSubmittedAt: row.orderSubmittedAt ? row.orderSubmittedAt.toISOString() : null,
    reviewSubmittedAt: row.reviewSubmittedAt ? row.reviewSubmittedAt.toISOString() : null,
    campaign: row.campaign,
    influencer: {
      id: row.influencer.id,
      name: row.influencer.name,
      email: row.influencer.email,
      flagged: row.influencer.flaggedAt !== null,
      snsAccounts: row.influencer.snsAccounts.map((account) => ({
        snsType:
          account.snsType as AdminApplication["influencer"]["snsAccounts"][number]["snsType"],
        handle: account.handle,
        followerCount: account.followerCount,
      })),
    },
  };
}

const SUB_TYPE_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  QOO10: "Qoo10",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

const APPLICATION_INCLUDE = {
  options: { select: { subType: true, option: true } },
  campaign: { select: { id: true, title: true, category: true } },
  influencer: {
    select: {
      id: true,
      name: true,
      email: true,
      flaggedAt: true,
      snsAccounts: {
        select: { snsType: true, handle: true, followerCount: true },
        orderBy: { snsType: "asc" as const },
      },
    },
  },
} as const;

@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
    private readonly dispatcher: LineDispatcherService,
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
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        campaign: {
          select: {
            ...DISPATCH_APPLICATION_INCLUDE.campaign.select,
            category: true,
            recruits: {
              select: {
                subType: true,
                recruitCount: true,
                rewardJpy: true,
                productPriceJpy: true,
                productUrl: true,
                options: {
                  select: {
                    option: true,
                    recruitCount: true,
                    rewardJpy: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPLIED") {
      throw new BadRequestException(`Cannot approve from status ${existing.status}`);
    }

    // 참여 서브타입 중 하나라도 모집 인원이 초과되면 승인 불가 (부분 승인 없음).
    for (const subType of existing.subTypes) {
      const recruit = existing.campaign.recruits.find(
        (candidate) => candidate.subType === subType,
      );
      const recruitCount = recruit?.recruitCount ?? 0;
      const approvedCount = await this.prisma.campaignApplication.count({
        where: {
          campaignId: existing.campaignId,
          subTypes: { has: subType },
          status: { in: SLOT_CONSUMING_STATUSES },
        },
      });
      if (approvedCount >= recruitCount) {
        throw new BadRequestException(
          `${SUB_TYPE_LABEL[subType]} 모집 인원(${recruitCount}명)이 모두 충족되어 승인할 수 없습니다`,
        );
      }

      // 옵션별 정원 분리 recruit 이면 응모가 선택한 옵션의 정원도 체크.
      const optionQuotas = (recruit?.options ?? []).filter(
        (option) => option.recruitCount !== null,
      );
      if (optionQuotas.length === 0) continue;
      const selected = existing.options.find(
        (entry) => entry.subType === subType,
      );
      if (!selected) continue; // 옵션 미선택 레거시 응모 — 서브타입 정원만 적용
      const quota = optionQuotas.find(
        (option) => option.option === selected.option,
      );
      if (!quota) continue;
      const optionApprovedCount = await this.prisma.campaignApplication.count({
        where: {
          campaignId: existing.campaignId,
          status: { in: SLOT_CONSUMING_STATUSES },
          options: { some: { subType, option: selected.option } },
        },
      });
      if (optionApprovedCount >= (quota.recruitCount ?? 0)) {
        throw new BadRequestException(
          `${SUB_TYPE_LABEL[subType]} ${SUB_TYPE_OPTION_LABEL[selected.option] ?? selected.option} 모집 인원(${quota.recruitCount}명)이 모두 충족되어 승인할 수 없습니다`,
        );
      }
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
    const approveTriggerKey =
      existing.campaign.category === "FAKE_PURCHASE"
        ? "FAKE_PURCHASE_APPLICATION_APPROVED"
        : existing.campaign.category === "SIMPLE_REVIEW"
          ? "SIMPLE_REVIEW_APPLICATION_APPROVED"
          : "SNS_APPLICATION_APPROVED";
    void this.dispatcher.dispatch(approveTriggerKey, { application: existing });
    return this.fetch(id);
  }

  async reject(id: string, reviewerId: string, reason: string): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        campaign: {
          select: {
            ...DISPATCH_APPLICATION_INCLUDE.campaign.select,
            category: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPLIED") {
      throw new BadRequestException(`Cannot reject from status ${existing.status}`);
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        rejectReason: reason.trim() || null,
      },
    });
    const rejectTriggerKey =
      existing.campaign.category === "FAKE_PURCHASE"
        ? "FAKE_PURCHASE_APPLICATION_REJECTED"
        : existing.campaign.category === "SIMPLE_REVIEW"
          ? "SIMPLE_REVIEW_APPLICATION_REJECTED"
          : "SNS_APPLICATION_REJECTED";
    void this.dispatcher.dispatch(rejectTriggerKey, { application: existing });

    return this.fetch(id);
  }

  async undo(id: string): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.status !== "APPROVED" && existing.status !== "REJECTED") {
      throw new BadRequestException(`Cannot undo from status ${existing.status}`);
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
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        campaign: {
          select: {
            ...DISPATCH_APPLICATION_INCLUDE.campaign.select,
            category: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.campaign.category !== "SNS" && existing.campaign.category !== "SIMPLE_REVIEW") {
      throw new BadRequestException("이 카테고리 캠페인에서는 발송 조작을 사용할 수 없습니다");
    }
    if (existing.status !== "APPROVED") {
      throw new BadRequestException(`현재 상태(${existing.status})에서는 발송 처리를 할 수 없습니다`);
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
    const shippedTriggerKey =
      existing.campaign.category === "SIMPLE_REVIEW"
        ? "SIMPLE_REVIEW_APPLICATION_SHIPPED"
        : "SNS_APPLICATION_SHIPPED";
    void this.dispatcher.dispatch(shippedTriggerKey, {
      application: { ...existing, trackingCarrier, trackingNumber },
    });
    return this.fetch(id);
  }

  async deliver(id: string): Promise<AdminApplication> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        campaign: {
          select: {
            ...DISPATCH_APPLICATION_INCLUDE.campaign.select,
            category: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.campaign.category !== "SNS" && existing.campaign.category !== "SIMPLE_REVIEW") {
      throw new BadRequestException("이 카테고리 캠페인에서는 배송 조작을 사용할 수 없습니다");
    }
    if (existing.status !== "SHIPPED") {
      throw new BadRequestException(`현재 상태(${existing.status})에서는 배송 완료 처리를 할 수 없습니다`);
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });
    const deliveredTriggerKey =
      existing.campaign.category === "SIMPLE_REVIEW"
        ? "SIMPLE_REVIEW_APPLICATION_DELIVERED"
        : "SNS_APPLICATION_DELIVERED";
    void this.dispatcher.dispatch(deliveredTriggerKey, { application: existing });
    return this.fetch(id);
  }

  async counts(campaignId?: string): Promise<Record<ApplicationStatus, number>> {
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
      ORDER_SUBMITTED: 0,
      REVIEW_SUBMITTED: 0,
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

  /** 제출물 검토 목록 — 제출 데이터가 있는 응모(Application) 단위. */
  async listSubmissions(): Promise<AdminSubmission[]> {
    const rows = await this.prisma.campaignApplication.findMany({
      where: { posts: { some: {} } },
      orderBy: { reviewSubmittedAt: { sort: "desc", nulls: "last" } },
      include: SUBMISSION_INCLUDE,
    });
    return Promise.all(rows.map((row) => toSubmissionResponse(row, this.r2)));
  }

  /**
   * 특정 submittedPost 의 첨부 이미지에 대해 presigned GET URL 을 즉시 발급.
   * 인사이트 모달을 여는 시점에 호출되어, 목록에서 받아온 만료된 URL 대신 신선한 URL 을 받는다.
   */
  async listSubmittedPostAttachments(postId: string) {
    const post = await this.prisma.submittedPost.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) throw new NotFoundException("Post not found");
    const rows = await this.prisma.attachment.findMany({
      where: { postId },
      orderBy: { uploadedAt: "asc" },
    });
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        kind: row.kind,
        objectKey: row.objectKey,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        uploadedAt: row.uploadedAt.toISOString(),
        viewUrl: await this.r2.presignGet(row.objectKey, 300),
      })),
    );
  }

  /**
   * 특정 CampaignApplication 의 첨부 이미지에 대해 presigned GET URL 을 발급.
   * 주문 명세서/리뷰 스크린샷을 통합 조회할 때 사용.
   */
  async listApplicationAttachments(applicationId: string) {
    const application = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!application) throw new NotFoundException("Application not found");
    const rows = await this.prisma.attachment.findMany({
      where: { applicationId },
      orderBy: { uploadedAt: "asc" },
    });
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        kind: row.kind,
        objectKey: row.objectKey,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        uploadedAt: row.uploadedAt.toISOString(),
        viewUrl: await this.r2.presignGet(row.objectKey, 300),
      })),
    );
  }

  /** 제출물 전체 승인 — 응모 단위. */
  async approveSubmission(
    applicationId: string,
    reviewerId: string,
  ): Promise<AdminSubmission> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Application not found");
    await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: {
        submissionReviewStatus: "APPROVED",
        submissionReviewedAt: new Date(),
        submissionReviewedById: reviewerId,
      },
    });
    // 인사이트가 이미 제출돼 있던 경우, 승인 시점에 자동 정산.
    const { autoCompleted } = await ensureSettlementForApplication(
      this.prisma,
      applicationId,
    );
    const refreshed = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        campaign: {
          select: {
            ...DISPATCH_APPLICATION_INCLUDE.campaign.select,
            category: true,
          },
        },
        settlement: true,
      },
    });
    if (refreshed) {
      const category = refreshed.campaign.category;
      const approveTriggerKey =
        category === "FAKE_PURCHASE"
          ? "FAKE_PURCHASE_REVIEW_APPROVED"
          : category === "SIMPLE_REVIEW"
            ? "SIMPLE_REVIEW_APPROVED"
            : "SNS_POST_APPROVED";
      void this.dispatcher.dispatch(approveTriggerKey, {
        application: refreshed,
        settlement: refreshed.settlement,
      });
      // 총액 0원 정산은 생성 즉시 완료되므로 종료 메시지를 이 시점에 발송.
      if (autoCompleted) {
        void this.dispatcher.dispatch(campaignCompletedTriggerKeyFor(category), {
          application: refreshed,
          settlement: refreshed.settlement,
        });
      }
    }
    return this.fetchSubmission(applicationId);
  }

  /** 제출물 전체 반려 — 응모 단위. 인플루언서는 수정 후 전체 재제출한다. */
  async rejectSubmission(
    applicationId: string,
    reviewerId: string,
    comment: string,
  ): Promise<AdminSubmission> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: {
        ...DISPATCH_APPLICATION_INCLUDE,
        campaign: {
          select: {
            ...DISPATCH_APPLICATION_INCLUDE.campaign.select,
            category: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("Application not found");
    const rejectedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.campaignApplication.update({
        where: { id: applicationId },
        data: {
          submissionReviewStatus: "REJECTED",
          submissionReviewedAt: rejectedAt,
          submissionReviewedById: reviewerId,
        },
      }),
      this.prisma.submissionRejection.create({
        data: {
          applicationId,
          comment,
          rejectedById: reviewerId,
          rejectedAt,
        },
      }),
    ]);
    const resubmitDeadlineAt = new Date(
      rejectedAt.getTime() + POST_REJECTION_RESUBMIT_DAYS * DAY_MS,
    );
    const rejectPostTriggerKey =
      existing.campaign.category === "FAKE_PURCHASE"
        ? "FAKE_PURCHASE_REVIEW_REJECTED"
        : existing.campaign.category === "SIMPLE_REVIEW"
          ? "SIMPLE_REVIEW_REJECTED"
          : "SNS_POST_REJECTED";
    void this.dispatcher.dispatch(rejectPostTriggerKey, {
      application: existing,
      rejection: { comment } as never,
      extra: { resubmitDeadlineAt },
    });
    return this.fetchSubmission(applicationId);
  }

  async undoSubmissionReview(applicationId: string): Promise<AdminSubmission> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: { posts: { select: { insightSubmittedAt: true } } },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.submissionReviewStatus === "PENDING") {
      throw new BadRequestException("이미 검토 대기 상태입니다");
    }
    if (existing.posts.some((post) => post.insightSubmittedAt !== null)) {
      throw new BadRequestException("인사이트가 제출된 검토는 되돌릴 수 없습니다");
    }
    await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: {
        submissionReviewStatus: "PENDING",
        submissionReviewedAt: null,
        submissionReviewedById: null,
      },
    });
    return this.fetchSubmission(applicationId);
  }

  /** 승인된 제출물을 인사이트 제출 여부와 무관하게 수동 정산 등록. */
  async settleSubmission(applicationId: string): Promise<AdminSubmission> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: {
        options: { select: { subType: true, option: true } },
        settlement: { select: { id: true } },
        campaign: {
          select: {
            category: true,
            rewardType: true,
            rewardJpy: true,
            recruits: {
              select: {
                subType: true,
                rewardJpy: true,
                productPriceJpy: true,
                options: { select: { option: true, rewardJpy: true } },
              },
            },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("Application not found");
    if (existing.submissionReviewStatus !== "APPROVED") {
      throw new BadRequestException("승인된 초안만 정산할 수 있습니다");
    }
    const { rewardAmountJpy, productRefundJpy } = settlementAmounts(
      existing.campaign,
      existing.subTypes,
      existing.options,
    );
    const amountJpy = rewardAmountJpy + productRefundJpy;
    // 총액 0원이면 정산 대기 없이 즉시 완료 처리 (ensure-settlement 와 동일 규칙).
    const autoCompleted = !existing.settlement && amountJpy === 0;
    // Settlement row 생성 (idempotent: 이미 있으면 그대로 유지)
    await this.prisma.settlement.upsert({
      where: { applicationId },
      create: {
        applicationId,
        amountJpy,
        rewardAmountJpy,
        productRefundJpy,
        status: autoCompleted ? "COMPLETED" : "PENDING",
        completedAt: autoCompleted ? new Date() : null,
      },
      update: {},
    });
    if (autoCompleted) {
      const refreshed = await this.prisma.campaignApplication.findUnique({
        where: { id: applicationId },
        include: { ...DISPATCH_APPLICATION_INCLUDE, settlement: true },
      });
      if (refreshed) {
        void this.dispatcher.dispatch(
          campaignCompletedTriggerKeyFor(existing.campaign.category),
          { application: refreshed as never, settlement: refreshed.settlement },
        );
      }
    }
    return this.fetchSubmission(applicationId);
  }

  private async fetchSubmission(applicationId: string): Promise<AdminSubmission> {
    const row = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: SUBMISSION_INCLUDE,
    });
    if (!row) throw new NotFoundException("Application not found");
    return toSubmissionResponse(row, this.r2);
  }

  /**
   * Settlement 테이블 기반 정산 목록.
   * month(JST) 필터는 Settlement.createdAt(정산 등록일) 기준으로 PENDING/COMPLETED 모두에 적용.
   */
  async listSettlements(month?: string): Promise<AdminSettlement[]> {
    const where = month ? buildMonthWhere(month) : {};
    const rows = await this.prisma.settlement.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        application: {
          select: {
            id: true,
            subTypes: true,
            posts: {
              select: {
                id: true,
                url: true,
                subType: true,
                submittedAt: true,
                insightSubmittedAt: true,
              },
              orderBy: { subType: "asc" as const },
            },
            campaign: { select: { id: true, title: true, category: true } },
            influencer: {
              select: {
                id: true,
                name: true,
                snsAccounts: {
                  select: { snsType: true, handle: true },
                },
                bankAccount: {
                  select: {
                    bankName: true,
                    bankCode: true,
                    branchName: true,
                    branchCode: true,
                    accountNumber: true,
                    accountHolderKana: true,
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

  /**
   * 응모자 관리 페이지의 테이블 로우 수와 동일.
   * - CANCELLED/COMPLETED 제외
   * - 검토 단계로 넘어간(SubmittedPost 존재) 응모 제외
   */
  async appliedCount(): Promise<{ count: number }> {
    const count = await this.prisma.campaignApplication.count({
      where: {
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        posts: { none: {} },
      },
    });
    return { count };
  }

  /** 검토 페이지의 테이블 로우 수와 동일. 정산 흐름에 들어간 응모는 제외. */
  async pendingReviewCount(): Promise<{ count: number }> {
    const count = await this.prisma.campaignApplication.count({
      where: { posts: { some: {} }, settlement: null },
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
        application: {
          include: {
            ...DISPATCH_APPLICATION_INCLUDE,
            campaign: {
              select: {
                ...DISPATCH_APPLICATION_INCLUDE.campaign.select,
                category: true,
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
      const category = target.application.campaign.category;
      const settlementTriggerKey =
        category === "FAKE_PURCHASE"
          ? "FAKE_PURCHASE_SETTLEMENT_COMPLETED"
          : category === "SIMPLE_REVIEW"
            ? "SIMPLE_REVIEW_SETTLEMENT_COMPLETED"
            : "SNS_SETTLEMENT_COMPLETED";
      const campaignCompletedTriggerKey =
        campaignCompletedTriggerKeyFor(category);
      // 보수 0엔이면 정산 안내는 생략하고 종료 메시지만 발송.
      if (target.amountJpy > 0) {
        void this.dispatcher.dispatch(settlementTriggerKey, {
          application: target.application as never,
          settlement: target,
        });
      }
      // 정산 완료 = 개인의 캠페인 프로세스 종료. 정산 알림과 별개로 종료 메시지를 발송.
      void this.dispatcher.dispatch(campaignCompletedTriggerKey, {
        application: target.application as never,
        settlement: target,
      });
    }
    return { completedCount: targets.length };
  }

  /**
   * 캠페인 응모 승인자(APPROVED 이상 단계) 명단을 export 용으로 반환.
   * APPLIED/REJECTED/CANCELLED 는 발송 대상이 아니므로 제외.
   * 응답 데이터엔 phone/주소 등 PII 가 포함되므로 다른 list 응답과 분리해 두었다.
   */
  async exportApprovedApplicants(
    campaignId: string,
  ): Promise<ApprovedApplicantExportResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");

    const rows = await this.prisma.campaignApplication.findMany({
      where: {
        campaignId,
        status: { in: SLOT_CONSUMING_STATUSES },
      },
      orderBy: { appliedAt: "desc" },
      select: {
        id: true,
        subTypes: true,
        appliedAt: true,
        influencer: {
          select: {
            id: true,
            name: true,
            nameKana: true,
            phone: true,
            postalCode: true,
            prefecture: true,
            city: true,
            addressLine1: true,
            addressLine2: true,
            snsAccounts: {
              select: { snsType: true, handle: true },
            },
          },
        },
      },
    });

    return {
      campaignTitle: campaign.title,
      rows: rows.map((row) => ({
        applicationId: row.id,
        influencerId: row.influencer.id,
        name: row.influencer.name,
        nameKana: row.influencer.nameKana,
        channels: row.subTypes.map((subType) => {
          const snsAccount = row.influencer.snsAccounts.find(
            (account) => account.snsType === subType,
          );
          const handle = snsAccount?.handle ?? "";
          // SNS 계열 (INSTAGRAM/TIKTOK/X/YOUTUBE) 만 프로필 URL 을 만든다.
          const profileUrl =
            handle &&
            (subType === "INSTAGRAM" ||
              subType === "TIKTOK" ||
              subType === "X" ||
              subType === "YOUTUBE")
              ? buildSnsProfileUrl(subType, handle)
              : "";
          return { subType, snsHandle: handle, profileUrl };
        }),
        phone: row.influencer.phone,
        postalCode: row.influencer.postalCode,
        address: [
          row.influencer.prefecture,
          row.influencer.city,
          row.influencer.addressLine1,
          row.influencer.addressLine2,
        ]
          .filter((part) => part && part.length > 0)
          .join(" "),
        appliedAt: row.appliedAt.toISOString(),
      })),
    };
  }
}

const SUBMISSION_INCLUDE = {
  options: { select: { subType: true, option: true } },
  posts: {
    orderBy: { subType: "asc" as const },
    include: {
      attachments: {
        orderBy: { uploadedAt: "asc" as const },
        select: {
          id: true,
          kind: true,
          objectKey: true,
          contentType: true,
          sizeBytes: true,
          uploadedAt: true,
        },
      },
    },
  },
  settlement: {
    select: {
      id: true,
      status: true,
      amountJpy: true,
      createdAt: true,
      completedAt: true,
    },
  },
  submissionRejections: {
    orderBy: { rejectedAt: "desc" as const },
    select: { id: true, comment: true, rejectedAt: true },
  },
  campaign: {
    select: { id: true, title: true, category: true, thumbnailUrl: true, rewardJpy: true },
  },
  influencer: {
    select: {
      id: true,
      name: true,
      flaggedAt: true,
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
} as const;

type SubmissionRow = {
  id: string;
  status: ApplicationStatus;
  subTypes: CampaignSubType[];
  options: { subType: CampaignSubType; option: string }[];
  reviewSubmittedAt: Date | null;
  submissionReviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  submissionReviewedAt: Date | null;
  posts: {
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
    attachments: {
      id: string;
      kind: "INSIGHT_SCREENSHOT" | "ORDER_RECEIPT" | "REVIEW_SCREENSHOT";
      objectKey: string;
      contentType: string;
      sizeBytes: number;
      uploadedAt: Date;
    }[];
  }[];
  settlement: {
    id: string;
    status: "PENDING" | "COMPLETED";
    amountJpy: number;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  submissionRejections: { id: string; comment: string; rejectedAt: Date }[];
  campaign: {
    id: string;
    title: string;
    category: CampaignCategory;
    thumbnailUrl: string | null;
    rewardJpy: number;
  };
  influencer: {
    id: string;
    name: string;
    flaggedAt: Date | null;
    snsAccounts: {
      snsType: string;
      handle: string;
      followerCount: number;
    }[];
  };
};

async function resolveThumbnail(raw: string | null, r2: R2Service): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return r2.presignGet(raw, 300);
}

async function toSubmissionResponse(
  row: SubmissionRow,
  r2: R2Service,
): Promise<AdminSubmission> {
  const campaignThumbnailUrl = await resolveThumbnail(
    row.campaign.thumbnailUrl,
    r2,
  );
  return {
    id: row.id,
    status: row.status,
    subTypes: row.subTypes,
    selectedOptions: row.options.map((entry) => ({
      subType: entry.subType,
      option: entry.option,
    })),
    reviewSubmittedAt: row.reviewSubmittedAt
      ? row.reviewSubmittedAt.toISOString()
      : null,
    submissionReviewStatus: row.submissionReviewStatus,
    submissionReviewedAt: row.submissionReviewedAt
      ? row.submissionReviewedAt.toISOString()
      : null,
    rejectionHistory: row.submissionRejections.map((rejection) => ({
      id: rejection.id,
      comment: rejection.comment,
      rejectedAt: rejection.rejectedAt.toISOString(),
    })),
    posts: row.posts.map((post) => ({
      id: post.id,
      subType: post.subType,
      url: post.url,
      submissionData:
        post.submissionData &&
        typeof post.submissionData === "object" &&
        !Array.isArray(post.submissionData)
          ? (post.submissionData as Record<string, unknown>)
          : null,
      submittedAt: post.submittedAt.toISOString(),
      insightLikes: post.insightLikes,
      insightComments: post.insightComments,
      insightShares: post.insightShares,
      insightReposts: post.insightReposts,
      insightSaves: post.insightSaves,
      insightViews: post.insightViews,
      insightReach: post.insightReach,
      insightSubmittedAt: post.insightSubmittedAt
        ? post.insightSubmittedAt.toISOString()
        : null,
      // viewUrl 은 presigned URL 의 만료 시간이 짧아 목록 시점에서 발급하면
      // 모달을 여는 시점에 이미 만료되어 있을 수 있다. 실제 보기 시점에
      // 별도 엔드포인트로 발급한다.
      attachments: post.attachments.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        objectKey: attachment.objectKey,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        uploadedAt: attachment.uploadedAt.toISOString(),
        viewUrl: null,
      })),
    })),
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
    campaign: {
      id: row.campaign.id,
      category: row.campaign.category,
      title: row.campaign.title,
      thumbnailUrl: campaignThumbnailUrl,
      rewardJpy: row.campaign.rewardJpy,
    },
    influencer: {
      id: row.influencer.id,
      name: row.influencer.name,
      flagged: row.influencer.flaggedAt !== null,
      snsAccounts: row.influencer.snsAccounts.map((account) => ({
        snsType:
          account.snsType as AdminSubmission["influencer"]["snsAccounts"][number]["snsType"],
        handle: account.handle,
        followerCount: account.followerCount,
      })),
    },
  };
}

type SettlementRow = {
  id: string;
  applicationId: string;
  amountJpy: number;
  rewardAmountJpy: number;
  productRefundJpy: number;
  status: "PENDING" | "COMPLETED";
  createdAt: Date;
  completedAt: Date | null;
  application: {
    id: string;
    subTypes: CampaignSubType[];
    posts: {
      id: string;
      url: string | null;
      subType: CampaignSubType;
      submittedAt: Date;
      insightSubmittedAt: Date | null;
    }[];
    campaign: { id: string; title: string; category: CampaignCategory };
    influencer: {
      id: string;
      name: string;
      snsAccounts: { snsType: string; handle: string }[];
      bankAccount: {
        bankName: string;
        bankCode: string;
        branchName: string;
        branchCode: string;
        accountNumber: string;
        accountHolderKana: string;
      } | null;
    };
  };
};

function toSettlementResponse(row: SettlementRow): AdminSettlement {
  const matchingAccount = row.application.influencer.snsAccounts.find(
    (account) => row.application.subTypes.includes(account.snsType as CampaignSubType),
  );
  return {
    id: row.id,
    applicationId: row.applicationId,
    amountJpy: row.amountJpy,
    rewardAmountJpy: row.rewardAmountJpy,
    productRefundJpy: row.productRefundJpy,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    influencer: {
      id: row.application.influencer.id,
      name: row.application.influencer.name,
      handle: matchingAccount?.handle ?? "",
      bankAccount: row.application.influencer.bankAccount
        ? {
            bankName: row.application.influencer.bankAccount.bankName,
            bankCode: row.application.influencer.bankAccount.bankCode,
            branchName: row.application.influencer.bankAccount.branchName,
            branchCode: row.application.influencer.bankAccount.branchCode,
            accountNumber: row.application.influencer.bankAccount.accountNumber,
            accountHolderKana:
              row.application.influencer.bankAccount.accountHolderKana,
          }
        : null,
    },
    campaign: {
      id: row.application.campaign.id,
      category: row.application.campaign.category,
      title: row.application.campaign.title,
    },
    posts: row.application.posts.map((post) => ({
      id: post.id,
      url: post.url,
      subType: post.subType,
      submittedAt: post.submittedAt.toISOString(),
      insightSubmittedAt: post.insightSubmittedAt
        ? post.insightSubmittedAt.toISOString()
        : null,
    })),
  };
}

/** "YYYY-MM" (JST) → Settlement where 절: Settlement.createdAt(정산 등록일)이 해당 월 범위. */
function buildMonthWhere(monthStr: string):
  | {
      createdAt: { gte: Date; lt: Date };
    }
  | Record<string, never> {
  const m = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (!m) return {};
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return {};
  const start = new Date(`${monthStr}-01T00:00:00+09:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`);
  return {
    createdAt: { gte: start, lt: end },
  };
}
