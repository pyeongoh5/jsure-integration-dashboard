import type { AdminBrandAccount } from "@/domains/jwin";

export type JwinBrandAccountRow = {
  id: string;
  label: string;
  /** 원본 값. 표시 문구·스타일은 렌더하는 컴포넌트가 결정한다 */
  xUsername: string | null;
  status: AdminBrandAccount["status"];
  campaignCount: number;
  connectUrl: string;
};

/** 목록 항목 → 뷰 모델. */
export function toJwinBrandAccountRow(account: AdminBrandAccount): JwinBrandAccountRow {
  return {
    id: account.id,
    label: account.label,
    xUsername: account.xUsername,
    status: account.status,
    campaignCount: account.campaignCount,
    connectUrl: account.connectUrl,
  };
}
