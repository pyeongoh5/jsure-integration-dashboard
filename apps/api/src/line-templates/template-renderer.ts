import type { DispatchContext, TriggerVariableWithResolver } from "./trigger-meta";

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

export function extractVariableKeys(body: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of body.matchAll(VAR_PATTERN)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export type ValidationResult = { ok: true } | { ok: false; unknown: string[] };

export function validateBodyVariables(
  body: string,
  variables: TriggerVariableWithResolver[],
): ValidationResult {
  const allowed = new Set(variables.map((v) => v.key));
  const unknown = extractVariableKeys(body).filter((k) => !allowed.has(k));
  return unknown.length === 0 ? { ok: true } : { ok: false, unknown };
}

export function renderTemplate(
  body: string,
  variables: TriggerVariableWithResolver[],
  context: DispatchContext,
  opts: { useSample?: boolean } = {},
): string {
  const byKey = new Map(variables.map((v) => [v.key, v]));
  return body.replace(VAR_PATTERN, (match, key: string) => {
    const variable = byKey.get(key);
    if (!variable) return match;
    if (opts.useSample) return variable.sample;
    const value = variable.resolver(context);
    return value ?? "";
  });
}
