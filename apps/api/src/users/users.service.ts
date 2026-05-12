import { Injectable, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { PublicUser } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

const PUBLIC_USER_SELECT = {
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

type PublicUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: PublicUser["role"];
  status: PublicUser["status"];
  createdAt: Date;
  updatedAt: Date;
  sessions: { lastSeenAt: Date }[];
};

function toPublic(row: PublicUserRow): PublicUser {
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
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findAllPublic(): Promise<PublicUser[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: PUBLIC_USER_SELECT,
    });
    return rows.map(toPublic);
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
    return row ? toPublic(row) : null;
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(input: { email: string; password: string; name?: string }) {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new ConflictException("Email already in use");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
    });
  }
}
