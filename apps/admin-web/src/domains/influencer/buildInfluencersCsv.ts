import type { AdminInfluencer, SnsAccountSubType } from "@jsure/shared";
import { translate, type AdminLanguage, type AdminTranslationKey } from "@i18n/admin";
import { getStoredLanguage } from "@/lib/i18n";

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
    translate("domains.influencer.csv.country", language),
    translate("domains.influencer.csv.postalCode", language),
    translate("domains.influencer.csv.address", language),
  ];
}

// 플랫폼별 [계정, 팔로워 수] 셀 쌍. 계정 없으면 둘 다 빈칸.
function snsCells(row: AdminInfluencer, type: SnsAccountSubType): [string, string] {
  const account = row.snsAccounts.find((sns) => sns.snsType === type);
  if (!account) return ["", ""];
  return [`@${account.handle}`, String(account.followerCount)];
}

const COUNTRY_LABEL_KEY: Record<AdminInfluencer["address"]["country"], AdminTranslationKey> = {
  JP: "domains.influencer.csv.countryJp",
  KR: "domains.influencer.csv.countryKr",
};

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
    translate(COUNTRY_LABEL_KEY[row.address.country], language),
    row.address.postalCode,
    formatAddress(row.address),
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
