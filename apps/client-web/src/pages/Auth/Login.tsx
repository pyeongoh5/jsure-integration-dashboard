import { lineAuthorizeUrl } from "@/domains/auth";
import { t } from "@i18n";

export function Login() {
  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: "#374151",
          textAlign: "center",
          margin: "0 0 20px",
          lineHeight: 1.6,
        }}
      >
        {t("pages.auth.login.intro")}
      </p>
      <a
        href={lineAuthorizeUrl()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "14px",
          borderRadius: 8,
          background: "#06c755",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          textDecoration: "none",
        }}
      >
        <i className="fa-brands fa-line" />
        {t("pages.auth.login.continueWithLine")}
      </a>
    </div>
  );
}
