import { useFormContext, useController } from "react-hook-form";
import { z } from "zod";
import {
  JP_PREFECTURES,
  KR_PROVINCES,
  type AddressCountry,
} from "@jsure/shared";
import { t } from "@i18n";
import styles from "./Address.module.css";
import { CountryToggle } from "../CountryToggle";
import { JpAddressFields } from "./JpAddressFields";
import { KrAddressFields } from "./KrAddressFields";

const JP_POSTAL_RE = /^\d{3}-?\d{4}$/;
const KR_POSTAL_RE = /^\d{5}$/;

export type AddressValues = {
  country: AddressCountry;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
};

export const EMPTY_ADDRESS: AddressValues = {
  country: "JP",
  postalCode: "",
  prefecture: "",
  city: "",
  addressLine1: "",
  addressLine2: "",
};

/** 국가 전환 시 지울 값이 있는지 — 국가 자체는 판단에서 제외한다. */
export function hasAddressValues(values: AddressValues): boolean {
  return Boolean(
    values.postalCode ||
      values.prefecture ||
      values.city ||
      values.addressLine1 ||
      values.addressLine2,
  );
}

/**
 * 국가별 주소 검증. discriminatedUnion 대신 superRefine 을 쓰는 이유는
 * react-hook-form 이 필드별 에러 경로를 유지해야 각 입력 아래에 메시지가 붙기 때문이다.
 */
export const AddressZodSchema = z
  .object({
    country: z.enum(["JP", "KR"]),
    postalCode: z.string(),
    prefecture: z.string(),
    city: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string(),
  })
  .superRefine((values, ctx) => {
    const isJp = values.country === "JP";

    if (!(isJp ? JP_POSTAL_RE : KR_POSTAL_RE).test(values.postalCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postalCode"],
        message: isJp
          ? t("me.address.postalCodeError")
          : t("me.addressKr.postalCodeError"),
      });
    }

    const provinces: readonly string[] = isJp ? JP_PREFECTURES : KR_PROVINCES;
    if (!provinces.includes(values.prefecture)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prefecture"],
        message: isJp
          ? t("me.address.prefectureError")
          : t("me.addressKr.provinceError"),
      });
    }

    if (!values.city.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["city"],
        message: isJp ? t("me.address.cityError") : t("me.addressKr.cityError"),
      });
    }

    if (!values.addressLine1.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["addressLine1"],
        message: isJp
          ? t("me.address.addressLine1Error")
          : t("me.addressKr.addressLine1Error"),
      });
    }
  });

type Props = {
  /** 폼 값 안에서 address 객체가 들어있는 경로. 빈 문자열이면 루트 자체가 address. */
  prefix?: string;
  /** 주소 헤더를 컴포넌트 안에 넣을지 (default true) */
  showHeading?: boolean;
};

/**
 * 회원가입 / 마이페이지가 공유하는 주소 입력.
 * 활성 주소는 하나뿐이라 국가를 바꾸면 입력값을 전부 비운다.
 */
export function AddressFormFields({ prefix = "", showHeading = true }: Props) {
  const methods = useFormContext<Record<string, unknown>>();
  const fieldName = (key: string): string => (prefix ? `${prefix}.${key}` : key);

  const country = useController({
    name: fieldName("country"),
    control: methods.control,
  });
  const current: AddressCountry =
    country.field.value === "KR" ? "KR" : "JP";

  const currentValues = (prefix
    ? methods.getValues(prefix)
    : methods.getValues()) as AddressValues;

  function switchCountry(next: AddressCountry) {
    const cleared: AddressValues = { ...EMPTY_ADDRESS, country: next };
    for (const [key, value] of Object.entries(cleared)) {
      methods.setValue(fieldName(key), value, { shouldValidate: false });
    }
  }

  return (
    <div>
      {showHeading && <div className={styles.heading}>{t("me.address.heading")}</div>}

      <CountryToggle
        value={current}
        onChange={switchCountry}
        hasValues={hasAddressValues(currentValues)}
        confirmMessage={(next) =>
          next === "JP"
            ? t("me.country.confirmAddressToJp")
            : t("me.country.confirmAddressToKr")
        }
      />

      {current === "JP" ? (
        <JpAddressFields fieldName={fieldName} />
      ) : (
        <KrAddressFields fieldName={fieldName} />
      )}
    </div>
  );
}
