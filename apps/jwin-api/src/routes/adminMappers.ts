import type {
  AdminBrandAccount,
  AdminBrandCampaignDetail,
  AdminBrandCampaignListItem,
  AdminCampaignDetail,
  AdminCampaignListItem,
  AdminCampaignSummary,
  AdminPrize,
  AdminPostTemplate,
  AdminShippingAddress,
  AdminWinner,
  AdminWinnerExportRow,
  AdminWinnerFilter,
  FulfillmentStatusSchema,
} from '@jsure/jwin-shared';
import { AdminShippingAddressSchema } from '@jsure/jwin-shared';
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

export type BrandCampaignRow = {
  id: string;
  status: string;
  dailyPostTime: string;
  dailyWinCap: number | null;
  cardImageUrl: string | null;
  rulesUrl: string | null;
  prUrl: string | null;
  winMediaUrl: string | null;
  loseMediaUrl: string | null;
  dmTemplate: string | null;
  brandAccountId: string;
  campaign: CampaignRow;
};

export type CampaignRow = {
  id: string;
  name: string;
  slug: string;
  startsAt: Date;
  endsAt: Date;
};

export function toCampaignSummary(campaign: CampaignRow): AdminCampaignSummary {
  return {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
  };
}

/** 참여 상세 — 게시 설정·결과화면과 소속 시즌 요약을 함께 싣는다. */
export function toBrandCampaignDetail(
  brandCampaign: BrandCampaignRow,
  brandAccount: AdminBrandAccount,
): AdminBrandCampaignDetail {
  return {
    id: brandCampaign.id,
    status: brandCampaign.status as AdminBrandCampaignDetail['status'],
    dailyPostTime: brandCampaign.dailyPostTime,
    dailyWinCap: brandCampaign.dailyWinCap,
    cardImageUrl: brandCampaign.cardImageUrl,
    rulesUrl: brandCampaign.rulesUrl,
    prUrl: brandCampaign.prUrl,
    winMediaUrl: brandCampaign.winMediaUrl,
    loseMediaUrl: brandCampaign.loseMediaUrl,
    dmTemplate: brandCampaign.dmTemplate,
    campaign: toCampaignSummary(brandCampaign.campaign),
    brandAccountId: brandCampaign.brandAccountId,
    brandAccount,
  };
}

export type BrandCampaignListRow = {
  id: string;
  status: string;
  brandAccountId: string;
  brandAccount: {
    label: string;
    slug: string;
    logoUrl: string | null;
    xUsername: string | null;
    refreshFailedAt: Date | null;
  };
  _count: { entries: number };
  /** status=FAILED 인 포스트만 담아 넘긴다 */
  posts: unknown[];
};

/** 시즌 상세의 참여 브랜드 행. */
export function toBrandCampaignListItem(
  brandCampaign: BrandCampaignListRow,
): AdminBrandCampaignListItem {
  return {
    id: brandCampaign.id,
    status: brandCampaign.status as AdminBrandCampaignListItem['status'],
    brandAccountId: brandCampaign.brandAccountId,
    brandName: brandCampaign.brandAccount.label,
    brandSlug: brandCampaign.brandAccount.slug,
    brandLogoUrl: brandCampaign.brandAccount.logoUrl,
    xUsername: brandCampaign.brandAccount.xUsername,
    needsReconnect: !!brandCampaign.brandAccount.refreshFailedAt,
    entryCount: brandCampaign._count.entries,
    failedPostCount: brandCampaign.posts.length,
  };
}

/** 시즌 상세 = 시즌 + 참여 브랜드 목록. */
export function toCampaignDetail(
  campaign: CampaignRow,
  brands: AdminBrandCampaignListItem[],
): AdminCampaignDetail {
  return {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    brands,
  };
}

/** 시즌 목록 행 — 경고는 참여 브랜드들에서 합산한다. */
export function toCampaignListItem(
  campaign: CampaignRow & { brands: BrandCampaignListRow[] },
): AdminCampaignListItem {
  return {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    brandCount: campaign.brands.length,
    entryCount: campaign.brands.reduce((sum, brand) => sum + brand._count.entries, 0),
    needsReconnectCount: campaign.brands.filter(
      (brand) => !!brand.brandAccount.refreshFailedAt,
    ).length,
    failedPostCount: campaign.brands.reduce((sum, brand) => sum + brand.posts.length, 0),
  };
}

export type BrandAccountRow = {
  id: string;
  label: string;
  slug: string;
  logoUrl: string | null;
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
    slug: account.slug,
    logoUrl: account.logoUrl,
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
    mediaUrls: string[];
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
    mediaUrls: template.mediaUrls,
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

/**
 * 배송지 복호화. 저장 형식은 암호화된 JSON 문자열.
 * 계약 모양과 어긋나는 데이터는 그대로 흘리지 않고 null로 막는다 — 목록·CSV 전체가
 * 행 하나 때문에 실패하는 것보다 해당 칸만 비는 편이 운영에 낫다.
 */
export function decryptShipping(encrypted: string | null): AdminShippingAddress | null {
  if (!encrypted) return null;
  const parsed = AdminShippingAddressSchema.safeParse(JSON.parse(decrypt(encrypted)));
  if (!parsed.success) {
    console.error('[admin] 배송지 형식이 계약과 다릅니다', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export function toWinnerExportRow(winner: Parameters<typeof toWinner>[0]): AdminWinnerExportRow {
  return { ...toWinner(winner), shipping: decryptShipping(winner.encryptedShipping) };
}

/** 당첨자 목록·CSV가 공유하는 조회 필드. 배송지 암호문은 매퍼에서만 쓰고 응답엔 안 나간다. */
export const WINNER_SELECT = {
  id: true,
  verification: true,
  fulfillment: true,
  encryptedShipping: true,
  dmSentAt: true,
  dmError: true,
  prize: { select: { name: true, type: true } },
  entry: { select: { dateJst: true, user: { select: { xUsername: true } } } },
} as const;

/**
 * 목록과 CSV가 같은 조건을 보도록 where 생성을 한 곳에 둔다.
 * 두 곳이 각자 조건을 짜면 CSV가 화면과 다른 집합을 담게 된다.
 */
export function winnerFilterWhere(campaignId: string, filter: AdminWinnerFilter) {
  return {
    entry: { campaignId },
    ...(filter.verification ? { verification: filter.verification } : {}),
    ...(filter.fulfillment ? { fulfillment: filter.fulfillment } : {}),
    ...(filter.prizeType ? { prize: { type: filter.prizeType } } : {}),
  };
}
