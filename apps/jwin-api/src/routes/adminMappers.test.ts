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

describe('시즌·참여 매퍼', () => {
  const season = {
    id: 'camp-1',
    name: '9월 캠페인',
    slug: '2026-09',
    startsAt: new Date('2026-09-01T00:00:00Z'),
    endsAt: new Date('2026-09-30T00:00:00Z'),
  };

  const brandCampaignRow = {
    id: 'bc-1',
    status: 'ACTIVE',
    brandAccountId: 'a1',
    brandAccount: {
      label: '코카콜라 재팬',
      slug: 'coke-jp',
      logoUrl: null,
      xUsername: 'coke_jp',
      refreshFailedAt: new Date(),
    },
    _count: { entries: 7 },
    posts: [{ id: 'p1' }],
  };

  it('참여 상세는 시즌 요약과 브랜드 DTO 를 함께 담는다', async () => {
    const { toBrandCampaignDetail, toBrandAccount } = await import('./adminMappers');
    const brandAccount = toBrandAccount(
      {
        id: 'a1', label: '코카콜라 재팬', slug: 'coke-jp', logoUrl: null,
        xUserId: 'x123', xUsername: 'brandx',
        encryptedAccessToken: 'secret', accessTokenExpiresAt: null,
        refreshFailedAt: new Date(), refreshFailCount: 1,
      },
      1,
      'https://api/oauth/brand/start?accountId=a1',
    );
    const mapped = toBrandCampaignDetail(
      {
        id: 'bc-1',
        status: 'ACTIVE',
        dailyPostTime: '11:00',
        dailyWinCap: null,
        cardImageUrl: null,
        rulesUrl: null,
        prUrl: null,
        winMediaUrl: null,
        loseMediaUrl: null,
        dmTemplate: null,
        brandAccountId: 'a1',
        campaign: season,
      },
      brandAccount,
    );
    expect(mapped.brandAccountId).toBe('a1');
    expect(mapped.brandAccount.status).toBe('NEEDS_RECONNECT');
    expect(mapped.campaign.startsAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('참여 목록 행은 브랜드 표시명·slug 와 경고를 담는다', async () => {
    const { toBrandCampaignListItem } = await import('./adminMappers');
    const item = toBrandCampaignListItem(brandCampaignRow);
    expect(item.brandName).toBe('코카콜라 재팬');
    expect(item.brandSlug).toBe('coke-jp');
    expect(item.needsReconnect).toBe(true);
    expect(item.entryCount).toBe(7);
    expect(item.failedPostCount).toBe(1);
  });

  it('시즌 목록 행은 참여 브랜드들의 응모·경고를 합산한다', async () => {
    const { toCampaignListItem } = await import('./adminMappers');
    const item = toCampaignListItem({
      ...season,
      brands: [
        brandCampaignRow,
        {
          ...brandCampaignRow,
          id: 'bc-2',
          brandAccount: { ...brandCampaignRow.brandAccount, refreshFailedAt: null },
          _count: { entries: 3 },
          posts: [],
        },
      ],
    });
    expect(item.brandCount).toBe(2);
    expect(item.entryCount).toBe(10);
    expect(item.needsReconnectCount).toBe(1);
    expect(item.failedPostCount).toBe(1);
  });
});

describe('brandAccountStatus', () => {
  const base = {
    id: 'a', label: 'L', slug: 'brand-a', logoUrl: null, xUserId: null, xUsername: null,
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

describe('winnerFilterWhere', () => {
  it('필터가 없으면 캠페인 조건만 건다', async () => {
    const { winnerFilterWhere } = await import('./adminMappers');
    expect(winnerFilterWhere('c1', {})).toEqual({ entry: { campaignId: 'c1' } });
  });

  it('경품 유형은 prize 관계 조건으로 내려간다', async () => {
    const { winnerFilterWhere } = await import('./adminMappers');
    expect(winnerFilterWhere('c1', { prizeType: 'PHYSICAL' })).toEqual({
      entry: { campaignId: 'c1' },
      prize: { type: 'PHYSICAL' },
    });
  });

  it('여러 필터는 AND로 함께 걸린다', async () => {
    const { winnerFilterWhere } = await import('./adminMappers');
    expect(
      winnerFilterWhere('c1', { verification: 'PASSED', fulfillment: 'READY', prizeType: 'CODE' }),
    ).toEqual({
      entry: { campaignId: 'c1' },
      verification: 'PASSED',
      fulfillment: 'READY',
      prize: { type: 'CODE' },
    });
  });
});

describe('decryptShipping / toWinnerExportRow', () => {
  const winnerRow = (encryptedShipping: string | null) => ({
    id: 'w1',
    verification: 'PASSED',
    fulfillment: 'READY',
    encryptedShipping,
    dmSentAt: null,
    dmError: null,
    prize: { name: '경품', type: 'PHYSICAL' },
    entry: { dateJst: '2026-09-05', user: { xUsername: 'someone' } },
  });

  it('계약 모양이면 그대로 복호화한다', async () => {
    const { encrypt } = await import('../lib/crypto');
    const { toWinnerExportRow } = await import('./adminMappers');
    const address = {
      postalCode: '1500001',
      prefecture: '東京都',
      address1: '渋谷区1-1',
      fullName: '山田太郎',
      phone: '09012345678',
    };
    const row = toWinnerExportRow(winnerRow(encrypt(JSON.stringify(address))));
    expect(row.shipping).toEqual(address);
    expect(row.hasShipping).toBe(true);
  });

  it('계약과 어긋난 배송지는 흘리지 않고 null로 막는다', async () => {
    const { encrypt } = await import('../lib/crypto');
    const { toWinnerExportRow } = await import('./adminMappers');
    const row = toWinnerExportRow(winnerRow(encrypt(JSON.stringify({ postalCode: 123 }))));
    expect(row.shipping).toBeNull();
  });

  it('배송지 미입력이면 null', async () => {
    const { toWinnerExportRow } = await import('./adminMappers');
    expect(toWinnerExportRow(winnerRow(null)).shipping).toBeNull();
  });
});
