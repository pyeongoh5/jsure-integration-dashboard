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

function pickAccount(
  accounts: AdminInfluencerSnsAccount[],
  subType: CampaignSubType,
): AdminInfluencerSnsAccount | undefined {
  return accounts.find((account) => account.snsType === subType);
}

function pickMedia(subType: CampaignSubType): Media[] {
  return [SNS_TO_MEDIA[subType]];
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
 * - 검토 단계(SubmittedPost 존재) 진입 후 또는 정산 완료(COMPLETED) 또는 CANCELLED 인 경우 null 반환 → 페이지에서 숨김.
 */
function deriveStatus(application: AdminApplication): ApplicantStatus | null {
  if (application.status === "CANCELLED") return null;
  if (application.status === "COMPLETED") return null;
  if (application.hasSubmittedPost) return null;
  if (application.status === "APPLIED") return "APPLIED";
  if (application.status === "REJECTED") return "REJECTED";
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
  const appliedAccount = pickAccount(
    application.influencer.snsAccounts,
    application.subType,
  );
  return {
    id: application.id,
    influencerId: application.influencer.id,
    name: application.influencer.name,
    handle: appliedAccount?.handle ?? "",
    flagged: application.influencer.flagged,
    campaignId: application.campaign.id,
    campaign: application.campaign.title,
    category: application.campaign.category,
    subType: application.subType,
    orderNumber: application.orderNumber,
    media: pickMedia(application.subType),
    instagramPostType: application.instagramPostType,
    followers: appliedAccount?.followerCount ?? 0,
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
