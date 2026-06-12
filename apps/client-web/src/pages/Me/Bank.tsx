import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { InfluencerBankAccountSchema } from "@jsure/shared";
import { fetchMe } from "@/domains/auth";
import { upsertBankAccount } from "@/domains/me";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { BankSelect } from "@/domains/me";
import { ErrorBanner } from "../../components/composites/ErrorBanner";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

const schema = z
  .object({
    bank: z.object({ code: z.string(), name: z.string() }).nullable(),
    branchName: z.string().refine((value) => value.trim().length > 0, "必須"),
    branchCode: z.string().regex(/^\d{3}$/, "3桁"),
    accountNumber: z.string().regex(/^\d{6,8}$/, "6~8桁"),
    accountHolderKana: z.string().regex(KANA_RE, "カナで入力"),
  })
  .superRefine((values, ctx) => {
    if (!values.bank) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "銀行を選択",
        path: ["bank"],
      });
    }
  });
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  bank: null,
  branchName: "",
  branchCode: "",
  accountNumber: "",
  accountHolderKana: "",
};

export function MeBank() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (data?.bankAccount) {
      methods.reset({
        bank: {
          code: data.bankAccount.bankCode,
          name: data.bankAccount.bankName,
        },
        branchName: data.bankAccount.branchName,
        branchCode: data.bankAccount.branchCode,
        accountNumber: "",
        accountHolderKana: data.bankAccount.accountHolderKana,
      });
    }
  }, [data, methods]);

  const mutation = useMutation({
    mutationFn: (values: Values) => {
      if (!values.bank) throw new Error("bank required");
      const payload = InfluencerBankAccountSchema.parse({
        bankCode: values.bank.code,
        bankName: values.bank.name,
        branchName: values.branchName.trim(),
        branchCode: values.branchCode,
        accountNumber: values.accountNumber,
        accountHolderKana: values.accountHolderKana,
      });
      return upsertBankAccount(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message ?? "保存に失敗しました");
    },
  });

  function save(values: Values) {
    setServerError(null);
    mutation.mutate(values);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(save)}>
        <PageHeader showBack title="振込先口座" />
        <div style={{ padding: 16 }}>
          {serverError && <ErrorBanner message={serverError} />}
          {data?.bankAccount && (
            <div
              style={{
                background: "#fef3c7",
                color: "#92400e",
                padding: 10,
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              セキュリティのため口座番号は再入力してください
            </div>
          )}
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111",
              marginBottom: 6,
            }}
          >
            銀行
          </div>
          <Controller
            control={methods.control}
            name="bank"
            render={({ field, fieldState, formState }) => {
              const showError =
                (formState.isSubmitted || fieldState.isTouched) &&
                !!fieldState.error;
              const errorMessage = fieldState.error?.message;
              return (
                <>
                  <BankSelect value={field.value} onChange={field.onChange} />
                  {showError && (
                    <div
                      style={{
                        color: "#ef4444",
                        fontSize: 11,
                        marginTop: -8,
                        marginBottom: 8,
                      }}
                    >
                      {typeof errorMessage === "string"
                        ? errorMessage
                        : "銀行を選択"}
                    </div>
                  )}
                </>
              );
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 12,
            }}
          >
            <FormField name="branchName" label="支店名">
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
            <FormField name="branchCode" label="支店コード (3桁)">
              {(field) => (
                <Input
                  id={field.id}
                  value={field.value}
                  onChange={(value) =>
                    field.onChange(value.replace(/[^\d]/g, "").slice(0, 3))
                  }
                  onBlur={field.onBlur}
                  error={field.error}
                  inputMode="numeric"
                  maxLength={3}
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>
          </div>
          <FormField name="accountNumber" label="口座番号">
            {(field) => (
              <Input
                id={field.id}
                type="text"
                inputMode="numeric"
                value={field.value}
                onChange={(value) =>
                  field.onChange(value.replace(/[^\d]/g, ""))
                }
                onBlur={field.onBlur}
                error={field.error}
                maxLength={8}
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>
          <FormField name="accountHolderKana" label="口座名義 (カナ)">
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
          <PrimaryButton type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "保存中…" : "保存"}
          </PrimaryButton>
        </div>
      </form>
    </FormProvider>
  );
}
