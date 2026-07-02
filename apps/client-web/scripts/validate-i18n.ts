import { messages } from "../src/i18n/messages";

type UnknownRecord = Record<string, unknown>;

const missing: string[] = [];

function walk(node: unknown, path: string[]): void {
  if (node === null || typeof node !== "object") {
    missing.push(`${path.join(".")}: leaf가 객체가 아님`);
    return;
  }
  const record = node as UnknownRecord;
  const keys = Object.keys(record);
  const hasKr = "kr" in record;
  const hasJp = "jp" in record;
  if (hasKr || hasJp) {
    for (const locale of ["kr", "jp"] as const) {
      const value = record[locale];
      if (typeof value !== "string" || value.trim() === "") {
        missing.push(`${path.join(".")}.${locale}: 값이 비어있음`);
      }
    }
    return;
  }
  for (const key of keys) {
    walk(record[key], [...path, key]);
  }
}

walk(messages, []);

if (missing.length > 0) {
  console.error("[i18n] 번역 누락:");
  for (const item of missing) console.error(`  - ${item}`);
  console.error(`\n총 ${missing.length}건.`);
  process.exit(1);
}

console.log("[i18n] 모든 leaf 검증 통과");
