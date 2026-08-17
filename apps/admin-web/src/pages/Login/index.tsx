import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { LoginRequestSchema } from "@jsure/shared";
import { login } from "@/domains/auth";
import { useT } from "@/lib/i18n";
import { hangulToEn } from "@/lib/hangulToEn";
import { FormField } from "@/components/composites";
import styles from "../_shared/Auth.module.css";

type LocationState = { from?: string } | null;

type Values = z.infer<typeof LoginRequestSchema>;

export function Login() {
  const t = useT();
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
          setServerError(t("pages.login.invalidCredentials"));
        } else if (err.response?.status === 403) {
          const code = (err.response.data as { code?: string } | undefined)?.code;
          if (code === "ACCOUNT_PENDING") {
            setServerError(t("pages.login.accountPending"));
          } else if (code === "ACCOUNT_SUSPENDED") {
            setServerError(t("pages.login.accountSuspended"));
          } else {
            setServerError(t("pages.login.loginNotAllowed"));
          }
        } else {
          setServerError(t("pages.login.loginFailed"));
        }
      } else {
        setServerError(t("pages.login.loginFailed"));
      }
    }
  }

  function onInvalid() {
    setServerError(t("domains.auth.checkEmailAndPassword"));
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

          <h1 className={styles.title}>{t("pages.login.title")}</h1>
          <p className={styles.subtitle}>{t("pages.login.subtitle")}</p>

          <form
            onSubmit={methods.handleSubmit(handleSubmit, onInvalid)}
            noValidate
          >
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

            <FormField name="password" label={t("pages.login.passwordLabel")}>
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
              {submitting ? t("pages.login.submitting") : t("pages.login.submit")}
            </button>
          </form>

          <div className={styles.footer}>
            {t("pages.login.noAccount")}
            <Link to="/register" className={styles.link}>
              {t("pages.login.registerLink")}
            </Link>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
