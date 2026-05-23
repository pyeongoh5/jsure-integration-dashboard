/**
 * SNS 핸들 정책: 저장/전송은 항상 bare(앞에 `@` 없음). 표시 시점에만 `@`를 붙인다.
 * 자세한 규칙은 `.claude/CODE_RULES.md` §6 참고.
 */
export function normalizeSnsHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

export function displaySnsHandle(handle: string): string {
  return `@${handle}`;
}
