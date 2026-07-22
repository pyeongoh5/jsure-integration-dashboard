import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchMe } from "@/domains/auth";
import { t } from "@i18n";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";
import { REFRESH_STORAGE_KEY, TOKEN_STORAGE_KEY } from "../../lib/api";

export function LineReturn() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const auth = useInfluencerAuth();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const signupToken = params.get("signup_token");
    const displayName = params.get("display_name");
    if (signupToken) {
      const search = new URLSearchParams();
      search.set("signup_token", signupToken);
      if (displayName) search.set("display_name", displayName);
      nav(`/signup/line?${search.toString()}`, { replace: true });
      return;
    }

    const token = params.get("line_access_token");
    const refreshToken = params.get("line_refresh_token");
    if (!token) {
      setError(t("pages.auth.lineReturn.errorReceive"));
      return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    if (refreshToken) {
      localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    }
    fetchMe()
      .then((me) => {
        auth.setSession(
          token,
          {
            id: me.id,
            email: me.email,
            name: me.name,
          },
          refreshToken ?? undefined,
        );
        nav("/", { replace: true });
      })
      .catch(() => {
        setError(t("pages.auth.lineReturn.errorLogin"));
      });
  }, [params, nav, auth]);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
        {error}
      </div>
    );
  }
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
      {t("pages.auth.lineReturn.loggingIn")}
    </div>
  );
}
