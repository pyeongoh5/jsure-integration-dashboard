import {
  InfluencerAddressSchema,
  InfluencerBankAccountSchema,
  toKrAddress,
} from "@jsure/shared";
import { addressColumns, bankAccountColumns } from "./account-columns";

describe("국가별 주소 스키마", () => {
  const krAddress = {
    country: "KR" as const,
    postalCode: "06236",
    prefecture: "서울",
    city: "강남구",
    addressLine1: "테헤란로 123",
    addressLine2: "4층",
  };

  it("한국 주소는 5자리 우편번호를 받는다", () => {
    expect(InfluencerAddressSchema.safeParse(krAddress).success).toBe(true);
  });

  it("한국 주소에 일본식 7자리 우편번호는 거부한다", () => {
    const result = InfluencerAddressSchema.safeParse({
      ...krAddress,
      postalCode: "150-0001",
    });
    expect(result.success).toBe(false);
  });

  it("일본 주소는 기존 검증을 그대로 유지한다", () => {
    const result = InfluencerAddressSchema.safeParse({
      country: "JP",
      postalCode: "150-0001",
      prefecture: "東京都",
      city: "渋谷区神宮前",
      addressLine1: "1-2-3",
      addressLine2: "",
    });
    expect(result.success).toBe(true);
  });

  it("시·도는 다음 우편번호 서비스가 주는 약칭만 허용한다", () => {
    // 정식 명칭으로 저장하면 검색 결과와 어긋나 검증에서 걸린다.
    const result = InfluencerAddressSchema.safeParse({
      ...krAddress,
      prefecture: "서울특별시",
    });
    expect(result.success).toBe(false);
  });
});

describe("국가별 계좌 스키마", () => {
  const krBank = {
    country: "KR" as const,
    bankCode: "088",
    bankName: "신한은행",
    accountNumber: "110-123-456789",
    accountHolder: "김민지",
  };

  it("한국 계좌는 은행코드 3자리와 한글 예금주명을 받는다", () => {
    expect(InfluencerBankAccountSchema.safeParse(krBank).success).toBe(true);
  });

  it("한국 계좌에 일본식 4자리 은행코드는 거부한다", () => {
    const result = InfluencerBankAccountSchema.safeParse({
      ...krBank,
      bankCode: "0088",
    });
    expect(result.success).toBe(false);
  });

  it("일본 계좌는 카나 예금주명만 허용한다", () => {
    const jpBank = {
      country: "JP" as const,
      bankCode: "0009",
      bankName: "三井住友銀行",
      branchName: "渋谷支店",
      branchCode: "123",
      accountNumber: "1234567",
      accountHolder: "ヤマダ ハナコ",
    };
    expect(InfluencerBankAccountSchema.safeParse(jpBank).success).toBe(true);
    expect(
      InfluencerBankAccountSchema.safeParse({ ...jpBank, accountHolder: "김민지" })
        .success,
    ).toBe(false);
  });
});

describe("DB 컬럼 변환", () => {
  it("한국 계좌는 일본 전용 컬럼을 비운다", () => {
    const columns = bankAccountColumns({
      country: "KR",
      bankCode: "090",
      bankName: "카카오뱅크",
      accountNumber: "3333-01-1234567",
      accountHolder: "박지훈",
    });

    expect(columns).toEqual({
      bankCountry: "KR",
      bankCode: "090",
      bankName: "카카오뱅크",
      branchName: "",
      branchCode: "",
      accountNumber: "3333-01-1234567",
      accountHolder: "박지훈",
      invoiceRegistrationNumber: null,
    });
  });

  it("주소 변환은 국가와 전체 컬럼을 함께 낸다", () => {
    // 국가 전환 시 이전 국가 값이 남지 않으려면 전체 컬럼이 나와야 한다.
    const columns = addressColumns({
      country: "KR",
      postalCode: "06236",
      prefecture: "서울",
      city: "강남구",
      addressLine1: "테헤란로 123",
      addressLine2: "",
    });

    expect(Object.keys(columns).sort()).toEqual([
      "addressCountry",
      "addressLine1",
      "addressLine2",
      "city",
      "postalCode",
      "prefecture",
    ]);
    expect(columns.addressCountry).toBe("KR");
  });
});

describe("다음 우편번호 응답 변환", () => {
  it("도로명 주소에서 시·도와 시·군·구 접두를 뗀다", () => {
    expect(
      toKrAddress({
        zonecode: "06236",
        sido: "서울",
        sigungu: "강남구",
        roadAddress: "서울 강남구 테헤란로 123",
        buildingName: "",
      }),
    ).toEqual({
      postalCode: "06236",
      prefecture: "서울",
      city: "강남구",
      addressLine1: "테헤란로 123",
    });
  });

  it("건물명이 있으면 도로명 뒤에 남긴다", () => {
    const result = toKrAddress({
      zonecode: "06236",
      sido: "서울",
      sigungu: "강남구",
      roadAddress: "서울 강남구 테헤란로 123",
      buildingName: "아이타워",
    });
    expect(result.addressLine1).toBe("테헤란로 123 (아이타워)");
  });

  it("접두가 예상과 다르면 도로명 주소를 그대로 쓴다", () => {
    // 세종시처럼 시·군·구가 비는 지역이 있어 접두 제거가 항상 성립하지는 않는다.
    const result = toKrAddress({
      zonecode: "30151",
      sido: "세종특별자치시",
      sigungu: "",
      roadAddress: "세종특별자치시 한누리대로 2130",
      buildingName: "",
    });
    expect(result.addressLine1).toBe("세종특별자치시 한누리대로 2130");
  });
});
