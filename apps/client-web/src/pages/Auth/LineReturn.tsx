import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchMe } from "@/domains/auth";
import { t } from "@i18n";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";
import { REFRESH_STORAGE_KEY, TOKEN_STORAGE_KEY } from "../../lib/api";
import { logAuthBounce, logAuthTrace } from "../../lib/sentry";

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
    logAuthTrace(
      `LineReturn 진입: signup_token=${signupToken ? "있음" : "없음"} line_access_token=${params.get("line_access_token") ? "있음" : "없음"}`,
    );
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
      logAuthBounce("LineReturn: signup_token 도 line_access_token 도 없음");
      setError(t("pages.auth.lineReturn.errorReceive"));
      return;
    }
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      if (refreshToken) {
        localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
      }
    } catch {
      // 스토리지가 막힌 환경(프라이빗 모드 등). 인터셉터가 토큰을 localStorage
      // 에서 읽으므로 이후 fetchMe 는 401 로 실패하지만, 조용히 죽는 대신
      // 이벤트를 남겨 원인 추적이 가능하게 한다.
      logAuthBounce("LineReturn: localStorage 쓰기 실패");
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
        logAuthTrace(`LineReturn: fetchMe 성공 (${me.id}) → / 이동`);
        nav("/", { replace: true });
      })
      .catch(() => {
        logAuthBounce("LineReturn: LINE 로그인 후 fetchMe 실패");
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
