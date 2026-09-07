/**
 * 주소 검증 규칙의 단일 소스.
 *
 * 서버(zod 스키마)와 화면(react-hook-form 폼 스키마)이 각자 규칙을 들고 있으면
 * 한쪽만 고쳐 놓고 못 고친 쪽에서 막히는 사고가 난다 — 실제로 세종특별자치시
 * (시·군·구가 없는 광역자치단체) 주소가 그렇게 저장되지 않았다.
 *
 * 여기서는 **판정만** 한다. 문구는 만들지 않는다 — 서버는 고정 문자열을,
 * 화면은 i18n 키를 쓰므로 표기는 호출부가 정한다.
 */

import { JP_PREFECTURES } from "../types/influencer.js";
import { KR_PROVINCES } from "../data/krBanks.js";

export const POSTAL_PATTERN = {
  JP: /^\d{3}-?\d{4}$/,
  KR: /^\d{5}$/,
} as const;

export type AddressRuleCountry = "JP" | "KR";

export type AddressRuleField = "postalCode" | "prefecture" | "city" | "addressLine1";

export type AddressIssueCode =
  /** 우편번호 형식이 그 나라 규격과 다르다 */
  | "postalFormat"
  /** 시·도(도도부현)가 목록에 없다 */
  | "prefectureInvalid"
  /** 필수 항목이 비어 있다 */
  | "required";

export type AddressIssue = {
  field: AddressRuleField;
  code: AddressIssueCode;
};

export type AddressRuleInput = {
  country: AddressRuleCountry;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
};

/**
 * 위반 목록을 순서대로 돌려준다. 비어 있으면 유효한 주소다.
 *
 * 나라별 차이는 두 가지다.
 *  - 우편번호 형식 (일본 7자리 / 한국 5자리)
 *  - 시·군·구 필수 여부: 일본은 시·구·정·촌이 항상 있지만, 한국은
 *    세종특별자치시처럼 시·군·구가 없는 광역자치단체가 있어 필수가 아니다.
 */
export function addressIssues(values: AddressRuleInput): AddressIssue[] {
  const issues: AddressIssue[] = [];
  const isJp = values.country === "JP";

  if (!POSTAL_PATTERN[values.country].test(values.postalCode)) {
    issues.push({ field: "postalCode", code: "postalFormat" });
  }

  const provinces: readonly string[] = isJp ? JP_PREFECTURES : KR_PROVINCES;
  if (!provinces.includes(values.prefecture)) {
    issues.push({ field: "prefecture", code: "prefectureInvalid" });
  }

  if (isJp && !values.city.trim()) {
    issues.push({ field: "city", code: "required" });
  }

  if (!values.addressLine1.trim()) {
    issues.push({ field: "addressLine1", code: "required" });
  }

  return issues;
}
