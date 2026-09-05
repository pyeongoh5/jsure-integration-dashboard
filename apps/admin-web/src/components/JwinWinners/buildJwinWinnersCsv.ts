import { translate, type AdminTranslationKey } from "@i18n/admin";
import { escapeCsvCell } from "@/domains/application";
import type { AdminWinnerExport, AdminWinnerExportRow } from "@/domains/jwin";
import { getStoredLanguage } from "@/lib/i18n";

const HEADER_KEYS = [
  "jwin.winner.export.header.date",
  "jwin.winner.export.header.account",
  "jwin.winner.export.header.prize",
  "jwin.winner.export.header.type",
  "jwin.winner.export.header.verification",
  "jwin.winner.export.header.fulfillment",
  "jwin.winner.export.header.postalCode",
  "jwin.winner.export.header.prefecture",
  "jwin.winner.export.header.address1",
  "jwin.winner.export.header.address2",
  "jwin.winner.export.header.fullName",
  "jwin.winner.export.header.phone",
] as const satisfies readonly AdminTranslationKey[];

function formatRow(
  row: AdminWinnerExportRow,
  translateLabel: (key: AdminTranslationKey) => string,
): string[] {
  return [
    row.dateJst,
    row.xUsername ? `@${row.xUsername}` : "",
    row.prizeName,
    translateLabel(
      row.prizeType === "PHYSICAL" ? "jwin.prize.type.physical" : "jwin.prize.type.code",
    ),
    translateLabel(`jwin.winner.verification.${row.verification}` as const),
    translateLabel(`jwin.winner.fulfillment.${row.fulfillment}` as const),
    row.shipping?.postalCode ?? "",
    row.shipping?.prefecture ?? "",
    row.shipping?.address1 ?? "",
    row.shipping?.address2 ?? "",
    row.shipping?.fullName ?? "",
    row.shipping?.phone ?? "",
  ];
}

/**
 * 당첨자 CSV. 서버가 필터에 걸린 전체를 배송지까지 복호화해 내려주고,
 * 여기서는 문자열 조립만 한다 — 화면에 로드된 페이지가 아니라 전체가 대상이다.
 */
export function buildJwinWinnersCsv(response: AdminWinnerExport): string {
  const language = getStoredLanguage();
  const translateLabel = (key: AdminTranslationKey) => translate(key, language);
  const header = HEADER_KEYS.map((key) => escapeCsvCell(translateLabel(key))).join(",");
  const body = response.rows
    .map((row) => formatRow(row, translateLabel).map(escapeCsvCell).join(","))
    .join("\r\n");
  return body ? `${header}\r\n${body}` : header;
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

export function jwinWinnersCsvFilename(campaignSlug: string, todayIso: string): string {
  return `jwin-winners-${sanitizeForFilename(campaignSlug)}-${todayIso}.csv`;
}
