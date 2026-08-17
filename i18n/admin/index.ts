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
    if (name in params) return String(params[name]);
    return match;
  });
}
