import { useState } from "react";
import { useFormContext, useController } from "react-hook-form";
import { JP_PREFECTURES } from "@jsure/shared";
import { z } from "zod";
import { LabeledInput } from "@/components/composites/LabeledInput";
import labeledInputStyles from "@/components/composites/LabeledInput.module.css";
import { FormField } from "@/components/composites";
import { lookupPostalCode } from "@/lib/zipcloud";
import { t } from "@i18n";

const POSTAL_RE = /^\d{3}-?\d{4}$/;

function formatPostalCode(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export type AddressValues = {
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
};

export type AddressErrors = Partial<
  Record<keyof AddressValues, string | undefined>
>;

export function validateAddress(values: AddressValues): AddressErrors {
  return {
    postalCode: POSTAL_RE.test(values.postalCode)
      ? undefined
      : t("me.address.postalCodeError"),
    prefecture: (JP_PREFECTURES as readonly string[]).includes(values.prefecture)
      ? undefined
      : t("me.address.prefectureError"),
    city: values.city.trim() ? undefined : t("me.address.cityError"),
    addressLine1: values.addressLine1.trim()
      ? undefined
      : t("me.address.addressLine1Error"),
  };
}

export const AddressZodSchema = z.object({
  postalCode: z.string().regex(POSTAL_RE, t("me.address.postalCodeError")),
  prefecture: z.enum(JP_PREFECTURES, {
    errorMap: () => ({ message: t("me.address.prefectureError") }),
  }),
  city: z
    .string()
    .refine((value) => value.trim().length > 0, t("me.address.cityError")),
  addressLine1: z
    .string()
    .refine(
      (value) => value.trim().length > 0,
      t("me.address.addressLine1Error"),
    ),
  addressLine2: z.string(),
});

type AddressFieldValues = Record<string, unknown>;

type Props = {
  /** 폼 값 안에서 address 객체가 들어있는 경로. 빈 문자열이면 루트 자체가 address. */
  prefix?: string;
  /** "住所" 헤더를 컴포넌트 안에 넣을지 (default true) */
  showHeading?: boolean;
};

/**
 * 회원가입 / 마이페이지 양쪽에서 공유되는 주소 입력 필드.
 * - 郵便番号 입력 시 zipcloud 로 都道府県/市区町村 자동 보완
 * - 부모 폼이 react-hook-form FormProvider 안에 있어야 한다
 */
export function AddressFormFields({ prefix = "", showHeading = true }: Props) {
  const [lookupState, setLookupState] = useState<
    "idle" | "loading" | "notFound" | "error"
  >("idle");
  const methods = useFormContext<AddressFieldValues>();
  const fieldName = (key: keyof AddressValues): string =>
    prefix ? `${prefix}.${key}` : key;

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
      methods.setValue(
        fieldName("city"),
        `${result.city}${result.town}`,
        { shouldValidate: true, shouldTouch: true },
      );
      setLookupState("idle");
    } catch {
      setLookupState("error");
    }
  }

  const postalShowError =
    (methods.formState.isSubmitted || postal.fieldState.isTouched) &&
    !!postal.fieldState.error;
  const postalErrorMessage = postal.fieldState.error?.message;

  return (
    <div>
      {showHeading && (
        <div
          style={{
            marginTop: 20,
            marginBottom: 10,
            fontSize: 13,
            fontWeight: 600,
            color: "#111",
          }}
        >
          {t("me.address.heading")}
        </div>
      )}

      <LabeledInput
        label={t("me.address.postalCodeLabel")}
        value={typeof postal.field.value === "string" ? postal.field.value : ""}
        onChange={handlePostalChange}
        error={
          postalShowError && typeof postalErrorMessage === "string"
            ? postalErrorMessage
            : undefined
        }
        hint={
          lookupState === "loading"
            ? t("me.address.lookupLoading")
            : lookupState === "notFound"
              ? t("me.address.lookupNotFound")
              : lookupState === "error"
                ? t("me.address.lookupError")
                : t("me.address.postalHint")
        }
        placeholder="1500001"
        inputMode="numeric"
        maxLength={8}
      />

      <label className={labeledInputStyles.field}>
        <span className={labeledInputStyles.label}>{t("me.address.prefectureLabel")}</span>
        <select
          className={[
            labeledInputStyles.input,
            showPrefectureError && labeledInputStyles.error,
          ]
            .filter(Boolean)
            .join(" ")}
          value={
            typeof prefecture.field.value === "string"
              ? prefecture.field.value
              : ""
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

      <FormField name={fieldName("city")} label={t("me.address.cityLabel")}>
        {(field) => (
          <input
            id={field.id}
            className={[
              labeledInputStyles.input,
              field.error && labeledInputStyles.error,
            ]
              .filter(Boolean)
              .join(" ")}
            type="text"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            placeholder={t("me.address.cityPlaceholder")}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>
      <FormField name={fieldName("addressLine1")} label={t("me.address.addressLine1Label")}>
        {(field) => (
          <input
            id={field.id}
            className={[
              labeledInputStyles.input,
              field.error && labeledInputStyles.error,
            ]
              .filter(Boolean)
              .join(" ")}
            type="text"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            placeholder="1-2-3"
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>
      <FormField name={fieldName("addressLine2")} label={t("me.address.addressLine2Label")}>
        {(field) => (
          <input
            id={field.id}
            className={labeledInputStyles.input}
            type="text"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            placeholder={t("me.address.addressLine2Placeholder")}
          />
        )}
      </FormField>
    </div>
  );
}
