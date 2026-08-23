import {
  SUB_TYPE_LABEL,
  SUB_TYPE_OPTION_LABEL,
  deriveApplicantViewStatus,
  type ApplicantExportRow,
} from "@jsure/shared";
import { translate, type AdminTranslationKey } from "@i18n/admin";
import { getStoredLanguage } from "@/lib/i18n";
import { APPLICANT_STATUS_LABEL } from "./components/applicants/types";
import { escapeCsvCell, triggerCsvDownload } from "./buildApprovedApplicantsCsv";

export { triggerCsvDownload };

/** CSV 컬럼 — 순서가 곧 파일의 컬럼 순서다. */
const APPLICANT_EXPORT_HEADER_KEYS = [
  "domains.application.export.campaignId",
  "domains.application.export.campaignTitle",
  "domains.application.applicants.table.subType",
  "domains.application.applicants.table.appliedAt",
  "domains.application.export.influencerId",
  "domains.application.export.nameKanji",
  "domains.application.export.nameKana",
  "domains.application.export.sns",
  "domains.application.export.snsId",
  "domains.application.export.profileUrl",
  "domains.application.applicants.table.followers",
  "domains.application.export.phone",
  "domains.application.export.postalCode",
  "domains.application.export.address",
  "domains.application.applicants.table.status",
  "domains.application.export.memo",
  "domains.application.export.rejectReason",
] as const satisfies readonly AdminTranslationKey[];

const JST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 응모 일시 — JST 기준 "YYYY-MM-DD HH:mm". */
export function formatAppliedAtJstDateTime(iso: string): string {
  return JST_DATE_TIME_FORMATTER.format(new Date(iso)).replace(", ", " ");
}

/** 응모가 선택한 옵션(피드/릴스)까지 담은 서브타입 표기. */
function subTypeCell(row: ApplicantExportRow): string {
  return row.channels
    .map((channel) =>
      channel.option
        ? `${SUB_TYPE_LABEL[channel.subType]}(${SUB_TYPE_OPTION_LABEL[channel.option] ?? channel.option})`
        : SUB_TYPE_LABEL[channel.subType],
    )
    .join(" / ");
}

function formatRow(
  row: ApplicantExportRow,
  translateLabel: (key: AdminTranslationKey) => string,
): string[] {
  const viewStatus = deriveApplicantViewStatus({
    status: row.status,
    category: row.campaignCategory,
    receivedAt: row.receivedAt,
  });
  return [
    row.campaignId,
    row.campaignTitle,
    subTypeCell(row),
    formatAppliedAtJstDateTime(row.appliedAt),
    row.influencerId,
    row.name,
    row.nameKana ?? "",
    row.channels
      .map((channel) => SUB_TYPE_LABEL[channel.subType])
      .join(" / "),
    row.channels.map((channel) => channel.snsHandle).join(" / "),
    row.channels
      .map((channel) => channel.profileUrl)
      .filter((profileUrl) => profileUrl !== "")
      .join(" / "),
    String(row.followers),
    row.phone,
    row.postalCode,
    row.address,
    viewStatus ? translateLabel(APPLICANT_STATUS_LABEL[viewStatus]) : "",
    row.memo,
    row.rejectReason ?? "",
  ];
}

export function buildApplicantsCsv(rows: ApplicantExportRow[]): string {
  const language = getStoredLanguage();
  const translateLabel = (key: AdminTranslationKey) => translate(key, language);
  const header = APPLICANT_EXPORT_HEADER_KEYS.map((headerKey) =>
    escapeCsvCell(translateLabel(headerKey)),
  ).join(",");
  const body = rows
    .map((row) => formatRow(row, translateLabel).map(escapeCsvCell).join(","))
    .join("\r\n");
  return body ? `${header}\r\n${body}` : header;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function applicantsCsvFilename(): string {
  return `applicants-${todayIso()}.csv`;
}
