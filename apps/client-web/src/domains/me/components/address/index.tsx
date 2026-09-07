import { useFormContext, useController } from "react-hook-form";
import { z } from "zod";
import {
  addressIssues,
  type AddressCountry,
  type AddressRuleField,
} from "@jsure/shared";
import { t } from "@i18n";
import styles from "./Address.module.css";
import { CountryToggle } from "../CountryToggle";
import { JpAddressFields } from "./JpAddressFields";
import { KrAddressFields } from "./KrAddressFields";

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
 * 국가별 주소 검증. 규칙 자체는 shared 의 `addressIssues()` 하나만 쓴다 —
 * 화면과 서버가 규칙을 따로 들고 있으면 한쪽만 고쳐 놓고 다른 쪽에서 막힌다
 * (세종특별자치시 주소가 실제로 그렇게 저장되지 않았다).
 *
 * discriminatedUnion 대신 flat + superRefine 인 이유는 react-hook-form 이
 * 필드별 에러 경로를 유지해야 각 입력 아래에 메시지가 붙기 때문이다.
 */

/** 위반 코드 → 화면 문구. 나라별 표기가 달라 필드마다 갈라 쓴다. */
function issueMessage(country: AddressCountry, field: AddressRuleField): string {
  const isKr = country === "KR";
  switch (field) {
    case "postalCode":
      return isKr ? t("me.addressKr.postalCodeError") : t("me.address.postalCodeError");
    case "prefecture":
      return isKr ? t("me.addressKr.provinceError") : t("me.address.prefectureError");
    case "city":
      return isKr ? t("me.addressKr.cityError") : t("me.address.cityError");
    case "addressLine1":
      return isKr
        ? t("me.addressKr.addressLine1Error")
        : t("me.address.addressLine1Error");
  }
}

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
    for (const issue of addressIssues(values)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [issue.field],
        // 문구는 화면이 정한다 — 규칙 함수는 위반 사실만 알려준다.
        message: issueMessage(values.country, issue.field),
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
