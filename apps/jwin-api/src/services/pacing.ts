/**
 * 인스턴트윈 소진 페이싱 — 순수 계산부.
 *
 * 당첨 판정은 두 단계다. 1단계에서 캠페인 단위 확률로 당첨 여부만 정하고,
 * 2단계에서 남은 수량 비례로 어떤 상품인지 뽑는다. 경품마다 확률을 따로 두지 않는다.
 *
 * 소진 속도는 두 겹으로 조절한다.
 *  - 하드 상한: 누적 소진량이 계획선을 앞지르지 못한다 (scheduleGateOpen).
 *  - 속도 조절: 구간마다 계획량 달성 여부로 보정 배수를 올리고 내린다 (rollForwardWindow).
 *
 * 설계: docs/superpowers/specs/2026-10-24-jwin-instant-win-pacing-design.md
 */

/** 적용 확률 상한. 기준 확률 입력 상한이기도 하다. */
export const MAX_APPLIED_PROBABILITY = 0.5;

/** 구간 길이 하한(ms). 재고가 밀집해도 보정 배수가 작은 표본 위에서 요동치지 않도록. */
export const MIN_WINDOW_MS = 2 * 60 * 60 * 1000;

const MULTIPLIER_ON_SHORTFALL = 1.5;
const MULTIPLIER_ON_TARGET_MET = 0.5;
const MIN_MULTIPLIER = 1;

/**
 * 누적 계획선 게이트.
 *
 * 경과 비율만큼은 이미 나갔어야 할 양이고, 거기 도달했으면 더 내보내지 않는다.
 * 뒤처진 만큼은 언제든 몰아서 나갈 수 있지만 계획선을 앞지르지는 못한다 — 확률이
 * 과하게 설정돼도 캠페인 중반에 재고가 동나는 일이 생기지 않는 이유다.
 */
export function scheduleGateOpen(input: {
  totalQty: number;
  remainingQty: number;
  startsAt: Date;
  endsAt: Date;
  now: Date;
}): boolean {
  const { totalQty, remainingQty, startsAt, endsAt, now } = input;
  if (remainingQty <= 0) return false;

  const campaignMs = endsAt.getTime() - startsAt.getTime();
  if (campaignMs <= 0) return false;

  const elapsedRatio = clamp((now.getTime() - startsAt.getTime()) / campaignMs, 0, 1);
  return totalQty - remainingQty < totalQty * elapsedRatio;
}

/** 재고를 남은 기간에 고르게 펴면 경품 1개당 몇 ms 인가. */
function naturalWindowMs(remainingQty: number, windowStartedAt: Date, endsAt: Date): number {
  const remainingMs = endsAt.getTime() - windowStartedAt.getTime();
  if (remainingQty <= 0 || remainingMs <= 0) return MIN_WINDOW_MS;
  return remainingMs / remainingQty;
}

/**
 * 구간 길이와 그 구간의 계획량.
 *
 * 자연 구간이 하한보다 짧으면(재고 밀집) 구간을 하한까지 넓히고, 대신 계획량이 1보다
 * 커진다. 예: 3000개/30일 → 자연 14.4분 → 구간 2시간, 계획량 8.
 */
export function windowPlan(
  remainingQty: number,
  windowStartedAt: Date,
  endsAt: Date,
): { lengthMs: number; targetWins: number } {
  const natural = naturalWindowMs(remainingQty, windowStartedAt, endsAt);
  const lengthMs = Math.max(MIN_WINDOW_MS, natural);
  return { lengthMs, targetWins: Math.max(1, Math.round(lengthMs / natural)) };
}

export type WindowState = {
  windowStartedAt: Date;
  windowWinCount: number;
  windowEntryCount: number;
  paceMultiplier: number;
};

/**
 * 지난 구간들을 현재까지 밀어내면서 보정 배수를 갱신한다.
 *
 * 건너뛴 구간은 응모가 0건이었던 구간이다 — 응모가 있었다면 그때 이 함수가 돌아 구간이
 * 전진했을 것이므로. 응모가 없던 구간은 "느리다"가 아니라 "정보가 없다"는 뜻이라
 * 배수를 건드리지 않는다. 그러지 않으면 게시가 하루 밀린 것만으로 배수가 복리로
 * 치솟아, 응모가 재개되는 순간 선착순이 된다.
 */
export function rollForwardWindow(
  state: WindowState,
  input: { remainingQty: number; endsAt: Date; now: Date; baseProbability: number },
): WindowState {
  const { remainingQty, endsAt, now, baseProbability } = input;
  const { lengthMs } = windowPlan(remainingQty, state.windowStartedAt, endsAt);

  const elapsedMs = now.getTime() - state.windowStartedAt.getTime();
  // ponytail: 건너뛴 구간 전부에 현재 lengthMs 를 쓴다. 엄밀히는 구간마다 조금씩
  // 다르지만, 여러 구간을 건너뛴 상황은 당첨이 없었다는 뜻이고 그때는 재고가 줄지
  // 않아 길이 변화가 미미하다. 구간별 길이를 누적하려면 구간 이력 테이블이 필요하다.
  const elapsedWindows = Math.floor(elapsedMs / lengthMs);
  if (elapsedWindows < 1) return state;

  return {
    windowStartedAt: new Date(state.windowStartedAt.getTime() + elapsedWindows * lengthMs),
    windowWinCount: 0,
    windowEntryCount: 0,
    paceMultiplier: nextMultiplier(state, remainingQty, endsAt, baseProbability),
  };
}

function nextMultiplier(
  state: WindowState,
  remainingQty: number,
  endsAt: Date,
  baseProbability: number,
): number {
  if (state.windowEntryCount === 0) return state.paceMultiplier;

  const { targetWins } = windowPlan(remainingQty, state.windowStartedAt, endsAt);
  const factor =
    state.windowWinCount >= targetWins ? MULTIPLIER_ON_TARGET_MET : MULTIPLIER_ON_SHORTFALL;
  return clampMultiplier(state.paceMultiplier * factor, baseProbability);
}

/**
 * 보정 배수의 범위.
 *
 * 하한 1 — 설정 확률이 바닥이다. 운영자가 정한 숫자보다 낮게는 돌지 않는다.
 * 상한 — 적용 확률 50% 에서 역산한다. 적용 확률만 잘라내고 배수를 방치하면, 트래픽이
 * 돌아왔을 때 거대해진 배수를 절반씩 여러 번 깎아야 해서 과열이 오래 끌린다.
 */
export function clampMultiplier(multiplier: number, baseProbability: number): number {
  if (baseProbability <= 0) return MIN_MULTIPLIER;
  const max = Math.max(MIN_MULTIPLIER, MAX_APPLIED_PROBABILITY / baseProbability);
  return clamp(multiplier, MIN_MULTIPLIER, max);
}

export function appliedProbability(baseProbability: number, multiplier: number): number {
  return Math.min(baseProbability * multiplier, MAX_APPLIED_PROBABILITY);
}

/**
 * 남은 수량을 가중치로 상품 하나를 고른다.
 *
 * A 10 / B 30 / C 1 이면 10:30:1. 소진된 상품은 가중치 0이라 자동으로 빠지고, 수량이
 * 많아 빨리 줄어드는 상품은 가중치도 같이 내려가 종류별 소진이 함께 끝나는 쪽으로
 * 수렴한다.
 */
export function pickPrizeByRemainingQty<T extends { remainingQty: number }>(
  prizes: T[],
  random: number,
): T | null {
  const candidates = prizes.filter((prize) => prize.remainingQty > 0);
  const totalRemaining = candidates.reduce((sum, prize) => sum + prize.remainingQty, 0);
  if (totalRemaining <= 0) return null;

  let threshold = clamp(random, 0, 1) * totalRemaining;
  for (const prize of candidates) {
    threshold -= prize.remainingQty;
    if (threshold < 0) return prize;
  }
  return candidates[candidates.length - 1] ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
