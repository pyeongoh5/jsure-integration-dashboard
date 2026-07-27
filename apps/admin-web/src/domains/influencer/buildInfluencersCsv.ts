import type { AdminInfluencer, SnsAccountSubType } from "@jsure/shared";

// SNS 를 플랫폼별로 분리하고, 플랫폼마다 계정·팔로워 수를 별도 컬럼으로 표현. 없으면 빈칸.
const SNS_COLUMNS: { type: SnsAccountSubType; label: string }[] = [
  { type: "INSTAGRAM", label: "인스타그램" },
  { type: "TIKTOK", label: "틱톡" },
  { type: "X", label: "X" },
];

const HEADERS = [
  "이름",
  "이름(카나)",
  "이메일",
  "연락처",
  ...SNS_COLUMNS.flatMap((column) => [
    `${column.label} 계정`,
    `${column.label} 팔로워`,
  ]),
  "상태",
  "가입일",
  "우편번호",
  "주소",
] as const;

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

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
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

function formatRow(row: AdminInfluencer): string[] {
  return [
    // 테이블 이름 셀의 "대상외" 배지를 접미로 반영.
    row.flagged ? `${row.name} (대상외)` : row.name,
    row.nameKana ?? "",
    row.email,
    row.phone,
    ...SNS_COLUMNS.flatMap((column) => snsCells(row, column.type)),
    row.status === "ACTIVE" ? "활성" : "정지",
    formatJoinDate(row.createdAt),
    row.address.postalCode,
    formatAddress(row.address),
  ];
}

export function buildInfluencersCsv(rows: AdminInfluencer[]): string {
  const header = HEADERS.map(escapeCsvCell).join(",");
  const body = rows
    .map((row) => formatRow(row).map(escapeCsvCell).join(","))
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
