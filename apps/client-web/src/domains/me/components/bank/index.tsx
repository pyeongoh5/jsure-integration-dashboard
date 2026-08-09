import { useFormContext, useController } from "react-hook-form";
import { z } from "zod";
import type {
  AddressCountry,
  InfluencerBankAccount,
  InfluencerBankAccountPublic,
} from "@jsure/shared";
import { t } from "@i18n";
import { CountryToggle } from "../CountryToggle";
import { JpBankFields } from "./JpBankFields";
import { KrBankFields } from "./KrBankFields";

const KANA_RE = /^[゠-ヿ　\sー]+$/;
const KR_ACCOUNT_RE = /^[\d-]{6,20}$/;

export type BankValues = {
  country: AddressCountry;
  bank: { code: string; name: string } | null;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolder: string;
  invoiceRegistrationNumber: string;
};

export const EMPTY_BANK: BankValues = {
  country: "JP",
  bank: null,
  branchName: "",
  branchCode: "",
  accountNumber: "",
  accountHolder: "",
  invoiceRegistrationNumber: "",
};

/** 국가 전환 시 지울 값이 있는지 — 국가 자체는 판단에서 제외한다. */
export function hasBankValues(values: BankValues): boolean {
  return Boolean(
    values.bank ||
      values.branchName ||
      values.branchCode ||
      values.accountNumber ||
      values.accountHolder ||
      values.invoiceRegistrationNumber,
  );
}

/**
 * 국가별 계좌 검증. discriminatedUnion 대신 superRefine 을 쓰는 이유는
 * react-hook-form 이 필드별 에러 경로를 유지해야 각 입력 아래에 메시지가 붙기 때문이다.
 */
export const BankZodSchema = z
  .object({
    country: z.enum(["JP", "KR"]),
    bank: z.object({ code: z.string(), name: z.string() }).nullable(),
    branchName: z.string(),
    branchCode: z.string(),
    accountNumber: z.string(),
    accountHolder: z.string(),
    invoiceRegistrationNumber: z.string(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (!values.bank) {
      issue(
        "bank",
        values.country === "JP"
          ? t("pages.me.bank.bankRequired")
          : t("me.bankKr.bankError"),
      );
    }

    if (values.country === "KR") {
      if (!KR_ACCOUNT_RE.test(values.accountNumber)) {
        issue("accountNumber", t("me.bankKr.accountNumberError"));
      }
      if (!values.accountHolder.trim()) {
        issue("accountHolder", t("me.bankKr.accountHolderError"));
      }
      return;
    }

    if (!values.branchName.trim()) {
      issue("branchName", t("pages.me.bank.required"));
    }
    if (!/^\d{3}$/.test(values.branchCode)) {
      issue("branchCode", t("pages.me.bank.branchCodeError"));
    }
    if (!/^\d{7}$/.test(values.accountNumber)) {
      issue("accountNumber", t("pages.me.bank.accountNumberError"));
    }
    if (!KANA_RE.test(values.accountHolder)) {
      issue("accountHolder", t("pages.me.bank.kanaError"));
    }
    if (
      values.invoiceRegistrationNumber &&
      !/^T\d{13}$/.test(values.invoiceRegistrationNumber)
    ) {
      issue("invoiceRegistrationNumber", t("pages.me.bank.invoiceNumberError"));
    }
  });

/** 폼 값 → API 요청 본문. 국가에 따라 보내는 필드가 다르다. */
export function toBankAccountPayload(values: BankValues): InfluencerBankAccount {
  if (!values.bank) throw new Error("bank required");
  if (values.country === "KR") {
    return {
      country: "KR",
      bankCode: values.bank.code,
      bankName: values.bank.name,
      accountNumber: values.accountNumber,
      accountHolder: values.accountHolder.trim(),
    };
  }
  return {
    country: "JP",
    bankCode: values.bank.code,
    bankName: values.bank.name,
    branchName: values.branchName.trim(),
    branchCode: values.branchCode,
    accountNumber: values.accountNumber,
    accountHolder: values.accountHolder,
    invoiceRegistrationNumber: values.invoiceRegistrationNumber || null,
  };
}

/** 저장된 계좌 → 폼 값. 한국 계좌에는 지점·인보이스 필드가 없어 빈 값으로 둔다. */
export function toBankValues(account: InfluencerBankAccountPublic): BankValues {
  const common = {
    bank: { code: account.bankCode, name: account.bankName },
    accountNumber: account.accountNumber ?? "",
    accountHolder: account.accountHolder,
  };
  if (account.country === "KR") {
    return {
      ...EMPTY_BANK,
      ...common,
      country: "KR",
    };
  }
  return {
    country: "JP",
    ...common,
    branchName: account.branchName,
    branchCode: account.branchCode,
    invoiceRegistrationNumber: account.invoiceRegistrationNumber ?? "",
  };
}

/**
 * 회원가입 / 마이페이지가 공유하는 계좌 입력.
 * 활성 계좌는 하나뿐이라 국가를 바꾸면 입력값을 전부 비운다.
 * 주소 국가와는 무관하게 따로 고른다.
 */
export function BankFormFields() {
  const methods = useFormContext<BankValues>();
  const country = useController({ name: "country", control: methods.control });
  const current: AddressCountry = country.field.value === "KR" ? "KR" : "JP";

  function switchCountry(next: AddressCountry) {
    methods.reset({ ...EMPTY_BANK, country: next });
  }

  return (
    <>
      <CountryToggle
        value={current}
        onChange={switchCountry}
        hasValues={hasBankValues(methods.getValues())}
        confirmMessage={(next) =>
          next === "JP"
            ? t("me.country.confirmBankToJp")
            : t("me.country.confirmBankToKr")
        }
      />

      {current === "JP" ? <JpBankFields /> : <KrBankFields />}
    </>
  );
}
