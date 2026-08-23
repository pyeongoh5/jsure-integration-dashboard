/**
 * 등록된 경품 확률의 합계 판정.
 *
 * 합이 1을 넘어도 **막지 않는다** — 추첨은 티어 순차 판정이라 동작 자체는 한다.
 * 다만 운영자가 의도한 확률과 실제가 어긋나므로 목록 위에 경고만 띄운다(설계 §3 탭3).
 */

/** 0.1 을 10번 더하면 0.9999999999999999 다. 이 오차로 잘못 경고하지 않도록 여유를 둔다. */
const OVERFLOW_EPSILON = 1e-9;

export function probabilitySum(prizes: { winProbability: number }[]): number {
  return prizes.reduce((sum, prize) => sum + prize.winProbability, 0);
}

export function isProbabilityOverflow(prizes: { winProbability: number }[]): boolean {
  return probabilitySum(prizes) > 1 + OVERFLOW_EPSILON;
}
