import { Injectable } from "@nestjs/common";
import type { AdminInfluencer } from "@jsure/shared";
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
  entityType: "INDIVIDUAL" | "CORPORATE";
  status: "ACTIVE" | "SUSPENDED";
  memo: string | null;
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
    entityType: row.entityType,
    status: row.status,
    memo: row.memo,
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
}
