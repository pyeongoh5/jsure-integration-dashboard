import { Injectable, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { PublicAdminUser } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

// JWT 검증 경로(=모든 보호된 API 요청)에서 admin_users 조회가 매번 발생하지 않도록
// id 별로 짧게 캐시한다. lastSeenAt 같은 표시용 필드는 캐시하지 않는다.
// 사용자 status/role 변경은 최대 AUTH_CACHE_TTL_MS 후에 반영된다 — JWT exp 가 짧으므로 허용 가능한 지연.
const AUTH_CACHE_TTL_MS = 30_000;
const AUTH_CACHE_MAX = 1000;

type AuthCacheEntry = {
  expiresAt: number;
  value: PublicAdminUser | null;
};

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
  private readonly authCache = new Map<string, AuthCacheEntry>();

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

  /**
   * JWT 검증 경로 전용. lastSeenAt 등 표시용 필드는 빼고 핵심 필드만 조회 + 30초 캐시.
   * status/role 변경은 캐시 만료 후 또는 invalidateAuthCache 호출 후 반영된다.
   */
  async findForAuth(id: string): Promise<PublicAdminUser | null> {
    const now = Date.now();
    const cached = this.authCache.get(id);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const row = await this.prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const value: PublicAdminUser | null = row
      ? {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          lastSeenAt: null,
        }
      : null;
    this.setAuthCache(id, value);
    return value;
  }

  /** 사용자 정보가 변경된 경우(권한/상태 등) 캐시를 즉시 무효화. */
  invalidateAuthCache(id: string): void {
    this.authCache.delete(id);
  }

  private setAuthCache(id: string, value: PublicAdminUser | null): void {
    if (this.authCache.size >= AUTH_CACHE_MAX) {
      // 단순 FIFO eviction — 어드민 사용자 수가 많지 않아 정교한 LRU 는 과함.
      const oldest = this.authCache.keys().next().value;
      if (oldest !== undefined) this.authCache.delete(oldest);
    }
    this.authCache.set(id, {
      expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
      value,
    });
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
    this.invalidateAuthCache(id);
    return toPublic(row);
  }

  /** PENDING → ACTIVE 승인. */
  async approve(id: string): Promise<PublicAdminUser> {
    const row = await this.prisma.adminUser.update({
      where: { id },
      data: { status: "ACTIVE" },
      select: PUBLIC_ADMIN_USER_SELECT,
    });
    this.invalidateAuthCache(id);
    return toPublic(row);
  }

  /** PENDING/ACTIVE → SUSPENDED 반려/정지. */
  async reject(id: string): Promise<PublicAdminUser> {
    const row = await this.prisma.adminUser.update({
      where: { id },
      data: { status: "SUSPENDED" },
      select: PUBLIC_ADMIN_USER_SELECT,
    });
    this.invalidateAuthCache(id);
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
