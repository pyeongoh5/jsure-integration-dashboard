import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { INFLUENCER_EXPORT_MAX_ROWS, residenceOf } from "@jsure/shared";
import type {
  AddressCountry,
  AdminInfluencer,
  AdminInfluencerExportResponse,
  AdminInfluencerPageResponse,
  InfluencerActivityResponse,
  InfluencerFilter,
  InfluencerNotesResponse,
  InfluencerMemoEntry,
  InfluencerWithdrawal,
  InfluencerTagListResponse,
  UpdateInfluencerTagsResponse,
  WithdrawalSnsSnapshot,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { INFLUENCER_TAG_INCLUDE, toTagLabels } from "./influencer-tags";
import {
  toWithdrawalResponse,
  type WithdrawalRow,
} from "../common/withdrawal-response";
import { AuditService } from "../audit/audit.service";
import type { AuditActor } from "../audit/audit.service";
import { influencerHistoryGroups } from "../audit/influencer-history";
import { deriveDisplayStage } from "../influencer-campaigns/display-stage";
import { LineDispatcherService } from "../line-templates/line-dispatcher.service";

/** 탈퇴 회원의 익명화 이메일 접두사 — deleted+<id>@invalid 형식의 단일 출처. */
const WITHDRAWN_EMAIL_PREFIX = "deleted+";

const ADMIN_INFLUENCER_INCLUDE = {
  snsAccounts: {
    select: { snsType: true, handle: true, followerCount: true },
    orderBy: { snsType: "asc" as const },
  },
  tagAssignments: INFLUENCER_TAG_INCLUDE,
  // 가장 최근 신청 1건만 — 목록 배지·CSV·승인 다이얼로그가 보는 건 현재 상태다.
  withdrawals: {
    orderBy: { requestedAt: "desc" as const },
    take: 1,
    include: { decidedBy: { select: { name: true } } },
  },
} as const;

type AdminInfluencerRow = {
  id: string;
  email: string;
  name: string;
  nameKana: string | null;
  phone: string;
  status: "ACTIVE" | "SUSPENDED";
  memo: string | null;
  flaggedAt: Date | null;
  createdAt: Date;
  addressCountry: AddressCountry;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  snsAccounts: {
    snsType: string;
    handle: string;
    followerCount: number;
  }[];
  tagAssignments: { tag: { label: string } }[];
  withdrawals: WithdrawalRow[];
};

function toAdminResponse(
  row: AdminInfluencerRow,
  crossPostCount: number,
): AdminInfluencer {
  return {
    id: row.id,
    // 익명화 이메일(deleted+<id>@invalid)은 연락처가 아니라 내부 자리표시자다 —
    // 표시용 응답에서는 비워, 화면·CSV 가 모두 빈 값으로 다룬다.
    email: row.email.startsWith(WITHDRAWN_EMAIL_PREFIX) ? "" : row.email,
    name: row.name,
    nameKana: row.nameKana,
    phone: row.phone,
    status: row.status,
    memo: row.memo,
    flagged: row.flaggedAt !== null,
    tags: toTagLabels(row.tagAssignments),
    snsAccounts: row.snsAccounts.map((s) => ({
      snsType: s.snsType as AdminInfluencer["snsAccounts"][number]["snsType"],
      handle: s.handle,
      followerCount: s.followerCount,
    })),
    address: {
      country: row.addressCountry,
      postalCode: row.postalCode,
      prefecture: row.prefecture,
      city: row.city,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
    },
    residence: residenceOf(row),
    crossPostCount,
    withdrawal: row.withdrawals[0]
      ? toWithdrawalResponse(row.withdrawals[0])
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class InfluencersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dispatcher: LineDispatcherService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.influencer.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.influencer.findUnique({ where: { id } });
  }

  findFull(id: string) {
    return this.prisma.influencer.findUnique({
      where: { id },
      include: { snsAccounts: true, bankAccount: true },
    });
  }

  /** 목록·CSV·발송 후보가 같은 조건을 쓰도록 where 는 여기 한 곳에서만 만든다. */
  private buildAdminWhere(filter: InfluencerFilter): Prisma.InfluencerWhereInput {
    const conditions: Prisma.InfluencerWhereInput[] = [];
    // 선택한 채널 중 하나라도 계정을 보유하면 포함 (미선택이면 전체).
    if (filter.snsTypes.length > 0) {
      conditions.push({
        snsAccounts: { some: { snsType: { in: filter.snsTypes } } },
      });
    }
    // 거주지 판정은 shared 의 residenceOf 와 같은 규칙이어야 한다 — 어긋나면
    // 필터 결과와 행에 찍힌 거주지가 달라진다.
    if (filter.residence === "NONE") {
      conditions.push({ postalCode: "" });
    } else if (filter.residence) {
      conditions.push({
        addressCountry: filter.residence,
        postalCode: { not: "" },
      });
    }
    // 태그는 조건을 하나씩 쌓는다 — 선택한 태그를 모두 보유해야 걸리도록(AND).
    for (const tagId of filter.tagIds) {
      conditions.push({ tagAssignments: { some: { tagId } } });
    }
    const query = filter.query.trim();
    if (query) {
      conditions.push({
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          {
            snsAccounts: {
              some: { handle: { contains: query, mode: "insensitive" } },
            },
          },
        ],
      });
    }
    // 대기 건은 인플루언서당 1개뿐이고 승인은 종착점이라, "그런 신청이 하나라도
    // 있는가"가 곧 "현재 그 상태인가"다.
    if (filter.withdrawal) {
      conditions.push({ withdrawals: { some: { decision: filter.withdrawal } } });
    }
    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /** 크로스포스팅 누적은 응모를 거쳐 인플루언서로 합산한다. */
  private async crossPostCountsByInfluencer(
    influencerIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (influencerIds.length === 0) return counts;
    const applications = await this.prisma.campaignApplication.findMany({
      where: { influencerId: { in: influencerIds }, crossPosts: { some: {} } },
      select: {
        influencerId: true,
        _count: { select: { crossPosts: true } },
      },
    });
    for (const application of applications) {
      counts.set(
        application.influencerId,
        (counts.get(application.influencerId) ?? 0) +
          application._count.crossPosts,
      );
    }
    return counts;
  }

  async listForAdminPage(
    filter: InfluencerFilter,
    cursor: string | null,
    limit: number,
  ): Promise<AdminInfluencerPageResponse> {
    const where = this.buildAdminWhere(filter);
    const [rows, total] = await Promise.all([
      this.prisma.influencer.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: ADMIN_INFLUENCER_INCLUDE,
        // 한 건 더 받아 다음 페이지 존재를 판정한다.
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.influencer.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const crossPostCounts = await this.crossPostCountsByInfluencer(
      pageRows.map((row) => row.id),
    );
    return {
      influencers: pageRows.map((row) =>
        toAdminResponse(row, crossPostCounts.get(row.id) ?? 0),
      ),
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
      total,
    };
  }

  /** 필터에 걸린 전체 — CSV 내보내기와 일괄 발송 후보가 함께 쓴다. */
  async exportForAdmin(
    filter: InfluencerFilter,
  ): Promise<AdminInfluencerExportResponse> {
    const rows = await this.prisma.influencer.findMany({
      where: this.buildAdminWhere(filter),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: ADMIN_INFLUENCER_INCLUDE,
      // 한 건 더 받아 상한 초과 여부를 판정한다.
      take: INFLUENCER_EXPORT_MAX_ROWS + 1,
    });
    const truncated = rows.length > INFLUENCER_EXPORT_MAX_ROWS;
    const pageRows = truncated
      ? rows.slice(0, INFLUENCER_EXPORT_MAX_ROWS)
      : rows;
    const crossPostCounts = await this.crossPostCountsByInfluencer(
      pageRows.map((row) => row.id),
    );
    return {
      influencers: pageRows.map((row) =>
        toAdminResponse(row, crossPostCounts.get(row.id) ?? 0),
      ),
      truncated,
    };
  }

  async getNotes(influencerId: string): Promise<InfluencerNotesResponse> {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        flaggedAt: true,
        tagAssignments: INFLUENCER_TAG_INCLUDE,
      },
    });
    if (!influencer) throw new NotFoundException("Influencer not found");

    const memoRows = await this.prisma.influencerMemo.findMany({
      where: { influencerId },
      orderBy: { createdAt: "desc" },
      include: { campaign: { select: { id: true, title: true } } },
    });

    const adminById = await this.adminNamesById(
      memoRows.map((memo) => memo.createdById),
    );
    const toActor = (id: string | null) =>
      id ? { id, name: adminById.get(id) ?? null } : null;

    return {
      memos: memoRows.map((memo) => ({
        id: memo.id,
        comment: memo.comment,
        createdAt: memo.createdAt.toISOString(),
        createdBy: toActor(memo.createdById),
        campaignId: memo.campaign?.id ?? null,
        campaignTitle: memo.campaign?.title ?? null,
      })),
      // 반려 이력은 GET :id/activity 로 옮겼다. 배포 갭 동안 구버전 admin-web 이
      // 이 필드를 필수로 파싱하므로 빈 배열로 응답하고, 스키마에서 필드를
      // 제거하는 것은 다음 배포로 미룬다.
      applicationRejections: [],
      postRejections: [],
      flaggedAt: influencer.flaggedAt ? influencer.flaggedAt.toISOString() : null,
      tags: toTagLabels(influencer.tagAssignments),
    };
  }

  /**
   * 인플루언서의 모든 캠페인 활동 이력. 응모 1건 = 그룹, 그 안의 이벤트 = 행.
   * 감사 로그(어드민 처리) + 응모 타임스탬프에서 합성한 인플루언서 액션을 합친다.
   */
  async getActivity(influencerId: string): Promise<InfluencerActivityResponse> {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true },
    });
    if (!influencer) throw new NotFoundException("인플루언서를 찾을 수 없습니다");

    const applications = await this.prisma.campaignApplication.findMany({
      where: { influencerId },
      select: {
        id: true,
        status: true,
        rejectReason: true,
        subTypes: true,
        appliedAt: true,
        orderSubmittedAt: true,
        receivedAt: true,
        // 감사 로그 이전 반려 건의 처리자·시각 복원용 (influencer-history 참조)
        reviewedAt: true,
        reviewedById: true,
        // 표시 단계(= 세부 탭 분류) 계산 입력
        submissionReviewStatus: true,
        submissionReviewedAt: true,
        settlement: { select: { status: true } },
        campaign: {
          select: {
            id: true,
            title: true,
            category: true,
            recruits: { select: { subType: true, insightRequired: true } },
          },
        },
        posts: {
          select: {
            subType: true,
            submittedAt: true,
            insightSubmittedAt: true,
          },
        },
      },
    });
    if (applications.length === 0) return { groups: [] };

    const logs = await this.prisma.adminActivityLog.findMany({
      where: { applicationId: { in: applications.map(({ id }) => id) } },
      select: {
        id: true,
        applicationId: true,
        action: true,
        origin: true,
        actorId: true,
        actorName: true,
        metadata: true,
        createdAt: true,
      },
    });

    const reviewerById = await this.adminNamesById(
      applications.map((application) => application.reviewedById),
    );

    return {
      groups: influencerHistoryGroups(
        applications.map((application) => ({
          ...application,
          displayStage: deriveDisplayStage({
            status: application.status,
            category: application.campaign.category,
            receivedAt: application.receivedAt,
            submissionReviewStatus: application.submissionReviewStatus,
            submissionReviewedAt: application.submissionReviewedAt,
            settlementStatus: application.settlement?.status ?? null,
            posts: application.posts.map((post) => ({
              insightSubmittedAt: post.insightSubmittedAt,
              insightRequired:
                application.campaign.recruits.find(
                  (recruit) => recruit.subType === post.subType,
                )?.insightRequired ?? true,
            })),
          }),
          reviewedBy: application.reviewedById
            ? {
                id: application.reviewedById,
                name: reviewerById.get(application.reviewedById) ?? null,
              }
            : null,
        })),
        logs,
      ),
    };
  }

  /** 어드민 id 목록 → 이름 맵. null·중복은 버린다. */
  private async adminNamesById(
    ids: (string | null)[],
  ): Promise<Map<string, string | null>> {
    const unique = Array.from(
      new Set(ids.filter((id): id is string => id !== null)),
    );
    if (unique.length === 0) return new Map();
    const admins = await this.prisma.adminUser.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(admins.map((user) => [user.id, user.name]));
  }

  async createMemo(
    influencerId: string,
    actor: AuditActor,
    comment: string,
    campaignId: string | null,
  ): Promise<InfluencerMemoEntry> {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true },
    });
    if (!influencer) throw new NotFoundException("Influencer not found");

    const created = await this.prisma.influencerMemo.create({
      data: {
        influencerId,
        comment,
        createdById: actor.id,
        campaignId: campaignId ?? null,
      },
      include: { campaign: { select: { id: true, title: true } } },
    });
    // 메모 본문은 InfluencerMemo 가 원본 — 로그에는 참조만 남긴다.
    await this.audit.record({
      action: "INFLUENCER_MEMO_CREATE",
      actor,
      influencerId,
      campaignId: created.campaign?.id ?? undefined,
      metadata: { memoId: created.id },
    });
    return {
      id: created.id,
      comment: created.comment,
      createdAt: created.createdAt.toISOString(),
      createdBy: { id: actor.id, name: actor.name },
      campaignId: created.campaign?.id ?? null,
      campaignTitle: created.campaign?.title ?? null,
    };
  }

  /** 태그 마스터 전체 — 자동완성 후보. 연결이 끊긴 태그도 후보로 남긴다. */
  async listTags(): Promise<InfluencerTagListResponse> {
    const tags = await this.prisma.influencerTag.findMany({
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    });
    return { tags };
  }

  /**
   * 한 인플루언서의 태그를 통째로 교체한다. 마스터에 없는 라벨은 여기서 만들고,
   * 빠진 태그는 연결만 끊는다 — 마스터 행은 다른 인플루언서와 자동완성이 계속 쓴다.
   */
  async updateTags(
    influencerId: string,
    actor: AuditActor,
    labels: string[],
  ): Promise<UpdateInfluencerTagsResponse> {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true },
    });
    if (!influencer) throw new NotFoundException("인플루언서를 찾을 수 없습니다");

    // 같은 라벨이 두 번 와도 한 번만 단다.
    const uniqueLabels = Array.from(new Set(labels));

    const tags = await this.prisma.$transaction(async (tx) => {
      const resolved = await Promise.all(
        uniqueLabels.map((label) =>
          tx.influencerTag.upsert({
            where: { label },
            update: {},
            create: { label, createdById: actor.id },
            select: { id: true, label: true },
          }),
        ),
      );
      const tagIds = resolved.map((tag) => tag.id);
      // 남길 태그를 제외하고 지운다 — 유지되는 태그의 부착 시점을 보존하기 위해.
      await tx.influencerTagAssignment.deleteMany({
        where: { influencerId, NOT: { tagId: { in: tagIds } } },
      });
      await tx.influencerTagAssignment.createMany({
        data: tagIds.map((tagId) => ({
          influencerId,
          tagId,
          createdById: actor.id,
        })),
        skipDuplicates: true,
      });
      return resolved;
    });

    const assignedLabels = tags.map((tag) => tag.label).sort();
    await this.audit.record({
      action: "INFLUENCER_TAGS_UPDATE",
      actor,
      influencerId,
      metadata: { tags: assignedLabels },
    });
    return { tags: assignedLabels };
  }

  async setFlagged(
    influencerId: string,
    actor: AuditActor,
  ): Promise<{ flaggedAt: string }> {
    const updated = await this.prisma.influencer.update({
      where: { id: influencerId },
      data: { flaggedAt: new Date(), flaggedById: actor.id },
      select: { flaggedAt: true },
    });
    await this.audit.record({
      action: "INFLUENCER_FLAG_SET",
      actor,
      influencerId,
    });
    return { flaggedAt: updated.flaggedAt!.toISOString() };
  }

  async clearFlagged(influencerId: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { flaggedById: true },
    });
    if (!existing) throw new NotFoundException("Influencer not found");
    await this.prisma.influencer.update({
      where: { id: influencerId },
      data: { flaggedAt: null, flaggedById: null },
    });
    // 해제는 flaggedById 를 소거하므로 이전 설정자를 로그에 보존한다.
    await this.audit.record({
      action: "INFLUENCER_FLAG_CLEAR",
      actor,
      influencerId,
      metadata: { previousFlaggedById: existing.flaggedById },
    });
  }

  /**
   * 탈퇴 처리 — 계정 삭제가 아니라 PII 익명화다. 응모·정산·동의·메모 이력은
   * 업무/법적 기록으로 남기고(CampaignApplication 은 onDelete: Restrict 라
   * 물리 삭제 자체가 불가), 개인정보만 지운다. 되돌릴 수 없다.
   */
  async withdraw(influencerId: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        email: true,
        name: true,
        lineUserId: true,
        // 아래 트랜잭션이 지우기 전의 보유 현황 — 탈퇴 기록에 스냅샷으로 남긴다.
        snsAccounts: { select: { snsType: true, followerCount: true } },
      },
    });
    if (!existing) throw new NotFoundException("인플루언서를 찾을 수 없습니다");
    if (existing.email.startsWith(WITHDRAWN_EMAIL_PREFIX))
      throw new ConflictException("이미 탈퇴 처리된 회원입니다");

    const pending = await this.prisma.influencerWithdrawal.findFirst({
      where: { influencerId, decision: "PENDING" },
      select: { id: true },
    });
    // 본인이 낸 신청이 있어야만 탈퇴시킬 수 있다. 어드민의 일방적 강제 탈퇴를
    // 막는 동시에, 사유·SNS 스냅샷을 담을 기록이 반드시 존재하도록 보장한다.
    if (!pending) {
      throw new ConflictException(
        "탈퇴 신청이 없는 회원은 탈퇴 처리할 수 없습니다",
      );
    }

    // 채널 종류와 팔로워 수만. 핸들은 개인 식별자라 익명화 취지에 맞게 제외한다.
    const snsSnapshot: WithdrawalSnsSnapshot = existing.snsAccounts.map(
      (account) => ({
        snsType: account.snsType,
        followerCount: account.followerCount,
      }),
    );

    await this.prisma.$transaction([
      this.prisma.influencerWithdrawal.update({
        where: { id: pending.id },
        data: {
          decision: "APPROVED" as const,
          decidedAt: new Date(),
          decidedById: actor.id,
          snsSnapshot,
        },
      }),
      this.prisma.influencerSnsAccount.deleteMany({ where: { influencerId } }),
      this.prisma.influencerBankAccount.deleteMany({ where: { influencerId } }),
      // 세션 삭제 = 로그인된 기기 전부 강제 로그아웃
      this.prisma.influencerSession.deleteMany({ where: { influencerId } }),
      this.prisma.influencer.update({
        where: { id: influencerId },
        data: {
          email: `${WITHDRAWN_EMAIL_PREFIX}${influencerId}@invalid`,
          passwordHash: null,
          lineUserId: null,
          lineLinkedAt: null,
          name: "탈퇴 회원",
          nameKana: null,
          phone: "",
          birthDate: null,
          postalCode: "",
          prefecture: "",
          city: "",
          addressLine1: "",
          addressLine2: "",
          status: "SUSPENDED",
        },
      }),
    ]);

    // 익명화가 lineUserId 와 이름을 지운 뒤라, 트랜잭션 전에 읽어둔 값으로 보낸다
    // (dispatchCommon 은 DB 를 다시 읽지 않는다). 탈퇴가 실제로 끝난 다음에
    // 보내야 트랜잭션이 실패했을 때 "탈퇴 완료" 안내만 나가는 일이 없다.
    await this.dispatcher.dispatchCommon("COMMON_WITHDRAWAL_APPROVED", {
      influencer: {
        id: influencerId,
        name: existing.name,
        lineUserId: existing.lineUserId,
      },
    });

    // 익명화 전 PII(이름·이메일)는 로그에도 남기지 않는다.
    await this.audit.record({
      action: "INFLUENCER_WITHDRAW",
      actor,
      influencerId,
      metadata: { fromRequest: pending !== null },
    });
  }

  /**
   * 탈퇴 신청 반려 — 미정산 잔액이나 오신청처럼 지금 탈퇴시키면 안 되는 사유가
   * 있을 때. 계정은 건드리지 않으므로(대기 중에도 상태는 ACTIVE 였다) 신청 건만
   * 닫고 LINE 으로 사유를 안내한다.
   */
  async rejectWithdrawal(
    influencerId: string,
    actor: AuditActor,
    rejectReason: string,
  ): Promise<InfluencerWithdrawal> {
    const pending = await this.prisma.influencerWithdrawal.findFirst({
      where: { influencerId, decision: "PENDING" },
      select: { id: true, influencer: { select: { name: true, lineUserId: true } } },
    });
    if (!pending)
      throw new NotFoundException("처리 대기 중인 탈퇴 신청이 없습니다");

    const updated = await this.prisma.influencerWithdrawal.update({
      where: { id: pending.id },
      data: {
        decision: "REJECTED",
        decidedAt: new Date(),
        decidedById: actor.id,
        rejectReason,
      },
      include: { decidedBy: { select: { name: true } } },
    });

    await this.dispatcher.dispatchCommon("COMMON_WITHDRAWAL_REJECTED", {
      influencer: {
        id: influencerId,
        name: pending.influencer.name,
        lineUserId: pending.influencer.lineUserId,
      },
      withdrawal: { rejectReason },
    });

    // 반려 사유는 자유 입력이라 감사 로그에 본문을 넣지 않는다 — 신청 테이블에 남는다.
    await this.audit.record({
      action: "INFLUENCER_WITHDRAW_REJECT",
      actor,
      influencerId,
    });

    return toWithdrawalResponse(updated);
  }
}
