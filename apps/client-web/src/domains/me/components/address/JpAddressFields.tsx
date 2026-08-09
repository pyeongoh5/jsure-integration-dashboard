import { useState } from "react";
import { useFormContext, useController } from "react-hook-form";
import { JP_PREFECTURES } from "@jsure/shared";
import { LabeledInput } from "@/components/composites/LabeledInput";
import labeledInputStyles from "@/components/composites/LabeledInput.module.css";
import { lookupPostalCode } from "@/lib/zipcloud";
import { t } from "@i18n";
import { AddressTextFields } from "./AddressTextFields";

const POSTAL_RE = /^\d{3}-?\d{4}$/;

function formatPostalCode(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

type AddressFieldValues = Record<string, unknown>;

/**
 * 일본 주소 입력. 郵便番号 를 넣으면 zipcloud 로 都道府県·市区町村 을 채운다.
 * 부모 폼이 react-hook-form FormProvider 안에 있어야 한다.
 */
export function JpAddressFields({ fieldName }: { fieldName: (key: string) => string }) {
  const [lookupState, setLookupState] = useState<
    "idle" | "loading" | "notFound" | "error"
  >("idle");
  const methods = useFormContext<AddressFieldValues>();

  const postal = useController({
    name: fieldName("postalCode"),
    control: methods.control,
  });
  const prefecture = useController({
    name: fieldName("prefecture"),
    control: methods.control,
  });

  const showPrefectureError =
    (methods.formState.isSubmitted || prefecture.fieldState.isTouched) &&
    !!prefecture.fieldState.error;

  async function handlePostalChange(raw: string) {
    const formatted = formatPostalCode(raw);
    postal.field.onChange(formatted);
    if (!POSTAL_RE.test(formatted)) {
      setLookupState("idle");
      return;
    }
    setLookupState("loading");
    try {
      const result = await lookupPostalCode(formatted);
      if (!result) {
        setLookupState("notFound");
        return;
      }
      methods.setValue(fieldName("prefecture"), result.prefecture, {
        shouldValidate: true,
        shouldTouch: true,
      });
      methods.setValue(fieldName("city"), `${result.city}${result.town}`, {
        shouldValidate: true,
        shouldTouch: true,
      });
      setLookupState("idle");
    } catch {
      setLookupState("error");
    }
  }

  const postalShowError =
    (methods.formState.isSubmitted || postal.fieldState.isTouched) &&
    !!postal.fieldState.error;
  const postalErrorMessage = postal.fieldState.error?.message;

  function postalHint(): string {
    if (lookupState === "loading") return t("me.address.lookupLoading");
    if (lookupState === "notFound") return t("me.address.lookupNotFound");
    if (lookupState === "error") return t("me.address.lookupError");
    return t("me.address.postalHint");
  }

  return (
    <>
      <LabeledInput
        label={t("me.address.postalCodeLabel")}
        value={typeof postal.field.value === "string" ? postal.field.value : ""}
        onChange={handlePostalChange}
        error={
          postalShowError && typeof postalErrorMessage === "string"
            ? postalErrorMessage
            : undefined
        }
        hint={postalHint()}
        placeholder="1500001"
        inputMode="numeric"
        maxLength={8}
      />

      <label className={labeledInputStyles.field}>
        <span className={labeledInputStyles.label}>
          {t("me.address.prefectureLabel")}
        </span>
        <select
          className={[
            labeledInputStyles.input,
            showPrefectureError && labeledInputStyles.error,
          ]
            .filter(Boolean)
            .join(" ")}
          value={
            typeof prefecture.field.value === "string" ? prefecture.field.value : ""
          }
          onChange={(event) => prefecture.field.onChange(event.target.value)}
          onBlur={prefecture.field.onBlur}
        >
          <option value="">{t("me.address.prefecturePlaceholder")}</option>
          {JP_PREFECTURES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {showPrefectureError && (
          <span className={labeledInputStyles.errorText}>
            {typeof prefecture.fieldState.error?.message === "string"
              ? prefecture.fieldState.error.message
              : t("me.address.prefectureError")}
          </span>
        )}
      </label>

      <AddressTextFields
        city={{
          name: fieldName("city"),
          label: t("me.address.cityLabel"),
          placeholder: t("me.address.cityPlaceholder"),
        }}
        addressLine1={{
          name: fieldName("addressLine1"),
          label: t("me.address.addressLine1Label"),
          placeholder: "1-2-3",
        }}
        addressLine2={{
          name: fieldName("addressLine2"),
          label: t("me.address.addressLine2Label"),
          placeholder: t("me.address.addressLine2Placeholder"),
        }}
      />
    </>
  );
}
