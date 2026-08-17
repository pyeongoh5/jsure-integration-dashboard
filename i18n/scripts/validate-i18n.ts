import { messages } from "../client/messages";
import { adminMessages } from "../admin/messages";

const missing: string[] = [];

function walk(node: unknown, path: string[], locales: readonly string[]): void {
  if (node === null || typeof node !== "object") {
    missing.push(`${path.join(".")}: leaf가 객체가 아님`);
    return;
  }
  const record = node as Record<string, unknown>;
  const isLeaf = locales.some((locale) => locale in record);
  if (isLeaf) {
    for (const locale of locales) {
      const value = record[locale];
      if (typeof value !== "string" || value.trim() === "") {
        missing.push(`${path.join(".")}.${locale}: 값이 비어있음`);
      }
    }
    return;
  }
  for (const key of Object.keys(record)) {
    walk(record[key], [...path, key], locales);
  }
}

walk(messages, ["client"], ["kr", "jp"]);
walk(adminMessages, ["admin"], ["ko", "en", "ja"]);

if (missing.length > 0) {
  console.error("[i18n] 번역 누락:");
  for (const item of missing) console.error(`  - ${item}`);
  console.error(`\n총 ${missing.length}건.`);
  process.exit(1);
}

console.log("[i18n] 모든 leaf 검증 통과");
