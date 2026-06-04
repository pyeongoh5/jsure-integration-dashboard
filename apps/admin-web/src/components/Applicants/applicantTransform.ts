import type {
  AdminApplication,
  AdminInfluencerSnsAccount,
  ApplicationStatus,
  SnsType,
} from "@jsure/shared";
import type {
  Applicant,
  ApplicantStage,
  ApplicantStatus,
  Media,
} from "./types";

export const SNS_TO_MEDIA: Record<SnsType, Media> = {
  INSTAGRAM: "ig",
  YOUTUBE: "yt",
  TIKTOK: "tt",
  X: "x",
};

export const STATUS_TO_TAB: Record<ApplicationStatus, ApplicantStatus | null> = {
  APPLIED: "pending",
  APPROVED: "approved",
  SHIPPED: "approved",
  DELIVERED: "approved",
  COMPLETED: "approved",
  REJECTED: "rejected",
  CANCELLED: null,
};

export const TAB_TO_STATUSES: Record<ApplicantStatus, ApplicationStatus[]> = {
  pending: ["APPLIED"],
  approved: ["APPROVED", "SHIPPED", "DELIVERED", "COMPLETED"],
  rejected: ["REJECTED"],
};

const RELATIVE_TIME = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function pickHandle(accounts: AdminInfluencerSnsAccount[]): string {
  return accounts[0]?.handle ?? "";
}

function pickFollowers(accounts: AdminInfluencerSnsAccount[]): number {
  return accounts.reduce(
    (max, account) => Math.max(max, account.followerCount),
    0,
  );
}

function pickMedia(snsType: SnsType): Media[] {
  return [SNS_TO_MEDIA[snsType]];
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

function deriveStage(application: AdminApplication): ApplicantStage | null {
  if (application.status === "COMPLETED") return "COMPLETED";
  if (application.hasSubmittedPost) return "REVIEW_DUE";
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
  const tab = STATUS_TO_TAB[application.status];
  if (!tab) return null;
  return {
    id: application.id,
    name: application.influencer.name,
    handle: pickHandle(application.influencer.snsAccounts),
    campaign: application.campaign.title,
    media: pickMedia(application.snsType),
    followers: pickFollowers(application.influencer.snsAccounts),
    engagementRate: 0,
    appliedAt: formatRelative(application.appliedAt, now),
    status: tab,
    rawStatus: application.status,
    trackingCarrier: application.trackingCarrier,
    trackingNumber: application.trackingNumber,
    stage: deriveStage(application),
  };
}

export function aggregateTabCounts(
  raw: Record<ApplicationStatus, number> | null,
): Record<ApplicantStatus, number> {
  const acc: Record<ApplicantStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  if (!raw) return acc;
  (Object.keys(TAB_TO_STATUSES) as ApplicantStatus[]).forEach((tab) => {
    for (const s of TAB_TO_STATUSES[tab]) acc[tab] += raw[s] ?? 0;
  });
  return acc;
}
