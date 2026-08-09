import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { t } from "@i18n";
import { BankSelect } from "../BankSelect";
import styles from "./BankFields.module.css";

/** 일본 계좌 입력. 금융기관 4자리 코드 + 지점 + 7자리 계좌번호 + カナ 명의. */
export function JpBankFields() {
  const methods = useFormContext();

  return (
    <>
      <div className={styles.sectionLabel}>{t("pages.me.bank.bankLabel")}</div>
      <Controller
        control={methods.control}
        name="bank"
        render={({ field, fieldState, formState }) => {
          const showError =
            (formState.isSubmitted || fieldState.isTouched) && !!fieldState.error;
          const errorMessage = fieldState.error?.message;
          return (
            <>
              <BankSelect value={field.value} onChange={field.onChange} />
              {showError && (
                <div className={styles.selectError}>
                  {typeof errorMessage === "string"
                    ? errorMessage
                    : t("pages.me.bank.bankRequired")}
                </div>
              )}
            </>
          );
        }}
      />

      <div className={styles.pairRow}>
        <FormField name="branchName" label={t("pages.me.bank.branchName")}>
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
        <FormField name="branchCode" label={t("pages.me.bank.branchCode")}>
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

      <FormField name="accountNumber" label={t("pages.me.bank.accountNumber")}>
        {(field) => (
          <Input
            id={field.id}
            type="text"
            inputMode="numeric"
            value={field.value}
            onChange={(value) =>
              field.onChange(value.replace(/[^\d]/g, "").slice(0, 7))
            }
            onBlur={field.onBlur}
            error={field.error}
            maxLength={7}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>

      <FormField name="accountHolder" label={t("pages.me.bank.accountHolder")}>
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

      <FormField
        name="invoiceRegistrationNumber"
        label={t("pages.me.bank.invoiceNumber")}
        hint={t("pages.me.bank.invoiceNumberHint")}
      >
        {(field) => (
          <Input
            id={field.id}
            value={field.value}
            onChange={(value) =>
              field.onChange(
                value.toUpperCase().replace(/[^T\d]/g, "").slice(0, 14),
              )
            }
            onBlur={field.onBlur}
            error={field.error}
            maxLength={14}
            placeholder="T1234567890123"
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>
    </>
  );
}
