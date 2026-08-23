import { Link } from "react-router-dom";
import { JwinAccountStatusBadge } from "@/components/composites";
import type { AdminCampaignDetail, AdminBrandAccount } from "@/domains/jwin";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  detail: AdminCampaignDetail;
  accounts: AdminBrandAccount[];
  onSelectAccount: (brandAccountId: string) => void;
  selectError: string | null;
  accountsError: string | null;
};

export function ConnectTab({ detail, accounts, onSelectAccount, selectError, accountsError }: Props) {
  const connectable = accounts.filter((account) => account.status !== "PENDING");

  return (
    <div className={styles.connect}>
      <div className={styles.field}>
        <span className={styles.label}>브랜드 계정</span>
        <select
          className={styles.accountSelect}
          value={detail.brandAccountId ?? ""}
          onChange={(event) => event.target.value && onSelectAccount(event.target.value)}
        >
          <option value="">계정 선택</option>
          {connectable.map((account) => (
            <option key={account.id} value={account.id}>
              {account.xUsername ? `@${account.xUsername} (${account.label})` : account.label}
            </option>
          ))}
        </select>
        {accountsError && <span className={styles.error}>{accountsError}</span>}
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
