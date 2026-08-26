import { describe, expect, it } from 'vitest';
import { activationBlockers } from './campaignActivation';

/** 2026-09-01 00:00 JST ~ 2026-09-05 23:59 JST */
const CAMPAIGN = {
  startsAt: new Date('2026-08-31T15:00:00.000Z'),
  endsAt: new Date('2026-09-05T14:59:00.000Z'),
  dmTemplate: null as string | null,
};

const CONNECTED_ACCOUNT = {
  xUserId: '1234',
  encryptedAccessToken: 'enc',
  refreshFailedAt: null as Date | null,
};

/** 전 기간을 덮는 소재 */
const FULL_TEMPLATE = {
  activeFrom: new Date('2026-08-31T15:00:00.000Z'),
  activeTo: new Date('2026-09-05T14:59:00.000Z'),
};

const PHYSICAL_PRIZE = { type: 'PHYSICAL' as const };
const CODE_PRIZE = { type: 'CODE' as const };

describe('activationBlockers', () => {
  it('모두 충족하면 빈 배열', () => {
    expect(
      activationBlockers({
        campaign: CAMPAIGN,
        brandAccount: CONNECTED_ACCOUNT,
        prizes: [PHYSICAL_PRIZE],
        postTemplates: [FULL_TEMPLATE],
      }),
    ).toEqual([]);
  });

  it('계정 미연결이면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: null,
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('계정');
  });

  it('연동이 끝나지 않은 계정이면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: { xUserId: null, encryptedAccessToken: null, refreshFailedAt: null },
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers).toHaveLength(1);
  });

  it('재연동이 필요한 계정이면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: { ...CONNECTED_ACCOUNT, refreshFailedAt: new Date() },
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers).toHaveLength(1);
  });

  it('경품이 없으면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: CONNECTED_ACCOUNT,
      prizes: [],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers.some((blocker) => blocker.includes('경품'))).toBe(true);
  });

  it('소재 빈틈이 있으면 어느 날인지 사유에 담는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: CONNECTED_ACCOUNT,
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [
        {
          activeFrom: new Date('2026-08-31T15:00:00.000Z'),
          activeTo: new Date('2026-09-02T14:59:00.000Z'),
        },
      ],
    });
    expect(blockers.some((blocker) => blocker.includes('2026-09-03'))).toBe(true);
  });

  it('소재가 하나도 없으면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: CONNECTED_ACCOUNT,
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [],
    });
    expect(blockers.some((blocker) => blocker.includes('소재'))).toBe(true);
  });

  it('CODE 경품이 있는데 DM 문구에 코드 자리가 없으면 막는다', () => {
    const blockers = activationBlockers({
      campaign: { ...CAMPAIGN, dmTemplate: 'おめでとうございます！' },
      brandAccount: CONNECTED_ACCOUNT,
      prizes: [CODE_PRIZE],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers.some((blocker) => blocker.includes('{{CODE}}'))).toBe(true);
  });

  it('CODE 경품이 있어도 DM 문구가 비어 있으면 기본 문구가 쓰이므로 통과', () => {
    expect(
      activationBlockers({
        campaign: { ...CAMPAIGN, dmTemplate: null },
        brandAccount: CONNECTED_ACCOUNT,
        prizes: [CODE_PRIZE],
        postTemplates: [FULL_TEMPLATE],
      }),
    ).toEqual([]);
  });

  it('PHYSICAL 경품만 있으면 DM 문구를 검사하지 않는다', () => {
    expect(
      activationBlockers({
        campaign: { ...CAMPAIGN, dmTemplate: '코드 없는 문구' },
        brandAccount: CONNECTED_ACCOUNT,
        prizes: [PHYSICAL_PRIZE],
        postTemplates: [FULL_TEMPLATE],
      }),
    ).toEqual([]);
  });

  it('여러 항목이 미충족이면 전부 담는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: null,
      prizes: [],
      postTemplates: [],
    });
    expect(blockers.length).toBeGreaterThanOrEqual(3);
  });
});
