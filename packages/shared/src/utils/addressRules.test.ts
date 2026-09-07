import { describe, expect, it } from "vitest";
import { addressIssues, type AddressRuleInput } from "./addressRules";

const JP: AddressRuleInput = {
  country: "JP",
  postalCode: "150-0001",
  prefecture: "東京都",
  city: "渋谷区",
  addressLine1: "神宮前1-1-1",
};

const KR: AddressRuleInput = {
  country: "KR",
  postalCode: "06236",
  prefecture: "서울",
  city: "강남구",
  addressLine1: "테헤란로 123",
};

describe("addressIssues", () => {
  it("유효한 주소는 위반이 없다", () => {
    expect(addressIssues(JP)).toEqual([]);
    expect(addressIssues(KR)).toEqual([]);
  });

  it("한국은 시·군·구가 비어도 통과한다 — 세종특별자치시", () => {
    expect(
      addressIssues({
        country: "KR",
        postalCode: "30150",
        prefecture: "세종특별자치시",
        city: "",
        addressLine1: "남세종로 302",
      }),
    ).toEqual([]);
  });

  it("일본은 시·구·정·촌이 비면 위반이다", () => {
    expect(addressIssues({ ...JP, city: "  " })).toEqual([
      { field: "city", code: "required" },
    ]);
  });

  it("우편번호 형식은 나라별로 다르게 본다", () => {
    // 일본 형식(7자리)을 한국 주소에 넣으면 위반
    expect(addressIssues({ ...KR, postalCode: "150-0001" })).toEqual([
      { field: "postalCode", code: "postalFormat" },
    ]);
    // 하이픈 없는 일본 우편번호는 허용
    expect(addressIssues({ ...JP, postalCode: "1500001" })).toEqual([]);
  });

  it("목록에 없는 시·도는 위반이다", () => {
    expect(addressIssues({ ...KR, prefecture: "서울특별시" })).toEqual([
      { field: "prefecture", code: "prefectureInvalid" },
    ]);
  });

  it("도로명 주소는 두 나라 모두 필수다", () => {
    expect(addressIssues({ ...KR, addressLine1: "" })).toEqual([
      { field: "addressLine1", code: "required" },
    ]);
  });
});
