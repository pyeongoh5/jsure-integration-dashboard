import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { fetchMe } from "@/domains/auth";
import { upsertBankAccount } from "@/domains/me";
import {
  BankFormFields,
  BankZodSchema,
  EMPTY_BANK,
  toBankAccountPayload,
  toBankValues,
  type BankValues,
} from "@/domains/me";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { ErrorBanner } from "../../components/composites/ErrorBanner";
import { t } from "@i18n";
import styles from "./Bank.module.css";

export function MeBank() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<BankValues>({
    resolver: zodResolver(BankZodSchema),
    defaultValues: EMPTY_BANK,
  });

  useEffect(() => {
    if (data?.bankAccount) {
      methods.reset(toBankValues(data.bankAccount));
    }
  }, [data, methods]);

  const mutation = useMutation({
    mutationFn: (values: BankValues) =>
      upsertBankAccount(toBankAccountPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error?.response?.data?.message ?? t("pages.me.bank.saveFailed"),
      );
    },
  });

  function save(values: BankValues) {
    setServerError(null);
    mutation.mutate(values);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(save)}>
        <PageHeader showBack title={t("pages.me.bank.title")} />
        <div className={styles.body}>
          {serverError && <ErrorBanner message={serverError} />}
          {data?.bankAccount && !data.bankAccount.accountNumber && (
            <div className={styles.reenterNotice}>
              {t("pages.me.bank.reenterAccount")}
            </div>
          )}

          <BankFormFields />

          <PrimaryButton type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? t("pages.me.bank.saving")
              : t("pages.me.bank.save")}
          </PrimaryButton>
        </div>
      </form>
    </FormProvider>
  );
}
