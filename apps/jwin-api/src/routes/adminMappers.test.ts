import { describe, expect, it } from 'vitest';

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
  it('needsReconnect를 credential.refreshFailedAt로 판정하고 connectUrl을 담는다', async () => {
    const { toCampaignDetail } = await import('./adminMappers');
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
      xUserId: 'x123',
      xUsername: 'brandx',
      credential: { refreshFailedAt: new Date() },
    };
    const mapped = toCampaignDetail(campaign as never, 'https://api/oauth/brand/start?campaignId=c1');
    expect(mapped.needsReconnect).toBe(true);
    expect(mapped.connectUrl).toContain('campaignId=c1');
    expect(mapped.startsAt).toBe('2026-08-01T00:00:00.000Z');
  });
});
