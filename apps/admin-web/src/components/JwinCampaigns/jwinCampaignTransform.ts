import type { AdminTranslationKey } from "@i18n/admin";
import type { AdminCampaignListItem } from "@/domains/jwin";

export type JwinCampaignWarning = {
  kind: "reconnect" | "failedPosts";
  labelKey: AdminTranslationKey;
  labelParams?: Record<string, string | number>;
};

/** 시즌 목록 행. 경고는 참여 브랜드들에서 합산된 값이다. */
export type JwinCampaignRow = {
  id: string;
  name: string;
  slug: string;
  /** "YYYY.MM.DD ~ YYYY.MM.DD" (JST) */
  period: string;
  brandCount: number;
  entryCount: number;
  warnings: JwinCampaignWarning[];
};

const JST_DATE = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatJstDate(iso: string): string {
  // ko-KR → "2026. 08. 01." → "2026.08.01"
  return JST_DATE.format(new Date(iso)).replace(/\.\s?/g, ".").replace(/\.$/, "");
}

/** 시즌 목록 항목 → 뷰 모델. 경고 판정 포함 (MVP_PLAN §3.2). */
export function toJwinCampaignRow(campaign: AdminCampaignListItem): JwinCampaignRow {
  const warnings: JwinCampaignWarning[] = [];
  if (campaign.needsReconnectCount > 0) {
    warnings.push({
      kind: "reconnect",
      labelKey: "jwin.campaign.warning.reconnect",
      labelParams: { count: campaign.needsReconnectCount },
    });
  }
  if (campaign.failedPostCount > 0) {
    warnings.push({
      kind: "failedPosts",
      labelKey: "jwin.campaign.warning.failedPosts",
      labelParams: { count: campaign.failedPostCount },
    });
  }

  return {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    period: `${formatJstDate(campaign.startsAt)} ~ ${formatJstDate(campaign.endsAt)}`,
    brandCount: campaign.brandCount,
    entryCount: campaign.entryCount,
    warnings,
  };
}
