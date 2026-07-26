import jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

/** 유저 세션 (X OAuth 로그인 후 쿠키) */
export interface UserSession {
  userId: string;
  xUsername: string;
}

/** 어드민 세션 (단일 테넌트 — J-sure 운영자) */
export interface AdminSession {
  adminId: string;
}

const USER_COOKIE = 'jwin_session';
const ADMIN_COOKIE = 'jwin_admin';
const WEEK = 7 * 24 * 60 * 60;

export function setUserSession(reply: FastifyReply, session: UserSession): void {
  const token = jwt.sign(session, config().SESSION_SECRET, { expiresIn: WEEK });
  reply.setCookie(USER_COOKIE, token, cookieOpts());
}

export function getUserSession(req: FastifyRequest): UserSession | null {
  return verifyCookie<UserSession>(req.cookies[USER_COOKIE]);
}

export function setAdminSession(reply: FastifyReply, session: AdminSession): void {
  const token = jwt.sign(session, config().SESSION_SECRET, { expiresIn: WEEK });
  reply.setCookie(ADMIN_COOKIE, token, cookieOpts());
}

export function getAdminSession(req: FastifyRequest): AdminSession | null {
  return verifyCookie<AdminSession>(req.cookies[ADMIN_COOKIE]);
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
