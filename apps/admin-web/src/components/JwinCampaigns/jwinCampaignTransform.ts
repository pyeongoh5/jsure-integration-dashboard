import type { AdminCampaignListItem } from "@/domains/jwin";

export type JwinCampaignWarning = {
  kind: "reconnect" | "unconnected" | "failedPosts";
  label: string;
};

export type JwinCampaignRow = {
  id: string;
  brandName: string;
  slug: string;
  status: AdminCampaignListItem["status"];
  /** "YYYY.MM.DD ~ YYYY.MM.DD" (JST) */
  period: string;
  /** "@handle" 또는 "미연동" */
  account: string;
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
    warnings.push({ kind: "reconnect", label: "브랜드 재연동 필요" });
  }
  if (campaign.status === "ACTIVE" && campaign.xUserId === null) {
    warnings.push({ kind: "unconnected", label: "계정 미연동" });
  }
  if (campaign.failedPostCount > 0) {
    warnings.push({ kind: "failedPosts", label: `게시 실패 ${campaign.failedPostCount}건` });
  }

  return {
    id: campaign.id,
    brandName: campaign.brandName,
    slug: campaign.slug,
    status: campaign.status,
    period: `${formatJstDate(campaign.startsAt)} ~ ${formatJstDate(campaign.endsAt)}`,
    account: campaign.xUsername ? `@${campaign.xUsername}` : "미연동",
    entryCount: campaign.entryCount,
    warnings,
  };
}
