import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  WITHDRAW_AUTO_CANCEL_STATUSES,
  WITHDRAW_BLOCKING_STATUSES,
  type CreateWithdrawalRequest,
  type InfluencerWithdrawal,
  type WithdrawalBlockingApplication,
  type WithdrawalEligibilityResponse,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { toWithdrawalResponse } from "../common/withdrawal-response";

/** 신청 가능 여부 판정에 필요한 응모만 고른다 — 종료·취소·반려 건은 쳐다보지 않는다. */
const RELEVANT_STATUSES = [
  ...WITHDRAW_BLOCKING_STATUSES,
  ...WITHDRAW_AUTO_CANCEL_STATUSES,
];

@Injectable()
export class InfluencerMeWithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getEligibility(
    influencerId: string,
  ): Promise<WithdrawalEligibilityResponse> {
    const [applications, latest] = await Promise.all([
      this.relevantApplications(influencerId),
      this.latestWithdrawal(influencerId),
    ]);
    const blockingApplications = applications.filter((application) =>
      WITHDRAW_BLOCKING_STATUSES.includes(application.status),
    );
    return {
      eligible:
        blockingApplications.length === 0 && latest?.decision !== "PENDING",
      blockingApplications: blockingApplications.map(toBlockingApplication),
      autoCancelApplications: applications
        .filter((application) =>
          WITHDRAW_AUTO_CANCEL_STATUSES.includes(application.status),
        )
        .map(toBlockingApplication),
      latest: latest ? toWithdrawalResponse(latest) : null,
    };
  }

  /**
   * 탈퇴 신청. 심사 중인 응모는 같은 트랜잭션에서 취소한다 — 승인 대기 중에
   * 심사가 통과해 진행 중으로 바뀌는 경합을 신청 시점에 없애기 위해서다.
   */
  async request(
    influencerId: string,
    input: CreateWithdrawalRequest,
  ): Promise<InfluencerWithdrawal> {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true },
    });
    if (!influencer) throw new NotFoundException("인플루언서를 찾을 수 없습니다");

    const applications = await this.relevantApplications(influencerId);
    const blocking = applications.filter((application) =>
      WITHDRAW_BLOCKING_STATUSES.includes(application.status),
    );
    if (blocking.length > 0) {
      throw new ConflictException({
        code: "ONGOING_CAMPAIGN",
        message: "진행 중인 캠페인이 있어 탈퇴를 신청할 수 없습니다",
        campaignTitles: blocking.map(
          (application) => application.campaign.title,
        ),
      });
    }

    const autoCancelIds = applications
      .filter((application) =>
        WITHDRAW_AUTO_CANCEL_STATUSES.includes(application.status),
      )
      .map((application) => application.id);

    const created = await this.prisma
      .$transaction(async (tx) => {
        if (autoCancelIds.length > 0) {
          await tx.campaignApplication.updateMany({
            where: { id: { in: autoCancelIds } },
            data: { status: "CANCELLED" },
          });
        }
        return tx.influencerWithdrawal.create({
          data: {
            influencerId,
            reason: input.reason,
            reasonDetail: input.reasonDetail.trim(),
          },
          include: { decidedBy: { select: { name: true } } },
        });
      })
      .catch((error: unknown) => {
        // 대기 건은 인플루언서당 1개라는 부분 유니크 인덱스 위반.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictException({
            code: "WITHDRAWAL_ALREADY_PENDING",
            message: "이미 처리 대기 중인 탈퇴 신청이 있습니다",
          });
        }
        throw error;
      });

    await this.audit.record({
      action: "INFLUENCER_WITHDRAW_REQUEST",
      origin: "SYSTEM",
      influencerId,
      // 상세 사유는 자유 입력이라 감사 로그에 넣지 않는다 — 기록은 신청 테이블에 있다.
      metadata: { reason: created.reason, autoCancelledCount: autoCancelIds.length },
    });
    for (const applicationId of autoCancelIds) {
      await this.audit.record({
        action: "APPLICATION_FORCE_CANCEL",
        origin: "CASCADE",
        influencerId,
        applicationId,
        metadata: { cause: "WITHDRAWAL_REQUEST" },
      });
    }

    return toWithdrawalResponse(created);
  }

  private relevantApplications(influencerId: string) {
    return this.prisma.campaignApplication.findMany({
      where: { influencerId, status: { in: RELEVANT_STATUSES } },
      select: {
        id: true,
        status: true,
        campaign: { select: { title: true } },
      },
      orderBy: { appliedAt: "desc" },
    });
  }

  private latestWithdrawal(influencerId: string) {
    return this.prisma.influencerWithdrawal.findFirst({
      where: { influencerId },
      orderBy: { requestedAt: "desc" },
      include: { decidedBy: { select: { name: true } } },
    });
  }
}

function toBlockingApplication(application: {
  id: string;
  campaign: { title: string };
}): WithdrawalBlockingApplication {
  return {
    applicationId: application.id,
    campaignTitle: application.campaign.title,
  };
}
