/**
 * 당첨확률 표기·입력 변환.
 *
 * 확률은 캠페인 단위 값 하나뿐이고(경품별 확률은 없다), 어떤 상품이 나갈지는 남은 수량
 * 비례로 정해진다. 그래서 경품 목록에는 확률 대신 "수량 비율"을 보여준다.
 */

/** 저장 값(0~1)을 화면 표기용 퍼센트 문자열로. 0.05 → "5%", 0.9999 → "99.99%". */
export function formatProbabilityPercent(value: number): string {
  // 부동소수 잔재(0.30000000000000004)를 소수점 4자리에서 끊고 뒤 0 은 버린다.
  return `${Number((value * 100).toFixed(4))}%`;
}

/** 퍼센트 입력 문자열을 저장 값(0~1)으로. 숫자가 아니거나 음수면 null. */
export function percentToProbability(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0) return null;
  return percent / 100;
}

export function probabilityToPercentInput(value: number): string {
  return String(Number((value * 100).toFixed(4)));
}

/** 당첨 시 이 경품이 뽑힐 비율 — 남은 수량 ÷ 캠페인 전체 남은 수량. */
export function prizeShare(
  prize: { remainingQty: number },
  prizes: { remainingQty: number }[],
): number {
  const totalRemaining = prizes.reduce((sum, candidate) => sum + candidate.remainingQty, 0);
  if (totalRemaining <= 0) return 0;
  return prize.remainingQty / totalRemaining;
}
