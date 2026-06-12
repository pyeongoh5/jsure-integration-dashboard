import { useState } from "react";
import { useFormContext, useController } from "react-hook-form";
import { JP_PREFECTURES } from "@jsure/shared";
import { z } from "zod";
import { LabeledInput } from "@/components/composites/LabeledInput";
import labeledInputStyles from "@/components/composites/LabeledInput.module.css";
import { FormField } from "@/components/composites";
import { lookupPostalCode } from "@/lib/zipcloud";

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
    postalCode: POSTAL_RE.test(values.postalCode) ? undefined : "郵便番号は7桁",
    prefecture: (JP_PREFECTURES as readonly string[]).includes(values.prefecture)
      ? undefined
      : "都道府県を選択してください",
    city: values.city.trim() ? undefined : "市区町村は必須",
    addressLine1: values.addressLine1.trim() ? undefined : "番地は必須",
  };
}

export const AddressZodSchema = z.object({
  postalCode: z.string().regex(POSTAL_RE, "郵便番号は7桁"),
  prefecture: z.enum(JP_PREFECTURES, {
    errorMap: () => ({ message: "都道府県を選択してください" }),
  }),
  city: z
    .string()
    .refine((value) => value.trim().length > 0, "市区町村は必須"),
  addressLine1: z
    .string()
    .refine((value) => value.trim().length > 0, "番地は必須"),
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
          住所
        </div>
      )}

      <LabeledInput
        label="郵便番号"
        value={typeof postal.field.value === "string" ? postal.field.value : ""}
        onChange={handlePostalChange}
        error={
          postalShowError && typeof postalErrorMessage === "string"
            ? postalErrorMessage
            : undefined
        }
        hint={
          lookupState === "loading"
            ? "住所を検索中…"
            : lookupState === "notFound"
              ? "該当する住所が見つかりませんでした"
              : lookupState === "error"
                ? "住所検索に失敗しました。手動で入力してください"
                : "例: 150-0001 (入力すると自動補完されます)"
        }
        placeholder="1500001"
        inputMode="numeric"
        maxLength={8}
      />

      <label className={labeledInputStyles.field}>
        <span className={labeledInputStyles.label}>都道府県</span>
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
          <option value="">選択してください</option>
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
              : "都道府県を選択してください"}
          </span>
        )}
      </label>

      <FormField name={fieldName("city")} label="市区町村">
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
            placeholder="渋谷区神宮前"
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>
      <FormField name={fieldName("addressLine1")} label="番地">
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
      <FormField name={fieldName("addressLine2")} label="建物名・部屋番号 (任意)">
        {(field) => (
          <input
            id={field.id}
            className={labeledInputStyles.input}
            type="text"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            placeholder="ABCビル 502号室"
          />
        )}
      </FormField>
    </div>
  );
}
