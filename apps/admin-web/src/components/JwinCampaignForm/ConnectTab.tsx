import { Link } from "react-router-dom";
import { JwinAccountStatusBadge } from "@/components/composites";
import type { AdminCampaignDetail, AdminBrandAccount } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  detail: AdminCampaignDetail;
  accounts: AdminBrandAccount[];
  onSelectAccount: (brandAccountId: string) => void;
  selectError: string | null;
  accountsError: string | null;
};

export function ConnectTab({ detail, accounts, onSelectAccount, selectError, accountsError }: Props) {
  const t = useT();
  const connectable = accounts.filter((account) => account.status !== "PENDING");

  return (
    <div className={styles.connect}>
      <div className={styles.field}>
        <span className={styles.label}>{t("jwin.connect.brandAccount")}</span>
        <select
          className={styles.accountSelect}
          value={detail.brandAccountId ?? ""}
          onChange={(event) => event.target.value && onSelectAccount(event.target.value)}
        >
          <option value="">{t("jwin.connect.selectAccount")}</option>
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
          <span className={styles.label}>{t("jwin.connect.status")}</span>
          <JwinAccountStatusBadge status={detail.brandAccount.status} />
          {detail.brandAccount.xUsername && <span>@{detail.brandAccount.xUsername}</span>}
        </div>
      )}
      <p className={styles.note}>
        {t("jwin.connect.manageNote")} <Link to="/jwin/accounts">{t("jwin.connect.manageLink")}</Link>
      </p>
    </div>
  );
}
