import { Link } from "react-router-dom";
import { Select } from "@/components/ui";
import { JwinAccountStatusBadge } from "@/components/composites";
import type { AdminCampaignDetail, AdminBrandAccount } from "@/domains/jwin";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  detail: AdminCampaignDetail;
  accounts: AdminBrandAccount[];
  onSelectAccount: (brandAccountId: string) => void;
  selectError: string | null;
};

export function ConnectTab({ detail, accounts, onSelectAccount, selectError }: Props) {
  const connectable = accounts.filter((account) => account.status !== "PENDING");

  return (
    <div className={styles.connect}>
      <div className={styles.field}>
        <span className={styles.label}>브랜드 계정</span>
        <Select
          value={detail.brandAccountId ?? ""}
          onChange={(value) => value && onSelectAccount(value)}
          placeholder="계정 선택"
          options={connectable.map((account) => ({
            value: account.id,
            label: account.xUsername ? `@${account.xUsername} (${account.label})` : account.label,
          }))}
        />
        {selectError && <span className={styles.error}>{selectError}</span>}
      </div>
      {detail.brandAccount && (
        <div className={styles.statusRow}>
          <span className={styles.label}>상태</span>
          <JwinAccountStatusBadge status={detail.brandAccount.status} />
          {detail.brandAccount.xUsername && <span>@{detail.brandAccount.xUsername}</span>}
        </div>
      )}
      <p className={styles.note}>
        계정 추가·재연동은 <Link to="/jwin/accounts">브랜드 계정</Link> 페이지에서 합니다.
      </p>
    </div>
  );
}
