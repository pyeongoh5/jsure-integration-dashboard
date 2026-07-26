import { getPrisma, BrandXCredential, User } from '@jsure/jwin-db';
import { decrypt, encrypt } from './crypto';
import { refreshTokens, XApiError } from './x-api';

/**
 * 토큰 수명 관리.
 * X OAuth2 access token은 2시간 만료 → 만료 임박 시 refresh token으로 갱신.
 * 브랜드 refresh 실패는 "조용한 포스팅 실패"로 이어지므로 실패 카운트를 기록하고
 * 어드민 대시보드에 재연동 필요 알림으로 노출한다.
 */

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export async function getBrandAccessToken(cred: BrandXCredential): Promise<string> {
  if (cred.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return decrypt(cred.encryptedAccessToken);
  }
  const prisma = getPrisma();
  try {
    const next = await refreshTokens(decrypt(cred.encryptedRefreshToken));
    await prisma.brandXCredential.update({
      where: { id: cred.id },
      data: {
        encryptedAccessToken: encrypt(next.accessToken),
        encryptedRefreshToken: encrypt(next.refreshToken || decrypt(cred.encryptedRefreshToken)),
        accessTokenExpiresAt: next.expiresAt,
        refreshFailedAt: null,
        refreshFailCount: 0,
      },
    });
    return next.accessToken;
  } catch (e) {
    if (e instanceof XApiError && e.isAuthError) {
      await prisma.brandXCredential.update({
        where: { id: cred.id },
        data: { refreshFailedAt: new Date(), refreshFailCount: { increment: 1 } },
      });
    }
    throw e;
  }
}

export async function getUserAccessToken(user: User): Promise<string | null> {
  if (!user.encryptedAccessToken || !user.accessTokenExpiresAt) return null;
  if (user.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return decrypt(user.encryptedAccessToken);
  }
  if (!user.encryptedRefreshToken) return null;
  try {
    const next = await refreshTokens(decrypt(user.encryptedRefreshToken));
    await getPrisma().user.update({
      where: { id: user.id },
      data: {
        encryptedAccessToken: encrypt(next.accessToken),
        encryptedRefreshToken: encrypt(
          next.refreshToken || decrypt(user.encryptedRefreshToken),
        ),
        accessTokenExpiresAt: next.expiresAt,
      },
    });
    return next.accessToken;
  } catch {
    return null; // 유저는 재로그인 유도
  }
}
