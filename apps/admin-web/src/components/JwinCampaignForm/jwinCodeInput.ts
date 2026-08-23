/**
 * 기프트코드 붙여넣기 파싱.
 *
 * 서버 `apps/jwin-api/src/routes/admin.ts` 의 `parseCodesInput` 과 **같은 규칙**이어야 한다.
 * 서버는 코드 개수가 totalQty 와 다르면 400 으로 거부하므로, 규칙이 어긋나면
 * 운영자는 "12건 입력했는데 왜 거부되지"를 겪는다. (F-7.3 엑셀 열 붙여넣기 전제)
 */
export function parseCodesInput(raw: string): string[] {
  return raw
    .split(/[\r\n\t,]+/)
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}

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
