import { useFormContext, Controller } from "react-hook-form";
import { KR_BANKS } from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { t } from "@i18n";
import { BankSelect } from "../BankSelect";
import styles from "./BankFields.module.css";

/**
 * 한국 계좌 입력. 지점은 국내이체에 무관하므로 받지 않고,
 * 계좌번호는 은행마다 자릿수가 달라 숫자와 하이픈만 허용한다.
 */
export function KrBankFields() {
  const methods = useFormContext();

  return (
    <>
      <div className={styles.sectionLabel}>{t("me.bankKr.bankLabel")}</div>
      <Controller
        control={methods.control}
        name="bank"
        render={({ field, fieldState, formState }) => {
          const showError =
            (formState.isSubmitted || fieldState.isTouched) && !!fieldState.error;
          const errorMessage = fieldState.error?.message;
          return (
            <>
              <BankSelect
                value={field.value}
                onChange={field.onChange}
                banks={KR_BANKS}
                searchPlaceholder={t("me.bankKr.searchPlaceholder")}
              />
              {showError && (
                <div className={styles.selectError}>
                  {typeof errorMessage === "string"
                    ? errorMessage
                    : t("me.bankKr.bankError")}
                </div>
              )}
            </>
          );
        }}
      />

      <FormField name="accountNumber" label={t("me.bankKr.accountNumberLabel")}>
        {(field) => (
          <Input
            id={field.id}
            type="text"
            inputMode="numeric"
            value={field.value}
            onChange={(value) =>
              field.onChange(value.replace(/[^\d-]/g, "").slice(0, 20))
            }
            onBlur={field.onBlur}
            error={field.error}
            maxLength={20}
            placeholder={t("me.bankKr.accountNumberPlaceholder")}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>

      <FormField name="accountHolder" label={t("me.bankKr.accountHolderLabel")}>
        {(field) => (
          <Input
            id={field.id}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={field.error}
            placeholder={t("me.bankKr.accountHolderPlaceholder")}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>
    </>
  );
}
