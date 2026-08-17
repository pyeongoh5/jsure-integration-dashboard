import { messages } from "./messages";
import { resolveLeaf, type DotPath } from "../core";

type Region = "kr" | "jp";
const raw = import.meta.env.VITE_I18N_REGION;
const region: Region = raw === "jp" ? "jp" : "kr";

type Leaf = { readonly kr: string; readonly jp: string };

export type TranslationKey = DotPath<typeof messages, Leaf>;

export function t(key: TranslationKey): string {
  const leaf = resolveLeaf(messages, key);
  const value = leaf[region];
  if (typeof value === "string") return value;
  throw new Error(`[i18n] Missing "${region}" for key: ${key}`);
}
