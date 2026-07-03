import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setLineSignupTokenStorage } from "../../context/SignupContext";
import { t } from "@i18n";

export function LineSignup() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = params.get("signup_token");
    if (!token) {
      nav("/login", { replace: true });
      return;
    }
    setLineSignupTokenStorage(token);
    const displayName = params.get("display_name");
    const search = new URLSearchParams();
    if (displayName) search.set("name", displayName);
    nav(
      `/signup/terms${search.toString() ? `?${search.toString()}` : ""}`,
      { replace: true },
    );
  }, [params, nav]);

  return (
    <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
      {t("pages.signup.lineSignup.linking")}
    </div>
  );
}
