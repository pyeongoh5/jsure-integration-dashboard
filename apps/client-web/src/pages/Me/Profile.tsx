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

const KANA_RE = /^[゠-ヿ　\sー]+$/;

const schema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, "必須"),
  nameKana: z.string().regex(KANA_RE, "カナで入力"),
  phone: z
    .string()
    .refine(
      (value) => /^\d{10,15}$|^[\d-]{10,20}$/.test(value),
      "10~15桁",
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
        <PageHeader showBack title="プロフィール" />
        <div style={{ padding: 16 }}>
          <FormField name="name" label="お名前">
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
          <FormField name="nameKana" label="お名前 (カナ)">
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
          <FormField name="phone" label="電話番号">
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
            <span className={labeledInputStyles.label}>メールアドレス</span>
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
            <span className={labeledInputStyles.label}>生年月日</span>
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
            {mutation.isPending ? "保存中…" : "保存"}
          </PrimaryButton>
        </div>
      </form>
    </FormProvider>
  );
}
