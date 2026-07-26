import { describe, expect, it } from 'vitest';
import { dateJst, jstToUtc } from '@jsure/jwin-shared';

// config() 는 최초 호출 시 process.env 를 캐시하므로 동적 import 전에 채워둔다
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SESSION_SECRET = 'test-secret-test-secret';
process.env.JWT_SECRET = 'test-jwt-secret-test-jwt';
process.env.X_CLIENT_ID = 'x';
process.env.X_CLIENT_SECRET = 'x';

describe('JST helpers', () => {
  it('converts UTC to JST date string', () => {
    // UTC 2026-07-23 16:00 = JST 2026-07-24 01:00
    expect(dateJst(new Date('2026-07-23T16:00:00Z'))).toBe('2026-07-24');
    expect(dateJst(new Date('2026-07-23T02:00:00Z'))).toBe('2026-07-23');
  });

  it('converts JST schedule time to UTC', () => {
    const utc = jstToUtc('2026-07-23', '11:00');
    expect(utc.toISOString()).toBe('2026-07-23T02:00:00.000Z');
  });
});

describe('crypto roundtrip', () => {
  it('encrypts and decrypts', async () => {
    const { encrypt, decrypt } = await import('../lib/crypto');
    const secret = 'refresh-token-value-12345';
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });
});

/** D-10: 대시보드(@jsure/api)가 발급한 access token 을 서명만으로 검증한다 */
describe('admin identity (dashboard JWT)', () => {
  const payload = { sub: 'admin-1', email: 'dev@aposapo.com', role: 'OWNER', sid: 'sess-1' };
  const reqWith = (auth?: string) => ({ headers: auth ? { authorization: auth } : {} }) as never;

  it('accepts a token signed with the shared secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { getAdminIdentity } = await import('../lib/auth');
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '15m' });

    expect(getAdminIdentity(reqWith(`Bearer ${token}`))).toEqual({
      adminId: 'admin-1',
      email: 'dev@aposapo.com',
      role: 'OWNER',
      sid: 'sess-1',
    });
  });

  it('rejects a token signed with a different secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { getAdminIdentity } = await import('../lib/auth');
    const forged = jwt.sign(payload, 'some-other-secret-value', { expiresIn: '15m' });

    expect(getAdminIdentity(reqWith(`Bearer ${forged}`))).toBeNull();
  });

  it('rejects an expired token', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { getAdminIdentity } = await import('../lib/auth');
    const expired = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: -10 });

    expect(getAdminIdentity(reqWith(`Bearer ${expired}`))).toBeNull();
  });

  it('rejects a missing or malformed header', async () => {
    const { getAdminIdentity } = await import('../lib/auth');
    expect(getAdminIdentity(reqWith())).toBeNull();
    expect(getAdminIdentity(reqWith('some-token'))).toBeNull();
  });
});
