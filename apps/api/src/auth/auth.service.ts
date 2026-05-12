import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type {
  AuthResponse,
  RefreshResponse,
  SessionSummary,
} from "@jsure/shared";
import { UsersService } from "../users/users.service";
import {
  SessionsService,
  type SessionContext,
  type SessionSummary as SessionRow,
} from "./sessions.service";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sid: string;
}

function toPublicSession(row: SessionRow, currentSid: string | null): SessionSummary {
  return {
    id: row.id,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    isCurrent: row.id === currentSid,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }

  private async signAccessToken(
    user: { id: string; email: string; role: string },
    sid: string,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid,
    };
    return this.jwt.signAsync(payload);
  }

  async login(
    email: string,
    password: string,
    ctx: SessionContext,
  ): Promise<AuthResponse> {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    if (user.status === "PENDING") {
      throw new ForbiddenException({
        code: "ACCOUNT_PENDING",
        message: "가입 승인 대기 중인 계정입니다.",
      });
    }
    if (user.status === "SUSPENDED") {
      throw new ForbiddenException({
        code: "ACCOUNT_SUSPENDED",
        message: "정지된 계정입니다. 관리자에게 문의하세요.",
      });
    }

    const { refreshToken, sessionId } = await this.sessions.create(user.id, ctx);
    const accessToken = await this.signAccessToken(user, sessionId);
    const publicUser = await this.users.findPublicById(user.id);
    if (!publicUser) throw new UnauthorizedException();
    return { accessToken, refreshToken, user: publicUser };
  }

  async refresh(
    presented: string,
    ctx: SessionContext,
  ): Promise<RefreshResponse> {
    const { refreshToken, userId, sessionId } = await this.sessions.rotate(
      presented,
      ctx,
    );
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Account is not active");
    }
    const accessToken = await this.signAccessToken(user, sessionId);
    return { accessToken, refreshToken };
  }

  async logout(presented: string): Promise<void> {
    await this.sessions.revokeByToken(presented);
  }

  async listSessions(
    userId: string,
    currentSid: string | null,
  ): Promise<SessionSummary[]> {
    const rows = await this.sessions.listForUser(userId);
    return rows.map((r) => toPublicSession(r, currentSid));
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    return this.sessions.revokeOwnedById(userId, sessionId);
  }

  async register(input: { email: string; password: string; name?: string }) {
    const created = await this.users.create(input);
    return {
      status: "PENDING" as const,
      email: created.email,
      message:
        "가입이 요청되었습니다. 관리자의 승인이 완료되면 로그인할 수 있습니다.",
    };
  }
}
