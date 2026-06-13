import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { LoginRequestSchema } from "@jsure/shared";
import { login } from "@/domains/auth";
import { hangulToEn } from "@/lib/hangulToEn";
import { FormField } from "@/components/composites";
import styles from "../_shared/Auth.module.css";

type LocationState = { from?: string } | null;

type Values = z.infer<typeof LoginRequestSchema>;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState)?.from ?? "/overview";

  const methods = useForm<Values>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { email: "", password: "" },
  });
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(values: Values) {
    setServerError(null);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setServerError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else if (err.response?.status === 403) {
          const code = (err.response.data as { code?: string } | undefined)?.code;
          if (code === "ACCOUNT_PENDING") {
            setServerError(
              "아직 승인 대기 중인 계정입니다. 승인이 완료되면 로그인할 수 있습니다.",
            );
          } else if (code === "ACCOUNT_SUSPENDED") {
            setServerError("정지된 계정입니다. 관리자에게 문의하세요.");
          } else {
            setServerError("로그인할 수 없습니다.");
          }
        } else {
          setServerError(
            "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
          );
        }
      } else {
        setServerError(
          "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    }
  }

  function onInvalid() {
    setServerError("이메일 형식과 비밀번호(8자 이상)를 확인해주세요.");
  }

  const submitting = methods.formState.isSubmitting;

  return (
    <FormProvider {...methods}>
      <div className={styles.root}>
        <div className={styles.card}>
          <div className={styles.brand}>
            <div className={styles.logo}>J</div>
            <div className={styles.brandText}>JSure Console</div>
          </div>

          <h1 className={styles.title}>로그인</h1>
          <p className={styles.subtitle}>운영 콘솔 계정으로 로그인하세요.</p>

          <form
            onSubmit={methods.handleSubmit(handleSubmit, onInvalid)}
            noValidate
          >
            <FormField name="email" label="이메일">
              {(field) => (
                <input
                  id={field.id}
                  type="email"
                  className={styles.input}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  onBlur={field.onBlur}
                  autoComplete="email"
                  required
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>

            <FormField name="password" label="비밀번호">
              {(field) => (
                <input
                  id={field.id}
                  type="password"
                  className={styles.input}
                  value={field.value}
                  onChange={(event) =>
                    field.onChange(hangulToEn(event.target.value))
                  }
                  onBlur={field.onBlur}
                  autoComplete="current-password"
                  required
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>

            {serverError && <div className={styles.error}>{serverError}</div>}

            <button
              type="submit"
              className={styles.submit}
              disabled={submitting}
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <div className={styles.footer}>
            계정이 없으신가요?
            <Link to="/register" className={styles.link}>
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
