import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { RegisterRequestSchema } from "@jsure/shared";
import { register } from "@/domains/auth";
import { hangulToEn } from "@/lib/hangulToEn";
import { FormField } from "@/components/composites";
import styles from "../_shared/Auth.module.css";

const formSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  password: z.string().min(8),
});
type Values = z.infer<typeof formSchema>;

export function Register() {
  const methods = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", name: "", password: "" },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(values: Values) {
    setServerError(null);
    const parsed = RegisterRequestSchema.safeParse({
      email: values.email,
      password: values.password,
      name: values.name.trim() || undefined,
    });
    if (!parsed.success) {
      setServerError("이메일 형식과 비밀번호(8자 이상)를 확인해주세요.");
      return;
    }
    try {
      const res = await register(parsed.data);
      setSubmittedEmail(res.email);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setServerError("이미 사용 중인 이메일입니다.");
      } else {
        setServerError(
          "계정 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    }
  }

  function onInvalid() {
    setServerError("이메일 형식과 비밀번호(8자 이상)를 확인해주세요.");
  }

  if (submittedEmail) {
    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <div className={styles.brand}>
            <div className={styles.logo}>J</div>
            <div className={styles.brandText}>JSure Console</div>
          </div>

          <div className={styles.successIcon}>✓</div>
          <h1 className={styles.title}>가입이 요청되었습니다</h1>
          <p className={styles.subtitle}>
            <strong>{submittedEmail}</strong>로 가입 요청이 접수되었습니다.
            <br />
            관리자의 <strong>승인이 완료되면</strong> 로그인할 수 있습니다.
          </p>

          <Link to="/login" className={`${styles.submit} ${styles.submitLink}`}>
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
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

          <h1 className={styles.title}>계정 생성</h1>
          <p className={styles.subtitle}>
            가입 요청 후 관리자의 승인이 완료되어야 로그인할 수 있습니다.
          </p>

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

            <FormField name="name" label="이름 (선택)">
              {(field) => (
                <input
                  id={field.id}
                  type="text"
                  className={styles.input}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  onBlur={field.onBlur}
                  autoComplete="name"
                />
              )}
            </FormField>

            <FormField name="password" label="비밀번호 (8자 이상)">
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
                  autoComplete="new-password"
                  minLength={8}
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
              {submitting ? "요청 중..." : "가입 요청"}
            </button>
          </form>

          <div className={styles.footer}>
            이미 계정이 있으신가요?
            <Link to="/login" className={styles.link}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
