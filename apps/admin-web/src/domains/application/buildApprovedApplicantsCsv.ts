import {
  SUB_TYPE_LABEL,
  SUB_TYPE_OPTION_LABEL,
  type ApprovedApplicantExportResponse,
  type ApprovedApplicantExportRow,
} from "@jsure/shared";

const HEADERS = [
  "이름(한자)",
  "이름(카타카나)",
  "SNS",
  "SNS ID",
  "프로필 URL",
  "전화번호",
  "우편번호",
  "주소",
  "캠페인 신청날짜",
] as const;

/** SNS 컬럼 표기 — 옵션이 있으면 "Instagram(피드)" 형태. */
export function approvedApplicantChannelLabel(
  channel: ApprovedApplicantExportRow["channels"][number],
): string {
  const snsLabel = SUB_TYPE_LABEL[channel.subType];
  if (!channel.option) return snsLabel;
  return `${snsLabel}(${SUB_TYPE_OPTION_LABEL[channel.option] ?? channel.option})`;
}

function escapeCsvCell(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatRow(row: ApprovedApplicantExportRow): string[] {
  return [
    row.name,
    row.nameKana ?? "",
    row.channels.map(approvedApplicantChannelLabel).join(" / "),
    row.channels.map((channel) => channel.snsHandle).join(" / "),
    row.channels
      .map((channel) => channel.profileUrl)
      .filter((profileUrl) => profileUrl !== "")
      .join(" / "),
    row.phone,
    row.postalCode,
    row.address,
    formatAppliedAtJst(row.appliedAt),
  ];
}

const JST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatAppliedAtJst(iso: string): string {
  return JST_DATE_FORMATTER.format(new Date(iso));
}

export function buildApprovedApplicantsCsv(
  response: ApprovedApplicantExportResponse,
): string {
  const header = HEADERS.map(escapeCsvCell).join(",");
  const body = response.rows
    .map((row) => formatRow(row).map(escapeCsvCell).join(","))
    .join("\r\n");
  return body ? `${header}\r\n${body}` : header;
}

/** 파일명에 쓸 수 없는 문자를 안전한 문자로 치환. */
function sanitizeForFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

function todayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function approvedApplicantsCsvFilename(campaignTitle: string): string {
  return `approved-applicants-${sanitizeForFilename(campaignTitle)}-${todayIso()}.csv`;
}

/** Blob + anchor 클릭으로 다운로드 트리거. UTF-8 BOM 부착으로 엑셀 호환. */
export function triggerCsvDownload(filename: string, csv: string): void {
  const bom = "﻿";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
