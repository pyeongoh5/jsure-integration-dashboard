import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { RegisterRequestSchema } from "@jsure/shared";
import { register } from "@/domains/auth";
import { useT } from "@/lib/i18n";
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
  const t = useT();
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
      setServerError(t("domains.auth.checkEmailAndPassword"));
      return;
    }
    try {
      const res = await register(parsed.data);
      setSubmittedEmail(res.email);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setServerError(t("pages.register.emailInUse"));
      } else {
        setServerError(t("pages.register.registerFailed"));
      }
    }
  }

  function onInvalid() {
    setServerError(t("domains.auth.checkEmailAndPassword"));
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
          <h1 className={styles.title}>{t("pages.register.successTitle")}</h1>
          <p className={styles.subtitle}>
            {t("pages.register.successReceived", { email: submittedEmail })}
            <br />
            <strong>{t("pages.register.successApprovalNote")}</strong>
          </p>

          <Link to="/login" className={`${styles.submit} ${styles.submitLink}`}>
            {t("pages.register.goToLogin")}
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

          <h1 className={styles.title}>{t("pages.register.title")}</h1>
          <p className={styles.subtitle}>{t("pages.register.subtitle")}</p>

          <form
            onSubmit={methods.handleSubmit(handleSubmit, onInvalid)}
            noValidate
          >
            <FormField name="email" label={t("pages.register.emailLabel")}>
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

            <FormField name="name" label={t("pages.register.nameLabel")}>
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

            <FormField name="password" label={t("pages.register.passwordLabel")}>
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
              {submitting ? t("pages.register.submitting") : t("pages.register.submit")}
            </button>
          </form>

          <div className={styles.footer}>
            {t("pages.register.hasAccount")}
            <Link to="/login" className={styles.link}>
              {t("pages.register.loginLink")}
            </Link>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
