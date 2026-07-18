import type {
  AdminApplication,
  AdminInfluencerSnsAccount,
  CampaignSubType,
} from "@jsure/shared";
import type { Applicant, ApplicantStatus, Media } from "./types";

export const SNS_TO_MEDIA: Record<CampaignSubType, Media> = {
  INSTAGRAM: "ig",
  YOUTUBE: "yt",
  TIKTOK: "tt",
  X: "x",
  QOO10: "qoo10",
  LIPS: "lips",
  ATCOSME: "atcosme",
};

const RELATIVE_TIME = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function pickAccounts(
  accounts: AdminInfluencerSnsAccount[],
  subTypes: CampaignSubType[],
): AdminInfluencerSnsAccount[] {
  return accounts.filter((account) =>
    subTypes.includes(account.snsType as CampaignSubType),
  );
}

export function formatRelative(iso: string, now: Date): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return RELATIVE_TIME.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return RELATIVE_TIME.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return RELATIVE_TIME.format(-days, "day");
  return then.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 응모 관리 페이지에 노출되는 단일 status 로 변환.
 * - 검토 단계(제출 완료=REVIEW_SUBMITTED) 진입 후 또는 정산 완료(COMPLETED) 또는 CANCELLED 인 경우 null 반환 → 페이지에서 숨김.
 */
function deriveStatus(application: AdminApplication): ApplicantStatus | null {
  if (application.status === "CANCELLED") return null;
  if (application.status === "COMPLETED") return null;
  if (application.status === "REVIEW_SUBMITTED") return null;
  if (application.status === "APPLIED") return "APPLIED";
  if (application.status === "REJECTED") return "REJECTED";

  const isFakePurchase = application.campaign.category === "FAKE_PURCHASE";
  if (isFakePurchase) {
    if (application.status === "APPROVED") return "AWAITING_ORDER";
    if (application.status === "ORDER_SUBMITTED") return "AWAITING_REVIEW";
    return null;
  }

  if (application.receivedAt) return "POST_DUE";
  if (application.status === "DELIVERED") return "DELIVERED";
  if (application.status === "SHIPPED") return "SHIPPING";
  if (application.status === "APPROVED") return "PRE_SHIP";
  return null;
}

export function toApplicant(
  application: AdminApplication,
  now: Date,
): Applicant | null {
  const status = deriveStatus(application);
  if (!status) return null;
  const appliedAccounts = pickAccounts(
    application.influencer.snsAccounts,
    application.subTypes,
  );
  return {
    id: application.id,
    influencerId: application.influencer.id,
    name: application.influencer.name,
    handle: appliedAccounts[0]?.handle ?? "",
    flagged: application.influencer.flagged,
    campaignId: application.campaign.id,
    campaign: application.campaign.title,
    category: application.campaign.category,
    subTypes: application.subTypes,
    orderNumber: application.orderNumber,
    media: application.subTypes.map((subType) => SNS_TO_MEDIA[subType]),
    selectedOptions: application.selectedOptions,
    followers: appliedAccounts.reduce(
      (sum, account) => sum + account.followerCount,
      0,
    ),
    followersBySubType: application.subTypes.flatMap((subType) => {
      const account = application.influencer.snsAccounts.find(
        (candidate) => candidate.snsType === subType,
      );
      return account
        ? [{ subType, followerCount: account.followerCount }]
        : [];
    }),
    engagementRate: 0,
    appliedAt: formatRelative(application.appliedAt, now),
    status,
    rawStatus: application.status,
    trackingCarrier: application.trackingCarrier,
    trackingNumber: application.trackingNumber,
    allHandles: application.influencer.snsAccounts.map(
      (account) => account.handle,
    ),
  };
}
