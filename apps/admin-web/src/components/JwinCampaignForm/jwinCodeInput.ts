/**
 * 기프트코드 붙여넣기 파싱.
 *
 * `@jsure/jwin-shared` 의 `parseCodesInput` 을 그대로 쓴다 — 서버(`apps/jwin-api/src/routes/admin.ts`)
 * 와 같은 함수라 화면·서버 규칙이 어긋날 일이 없다. (F-7.3 엑셀 열 붙여넣기 전제)
 */
import { parseCodesInput } from "@jsure/jwin-shared";

export { parseCodesInput };

export type CodeInputSummary = {
  count: number;
  /** 중복 등장한 코드 (서버가 400 으로 거부하는 조건) */
  duplicates: string[];
};

export function summarizeCodeInput(raw: string): CodeInputSummary {
  const codes = parseCodesInput(raw);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const code of codes) {
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);
  }
  return { count: codes.length, duplicates: [...duplicates] };
}
