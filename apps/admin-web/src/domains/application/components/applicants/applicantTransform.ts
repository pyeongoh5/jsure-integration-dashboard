import {
  deriveApplicantViewStatus,
  pickRepresentativeSnsAccount,
  type AdminApplication,
  type AdminInfluencerSnsAccount,
  type CampaignSubType,
} from "@jsure/shared";
import { translate, type AdminLanguage } from "@i18n/admin";
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

function pickAccounts(
  accounts: AdminInfluencerSnsAccount[],
  subTypes: CampaignSubType[],
): AdminInfluencerSnsAccount[] {
  return accounts.filter((account) =>
    subTypes.includes(account.snsType as CampaignSubType),
  );
}

export function formatRelative(
  iso: string,
  now: Date,
  language: AdminLanguage,
): string {
  const relativeTimeFormat = new Intl.RelativeTimeFormat(language, {
    numeric: "auto",
  });
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return translate("domains.application.applicants.time.justNow", language);
  }
  if (minutes < 60) return relativeTimeFormat.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeTimeFormat.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return relativeTimeFormat.format(-days, "day");
  return then.toLocaleDateString(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 응모 관리 페이지에 노출되는 단일 status 로 변환.
 * 판정 규칙은 서버 목록 필터(SQL)와 공유하는 shared 의 규칙 표를 따른다.
 * null 이면 응모자 관리에서 숨기는 응모(검토 제출·정산 완료·취소).
 */
function deriveStatus(application: AdminApplication): ApplicantStatus | null {
  return deriveApplicantViewStatus({
    status: application.status,
    category: application.campaign.category,
    receivedAt: application.receivedAt,
  });
}

export function toApplicant(
  application: AdminApplication,
  now: Date,
  language: AdminLanguage,
): Applicant | null {
  const status = deriveStatus(application);
  if (!status) return null;
  const appliedAccounts = pickAccounts(
    application.influencer.snsAccounts,
    application.subTypes,
  );
  const representative = pickRepresentativeSnsAccount(
    application.influencer.snsAccounts,
  );
  return {
    id: application.id,
    influencerId: application.influencer.id,
    name: application.influencer.name,
    handle: appliedAccounts[0]?.handle ?? "",
    representativeSns: representative
      ? { snsType: representative.snsType, handle: representative.handle }
      : null,
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
    appliedAt: formatRelative(application.appliedAt, now, language),
    status,
    rawStatus: application.status,
    trackingCarrier: application.trackingCarrier,
    trackingNumber: application.trackingNumber,
    allHandles: application.influencer.snsAccounts.map(
      (account) => account.handle,
    ),
  };
}
