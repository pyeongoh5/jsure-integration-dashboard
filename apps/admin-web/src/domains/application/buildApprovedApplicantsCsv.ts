import type {
  ApprovedApplicantExportResponse,
  ApprovedApplicantExportRow,
  CampaignSubType,
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

const SNS_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  QOO10: "Qoo10",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

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
    SNS_LABEL[row.subType],
    row.snsHandle,
    row.profileUrl,
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
