import { describe, expect, it } from "vitest";
import { toKrAddress } from "./krAddress";

describe("toKrAddress", () => {
  it("시·도와 시·군·구 접두를 도로명에서 떼어낸다", () => {
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

  it("건물명이 있으면 괄호로 함께 남긴다", () => {
    const result = toKrAddress({
      zonecode: "06236",
      sido: "서울",
      sigungu: "강남구",
      roadAddress: "서울 강남구 테헤란로 123",
      buildingName: "아포스아포빌딩",
    });
    expect(result.addressLine1).toBe("테헤란로 123 (아포스아포빌딩)");
  });

  it("시·군·구가 없는 세종특별자치시도 시·도를 떼어낸다", () => {
    expect(
      toKrAddress({
        zonecode: "30150",
        sido: "세종특별자치시",
        sigungu: "",
        roadAddress: "세종특별자치시 남세종로 302",
        buildingName: "새샘마을6단지",
      }),
    ).toEqual({
      postalCode: "30150",
      prefecture: "세종특별자치시",
      city: "",
      addressLine1: "남세종로 302 (새샘마을6단지)",
    });
  });

  it("접두가 예상과 다르면 도로명을 그대로 쓴다", () => {
    const result = toKrAddress({
      zonecode: "12345",
      sido: "경기",
      sigungu: "성남시 분당구",
      roadAddress: "경기도 성남시 분당구 판교로 1",
      buildingName: "",
    });
    expect(result.addressLine1).toBe("경기도 성남시 분당구 판교로 1");
  });
});
