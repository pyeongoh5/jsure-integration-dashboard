import { describe, expect, it } from 'vitest';
import { dateJst, jstToUtc } from '@jsure/jwin-shared';

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
    process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.SESSION_SECRET = 'test-secret-test-secret';
    process.env.X_CLIENT_ID = 'x';
    process.env.X_CLIENT_SECRET = 'x';
    process.env.ADMIN_EMAIL = 'a@b.co';
    process.env.ADMIN_PASSWORD_HASH = 'h';
    const { encrypt, decrypt } = await import('../lib/crypto');
    const secret = 'refresh-token-value-12345';
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });
});
