import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../../lib/api/auth";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";
import "./Me.css";

export function Me() {
  const nav = useNavigate();
  const auth = useInfluencerAuth();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  function logout() {
    auth.clear();
    nav("/login", { replace: true });
  }

  return (
    <div className="me">
      <header className="me__header">
        <h1>マイページ</h1>
      </header>

      <Link to="/me/profile" className="me__row">
        <div className="me__row-main">
          <div className="me__row-label">プロフィール</div>
          <div className="me__row-sub">{data ? data.name : "—"}</div>
        </div>
        <i className="fa-solid fa-chevron-right me__chev" />
      </Link>

      <Link to="/me/sns" className="me__row">
        <div className="me__row-main">
          <div className="me__row-label">SNSアカウント</div>
          <div className="me__row-sub">
            {data ? `${data.snsAccounts.length}件` : "—"}
          </div>
        </div>
        <i className="fa-solid fa-chevron-right me__chev" />
      </Link>

      <Link to="/me/bank" className="me__row">
        <div className="me__row-main">
          <div className="me__row-label">振込先口座</div>
          <div className="me__row-sub">
            {data?.bankAccount
              ? `${data.bankAccount.bankName} ${data.bankAccount.accountNumberMasked}`
              : "未登録"}
          </div>
        </div>
        <i className="fa-solid fa-chevron-right me__chev" />
      </Link>

      <div className="me__email">
        <div style={{ fontSize: 11, color: "#6b7280" }}>ログイン</div>
        <div style={{ fontSize: 13, color: "#111" }}>{data?.email ?? "—"}</div>
      </div>

      <button type="button" className="me__logout" onClick={logout}>
        ログアウト
      </button>
    </div>
  );
}
