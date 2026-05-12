import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { RegisterRequestSchema } from "@jsure/shared";
import { register } from "@/lib/auth";
import { hangulToEn } from "@/lib/hangulToEn";
import "./Auth.css";

export function Register() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = RegisterRequestSchema.safeParse({
      email,
      password,
      name: name.trim() || undefined,
    });
    if (!parsed.success) {
      setError("이메일 형식과 비밀번호(8자 이상)를 확인해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await register(parsed.data);
      setSubmittedEmail(res.email);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError("이미 사용 중인 이메일입니다.");
      } else {
        setError("계정 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedEmail) {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="auth__brand">
            <div className="auth__logo">J</div>
            <div className="auth__brand-text">JSure Console</div>
          </div>

          <div className="auth__success-icon">✓</div>
          <h1 className="auth__title">가입이 요청되었습니다</h1>
          <p className="auth__subtitle">
            <strong>{submittedEmail}</strong>로 가입 요청이 접수되었습니다.<br />
            관리자의 <strong>승인이 완료되면</strong> 로그인할 수 있습니다.
          </p>

          <Link to="/login" className="auth__submit auth__submit--link">
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth__brand">
          <div className="auth__logo">J</div>
          <div className="auth__brand-text">JSure Console</div>
        </div>

        <h1 className="auth__title">계정 생성</h1>
        <p className="auth__subtitle">
          가입 요청 후 관리자의 승인이 완료되어야 로그인할 수 있습니다.
        </p>

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
            <label className="auth__label" htmlFor="name">이름 (선택)</label>
            <input
              id="name"
              type="text"
              className="auth__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="password">비밀번호 (8자 이상)</label>
            <input
              id="password"
              type="password"
              className="auth__input"
              value={password}
              onChange={(e) => setPassword(hangulToEn(e.target.value))}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && <div className="auth__error">{error}</div>}

          <button type="submit" className="auth__submit" disabled={submitting}>
            {submitting ? "요청 중..." : "가입 요청"}
          </button>
        </form>

        <div className="auth__footer">
          이미 계정이 있으신가요?
          <Link to="/login" className="auth__link">로그인</Link>
        </div>
      </div>
    </div>
  );
}
