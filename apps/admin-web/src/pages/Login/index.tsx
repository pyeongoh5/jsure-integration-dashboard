import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { LoginRequestSchema } from "@jsure/shared";
import { login } from "@/domains/auth";
import { hangulToEn } from "@/lib/hangulToEn";
import "../_shared/Auth.css";

type LocationState = { from?: string } | null;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState)?.from ?? "/overview";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = LoginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("이메일 형식과 비밀번호(8자 이상)를 확인해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data);
      navigate(from, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else if (err.response?.status === 403) {
          const code = (err.response.data as { code?: string } | undefined)?.code;
          if (code === "ACCOUNT_PENDING") {
            setError("아직 승인 대기 중인 계정입니다. 승인이 완료되면 로그인할 수 있습니다.");
          } else if (code === "ACCOUNT_SUSPENDED") {
            setError("정지된 계정입니다. 관리자에게 문의하세요.");
          } else {
            setError("로그인할 수 없습니다.");
          }
        } else {
          setError("로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
        }
      } else {
        setError("로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth__brand">
          <div className="auth__logo">J</div>
          <div className="auth__brand-text">JSure Console</div>
        </div>

        <h1 className="auth__title">로그인</h1>
        <p className="auth__subtitle">운영 콘솔 계정으로 로그인하세요.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth__field">
            <label className="auth__label" htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              className="auth__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              className="auth__input"
              value={password}
              onChange={(e) => setPassword(hangulToEn(e.target.value))}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="auth__error">{error}</div>}

          <button type="submit" className="auth__submit" disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="auth__footer">
          계정이 없으신가요?
          <Link to="/register" className="auth__link">회원가입</Link>
        </div>
      </div>
    </div>
  );
}
