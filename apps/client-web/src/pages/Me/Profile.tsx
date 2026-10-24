import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fetchMe } from "@/domains/auth";
import { updateProfile } from "@/domains/me";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import labeledInputStyles from "@/components/composites/LabeledInput.module.css";
import { ErrorBanner } from "../../components/composites/ErrorBanner";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { t } from "@i18n";

const KANA_RE = /^[゠-ヿ　\sー]+$/;
const BIRTH_RE = /^\d{4}-\d{2}-\d{2}$/;
const TODAY_YMD = new Date().toISOString().slice(0, 10);

const schema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, t("pages.me.profile.required")),
  nameKana: z.string().regex(KANA_RE, t("pages.me.profile.kanaError")),
  phone: z
    .string()
    .refine(
      (value) => /^\d{10,15}$|^[\d-]{10,20}$/.test(value),
      t("pages.me.profile.phoneError"),
    ),
  email: z.string().email(t("pages.me.profile.emailError")),
  birthDate: z
    .string()
    .refine(
      (value) => BIRTH_RE.test(value) && value <= TODAY_YMD,
      t("pages.me.profile.birthDateError"),
    ),
});
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = {
  name: "",
  nameKana: "",
  phone: "",
  email: "",
  birthDate: "",
};

export function MeProfile() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (data) {
      methods.reset({
        name: data.name,
        nameKana: data.nameKana ?? "",
        phone: data.phone,
        email: data.email,
        birthDate: data.birthDate ?? "",
      });
    }
  }, [data, methods]);

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      updateProfile({
        name: values.name,
        nameKana: values.nameKana,
        phone: values.phone.replace(/[^\d]/g, ""),
        email: values.email,
        birthDate: values.birthDate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
    onError: (error: unknown) => {
      const failure = error as { response?: { data?: { message?: string } } };
      setServerError(
        failure?.response?.data?.message ?? t("pages.me.profile.saveFailed"),
      );
    },
  });

  function save(values: Values) {
    setServerError(null);
    mutation.mutate(values);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(save)}>
        <PageHeader showBack title={t("pages.me.profile.title")} />
        <div style={{ padding: 16 }}>
          <FormField name="name" label={t("pages.me.profile.nameLabel")}>
            {(field) => (
              <Input
                id={field.id}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={field.error}
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>
          <FormField name="nameKana" label={t("pages.me.profile.nameKanaLabel")}>
            {(field) => (
              <Input
                id={field.id}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={field.error}
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>
          <FormField name="phone" label={t("pages.me.profile.phoneLabel")}>
            {(field) => (
              <Input
                id={field.id}
                type="tel"
                inputMode="tel"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={field.error}
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>

          <FormField name="email" label={t("pages.me.profile.emailLabel")}>
            {(field) => (
              <Input
                id={field.id}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={field.error}
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>
          <div style={{ marginTop: -8, marginBottom: 16, fontSize: 11, color: "#6b7280" }}>
            {t("pages.me.profile.emailNotice")}
          </div>
          <FormField name="birthDate" label={t("pages.me.profile.birthDateLabel")}>
            {(field) => (
              <input
                id={field.id}
                type="date"
                className={[labeledInputStyles.input, field.error && labeledInputStyles.error]
                  .filter(Boolean)
                  .join(" ")}
                value={field.value}
                max={TODAY_YMD}
                onChange={(event) => field.onChange(event.target.value)}
                onBlur={field.onBlur}
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>

          {serverError && <ErrorBanner message={serverError} />}

          <PrimaryButton type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("pages.me.profile.saving") : t("pages.me.profile.save")}
          </PrimaryButton>
        </div>
      </form>
    </FormProvider>
  );
}
