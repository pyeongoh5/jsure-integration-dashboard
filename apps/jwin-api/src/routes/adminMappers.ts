import type {
  AdminBrandAccount,
  AdminCampaignDetail,
  AdminCampaignListItem,
  AdminPrize,
  AdminPostTemplate,
  AdminWinner,
  FulfillmentStatusSchema,
} from '@jsure/jwin-shared';
import type { z } from 'zod';
import { decrypt } from '../lib/crypto';

type FulfillmentStatus = z.infer<typeof FulfillmentStatusSchema>;

/** 이행 상태의 허용 전이 (D-2·§4-⑦). 그 외 전이는 전부 거부. */
const ALLOWED_FULFILLMENT_TRANSITIONS: Record<string, FulfillmentStatus[]> = {
  AWAITING_INFO: ['READY'],
  READY: ['SHIPPED'],
};

export function canTransitionFulfillment(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean {
  return ALLOWED_FULFILLMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function toCampaignDetail(
  campaign: {
    id: string;
    brandName: string;
    slug: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
    dailyPostTime: string;
    dailyWinCap: number | null;
    prUrl: string | null;
    winMediaUrl: string | null;
    loseMediaUrl: string | null;
    dmTemplate: string | null;
    brandAccountId: string | null;
  },
  brandAccount: AdminBrandAccount | null,
): AdminCampaignDetail {
  return {
    id: campaign.id,
    brandName: campaign.brandName,
    slug: campaign.slug,
    status: campaign.status as AdminCampaignDetail['status'],
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    dailyPostTime: campaign.dailyPostTime,
    dailyWinCap: campaign.dailyWinCap,
    prUrl: campaign.prUrl,
    winMediaUrl: campaign.winMediaUrl,
    loseMediaUrl: campaign.loseMediaUrl,
    dmTemplate: campaign.dmTemplate,
    brandAccountId: campaign.brandAccountId,
    brandAccount,
  };
}

export function toCampaignListItem(campaign: {
  id: string;
  brandName: string;
  slug: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  brandAccount?: { xUserId: string | null; xUsername: string | null; refreshFailedAt: Date | null } | null;
  _count: { entries: number };
  posts: unknown[];
}): AdminCampaignListItem {
  return {
    id: campaign.id,
    brandName: campaign.brandName,
    slug: campaign.slug,
    status: campaign.status as AdminCampaignListItem['status'],
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    xUserId: campaign.brandAccount?.xUserId ?? null,
    xUsername: campaign.brandAccount?.xUsername ?? null,
    needsReconnect: !!campaign.brandAccount?.refreshFailedAt,
    entryCount: campaign._count.entries,
    failedPostCount: campaign.posts.length,
  };
}

export type BrandAccountRow = {
  id: string;
  label: string;
  xUserId: string | null;
  xUsername: string | null;
  encryptedAccessToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshFailedAt: Date | null;
  refreshFailCount: number;
};

/** 브랜드 X 계정의 연동 상태를 판정하는 순수 함수. */
export function brandAccountStatus(
  account: Pick<BrandAccountRow, 'xUserId' | 'encryptedAccessToken' | 'refreshFailedAt'>,
): AdminBrandAccount['status'] {
  if (account.refreshFailedAt) return 'NEEDS_RECONNECT';
  if (account.xUserId && account.encryptedAccessToken) return 'CONNECTED';
  return 'PENDING';
}

/** 브랜드 X 계정을 응답 DTO로 변환. 토큰/암호문 필드는 절대 포함하지 않는다. */
export function toBrandAccount(
  account: BrandAccountRow,
  campaignCount: number,
  connectUrl: string,
): AdminBrandAccount {
  return {
    id: account.id,
    label: account.label,
    xUserId: account.xUserId,
    xUsername: account.xUsername,
    status: brandAccountStatus(account),
    refreshFailCount: account.refreshFailCount,
    accessTokenExpiresAt: account.accessTokenExpiresAt
      ? account.accessTokenExpiresAt.toISOString()
      : null,
    campaignCount,
    connectUrl,
  };
}

export function toPrize(
  prize: {
    id: string;
    type: string;
    name: string;
    tier: number;
    totalQty: number;
    remainingQty: number;
    winProbability: number;
  },
  availableCodeCount: number,
): AdminPrize {
  return {
    id: prize.id,
    type: prize.type as AdminPrize['type'],
    name: prize.name,
    tier: prize.tier,
    totalQty: prize.totalQty,
    remainingQty: prize.remainingQty,
    winProbability: prize.winProbability,
    availableCodeCount,
  };
}

export function toPostTemplate(
  template: {
    id: string;
    label: string;
    bodyText: string;
    mediaUrl: string | null;
    activeFrom: Date;
    activeTo: Date;
  },
  used: boolean,
): AdminPostTemplate {
  return {
    id: template.id,
    label: template.label,
    bodyText: template.bodyText,
    mediaUrl: template.mediaUrl,
    activeFrom: template.activeFrom.toISOString(),
    activeTo: template.activeTo.toISOString(),
    used,
  };
}

export function toWinner(winner: {
  id: string;
  verification: string;
  fulfillment: string;
  encryptedShipping: string | null;
  dmSentAt: Date | null;
  dmError: string | null;
  prize: { name: string; type: string };
  entry: { dateJst: string; user: { xUsername: string | null } };
}): AdminWinner {
  return {
    id: winner.id,
    dateJst: winner.entry.dateJst,
    xUsername: winner.entry.user.xUsername,
    prizeName: winner.prize.name,
    prizeType: winner.prize.type as AdminWinner['prizeType'],
    verification: winner.verification as AdminWinner['verification'],
    fulfillment: winner.fulfillment as AdminWinner['fulfillment'],
    hasShipping: !!winner.encryptedShipping,
    dmSentAt: winner.dmSentAt ? winner.dmSentAt.toISOString() : null,
    dmError: winner.dmError,
  };
}

/** 배송지 복호화. 저장 형식은 암호화된 JSON 문자열. */
export function decryptShipping(encrypted: string | null): Record<string, unknown> | null {
  if (!encrypted) return null;
  return JSON.parse(decrypt(encrypted)) as Record<string, unknown>;
}
