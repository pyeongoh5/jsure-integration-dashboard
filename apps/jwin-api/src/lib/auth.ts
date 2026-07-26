import jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

/** 유저 세션 (X OAuth 로그인 후 쿠키) */
export interface UserSession {
  userId: string;
  xUsername: string;
}

/**
 * 어드민 신원 (D-10)
 *
 * J-WIN은 어드민 계정을 직접 갖지 않는다. 대시보드(@jsure/api)가 로그인 시 발급한
 * access token을 그대로 받아 같은 JWT_SECRET으로 서명만 검증한다.
 * stateless 검증이므로 대시보드 API를 호출하지 않는다.
 *
 * 한계: 대시보드에서 세션을 폐기하거나 계정을 정지시켜도 이미 발급된 access token은
 * 만료(기본 15분)까지 여기서 통과한다. 즉시 차단이 필요해지면 introspection 방식으로 바꿔야 한다.
 */
export interface AdminIdentity {
  /** 대시보드 AdminUser.id */
  adminId: string;
  email: string;
  role: string;
  /** 대시보드 세션 id */
  sid: string;
}

/** 대시보드 @jsure/api 의 JwtPayload 와 동일한 형태 (auth.service.ts) */
interface DashboardJwtPayload {
  sub: string;
  email: string;
  role: string;
  sid: string;
}

const USER_COOKIE = 'jwin_session';
const WEEK = 7 * 24 * 60 * 60;

export function setUserSession(reply: FastifyReply, session: UserSession): void {
  const token = jwt.sign(session, config().SESSION_SECRET, { expiresIn: WEEK });
  reply.setCookie(USER_COOKIE, token, cookieOpts());
}

export function getUserSession(req: FastifyRequest): UserSession | null {
  return verifyCookie<UserSession>(req.cookies[USER_COOKIE]);
}

/**
 * Authorization: Bearer <대시보드 access token> 을 검증해 어드민 신원을 돌려준다.
 * 실패 시 null (호출부에서 401 처리).
 */
export function getAdminIdentity(req: FastifyRequest): AdminIdentity | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), config().JWT_SECRET) as DashboardJwtPayload;
    if (!payload?.sub) return null;
    return {
      adminId: payload.sub,
      email: payload.email,
      role: payload.role,
      sid: payload.sid,
    };
  } catch {
    return null;
  }
}

function verifyCookie<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return jwt.verify(raw, config().SESSION_SECRET) as T;
  } catch {
    return null;
  }
}

function cookieOpts() {
  return {
    path: '/',
    httpOnly: true,
    secure: config().NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: WEEK,
  };
}
