import type { TriggerVariable } from "@jsure/shared";

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

export function extractVariableKeys(body: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of body.matchAll(VAR_PATTERN)) {
    const key = match[1];
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export type ValidationResult = { ok: true } | { ok: false; unknown: string[] };

export function validateBodyVariables(
  body: string,
  variables: TriggerVariable[],
): ValidationResult {
  const allowed = new Set(variables.map((variable) => variable.key));
  const unknown = extractVariableKeys(body).filter((key) => !allowed.has(key));
  return unknown.length === 0 ? { ok: true } : { ok: false, unknown };
}

/**
 * 변수 컨텍스트에 제네릭이다 — 캠페인 트리거(DispatchContext)와 공통
 * 트리거(CommonDispatchContext)가 서로 다른 모양의 컨텍스트를 쓰기 때문이다.
 * 치환 규칙 자체는 같으므로 함수는 하나만 둔다.
 */
export function renderTemplate<Ctx>(
  body: string,
  variables: (TriggerVariable & { resolver: (ctx: Ctx) => string | null })[],
  context: Ctx,
): string {
  const byKey = new Map(variables.map((variable) => [variable.key, variable]));
  return body.replace(VAR_PATTERN, (match, key: string) => {
    const variable = byKey.get(key);
    if (!variable) return match;
    return variable.resolver(context) ?? "";
  });
}

/** 미리보기·테스트 발송용 — 실제 데이터 대신 변수의 샘플 값으로 채운다. */
export function renderSample(body: string, variables: TriggerVariable[]): string {
  const byKey = new Map(variables.map((variable) => [variable.key, variable]));
  return body.replace(VAR_PATTERN, (match, key: string) => {
    const variable = byKey.get(key);
    return variable ? variable.sample : match;
  });
}
