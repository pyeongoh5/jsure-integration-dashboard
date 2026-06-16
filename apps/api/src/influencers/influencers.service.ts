import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminInfluencer,
  InfluencerNotesResponse,
  InfluencerMemoEntry,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

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
  snsAccounts: {
    snsType: string;
    handle: string;
    followerCount: number;
  }[];
};

function toAdminResponse(row: AdminInfluencerRow): AdminInfluencer {
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
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class InfluencersService {
  constructor(private readonly prisma: PrismaService) {}

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
    const rows = await this.prisma.influencer.findMany({
      orderBy: { createdAt: "desc" },
      include: ADMIN_INFLUENCER_INCLUDE,
    });
    return rows.map(toAdminResponse);
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
          campaign: { select: { title: true } },
        },
      }),
      this.prisma.submittedPostRejection.findMany({
        where: { post: { application: { influencerId } } },
        orderBy: { rejectedAt: "desc" },
        select: {
          id: true,
          postId: true,
          comment: true,
          rejectedAt: true,
          post: {
            select: {
              application: {
                select: { campaign: { select: { title: true } } },
              },
            },
          },
        },
      }),
    ]);

    const memoCreatorIds = Array.from(
      new Set(
        memoRows
          .map((memo) => memo.createdById)
          .filter((id): id is string => id !== null),
      ),
    );
    const creators = memoCreatorIds.length
      ? await this.prisma.adminUser.findMany({
          where: { id: { in: memoCreatorIds } },
          select: { id: true, name: true },
        })
      : [];
    const creatorById = new Map(creators.map((user) => [user.id, user]));

    return {
      memos: memoRows.map((memo) => ({
        id: memo.id,
        comment: memo.comment,
        createdAt: memo.createdAt.toISOString(),
        createdBy: memo.createdById
          ? {
              id: memo.createdById,
              name: creatorById.get(memo.createdById)?.name ?? null,
            }
          : null,
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
      })),
      postRejections: postRejectionRows.map((rejection) => ({
        id: rejection.id,
        postId: rejection.postId,
        comment: rejection.comment,
        rejectedAt: rejection.rejectedAt.toISOString(),
        campaignTitle: rejection.post.application.campaign.title,
      })),
      flaggedAt: influencer.flaggedAt ? influencer.flaggedAt.toISOString() : null,
    };
  }

  async createMemo(
    influencerId: string,
    creatorId: string,
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
        createdById: creatorId,
        campaignId: campaignId ?? null,
      },
      include: { campaign: { select: { id: true, title: true } } },
    });
    const creator = await this.prisma.adminUser.findUnique({
      where: { id: creatorId },
      select: { id: true, name: true },
    });
    return {
      id: created.id,
      comment: created.comment,
      createdAt: created.createdAt.toISOString(),
      createdBy: creator ? { id: creator.id, name: creator.name } : null,
      campaignId: created.campaign?.id ?? null,
      campaignTitle: created.campaign?.title ?? null,
    };
  }

  async setFlagged(
    influencerId: string,
    actorId: string,
  ): Promise<{ flaggedAt: string }> {
    const updated = await this.prisma.influencer.update({
      where: { id: influencerId },
      data: { flaggedAt: new Date(), flaggedById: actorId },
      select: { flaggedAt: true },
    });
    return { flaggedAt: updated.flaggedAt!.toISOString() };
  }

  async clearFlagged(influencerId: string): Promise<void> {
    await this.prisma.influencer.update({
      where: { id: influencerId },
      data: { flaggedAt: null, flaggedById: null },
    });
  }
}
