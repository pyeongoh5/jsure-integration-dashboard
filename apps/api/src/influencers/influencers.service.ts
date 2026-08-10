import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AddressCountry,
  AdminInfluencer,
  InfluencerNotesResponse,
  InfluencerMemoEntry,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuditActor } from "../audit/audit.service";

const ADMIN_INFLUENCER_INCLUDE = {
  snsAccounts: {
    select: { snsType: true, handle: true, followerCount: true },
    orderBy: { snsType: "asc" as const },
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
};

function toAdminResponse(
  row: AdminInfluencerRow,
  crossPostCount: number,
): AdminInfluencer {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    nameKana: row.nameKana,
    phone: row.phone,
    status: row.status,
    memo: row.memo,
    flagged: row.flaggedAt !== null,
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
    crossPostCount,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class InfluencersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  async listForAdmin(): Promise<AdminInfluencer[]> {
    const [rows, applicationsWithCrossPosts] = await Promise.all([
      this.prisma.influencer.findMany({
        orderBy: { createdAt: "desc" },
        include: ADMIN_INFLUENCER_INCLUDE,
      }),
      // 크로스포스팅 누적은 응모를 거쳐 인플루언서로 합산한다.
      this.prisma.campaignApplication.findMany({
        where: { crossPosts: { some: {} } },
        select: {
          influencerId: true,
          _count: { select: { crossPosts: true } },
        },
      }),
    ]);
    const crossPostCountByInfluencer = new Map<string, number>();
    for (const application of applicationsWithCrossPosts) {
      crossPostCountByInfluencer.set(
        application.influencerId,
        (crossPostCountByInfluencer.get(application.influencerId) ?? 0) +
          application._count.crossPosts,
      );
    }
    return rows.map((row) =>
      toAdminResponse(row, crossPostCountByInfluencer.get(row.id) ?? 0),
    );
  }

  async getNotes(influencerId: string): Promise<InfluencerNotesResponse> {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true, flaggedAt: true },
    });
    if (!influencer) throw new NotFoundException("Influencer not found");

    const [memoRows, applicationRows, postRejectionRows] = await Promise.all([
      this.prisma.influencerMemo.findMany({
        where: { influencerId },
        orderBy: { createdAt: "desc" },
        include: { campaign: { select: { id: true, title: true } } },
      }),
      this.prisma.campaignApplication.findMany({
        where: { influencerId, rejectReason: { not: null } },
        orderBy: { reviewedAt: "desc" },
        select: {
          id: true,
          rejectReason: true,
          reviewedAt: true,
          // undo 가 rejectReason 과 reviewedById 를 함께 비우므로, 이 쿼리에
          // 걸린 행의 검토자는 항상 그 거절을 수행한 어드민이다.
          reviewedById: true,
          campaign: { select: { title: true } },
        },
      }),
      this.prisma.submissionRejection.findMany({
        where: { application: { influencerId } },
        orderBy: { rejectedAt: "desc" },
        select: {
          id: true,
          applicationId: true,
          comment: true,
          rejectedAt: true,
          rejectedById: true,
          application: {
            select: { campaign: { select: { title: true } } },
          },
        },
      }),
    ]);

    // 메모 작성자·응모 거절자·제출물 반려자를 한 번에 조회한다.
    const adminIds = Array.from(
      new Set(
        [
          ...memoRows.map((memo) => memo.createdById),
          ...applicationRows.map((application) => application.reviewedById),
          ...postRejectionRows.map((rejection) => rejection.rejectedById),
        ].filter((id): id is string => id !== null),
      ),
    );
    const admins = adminIds.length
      ? await this.prisma.adminUser.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true },
        })
      : [];
    const adminById = new Map(admins.map((user) => [user.id, user]));
    const toActor = (id: string | null) =>
      id ? { id, name: adminById.get(id)?.name ?? null } : null;

    return {
      memos: memoRows.map((memo) => ({
        id: memo.id,
        comment: memo.comment,
        createdAt: memo.createdAt.toISOString(),
        createdBy: toActor(memo.createdById),
        campaignId: memo.campaign?.id ?? null,
        campaignTitle: memo.campaign?.title ?? null,
      })),
      applicationRejections: applicationRows.map((application) => ({
        applicationId: application.id,
        comment: application.rejectReason ?? "",
        rejectedAt: application.reviewedAt
          ? application.reviewedAt.toISOString()
          : null,
        campaignTitle: application.campaign.title,
        rejectedBy: toActor(application.reviewedById),
      })),
      postRejections: postRejectionRows.map((rejection) => ({
        id: rejection.id,
        applicationId: rejection.applicationId,
        comment: rejection.comment,
        rejectedAt: rejection.rejectedAt.toISOString(),
        campaignTitle: rejection.application.campaign.title,
        rejectedBy: toActor(rejection.rejectedById),
      })),
      flaggedAt: influencer.flaggedAt ? influencer.flaggedAt.toISOString() : null,
    };
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
}
