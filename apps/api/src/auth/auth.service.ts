import {
  Injectable,
  Logger,
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
import { AdminUsersService } from "../admin-users/admin-users.service";
import { MailService } from "../mail/mail.service";
import { generateTempPassword, isThrottled } from "../mail/temp-password";
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: AdminUsersService,
    private readonly sessions: SessionsService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  /**
   * 같은 주소로 연달아 요청하는 것을 막는다.
   * 단일 인스턴스 전제 — 스케일아웃하면 Redis 등 공유 저장소로 옮겨야 한다.
   */
  private readonly lastResetRequestAt = new Map<string, number>();

  /**
   * 비밀번호 찾기 — 임시 비밀번호를 만들어 메일로 보낸다.
   *
   * 계정이 없거나 승인 대기 상태여도 **성공으로 응답한다**. 응답이 갈리면 어떤 이메일이
   * 가입돼 있는지 알아낼 수 있기 때문이다(계정 열거). 실제로 한 일은 로그에만 남긴다.
   *
   * 발급 시 기존 세션은 모두 끊는다 — 비밀번호를 잊었다는 건 계정이 남의 손에 있을
   * 가능성을 포함한다.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (isThrottled(this.lastResetRequestAt.get(normalized), Date.now())) {
      this.logger.warn(`비밀번호 재설정 요청이 너무 잦습니다: ${normalized}`);
      return;
    }
    this.lastResetRequestAt.set(normalized, Date.now());

    const user = await this.users.findByEmail(normalized);
    if (!user || user.status !== "ACTIVE") {
      this.logger.warn(
        `비밀번호 재설정 대상 없음(또는 비활성): ${normalized} — 응답은 성공으로 내려간다`,
      );
      return;
    }

    const tempPassword = generateTempPassword();
    await this.users.setPassword(user.id, tempPassword, null);
    await this.mail.send({
      to: user.email,
      subject: "[J-SURE] 임시 비밀번호 안내",
      text: [
        "요청하신 임시 비밀번호입니다.",
        "",
        `    ${tempPassword}`,
        "",
        "이 비밀번호로 로그인한 뒤, 설정 화면에서 새 비밀번호로 바꿔 주세요.",
        "기존에 로그인돼 있던 기기는 모두 로그아웃되었습니다.",
        "",
        "본인이 요청하지 않았다면 즉시 관리자에게 알려 주세요.",
      ].join("\n"),
    });
  }

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
    const { refreshToken, adminUserId, sessionId } = await this.sessions.rotate(
      presented,
      ctx,
    );
    const user = await this.users.findById(adminUserId);
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
