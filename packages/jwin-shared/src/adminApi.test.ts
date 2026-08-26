import { describe, expect, it } from 'vitest';
import {
  AdminWinnerSchema,
  AdminCampaignDetailSchema,
  AdminFulfillmentPatchSchema,
  AdminBrandAccountSchema,
  AdminBrandAccountCreateSchema,
  AdminPostTemplateCreateSchema,
} from './adminApi';

describe('어드민 응답 스키마', () => {
  it('당첨자 응답에 배송지 평문·암호문 필드가 없다', () => {
    const shape = Object.keys(AdminWinnerSchema.shape);
    expect(shape).not.toContain('encryptedShipping');
    expect(shape).not.toContain('shipping');
    expect(shape).toContain('hasShipping');
  });

  it('캠페인 상세는 brandAccountId·brandAccount를 포함하고 connectUrl은 없다', () => {
    const shape = Object.keys(AdminCampaignDetailSchema.shape);
    expect(shape).toContain('brandAccountId');
    expect(shape).toContain('brandAccount');
    expect(shape).not.toContain('connectUrl');
  });

  it('이행 상태 PATCH는 유효한 enum만 받는다', () => {
    expect(AdminFulfillmentPatchSchema.safeParse({ fulfillment: 'SHIPPED' }).success).toBe(true);
    expect(AdminFulfillmentPatchSchema.safeParse({ fulfillment: 'BOGUS' }).success).toBe(false);
  });
});

describe('AdminBrandAccount 계약', () => {
  it('연동 완료 계정을 파싱한다', () => {
    const parsed = AdminBrandAccountSchema.parse({
      id: 'acc1',
      label: '코카콜라 재팬',
      xUserId: '123',
      xUsername: 'coke_jp',
      status: 'CONNECTED',
      refreshFailCount: 0,
      accessTokenExpiresAt: '2026-09-01T00:00:00.000Z',
      campaignCount: 3,
      connectUrl: 'http://localhost:8080/oauth/brand/start?accountId=acc1',
    });
    expect(parsed.status).toBe('CONNECTED');
  });

  it('대기 계정은 xUserId·토큰만료가 null이어도 파싱된다', () => {
    const parsed = AdminBrandAccountSchema.parse({
      id: 'acc2',
      label: '롯데(신규)',
      xUserId: null,
      xUsername: null,
      status: 'PENDING',
      refreshFailCount: 0,
      accessTokenExpiresAt: null,
      campaignCount: 0,
      connectUrl: 'http://localhost:8080/oauth/brand/start?accountId=acc2',
    });
    expect(parsed.status).toBe('PENDING');
  });

  it('계정 생성 요청은 label만 받는다', () => {
    expect(AdminBrandAccountCreateSchema.parse({ label: '롯데' }).label).toBe('롯데');
  });

  it('캠페인 상세에 brandAccountId가 포함되고 connectUrl은 없다', () => {
    const detail = AdminCampaignDetailSchema.parse({
      id: 'c1', brandName: 'b', slug: 's', status: 'SETUP',
      startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-10T00:00:00.000Z',
      dailyPostTime: '11:00', dailyWinCap: null, prUrl: null,
      winMediaUrl: null, loseMediaUrl: null, dmTemplate: null,
      brandAccountId: null, brandAccount: null,
    });
    expect(detail.brandAccountId).toBeNull();
    expect('connectUrl' in detail).toBe(false);
  });
});

describe('소재 유효기간', () => {
  const base = {
    campaignId: 'camp-1',
    label: '1주차',
    bodyText: '본문 {{LP_URL}}',
  };

  it('종료가 시작 이후면 통과한다', () => {
    const result = AdminPostTemplateCreateSchema.safeParse({
      ...base,
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeTo: '2026-09-05T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('종료가 시작보다 앞서면 거부한다 — 역전 구간은 어떤 날에도 선택되지 않는다', () => {
    const result = AdminPostTemplateCreateSchema.safeParse({
      ...base,
      activeFrom: '2026-09-05T00:00:00.000Z',
      activeTo: '2026-09-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('종료와 시작이 같아도 거부한다', () => {
    const result = AdminPostTemplateCreateSchema.safeParse({
      ...base,
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeTo: '2026-09-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
