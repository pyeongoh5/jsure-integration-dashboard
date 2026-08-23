import type { AdminTranslationKey } from "@i18n/admin";
import type { AdminCampaignListItem } from "@/domains/jwin";

export type JwinCampaignWarning = {
  kind: "reconnect" | "unconnected" | "failedPosts";
  labelKey: AdminTranslationKey;
  labelParams?: Record<string, string | number>;
};

export type JwinCampaignRow = {
  id: string;
  brandName: string;
  slug: string;
  status: AdminCampaignListItem["status"];
  /** "YYYY.MM.DD ~ YYYY.MM.DD" (JST) */
  period: string;
  /** 원본 값. 표시 문구·스타일은 렌더하는 컴포넌트가 결정한다 */
  xUsername: string | null;
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

/** 목록 항목 → 뷰 모델. 경고 판정 포함 (MVP_PLAN §3.2). */
export function toJwinCampaignRow(campaign: AdminCampaignListItem): JwinCampaignRow {
  const warnings: JwinCampaignWarning[] = [];
  if (campaign.needsReconnect) {
    warnings.push({ kind: "reconnect", labelKey: "jwin.campaign.warning.reconnect" });
  }
  if (campaign.status === "ACTIVE" && campaign.xUserId === null) {
    warnings.push({ kind: "unconnected", labelKey: "jwin.campaign.warning.unconnected" });
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
    brandName: campaign.brandName,
    slug: campaign.slug,
    status: campaign.status,
    period: `${formatJstDate(campaign.startsAt)} ~ ${formatJstDate(campaign.endsAt)}`,
    xUsername: campaign.xUsername,
    entryCount: campaign.entryCount,
    warnings,
  };
}
