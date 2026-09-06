import { Link } from "react-router-dom";
import { JwinAccountStatusBadge } from "@/components/composites";
import type { AdminBrandCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  detail: AdminBrandCampaignDetail;
};

/**
 * 브랜드 X 계정 연동 상태. 브랜드가 곧 계정이라 여기서 계정을 고르지 않는다 —
 * 연동·재연동 링크는 브랜드 관리 화면에서 발급한다.
 */
export function ConnectTab({ detail }: Props) {
  const t = useT();
  const account = detail.brandAccount;

  return (
    <div className={styles.connect}>
      <div className={styles.statusRow}>
        <span className={styles.label}>{t("jwin.connect.brandAccount")}</span>
        <span>{account.label}</span>
      </div>
      <div className={styles.statusRow}>
        <span className={styles.label}>{t("jwin.connect.status")}</span>
        <JwinAccountStatusBadge status={account.status} />
        {account.xUsername && <span>@{account.xUsername}</span>}
      </div>
      {account.status !== "CONNECTED" && (
        <p className={styles.note}>
          {t("jwin.connect.connectNote")}{" "}
          <a href={account.connectUrl} target="_blank" rel="noreferrer">
            {account.connectUrl}
          </a>
        </p>
      )}
      <p className={styles.note}>
        {t("jwin.connect.manageNote")} <Link to="/jwin/accounts">{t("jwin.connect.manageLink")}</Link>
      </p>
    </div>
  );
}
