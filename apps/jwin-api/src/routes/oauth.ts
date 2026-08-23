import { FastifyInstance } from 'fastify';
import { getPrisma, Prisma } from '@jsure/jwin-db';
import { config } from '../config';
import { encrypt } from '../lib/crypto';
import { setUserSession } from '../lib/auth';
import {
  BRAND_SCOPES,
  USER_SCOPES,
  buildAuthorizeUrl,
  exchangeCode,
  generatePkce,
  getMe,
} from '../lib/x-api';

/**
 * OAuth 플로우 2종:
 *  - 브랜드: 어드민이 발급한 링크를 브랜드 담당자가 열어 승인 → 토큰을 캠페인에 귀속
 *  - 유저: LP에서 응모 전 로그인 → 세션 쿠키 + 검증용 토큰 저장
 */
export async function oauthRoutes(app: FastifyInstance) {
  const prisma = getPrisma();
  const brandRedirect = `${config().API_BASE_URL}/oauth/brand/callback`;
  const userRedirect = `${config().API_BASE_URL}/oauth/user/callback`;

  // ── 브랜드 연동 시작 (어드민이 브랜드에 전달하는 링크) ──
  // state 저장은 OAuthState.campaignId 컬럼을 그대로 재사용한다 (user 플로우의
  // redirectTo와 마찬가지로 kind별로 다른 의미의 값을 담아 쓰는 기존 방식).
  app.get<{ Querystring: { accountId: string } }>('/oauth/brand/start', async (req, reply) => {
    const { accountId } = req.query;
    const brandAccount = await prisma.brandXAccount.findUnique({ where: { id: accountId } });
    if (!brandAccount) return reply.code(404).send({ error: 'account not found' });

    const { codeVerifier, codeChallenge, state } = generatePkce();
    await prisma.oAuthState.create({
      data: { state, kind: 'brand', codeVerifier, campaignId: accountId },
    });
    return reply.redirect(
      buildAuthorizeUrl({ redirectUri: brandRedirect, scopes: BRAND_SCOPES, state, codeChallenge }),
    );
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/oauth/brand/callback',
    async (req, reply) => {
      const { code, state, error } = req.query;
      if (error || !code || !state) return reply.redirect(`${config().WEB_BASE_URL}/connect/failed`);
      const savedState = await prisma.oAuthState.delete({ where: { state } }).catch(() => null);
      if (!savedState || savedState.kind !== 'brand' || !savedState.campaignId) {
        return reply.redirect(`${config().WEB_BASE_URL}/connect/failed`);
      }
      const saved = { accountId: savedState.campaignId, codeVerifier: savedState.codeVerifier };

      const tokens = await exchangeCode(code, brandRedirect, saved.codeVerifier);
      const me = await getMe(tokens.accessToken);

      // 동일 X 계정(xUserId)이 다른 계정 row에 이미 연동돼 있으면 중복
      const duplicate = await prisma.brandXAccount.findFirst({
        where: { xUserId: me.data.id, id: { not: saved.accountId } },
      });
      if (duplicate) {
        return reply.redirect(`${config().WEB_BASE_URL}/connect/failed?reason=duplicate`);
      }
      try {
        await prisma.brandXAccount.update({
          where: { id: saved.accountId },
          data: {
            xUserId: me.data.id,
            xUsername: me.data.username,
            encryptedAccessToken: encrypt(tokens.accessToken),
            encryptedRefreshToken: encrypt(tokens.refreshToken),
            accessTokenExpiresAt: tokens.expiresAt,
            scopes: tokens.scopes,
            refreshFailedAt: null,
            refreshFailCount: 0,
          },
        });
      } catch (updateError) {
        // 콜백 진입 이후 계정 row가 삭제된 경우(P2025) 등은 500 대신 실패 페이지로
        if (
          updateError instanceof Prisma.PrismaClientKnownRequestError &&
          updateError.code === 'P2025'
        ) {
          return reply.redirect(`${config().WEB_BASE_URL}/connect/failed`);
        }
        throw updateError;
      }
      return reply.redirect(`${config().WEB_BASE_URL}/connect/done?account=${me.data.username}`);
    },
  );

  // ── 유저 로그인 (LP에서 응모 직전) ──
  app.get<{ Querystring: { redirectTo?: string } }>('/oauth/user/start', async (req, reply) => {
    const { codeVerifier, codeChallenge, state } = generatePkce();
    await prisma.oAuthState.create({
      data: { state, kind: 'user', codeVerifier, redirectTo: req.query.redirectTo ?? '/' },
    });
    return reply.redirect(
      buildAuthorizeUrl({ redirectUri: userRedirect, scopes: USER_SCOPES, state, codeChallenge }),
    );
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/oauth/user/callback',
    async (req, reply) => {
      const { code, state, error } = req.query;
      const saved = state
        ? await prisma.oAuthState.delete({ where: { state } }).catch(() => null)
        : null;
      if (error || !code || !saved || saved.kind !== 'user') {
        return reply.redirect(`${config().WEB_BASE_URL}/login/failed`);
      }

      const tokens = await exchangeCode(code, userRedirect, saved.codeVerifier);
      const me = await getMe(tokens.accessToken);

      const user = await prisma.user.upsert({
        where: { xUserId: me.data.id },
        create: {
          xUserId: me.data.id,
          xUsername: me.data.username,
          displayName: me.data.name,
          encryptedAccessToken: encrypt(tokens.accessToken),
          encryptedRefreshToken: encrypt(tokens.refreshToken),
          accessTokenExpiresAt: tokens.expiresAt,
        },
        update: {
          xUsername: me.data.username,
          displayName: me.data.name,
          encryptedAccessToken: encrypt(tokens.accessToken),
          encryptedRefreshToken: encrypt(tokens.refreshToken),
          accessTokenExpiresAt: tokens.expiresAt,
        },
      });

      setUserSession(reply, { userId: user.id, xUsername: user.xUsername });
      const dest = saved.redirectTo?.startsWith('/') ? saved.redirectTo : '/';
      return reply.redirect(`${config().WEB_BASE_URL}${dest}`);
    },
  );
}
