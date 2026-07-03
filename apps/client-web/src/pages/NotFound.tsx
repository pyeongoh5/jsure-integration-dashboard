import { Link } from "react-router-dom";
import { t } from "@i18n";

export function NotFound() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#111" }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>{t("pages.notFound.heading")}</h2>
      <Link to="/" style={{ color: "#1d6cf3" }}>{t("pages.notFound.home")}</Link>
    </div>
  );
}
