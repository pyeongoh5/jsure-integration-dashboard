import { describe, expect, it } from 'vitest';
import { brandAccountStatus, toBrandAccount } from './adminMappers';

process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SESSION_SECRET = 'test-secret-test-secret';
process.env.JWT_SECRET = 'test-jwt-secret-test-jwt';
process.env.X_CLIENT_ID = 'x';
process.env.X_CLIENT_SECRET = 'x';

describe('toWinner', () => {
  it('암호문을 노출하지 않고 hasShipping 불리언만 준다', async () => {
    const { toWinner } = await import('./adminMappers');
    const row = {
      id: 'w1',
      verification: 'PASSED',
      fulfillment: 'READY',
      encryptedShipping: 'ENCRYPTED_BLOB',
      dmSentAt: null,
      dmError: null,
      prize: { name: '아마존 1만엔', type: 'CODE' },
      entry: { dateJst: '2026-08-01', user: { xUsername: 'tester' } },
    };
    const mapped = toWinner(row as never);
    expect(mapped.hasShipping).toBe(true);
    expect(mapped.xUsername).toBe('tester');
    expect(mapped.prizeName).toBe('아마존 1만엔');
    expect(JSON.stringify(mapped)).not.toContain('ENCRYPTED_BLOB');
  });

  it('배송지가 없으면 hasShipping=false', async () => {
    const { toWinner } = await import('./adminMappers');
    const row = {
      id: 'w2',
      verification: 'PENDING',
      fulfillment: 'AWAITING_INFO',
      encryptedShipping: null,
      dmSentAt: null,
      dmError: null,
      prize: { name: '텀블러', type: 'PHYSICAL' },
      entry: { dateJst: '2026-08-01', user: { xUsername: null } },
    };
    expect(toWinner(row as never).hasShipping).toBe(false);
  });
});

describe('canTransitionFulfillment', () => {
  it('허용 전이만 통과한다', async () => {
    const { canTransitionFulfillment } = await import('./adminMappers');
    expect(canTransitionFulfillment('READY', 'SHIPPED')).toBe(true);
    expect(canTransitionFulfillment('AWAITING_INFO', 'READY')).toBe(true);
  });

  it('허용되지 않은 전이는 막는다', async () => {
    const { canTransitionFulfillment } = await import('./adminMappers');
    expect(canTransitionFulfillment('NOT_READY', 'SHIPPED')).toBe(false);
    expect(canTransitionFulfillment('SHIPPED', 'READY')).toBe(false);
    expect(canTransitionFulfillment('READY', 'DM_SENT')).toBe(false);
  });
});

describe('toCampaignDetail', () => {
  it('brandAccountId와 brandAccount(연동된 계정 DTO)를 그대로 담는다', async () => {
    const { toCampaignDetail, toBrandAccount } = await import('./adminMappers');
    const campaign = {
      id: 'c1',
      brandName: 'B',
      slug: 'b-slug',
      status: 'ACTIVE',
      startsAt: new Date('2026-08-01T00:00:00Z'),
      endsAt: new Date('2026-08-10T00:00:00Z'),
      dailyPostTime: '11:00',
      dailyWinCap: null,
      prUrl: null,
      winMediaUrl: null,
      loseMediaUrl: null,
      dmTemplate: null,
      brandAccountId: 'a1',
    };
    const brandAccount = toBrandAccount(
      {
        id: 'a1', label: 'L', xUserId: 'x123', xUsername: 'brandx',
        encryptedAccessToken: 'secret', accessTokenExpiresAt: null,
        refreshFailedAt: new Date(), refreshFailCount: 1,
      },
      1,
      'https://api/oauth/brand/start?accountId=a1',
    );
    const mapped = toCampaignDetail(campaign as never, brandAccount);
    expect(mapped.brandAccountId).toBe('a1');
    expect(mapped.brandAccount?.status).toBe('NEEDS_RECONNECT');
    expect(mapped.startsAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('brandAccount가 없으면 null을 그대로 담는다', async () => {
    const { toCampaignDetail } = await import('./adminMappers');
    const campaign = {
      id: 'c2',
      brandName: 'B',
      slug: 'b-slug-2',
      status: 'DRAFT',
      startsAt: new Date('2026-08-01T00:00:00Z'),
      endsAt: new Date('2026-08-10T00:00:00Z'),
      dailyPostTime: '11:00',
      dailyWinCap: null,
      prUrl: null,
      winMediaUrl: null,
      loseMediaUrl: null,
      dmTemplate: null,
      brandAccountId: null,
    };
    const mapped = toCampaignDetail(campaign as never, null);
    expect(mapped.brandAccountId).toBeNull();
    expect(mapped.brandAccount).toBeNull();
  });
});

describe('brandAccountStatus', () => {
  const base = {
    id: 'a', label: 'L', xUserId: null, xUsername: null,
    encryptedAccessToken: null, encryptedRefreshToken: null,
    accessTokenExpiresAt: null, scopes: null,
    refreshFailedAt: null, refreshFailCount: 0,
    createdAt: new Date(), updatedAt: new Date(),
  };
  it('xUserId 없으면 PENDING', () => {
    expect(brandAccountStatus(base)).toBe('PENDING');
  });
  it('연동됐고 refresh 정상이면 CONNECTED', () => {
    expect(brandAccountStatus({ ...base, xUserId: '1', encryptedAccessToken: 'x' })).toBe('CONNECTED');
  });
  it('refreshFailedAt 있으면 NEEDS_RECONNECT', () => {
    expect(brandAccountStatus({ ...base, xUserId: '1', encryptedAccessToken: 'x', refreshFailedAt: new Date() })).toBe('NEEDS_RECONNECT');
  });
  it('toBrandAccount는 토큰 암호문을 노출하지 않는다', () => {
    const dto = toBrandAccount({ ...base, xUserId: '1', xUsername: 'u', encryptedAccessToken: 'secret', accessTokenExpiresAt: new Date('2026-09-01') }, 2, 'http://x/start?accountId=a');
    expect(dto).not.toHaveProperty('encryptedAccessToken');
    expect(dto.campaignCount).toBe(2);
    expect(dto.status).toBe('CONNECTED');
  });
});
