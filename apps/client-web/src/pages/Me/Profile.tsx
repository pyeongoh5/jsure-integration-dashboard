import { useEffect } from "react";
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
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { t } from "@/i18n";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

const schema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, t("pages.me.profile.required")),
  nameKana: z.string().regex(KANA_RE, t("pages.me.profile.kanaError")),
  phone: z
    .string()
    .refine(
      (value) => /^\d{10,15}$|^[\d-]{10,20}$/.test(value),
      t("pages.me.profile.phoneError"),
    ),
});
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = { name: "", nameKana: "", phone: "" };

export function MeProfile() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

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
      });
    }
  }, [data, methods]);

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      updateProfile({
        name: values.name,
        nameKana: values.nameKana,
        phone: values.phone.replace(/[^\d]/g, ""),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
  });

  function save(values: Values) {
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

          <div className={labeledInputStyles.field}>
            <span className={labeledInputStyles.label}>{t("pages.me.profile.emailLabel")}</span>
            <div
              className={labeledInputStyles.input}
              style={{
                background: "#f3f4f6",
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
              }}
            >
              {data?.email ?? "—"}
            </div>
          </div>
          <div className={labeledInputStyles.field}>
            <span className={labeledInputStyles.label}>{t("pages.me.profile.birthDateLabel")}</span>
            <div
              className={labeledInputStyles.input}
              style={{
                background: "#f3f4f6",
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
              }}
            >
              {data?.birthDate ?? "—"}
            </div>
          </div>

          <PrimaryButton type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("pages.me.profile.saving") : t("pages.me.profile.save")}
          </PrimaryButton>
        </div>
      </form>
    </FormProvider>
  );
}
