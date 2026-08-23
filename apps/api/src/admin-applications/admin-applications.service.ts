import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  APPLICANT_EXPORT_MAX_ROWS,
  SLOT_CONSUMING_STATUSES,
  SUB_TYPE_OPTION_LABEL,
  snsProfileUrlOrNull,
  type AddressCountry,
  type AdminActivityLog,
  formatTitleWithTags,
  type AdminApplicantPageResponse,
  type AdminApplication,
  type AdminSettlement,
  type AdminSubmission,
  type ApplicantExportResponse,
  type ApplicantExportRow,
  type ApplicantFilter,
  type ApplicationStatus,
  type ApprovedApplicantExportResponse,
  type CampaignCategory,
  type CampaignSubType,
  type CrossPostPlatform,
} from "@jsure/shared";
import {
  APPLICANT_FROM_SQL,
  applicantCursorSql,
  buildApplicantWhereSql,
} from "./applicant-filter.sql";
import { PrismaService } from "../prisma/prisma.service";
import { toActivityLog } from "../audit/application-activity";
import { influencerActivityEntries } from "../audit/influencer-activity";
import { POST_REJECTION_RESUBMIT_DAYS } from "../common/resubmit-deadline";
import { PUBLISHED_CAMPAIGN_WHERE } from "../campaigns/published-campaign";
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
import { AuditService } from "../audit/audit.service";
import type { AuditActor } from "../audit/audit.service";

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
    private readonly audit: AuditService,
  ) {}

  private async fetch(id: string): Promise<AdminApplication> {
    const row = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: APPLICATION_INCLUDE,
    });
    if (!row) throw new NotFoundException("Application not found");
    return toResponse(row);
  }

  async approve(id: string, actor: AuditActor): Promise<AdminApplication> {
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
        reviewedById: actor.id,
        rejectReason: null,
      },
    });
    await this.audit.record({
      action: "APPLICATION_APPROVE",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
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

  async reject(
    id: string,
    actor: AuditActor,
    reason: string,
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
    if (existing.status !== "APPLIED") {
      throw new BadRequestException(`Cannot reject from status ${existing.status}`);
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: actor.id,
        rejectReason: reason.trim() || null,
      },
    });
    await this.audit.record({
      action: "APPLICATION_REJECT",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
      metadata: { reason: reason.trim() },
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

  async undo(id: string, actor: AuditActor): Promise<AdminApplication> {
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
    // undo 는 reviewedById 를 null 로 소거하므로 이전 검토자를 로그에 보존한다.
    await this.audit.record({
      action: "APPLICATION_REVIEW_UNDO",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
      metadata: {
        previousStatus: existing.status,
        previousReviewerId: existing.reviewedById,
      },
    });
    return this.fetch(id);
  }

  async ship(
    id: string,
    actor: AuditActor,
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
    await this.audit.record({
      action: "APPLICATION_SHIP",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
      metadata: { trackingCarrier, trackingNumber },
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

  async deliver(id: string, actor: AuditActor): Promise<AdminApplication> {
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
    await this.audit.record({
      action: "APPLICATION_DELIVER",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
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
        viewUrl: await this.r2.presignGet(row.objectKey, 3600),
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
        viewUrl: await this.r2.presignGet(row.objectKey, 3600),
      })),
    );
  }

  /** 제출물 전체 승인 — 응모 단위. */
  async approveSubmission(
    applicationId: string,
    actor: AuditActor,
  ): Promise<AdminSubmission> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, campaignId: true },
    });
    if (!existing) throw new NotFoundException("Application not found");
    await this.prisma.campaignApplication.update({
      where: { id: applicationId },
      data: {
        submissionReviewStatus: "APPROVED",
        submissionReviewedAt: new Date(),
        submissionReviewedById: actor.id,
      },
    });
    await this.audit.record({
      action: "SUBMISSION_APPROVE",
      actor,
      applicationId,
      campaignId: existing.campaignId,
    });
    // 인사이트가 이미 제출돼 있던 경우, 승인 시점에 자동 정산.
    const { autoCompleted, createdSettlementId } =
      await ensureSettlementForApplication(this.prisma, applicationId);
    if (createdSettlementId) {
      // 어드민 승인의 부수효과 — 액터는 승인자지만 "직접 정산 버튼을 눌렀다"와
      // 구분되도록 origin 은 CASCADE.
      await this.audit.record({
        action: autoCompleted
          ? "SETTLEMENT_AUTO_COMPLETE"
          : "SETTLEMENT_CREATE",
        origin: "CASCADE",
        actor,
        applicationId,
        campaignId: existing.campaignId,
        settlementId: createdSettlementId,
      });
    }
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
      // 총액 0원 정산은 생성 즉시 완료 — 입금 안내가 포함된 승인 메시지는
      // 생략하고 무보수 캠페인 종료 안내만 발송한다.
      const completedTriggerKey = campaignCompletedTriggerKeyFor(category);
      if (autoCompleted && completedTriggerKey) {
        void this.dispatcher.dispatch(completedTriggerKey, {
          application: refreshed,
          settlement: refreshed.settlement,
        });
      } else {
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
      }
    }
    return this.fetchSubmission(applicationId);
  }

  /** 제출물 전체 반려 — 응모 단위. 인플루언서는 수정 후 전체 재제출한다. */
  async rejectSubmission(
    applicationId: string,
    actor: AuditActor,
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
          submissionReviewedById: actor.id,
        },
      }),
      this.prisma.submissionRejection.create({
        data: {
          applicationId,
          comment,
          rejectedById: actor.id,
          rejectedAt,
        },
      }),
    ]);
    await this.audit.record({
      action: "SUBMISSION_REJECT",
      actor,
      applicationId,
      campaignId: existing.campaignId,
      metadata: { reason: comment },
    });
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

  async undoSubmissionReview(
    applicationId: string,
    actor: AuditActor,
  ): Promise<AdminSubmission> {
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
    // 검토 취소는 submissionReviewedById 를 소거하므로 이전 검토자를 보존한다.
    await this.audit.record({
      action: "SUBMISSION_REVIEW_UNDO",
      actor,
      applicationId,
      campaignId: existing.campaignId,
      metadata: {
        previousStatus: existing.submissionReviewStatus,
        previousReviewerId: existing.submissionReviewedById,
      },
    });
    return this.fetchSubmission(applicationId);
  }

  /** 승인된 제출물을 인사이트 제출 여부와 무관하게 수동 정산 등록. */
  async settleSubmission(
    applicationId: string,
    actor: AuditActor,
  ): Promise<AdminSubmission> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      include: {
        options: { select: { subType: true, option: true } },
        settlement: { select: { id: true } },
        influencer: {
          select: {
            bankAccount: {
              select: {
                bankCountry: true,
                bankCode: true,
                bankName: true,
                branchName: true,
                branchCode: true,
                accountNumber: true,
                accountHolder: true,
                invoiceRegistrationNumber: true,
              },
            },
          },
        },
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
    // 생성 시점 계좌를 스냅샷 — 이후 계좌 변경과 무관하게 입금 계좌 기록 보존.
    const created = await this.prisma.settlement.upsert({
      where: { applicationId },
      create: {
        applicationId,
        amountJpy,
        rewardAmountJpy,
        productRefundJpy,
        status: autoCompleted ? "COMPLETED" : "PENDING",
        completedAt: autoCompleted ? new Date() : null,
        // 이 경로의 자동완료는 어드민이 등록 버튼을 눌러 일어났으므로
        // 상태 컬럼에도 완료자를 남긴다 (기존엔 공백이었다).
        completedById: autoCompleted ? actor.id : null,
        bankCountry: existing.influencer.bankAccount?.bankCountry ?? null,
        bankCode: existing.influencer.bankAccount?.bankCode ?? null,
        bankName: existing.influencer.bankAccount?.bankName ?? null,
        branchName: existing.influencer.bankAccount?.branchName ?? null,
        branchCode: existing.influencer.bankAccount?.branchCode ?? null,
        accountNumber: existing.influencer.bankAccount?.accountNumber ?? null,
        accountHolder:
          existing.influencer.bankAccount?.accountHolder ?? null,
        invoiceRegistrationNumber:
          existing.influencer.bankAccount?.invoiceRegistrationNumber ?? null,
      },
      update: {},
      select: { id: true },
    });
    // 어드민이 누른 액션은 '등록' 하나다. 0엔 즉시완료는 그 결과이므로
    // 별도 행으로 남기지 않고 metadata 로 표기한다.
    await this.audit.record({
      action: "SETTLEMENT_REGISTER",
      actor,
      applicationId,
      campaignId: existing.campaignId,
      settlementId: created.id,
      metadata: { amountJpy, autoCompleted },
    });
    const completedTriggerKey = campaignCompletedTriggerKeyFor(
      existing.campaign.category,
    );
    if (autoCompleted && completedTriggerKey) {
      const refreshed = await this.prisma.campaignApplication.findUnique({
        where: { id: applicationId },
        include: { ...DISPATCH_APPLICATION_INCLUDE, settlement: true },
      });
      if (refreshed) {
        void this.dispatcher.dispatch(completedTriggerKey, {
          application: refreshed as never,
          settlement: refreshed.settlement,
        });
      }
    }
    return this.fetchSubmission(applicationId);
  }

  /** 응모 단건 제출물 조회 — 정산 화면에서 정산 이후 제출물/인사이트 열람용. */
  async getSubmission(applicationId: string): Promise<AdminSubmission> {
    return this.fetchSubmission(applicationId);
  }

  /**
   * 응모건 활동 타임라인. 어드민 액션은 감사 로그 행에서, 인플루언서 액션은
   * 응모의 타임스탬프 컬럼에서 합성해 시간순으로 합친다 — 합성 덕분에 감사 로그
   * 계측 이전 응모도 인플루언서 흐름이 보인다.
   *
   * (applicationId, createdAt) 인덱스 range scan 이라 테이블 총량과 무관하다.
   * 응모당 수십 건 수준이라 페이지네이션 없이 전량 반환.
   */
  async listActivity(applicationId: string): Promise<AdminActivityLog[]> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      select: {
        appliedAt: true,
        orderSubmittedAt: true,
        receivedAt: true,
        posts: {
          select: {
            subType: true,
            submittedAt: true,
            insightSubmittedAt: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("응모를 찾을 수 없습니다");
    const rows = await this.prisma.adminActivityLog.findMany({
      where: { applicationId },
      select: {
        id: true,
        action: true,
        origin: true,
        actorId: true,
        actorName: true,
        metadata: true,
        createdAt: true,
      },
    });
    return [...rows.map(toActivityLog), ...influencerActivityEntries(existing)]
      .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
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
                insightLikes: true,
                insightComments: true,
                insightShares: true,
                insightReposts: true,
                insightSaves: true,
                insightViews: true,
                insightReach: true,
              },
              orderBy: { subType: "asc" as const },
            },
            campaign: { select: { id: true, title: true, category: true, tags: true } },
            influencer: {
              select: {
                id: true,
                name: true,
                snsAccounts: {
                  select: { snsType: true, handle: true },
                },
                bankAccount: {
                  select: {
                    bankCountry: true,
                    bankName: true,
                    bankCode: true,
                    branchName: true,
                    branchCode: true,
                    accountNumber: true,
                    accountHolder: true,
                    invoiceRegistrationNumber: true,
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
    actor: AuditActor,
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
        completedById: actor.id,
      },
    });
    // 정산 건당 1행. applicationId 를 함께 넣어 응모 타임라인이 단일 인덱스
    // 쿼리로 정산 이력까지 커버하게 한다.
    await this.audit.recordMany(
      targets.map((target) => ({
        action: "SETTLEMENT_COMPLETE" as const,
        actor,
        applicationId: target.applicationId,
        campaignId: target.application.campaignId,
        settlementId: target.id,
        metadata: { batchSize: targets.length, amountJpy: target.amountJpy },
      })),
    );
    for (const target of targets) {
      const category = target.application.campaign.category;
      if (target.amountJpy > 0) {
        const settlementTriggerKey =
          category === "FAKE_PURCHASE"
            ? "FAKE_PURCHASE_SETTLEMENT_COMPLETED"
            : category === "SIMPLE_REVIEW"
              ? "SIMPLE_REVIEW_SETTLEMENT_COMPLETED"
              : "SNS_SETTLEMENT_COMPLETED";
        void this.dispatcher.dispatch(settlementTriggerKey, {
          application: target.application as never,
          settlement: target,
        });
      } else {
        // 0엔 정산(무보수)은 정산 안내 대신 무보수 캠페인 종료 안내만 발송.
        const campaignCompletedTriggerKey =
          campaignCompletedTriggerKeyFor(category);
        if (campaignCompletedTriggerKey) {
          void this.dispatcher.dispatch(campaignCompletedTriggerKey, {
            application: target.application as never,
            settlement: target,
          });
        }
      }
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
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, ...PUBLISHED_CAMPAIGN_WHERE },
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
        options: { select: { subType: true, option: true } },
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
        channels: buildExportChannels(row),
        phone: row.influencer.phone,
        postalCode: row.influencer.postalCode,
        address: joinAddress(row.influencer),
        appliedAt: row.appliedAt.toISOString(),
      })),
    };
  }

  /**
   * 응모자 관리 목록 한 페이지.
   * 화면의 모든 필터를 SQL 에서 처리하고 appliedAt 내림차순 커서로 페이징한다.
   * 팔로워 합계 조건은 Prisma where 로 표현할 수 없어 id 선별만 raw SQL 로 하고,
   * 상세 로딩은 기존 include 를 그대로 재사용한다.
   */
  async listApplicantsPage(
    filter: ApplicantFilter,
    cursor: string | null,
    limit: number,
  ): Promise<AdminApplicantPageResponse> {
    const where = buildApplicantWhereSql(filter);
    const cursorCondition = cursor
      ? Prisma.sql`AND ${applicantCursorSql(cursor)}`
      : Prisma.empty;

    const [idRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT a.id ${APPLICANT_FROM_SQL}
        WHERE ${where} ${cursorCondition}
        ORDER BY a."appliedAt" DESC, a.id DESC
        LIMIT ${limit + 1}
      `,
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count ${APPLICANT_FROM_SQL}
        WHERE ${where}
      `,
    ]);

    const hasMore = idRows.length > limit;
    const pageIds = idRows.slice(0, limit).map((row) => row.id);
    const rows = await this.prisma.campaignApplication.findMany({
      where: { id: { in: pageIds } },
      include: APPLICATION_INCLUDE,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    return {
      applications: pageIds.flatMap((id) => {
        const row = byId.get(id);
        return row ? [toResponse(row)] : [];
      }),
      nextCursor: hasMore ? (pageIds[pageIds.length - 1] ?? null) : null,
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  /**
   * 응모자 관리 CSV 내보내기 — 목록과 완전히 같은 필터를 쓰되 페이지가 아니라 전체를 반환한다.
   * phone/주소 등 PII 를 포함하므로 목록 응답과 분리해 둔다.
   */
  async exportApplicants(
    filter: ApplicantFilter,
  ): Promise<ApplicantExportResponse> {
    const where = buildApplicantWhereSql(filter);
    const idRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT a.id ${APPLICANT_FROM_SQL}
      WHERE ${where}
      ORDER BY a."appliedAt" DESC, a.id DESC
      LIMIT ${APPLICANT_EXPORT_MAX_ROWS + 1}
    `;
    const truncated = idRows.length > APPLICANT_EXPORT_MAX_ROWS;
    const ids = idRows
      .slice(0, APPLICANT_EXPORT_MAX_ROWS)
      .map((row) => row.id);

    const rows = await this.prisma.campaignApplication.findMany({
      where: { id: { in: ids } },
      select: APPLICANT_EXPORT_SELECT,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    return {
      rows: ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [toApplicantExportRow(row)] : [];
      }),
      truncated,
    };
  }
}

type ExportChannelRow = {
  subTypes: CampaignSubType[];
  options: { subType: CampaignSubType; option: string }[];
  influencer: { snsAccounts: { snsType: string; handle: string }[] };
};

/** 참여 서브타입별 SNS 정보. 응모가 고른 옵션(피드/릴스)까지 함께 담는다. */
function buildExportChannels(row: ExportChannelRow) {
  return row.subTypes.map((subType) => {
    const snsAccount = row.influencer.snsAccounts.find(
      (account) => account.snsType === subType,
    );
    const handle = snsAccount?.handle ?? "";
    // SNS 계열 (INSTAGRAM/TIKTOK/X/YOUTUBE) 만 프로필 URL 을 만든다.
    const profileUrl = snsProfileUrlOrNull(subType, handle) ?? "";
    const selectedOption =
      row.options.find((entry) => entry.subType === subType)?.option ?? null;
    return { subType, option: selectedOption, snsHandle: handle, profileUrl };
  });
}

function joinAddress(influencer: {
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
}): string {
  return [
    influencer.prefecture,
    influencer.city,
    influencer.addressLine1,
    influencer.addressLine2,
  ]
    .filter((part) => part && part.length > 0)
    .join(" ");
}

const APPLICANT_EXPORT_SELECT = {
  id: true,
  subTypes: true,
  options: { select: { subType: true, option: true } },
  appliedAt: true,
  status: true,
  receivedAt: true,
  rejectReason: true,
  campaign: { select: { id: true, title: true, category: true } },
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
      memo: true,
      snsAccounts: {
        select: { snsType: true, handle: true, followerCount: true },
      },
      memos: {
        orderBy: { createdAt: "desc" as const },
        select: { comment: true },
      },
    },
  },
} as const;

type ApplicantExportPrismaRow = {
  id: string;
  subTypes: CampaignSubType[];
  options: { subType: CampaignSubType; option: string }[];
  appliedAt: Date;
  status: ApplicationStatus;
  receivedAt: Date | null;
  rejectReason: string | null;
  campaign: { id: string; title: string; category: CampaignCategory };
  influencer: {
    id: string;
    name: string;
    nameKana: string | null;
    phone: string;
    postalCode: string;
    prefecture: string;
    city: string;
    addressLine1: string;
    addressLine2: string;
    memo: string | null;
    snsAccounts: { snsType: string; handle: string; followerCount: number }[];
    memos: { comment: string }[];
  };
};

function toApplicantExportRow(
  row: ApplicantExportPrismaRow,
): ApplicantExportRow {
  // 담당자 메모는 최신순으로 이어붙인다. 구 단일 memo 필드는 목록이 비었을 때만 폴백.
  const memos = row.influencer.memos.map((entry) => entry.comment);
  const memo =
    memos.length > 0 ? memos.join(" | ") : (row.influencer.memo ?? "");
  return {
    applicationId: row.id,
    influencerId: row.influencer.id,
    name: row.influencer.name,
    nameKana: row.influencer.nameKana,
    channels: buildExportChannels(row),
    phone: row.influencer.phone,
    postalCode: row.influencer.postalCode,
    address: joinAddress(row.influencer),
    appliedAt: row.appliedAt.toISOString(),
    campaignId: row.campaign.id,
    campaignTitle: row.campaign.title,
    campaignCategory: row.campaign.category,
    status: row.status,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    followers: row.influencer.snsAccounts
      .filter((account) =>
        row.subTypes.includes(account.snsType as CampaignSubType),
      )
      .reduce((sum, account) => sum + account.followerCount, 0),
    memo,
    rejectReason: row.rejectReason,
  };
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
  crossPosts: {
    orderBy: { submittedAt: "asc" as const },
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
  orderNumber: string | null;
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
  crossPosts: {
    id: string;
    platform: CrossPostPlatform;
    platformName: string | null;
    url: string;
    submittedAt: Date;
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
  return r2.publicUrl(raw) ?? r2.presignGet(raw, 86400);
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
    orderNumber: row.orderNumber,
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
    crossPosts: row.crossPosts.map((crossPost) => ({
      id: crossPost.id,
      platform: crossPost.platform,
      platformName: crossPost.platformName,
      url: crossPost.url,
      submittedAt: crossPost.submittedAt.toISOString(),
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
  bankCountry: AddressCountry | null;
  bankCode: string | null;
  bankName: string | null;
  branchName: string | null;
  branchCode: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  invoiceRegistrationNumber: string | null;
  application: {
    id: string;
    subTypes: CampaignSubType[];
    posts: {
      id: string;
      url: string | null;
      subType: CampaignSubType;
      submittedAt: Date;
      insightSubmittedAt: Date | null;
      insightLikes: number | null;
      insightComments: number | null;
      insightShares: number | null;
      insightReposts: number | null;
      insightSaves: number | null;
      insightViews: number | null;
      insightReach: number | null;
    }[];
    campaign: {
      id: string;
      title: string;
      category: CampaignCategory;
      tags: string[];
    };
    influencer: {
      id: string;
      name: string;
      snsAccounts: { snsType: string; handle: string }[];
      bankAccount: {
        bankCountry: AddressCountry;
        bankName: string;
        bankCode: string;
        branchName: string;
        branchCode: string;
        accountNumber: string;
        accountHolder: string;
        invoiceRegistrationNumber: string | null;
      } | null;
    };
  };
};

function toSettlementResponse(row: SettlementRow): AdminSettlement {
  const matchingAccount = row.application.influencer.snsAccounts.find(
    (account) => row.application.subTypes.includes(account.snsType as CampaignSubType),
  );
  // 정산 생성 시점 스냅샷 우선. 스냅샷 도입 전 정산 건은 현재 계좌로 fallback.
  const bankAccount =
    row.bankCode !== null && row.accountNumber !== null
      ? {
          // 스냅샷 도입 전 행은 bankCountry 가 없다 — 당시엔 일본 계좌뿐이었다.
          bankCountry: row.bankCountry ?? "JP",
          bankName: row.bankName ?? "",
          bankCode: row.bankCode,
          branchName: row.branchName ?? "",
          branchCode: row.branchCode ?? "",
          accountNumber: row.accountNumber,
          accountHolder: row.accountHolder ?? "",
          invoiceRegistrationNumber: row.invoiceRegistrationNumber,
        }
      : row.application.influencer.bankAccount;
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
      bankAccount,
    },
    campaign: {
      id: row.application.campaign.id,
      category: row.application.campaign.category,
      // 어드민 정산 화면·CSV 전용 응답이므로 제목 앞에 어드민 태그를 붙여 내려준다.
      title: formatTitleWithTags(
        row.application.campaign.tags,
        row.application.campaign.title,
      ),
    },
    posts: row.application.posts.map((post) => ({
      id: post.id,
      url: post.url,
      subType: post.subType,
      submittedAt: post.submittedAt.toISOString(),
      insightSubmittedAt: post.insightSubmittedAt
        ? post.insightSubmittedAt.toISOString()
        : null,
      insightLikes: post.insightLikes,
      insightComments: post.insightComments,
      insightShares: post.insightShares,
      insightReposts: post.insightReposts,
      insightSaves: post.insightSaves,
      insightViews: post.insightViews,
      insightReach: post.insightReach,
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
