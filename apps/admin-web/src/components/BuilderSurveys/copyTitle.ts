const MAX_TITLE_LENGTH = 200;

/**
 * 복사한 설문의 제목. 원본 제목에 `" (접미사)"` 를 덧붙이되, 전체가 200자(Task 1 의
 * title 상한)를 넘으면 원본 제목을 잘라 맞춘다 — 그대로 넘기면 서버가 400을 돌려준다.
 */
export function copyTitle(title: string, suffix: string): string {
  const suffixText = ` (${suffix})`;
  const availableLength = MAX_TITLE_LENGTH - suffixText.length;
  const truncatedTitle = title.slice(0, Math.max(availableLength, 0));
  return `${truncatedTitle}${suffixText}`;
}
