import type { AdminBrandAccount } from "@/domains/jwin";

export type JwinBrandAccountRow = {
  id: string;
  label: string;
  /** "@handle" 또는 "미승인" */
  handle: string;
  status: AdminBrandAccount["status"];
  campaignCount: number;
  connectUrl: string;
};

/** 목록 항목 → 뷰 모델. */
export function toJwinBrandAccountRow(account: AdminBrandAccount): JwinBrandAccountRow {
  return {
    id: account.id,
    label: account.label,
    handle: account.xUsername ? `@${account.xUsername}` : "미승인",
    status: account.status,
    campaignCount: account.campaignCount,
    connectUrl: account.connectUrl,
  };
}
