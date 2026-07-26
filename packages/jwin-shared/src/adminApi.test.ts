import { describe, expect, it } from 'vitest';
import {
  AdminWinnerSchema,
  AdminCampaignDetailSchema,
  AdminFulfillmentPatchSchema,
} from './adminApi';

describe('어드민 응답 스키마', () => {
  it('당첨자 응답에 배송지 평문·암호문 필드가 없다', () => {
    const shape = Object.keys(AdminWinnerSchema.shape);
    expect(shape).not.toContain('encryptedShipping');
    expect(shape).not.toContain('shipping');
    expect(shape).toContain('hasShipping');
  });

  it('캠페인 상세는 connectUrl·needsReconnect를 포함한다', () => {
    const shape = Object.keys(AdminCampaignDetailSchema.shape);
    expect(shape).toContain('connectUrl');
    expect(shape).toContain('needsReconnect');
  });

  it('이행 상태 PATCH는 유효한 enum만 받는다', () => {
    expect(AdminFulfillmentPatchSchema.safeParse({ fulfillment: 'SHIPPED' }).success).toBe(true);
    expect(AdminFulfillmentPatchSchema.safeParse({ fulfillment: 'BOGUS' }).success).toBe(false);
  });
});
