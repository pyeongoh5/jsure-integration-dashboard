import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LabeledInput } from "../../components/form/LabeledInput";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { ErrorBanner } from "../../components/form/ErrorBanner";
import { login as loginApi } from "../../lib/api/auth";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";

export function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const from = params.get("from") || "/";
  const auth = useInfluencerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await loginApi({ email, password });
      auth.setSession(res.accessToken, res.influencer);
      nav(from, { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 401) {
        setError("メールアドレスまたはパスワードが正しくありません");
      } else {
        setError("ログインに失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <ErrorBanner message={error} />}
      <LabeledInput
        label="メールアドレス"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <LabeledInput
        label="パスワード"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <div style={{ marginTop: 8 }}>
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "ログイン中…" : "ログイン"}
        </PrimaryButton>
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link to="/signup/terms" style={{ color: "#1d6cf3", fontSize: 13 }}>
          まだアカウントをお持ちでない方はこちら
        </Link>
      </div>
    </form>
  );
}
