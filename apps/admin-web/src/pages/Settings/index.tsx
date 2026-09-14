import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChangeMyPasswordRequestSchema } from "@jsure/shared";
import { changeMyPassword } from "@/domains/auth";
import { extractApiErrorMessage } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { hangulToEn } from "@/lib/hangulToEn";
import { FormField } from "@/components/composites";
import { Button } from "@/components/ui";
import styles from "./Settings.module.css";

const FormSchema = ChangeMyPasswordRequestSchema.extend({
  confirmPassword: z.string().min(8),
}).refine((values) => values.newPassword === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "새 비밀번호가 일치하지 않습니다",
});

type Values = z.infer<typeof FormSchema>;

/** 내 설정 — 지금은 비밀번호 변경 하나. 임시 비밀번호를 받은 뒤 바꾸는 자리다. */
export function Settings() {
  const t = useT();
  const methods = useForm<Values>({
    resolver: zodResolver(FormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(values: Values) {
    setServerError(null);
    setSaved(false);
    try {
      await changeMyPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      methods.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaved(true);
    } catch (error: unknown) {
      setServerError(extractApiErrorMessage(error, t("pages.settings.changeFailed")));
    }
  }

  const submitting = methods.formState.isSubmitting;

  return (
    <FormProvider {...methods}>
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t("pages.settings.title")}</h1>
        </div>

        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>{t("pages.settings.passwordTitle")}</h2>
          <p className={styles.hint}>{t("pages.settings.passwordHint")}</p>

          <form
            className={styles.form}
            onSubmit={methods.handleSubmit(handleSubmit)}
            noValidate
          >
            <FormField
              name="currentPassword"
              label={t("pages.settings.currentPassword")}
            >
              {(field) => (
                <input
                  id={field.id}
                  type="password"
                  className={styles.input}
                  value={field.value}
                  onChange={(event) => field.onChange(hangulToEn(event.target.value))}
                  onBlur={field.onBlur}
                  autoComplete="current-password"
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>

            <FormField name="newPassword" label={t("pages.settings.newPassword")}>
              {(field) => (
                <input
                  id={field.id}
                  type="password"
                  className={styles.input}
                  value={field.value}
                  onChange={(event) => field.onChange(hangulToEn(event.target.value))}
                  onBlur={field.onBlur}
                  autoComplete="new-password"
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>

            <FormField
              name="confirmPassword"
              label={t("pages.settings.confirmPassword")}
            >
              {(field) => (
                <input
                  id={field.id}
                  type="password"
                  className={styles.input}
                  value={field.value}
                  onChange={(event) => field.onChange(hangulToEn(event.target.value))}
                  onBlur={field.onBlur}
                  autoComplete="new-password"
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>

            {serverError && <div className={styles.error}>{serverError}</div>}
            {saved && <div className={styles.saved}>{t("pages.settings.changed")}</div>}

            <div className={styles.actions}>
              <Button type="submit" variant="primary" size="md" loading={submitting}>
                {t("pages.settings.submit")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </FormProvider>
  );
}
