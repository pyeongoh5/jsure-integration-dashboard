import type { AdminInfluencer, SnsAccountSubType } from "@jsure/shared";
import { translate, type AdminLanguage, type AdminTranslationKey } from "@i18n/admin";
import { getStoredLanguage } from "@/lib/i18n";
import { RESIDENCE_LABEL_KEY } from "./residenceLabel";
import { WITHDRAWAL_REASON_LABEL_KEY } from "./withdrawalLabel";
import { WITHDRAWAL_DECISION_LABEL_KEY } from "@/components/composites";

// SNS 를 플랫폼별로 분리하고, 플랫폼마다 계정·팔로워 수를 별도 컬럼으로 표현. 없으면 빈칸.
const SNS_COLUMNS: { type: SnsAccountSubType; labelKey: AdminTranslationKey }[] = [
  { type: "INSTAGRAM", labelKey: "domains.campaign.snsName.instagram" },
  { type: "TIKTOK", labelKey: "domains.campaign.snsName.tiktok" },
  { type: "X", labelKey: "domains.campaign.snsName.x" },
];

function buildHeaders(language: AdminLanguage): string[] {
  return [
    translate("common.name", language),
    translate("domains.influencer.csv.nameKana", language),
    translate("common.email", language),
    translate("domains.influencer.csv.phone", language),
    ...SNS_COLUMNS.flatMap((column) => {
      const snsLabel = translate(column.labelKey, language);
      return [
        translate("domains.influencer.csv.accountColumn", language, { sns: snsLabel }),
        translate("domains.influencer.csv.followerColumn", language, { sns: snsLabel }),
      ];
    }),
    translate("common.status", language),
    translate("common.joinedAt", language),
    translate("domains.influencer.residence.label", language),
    translate("domains.influencer.csv.postalCode", language),
    translate("domains.influencer.csv.address", language),
    translate("domains.influencer.withdrawal.prefix", language),
    translate("domains.influencer.withdrawal.requestedAt", language),
    translate("domains.influencer.withdrawal.decidedAt", language),
    translate("domains.influencer.withdrawal.reason", language),
    translate("domains.influencer.withdrawal.reasonDetail", language),
  ];
}

function formatDateTime(iso: string | null, language: AdminLanguage): string {
  return iso ? new Date(iso).toLocaleString(language) : "";
}

/**
 * 탈퇴 컬럼 5개. 신청 이력이 없으면 전부 빈칸 — 빈 문자열이 "신청한 적 없음"이라는
 * 뜻이 되도록 상태 컬럼에도 라벨을 넣지 않는다.
 */
function withdrawalCells(
  withdrawal: AdminInfluencer["withdrawal"],
  language: AdminLanguage,
): string[] {
  if (!withdrawal) return ["", "", "", "", ""];
  return [
    translate(WITHDRAWAL_DECISION_LABEL_KEY[withdrawal.decision], language),
    formatDateTime(withdrawal.requestedAt, language),
    // 승인일시 — 반려 건의 처리 시각은 승인일시가 아니므로 비운다.
    withdrawal.decision === "APPROVED"
      ? formatDateTime(withdrawal.decidedAt, language)
      : "",
    translate(WITHDRAWAL_REASON_LABEL_KEY[withdrawal.reason], language),
    withdrawal.reasonDetail,
  ];
}

// 플랫폼별 [계정, 팔로워 수] 셀 쌍. 계정 없으면 둘 다 빈칸.
function snsCells(row: AdminInfluencer, type: SnsAccountSubType): [string, string] {
  const account = row.snsAccounts.find((sns) => sns.snsType === type);
  if (!account) return ["", ""];
  return [`@${account.handle}`, String(account.followerCount)];
}

function formatAddress(address: AdminInfluencer["address"]): string {
  return [
    address.prefecture,
    address.city,
    address.addressLine1,
    address.addressLine2,
  ]
    .filter((part) => part.trim() !== "")
    .join(" ");
}

function formatJoinDate(iso: string, language: AdminLanguage): string {
  return new Date(iso).toLocaleDateString(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function escapeCsvCell(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatRow(row: AdminInfluencer, language: AdminLanguage): string[] {
  return [
    // 테이블 이름 셀의 "대상외" 배지를 접미로 반영.
    row.flagged
      ? translate("domains.influencer.csv.flaggedSuffix", language, { name: row.name })
      : row.name,
    row.nameKana ?? "",
    row.email,
    row.phone,
    ...SNS_COLUMNS.flatMap((column) => snsCells(row, column.type)),
    row.status === "ACTIVE"
      ? translate("common.active", language)
      : translate("common.suspended", language),
    formatJoinDate(row.createdAt, language),
    translate(RESIDENCE_LABEL_KEY[row.residence], language),
    row.address.postalCode,
    formatAddress(row.address),
    ...withdrawalCells(row.withdrawal, language),
  ];
}

export function buildInfluencersCsv(rows: AdminInfluencer[]): string {
  const language = getStoredLanguage();
  const header = buildHeaders(language).map(escapeCsvCell).join(",");
  const body = rows
    .map((row) => formatRow(row, language).map(escapeCsvCell).join(","))
    .join("\r\n");
  return body ? `${header}\r\n${body}` : header;
}

export function influencersCsvFilename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `influencers-${yyyy}-${mm}-${dd}.csv`;
}
