import { messages } from "./messages";

type Region = "kr" | "jp";
const raw = import.meta.env.VITE_I18N_REGION;
const region: Region = raw === "jp" ? "jp" : "kr";

type Leaf = { readonly kr: string; readonly jp: string };

type DotPath<T> = T extends Leaf
  ? ""
  : T extends object
    ? {
        [K in keyof T & string]: DotPath<T[K]> extends "" ? K : `${K}.${DotPath<T[K]>}`;
      }[keyof T & string]
    : never;

export type TranslationKey = DotPath<typeof messages>;

export function t(key: TranslationKey): string {
  const segments = key.split(".");
  let node: unknown = messages;
  for (const segment of segments) {
    if (node && typeof node === "object" && segment in node) {
      node = (node as Record<string, unknown>)[segment];
      continue;
    }
    throw new Error(`[i18n] Unknown key: ${key}`);
  }
  if (node && typeof node === "object" && region in node) {
    const value = (node as Record<string, unknown>)[region];
    if (typeof value === "string") return value;
  }
  throw new Error(`[i18n] Missing "${region}" for key: ${key}`);
}
