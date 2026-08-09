import { useFormContext, useController } from "react-hook-form";
import { KR_PROVINCES } from "@jsure/shared";
import { LabeledInput } from "@/components/composites/LabeledInput";
import labeledInputStyles from "@/components/composites/LabeledInput.module.css";
import { t } from "@i18n";
import { AddressTextFields } from "./AddressTextFields";
import styles from "./Address.module.css";

type AddressFieldValues = Record<string, unknown>;

/**
 * 다음 우편번호 스크립트를 불러오지 못했을 때만 쓰는 수동 입력 폼.
 * 검색이 안 된다고 회원가입이 막히면 안 되므로 남겨 둔다.
 */
export function KrManualAddressFields({
  fieldName,
}: {
  fieldName: (key: string) => string;
}) {
  const methods = useFormContext<AddressFieldValues>();

  const postal = useController({
    name: fieldName("postalCode"),
    control: methods.control,
  });
  const province = useController({
    name: fieldName("prefecture"),
    control: methods.control,
  });

  const showProvinceError =
    (methods.formState.isSubmitted || province.fieldState.isTouched) &&
    !!province.fieldState.error;
  const postalShowError =
    (methods.formState.isSubmitted || postal.fieldState.isTouched) &&
    !!postal.fieldState.error;
  const postalErrorMessage = postal.fieldState.error?.message;

  return (
    <>
      <div className={styles.fallbackNotice}>
        {t("me.addressKr.searchUnavailable")}
      </div>

      <LabeledInput
        label={t("me.addressKr.postalCodeLabel")}
        value={typeof postal.field.value === "string" ? postal.field.value : ""}
        onChange={(raw) =>
          postal.field.onChange(raw.replace(/[^\d]/g, "").slice(0, 5))
        }
        error={
          postalShowError && typeof postalErrorMessage === "string"
            ? postalErrorMessage
            : undefined
        }
        hint={t("me.addressKr.postalHint")}
        placeholder="06236"
        inputMode="numeric"
        maxLength={5}
      />

      <label className={labeledInputStyles.field}>
        <span className={labeledInputStyles.label}>
          {t("me.addressKr.provinceLabel")}
        </span>
        <select
          className={[
            labeledInputStyles.input,
            showProvinceError && labeledInputStyles.error,
          ]
            .filter(Boolean)
            .join(" ")}
          value={
            typeof province.field.value === "string" ? province.field.value : ""
          }
          onChange={(event) => province.field.onChange(event.target.value)}
          onBlur={province.field.onBlur}
        >
          <option value="">{t("me.addressKr.provincePlaceholder")}</option>
          {KR_PROVINCES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {showProvinceError && (
          <span className={labeledInputStyles.errorText}>
            {typeof province.fieldState.error?.message === "string"
              ? province.fieldState.error.message
              : t("me.addressKr.provinceError")}
          </span>
        )}
      </label>

      <AddressTextFields
        city={{
          name: fieldName("city"),
          label: t("me.addressKr.cityLabel"),
          placeholder: t("me.addressKr.cityPlaceholder"),
        }}
        addressLine1={{
          name: fieldName("addressLine1"),
          label: t("me.addressKr.addressLine1Label"),
          placeholder: t("me.addressKr.addressLine1Placeholder"),
        }}
        addressLine2={{
          name: fieldName("addressLine2"),
          label: t("me.addressKr.addressLine2Label"),
          placeholder: t("me.addressKr.addressLine2Placeholder"),
        }}
      />
    </>
  );
}
