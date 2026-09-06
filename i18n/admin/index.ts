import { adminMessages } from "./messages";
import { resolveLeaf, type DotPath } from "../core";

export { adminMessages };

export type AdminLanguage = "ko" | "en" | "ja";
export const ADMIN_LANGUAGES: readonly AdminLanguage[] = ["ko", "en", "ja"];

type AdminLeaf = { readonly ko: string; readonly en: string; readonly ja: string };

export type AdminTranslationKey = DotPath<typeof adminMessages, AdminLeaf>;

export function translate(
  key: AdminTranslationKey,
  language: AdminLanguage,
  params?: Record<string, string | number>,
): string {
  const leaf = resolveLeaf(adminMessages, key);
  const template = leaf[language];
  if (typeof template !== "string") {
    throw new Error(`[i18n] Missing "${language}" for key: ${key}`);
  }
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in params)) return match;
    return formatParam(params[name], language);
  });
}

/**
 * 숫자 파라미터는 언어에 맞춰 천단위 구분자를 넣는다 (총 1,250명).
 * 구분자를 붙이면 안 되는 값(계좌·운송장 번호 등)은 호출부에서 문자열로 넘기므로
 * 여기서 손대지 않는다.
 */
function formatParam(
  value: string | number | undefined,
  language: AdminLanguage,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  return formatNumber(value, language);
}

/**
 * 화면에 그대로 그리는 숫자용 — 문구 없이 숫자만 보여주는 자리(사이드바 배지 등)가
 * translate 를 거치는 숫자와 같은 표기를 쓰도록 구현을 하나로 둔다.
 */
export function formatNumber(value: number, language: AdminLanguage): string {
  return value.toLocaleString(LOCALE_BY_LANGUAGE[language]);
}

const LOCALE_BY_LANGUAGE: Record<AdminLanguage, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
};
