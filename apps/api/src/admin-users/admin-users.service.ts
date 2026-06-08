import { Injectable, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { PublicAdminUser } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

const PUBLIC_ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  sessions: {
    where: { revokedAt: null },
    orderBy: { lastSeenAt: "desc" as const },
    take: 1,
    select: { lastSeenAt: true },
  },
} as const;

type PublicAdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: PublicAdminUser["role"];
  status: PublicAdminUser["status"];
  createdAt: Date;
  updatedAt: Date;
  sessions: { lastSeenAt: Date }[];
};

function toPublic(row: PublicAdminUserRow): PublicAdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastSeenAt: row.sessions[0]?.lastSeenAt.toISOString() ?? null,
  };
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.adminUser.findUnique({ where: { email } });
  }

  async findAllPublic(): Promise<PublicAdminUser[]> {
    const rows = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      select: PUBLIC_ADMIN_USER_SELECT,
    });
    return rows.map(toPublic);
  }

  async findPublicById(id: string): Promise<PublicAdminUser | null> {
    const row = await this.prisma.adminUser.findUnique({
      where: { id },
      select: PUBLIC_ADMIN_USER_SELECT,
    });
    return row ? toPublic(row) : null;
  }

  findById(id: string) {
    return this.prisma.adminUser.findUnique({ where: { id } });
  }

  /** 역할 변경. */
  async updateRole(
    id: string,
    role: "OWNER" | "ADMIN" | "GUEST",
  ): Promise<PublicAdminUser> {
    const row = await this.prisma.adminUser.update({
      where: { id },
      data: { role },
      select: PUBLIC_ADMIN_USER_SELECT,
    });
    return toPublic(row);
  }

  /** PENDING → ACTIVE 승인. */
  async approve(id: string): Promise<PublicAdminUser> {
    const row = await this.prisma.adminUser.update({
      where: { id },
      data: { status: "ACTIVE" },
      select: PUBLIC_ADMIN_USER_SELECT,
    });
    return toPublic(row);
  }

  /** PENDING/ACTIVE → SUSPENDED 반려/정지. */
  async reject(id: string): Promise<PublicAdminUser> {
    const row = await this.prisma.adminUser.update({
      where: { id },
      data: { status: "SUSPENDED" },
      select: PUBLIC_ADMIN_USER_SELECT,
    });
    return toPublic(row);
  }

  async create(input: { email: string; password: string; name?: string }) {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new ConflictException("Email already in use");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.adminUser.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
    });
  }
}
