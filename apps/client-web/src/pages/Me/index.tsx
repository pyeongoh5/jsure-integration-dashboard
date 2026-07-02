import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/domains/auth";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";
import { t } from "@/i18n";
import styles from "./Me.module.css";

export function Me() {
  const nav = useNavigate();
  const auth = useInfluencerAuth();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  function logout() {
    auth.clear();
    nav("/login", { replace: true });
  }

  return (
    <div className={styles.me}>
      <header className={styles.header}>
        <h1>{t("pages.me.index.title")}</h1>
      </header>

      <Link to="/me/profile" className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>{t("pages.me.index.profile")}</div>
          <div className={styles.rowSub}>
            {data
              ? `${data.name}${data.birthDate ? ` ・ ${data.birthDate}` : ""}`
              : "—"}
          </div>
        </div>
        <i className={`fa-solid fa-chevron-right ${styles.chev}`} />
      </Link>

      <Link to="/me/sns" className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>{t("pages.me.index.snsAccounts")}</div>
          <div className={styles.rowSub}>
            {data ? `${data.snsAccounts.length}${t("pages.me.index.snsCountSuffix")}` : "—"}
          </div>
        </div>
        <i className={`fa-solid fa-chevron-right ${styles.chev}`} />
      </Link>

      <Link to="/me/bank" className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>{t("pages.me.index.bank")}</div>
          <div className={styles.rowSub}>
            {data?.bankAccount
              ? `${data.bankAccount.bankName} ${data.bankAccount.accountNumberMasked}`
              : t("pages.me.index.notRegistered")}
          </div>
        </div>
        <i className={`fa-solid fa-chevron-right ${styles.chev}`} />
      </Link>

      <Link to="/me/address" className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>{t("pages.me.index.address")}</div>
          <div className={styles.rowSub}>
            {data?.address
              ? `〒${data.address.postalCode} ${data.address.prefecture}${data.address.city}`
              : t("pages.me.index.notRegistered")}
          </div>
        </div>
        <i className={`fa-solid fa-chevron-right ${styles.chev}`} />
      </Link>

      <div className={styles.email}>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{t("pages.me.index.login")}</div>
        <div style={{ fontSize: 13, color: "#111" }}>{data?.email ?? "—"}</div>
      </div>

      <button type="button" className={styles.logout} onClick={logout}>
        {t("pages.me.index.logout")}
      </button>
    </div>
  );
}
