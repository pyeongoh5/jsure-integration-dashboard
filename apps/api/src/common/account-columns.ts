import type {
  AddressCountry,
  InfluencerAddress,
  InfluencerBankAccount,
  InfluencerBankAccountPublic,
  JpPrefecture,
  KrProvince,
} from "@jsure/shared";

/**
 * 국가별 주소·계좌 입력을 DB 컬럼으로 옮긴다.
 *
 * 주소와 계좌는 컬럼을 공유하고 국가에 따라 의미만 달라진다. 국가를 전환하면
 * 이전 국가에서만 쓰던 컬럼에 값이 남을 수 있으므로, 두 함수 모두 **전체 컬럼을
 * 반환**해 저장 시 항상 덮어쓰게 한다. 이 규칙을 서비스마다 반복하면 한 곳만
 * 빠뜨려도 잔여 값이 남으므로 변환을 여기 모은다.
 */

export type AddressColumns = {
  addressCountry: AddressCountry;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
};

export function addressColumns(input: InfluencerAddress): AddressColumns {
  return {
    addressCountry: input.country,
    postalCode: input.postalCode,
    prefecture: input.prefecture,
    city: input.city,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 ?? "",
  };
}

export type BankAccountColumns = {
  bankCountry: AddressCountry;
  bankCode: string;
  bankName: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolder: string;
  invoiceRegistrationNumber: string | null;
};

export function bankAccountColumns(
  input: InfluencerBankAccount,
): BankAccountColumns {
  // 한국 계좌는 지점과 인보이스 등록번호를 쓰지 않는다. NOT NULL 컬럼이라
  // null 이 아닌 빈 문자열로 비운다.
  if (input.country === "KR") {
    return {
      bankCountry: "KR",
      bankCode: input.bankCode,
      bankName: input.bankName,
      branchName: "",
      branchCode: "",
      accountNumber: input.accountNumber,
      accountHolder: input.accountHolder,
      invoiceRegistrationNumber: null,
    };
  }
  return {
    bankCountry: "JP",
    bankCode: input.bankCode,
    bankName: input.bankName,
    branchName: input.branchName,
    branchCode: input.branchCode,
    accountNumber: input.accountNumber,
    accountHolder: input.accountHolder,
    invoiceRegistrationNumber: input.invoiceRegistrationNumber ?? null,
  };
}

/** DB 행에서 응답용 계좌 유니온으로. 계좌번호는 마스킹과 원본을 함께 싣는다. */
export function toBankAccountResponse(
  row: BankAccountColumns,
  accountNumberMasked: string,
): InfluencerBankAccountPublic {
  const common = {
    bankCode: row.bankCode,
    bankName: row.bankName,
    accountHolder: row.accountHolder,
    accountNumberMasked,
    accountNumber: row.accountNumber,
  };
  if (row.bankCountry === "KR") {
    return { country: "KR", ...common };
  }
  return {
    country: "JP",
    ...common,
    branchName: row.branchName,
    branchCode: row.branchCode,
    invoiceRegistrationNumber: row.invoiceRegistrationNumber,
  };
}

/** DB 행에서 응답용 주소 유니온으로. 저장된 값은 국가별 검증을 이미 통과했다. */
export function toAddressResponse(row: {
  addressCountry: AddressCountry;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
}): InfluencerAddress {
  const common = {
    postalCode: row.postalCode,
    city: row.city,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
  };
  if (row.addressCountry === "KR") {
    return { country: "KR", ...common, prefecture: row.prefecture as KrProvince };
  }
  return { country: "JP", ...common, prefecture: row.prefecture as JpPrefecture };
}
