import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/domains/auth";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";
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
        <h1>マイページ</h1>
      </header>

      <Link to="/me/profile" className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>プロフィール</div>
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
          <div className={styles.rowLabel}>SNSアカウント</div>
          <div className={styles.rowSub}>
            {data ? `${data.snsAccounts.length}件` : "—"}
          </div>
        </div>
        <i className={`fa-solid fa-chevron-right ${styles.chev}`} />
      </Link>

      <Link to="/me/bank" className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>振込先口座</div>
          <div className={styles.rowSub}>
            {data?.bankAccount
              ? `${data.bankAccount.bankName} ${data.bankAccount.accountNumberMasked}`
              : "未登録"}
          </div>
        </div>
        <i className={`fa-solid fa-chevron-right ${styles.chev}`} />
      </Link>

      <Link to="/me/address" className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>配送先住所</div>
          <div className={styles.rowSub}>
            {data?.address
              ? `〒${data.address.postalCode} ${data.address.prefecture}${data.address.city}`
              : "未登録"}
          </div>
        </div>
        <i className={`fa-solid fa-chevron-right ${styles.chev}`} />
      </Link>

      <div className={styles.email}>
        <div style={{ fontSize: 11, color: "#6b7280" }}>ログイン</div>
        <div style={{ fontSize: 13, color: "#111" }}>{data?.email ?? "—"}</div>
      </div>

      <button type="button" className={styles.logout} onClick={logout}>
        ログアウト
      </button>
    </div>
  );
}
