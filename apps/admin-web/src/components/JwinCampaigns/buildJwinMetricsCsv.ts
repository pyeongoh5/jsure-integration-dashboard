import { translate, type AdminTranslationKey } from "@i18n/admin";
import { escapeCsvCell } from "@/domains/application";
import type { AdminCampaignMetricsExport } from "@/domains/jwin";
import { getStoredLanguage } from "@/lib/i18n";

const HEADER_KEYS = [
  "jwin.statsPage.export.header.brand",
  "jwin.statsPage.export.header.date",
  "jwin.statsPage.export.header.kind",
  "jwin.statsPage.export.header.followers",
  "jwin.statsPage.export.header.reposts",
  "jwin.statsPage.export.header.likes",
  "jwin.statsPage.export.header.replies",
] as const satisfies readonly AdminTranslationKey[];

/** 시즌 전체 지표(브랜드×일자) CSV. 순수 함수 — 정렬·내용은 서버 응답을 그대로 따른다. */
export function buildJwinMetricsCsv(data: AdminCampaignMetricsExport): string {
  const language = getStoredLanguage();
  const header = HEADER_KEYS.map((key) => translate(key, language));
  const lines = data.rows.map((row) =>
    [
      row.brandName,
      row.dateJst,
      translate(
        row.kind === "BASELINE"
          ? "jwin.stats.metricsBaselineTag"
          : "jwin.statsPage.export.kindDaily",
        language,
      ),
      String(row.followerCount),
      row.repostCount === null ? "" : String(row.repostCount),
      row.likeCount === null ? "" : String(row.likeCount),
      row.replyCount === null ? "" : String(row.replyCount),
    ]
      .map(escapeCsvCell)
      .join(","),
  );
  return [header.map(escapeCsvCell).join(","), ...lines].join("\r\n");
}

export function jwinMetricsCsvFilename(campaignSlug: string, dateIso: string): string {
  return `jwin-metrics-${campaignSlug}-${dateIso}.csv`;
}
