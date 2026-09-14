import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RequestPasswordResetRequestSchema } from "@jsure/shared";
import { requestPasswordReset } from "@/domains/auth";
import { useT } from "@/lib/i18n";
import { FormField } from "@/components/composites";
import styles from "../_shared/Auth.module.css";

type Values = z.infer<typeof RequestPasswordResetRequestSchema>;

/**
 * 비밀번호 찾기 — 임시 비밀번호를 메일로 받는다.
 *
 * 성공·실패를 구분해 보여주지 않는다. 계정이 없을 때 다른 메시지를 내면
 * 어떤 이메일이 가입돼 있는지 알아낼 수 있기 때문이다(서버도 같은 이유로 항상 성공한다).
 */
export function PasswordReset() {
  const t = useT();
  const methods = useForm<Values>({
    resolver: zodResolver(RequestPasswordResetRequestSchema),
    defaultValues: { email: "" },
  });
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(values: Values) {
    setServerError(null);
    try {
      await requestPasswordReset(values);
      setSent(true);
    } catch {
      setServerError(t("pages.passwordReset.failed"));
    }
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

          <h1 className={styles.title}>{t("pages.passwordReset.title")}</h1>
          <p className={styles.subtitle}>{t("pages.passwordReset.subtitle")}</p>

          {sent ? (
            <p className={styles.subtitle}>{t("pages.passwordReset.sent")}</p>
          ) : (
            <form onSubmit={methods.handleSubmit(handleSubmit)} noValidate>
              <FormField name="email" label={t("pages.login.emailLabel")}>
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

              {serverError && <div className={styles.error}>{serverError}</div>}

              <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting
                  ? t("pages.passwordReset.submitting")
                  : t("pages.passwordReset.submit")}
              </button>
            </form>
          )}

          <div className={styles.footer}>
            <Link to="/login" className={styles.link}>
              {t("pages.passwordReset.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
