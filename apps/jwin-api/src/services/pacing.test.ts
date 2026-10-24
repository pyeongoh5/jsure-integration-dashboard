import { describe, expect, it } from 'vitest';
import {
  MAX_APPLIED_PROBABILITY,
  MIN_WINDOW_MS,
  appliedProbability,
  clampMultiplier,
  pickPrizeByRemainingQty,
  rollForwardWindow,
  scheduleGateOpen,
  windowPlan,
  type WindowState,
} from './pacing';

const HOUR = 60 * 60 * 1000;
const START = new Date('2026-11-01T00:00:00Z');
const END = new Date('2026-12-01T00:00:00Z'); // 30일

/**
 * mulberry32 — 시드 고정 난수. Math.random 대신 분포를 재현 가능하게 본다.
 * 단순 LCG 는 격자 구조 때문에 가중 추첨 분포가 수 %씩 치우쳐 분포 검증을 못 한다.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

describe('수량 비례 상품 선택', () => {
  const prizes = () => [
    { name: 'A', remainingQty: 10 },
    { name: 'B', remainingQty: 30 },
    { name: 'C', remainingQty: 1 },
  ];

  it('남은 수량 비례로 수렴한다 (10:30:1)', () => {
    const random = seededRandom(42);
    const picked = { A: 0, B: 0, C: 0 };
    const rounds = 60_000;
    for (let i = 0; i < rounds; i += 1) {
      const prize = pickPrizeByRemainingQty(prizes(), random());
      if (prize?.name === 'A') picked.A += 1;
      if (prize?.name === 'B') picked.B += 1;
      if (prize?.name === 'C') picked.C += 1;
    }
    expect(picked.A / rounds).toBeCloseTo(10 / 41, 2);
    expect(picked.B / rounds).toBeCloseTo(30 / 41, 2);
    expect(picked.C / rounds).toBeCloseTo(1 / 41, 2);
  });

  it('소진된 상품은 절대 선택하지 않는다', () => {
    const withEmpty = [
      { name: 'A', remainingQty: 0 },
      { name: 'B', remainingQty: 5 },
    ];
    const random = seededRandom(7);
    for (let i = 0; i < 500; i += 1) {
      expect(pickPrizeByRemainingQty(withEmpty, random())?.name).toBe('B');
    }
  });

  it('남은 재고가 전혀 없으면 null', () => {
    expect(pickPrizeByRemainingQty([{ remainingQty: 0 }], 0.5)).toBeNull();
    expect(pickPrizeByRemainingQty([], 0.5)).toBeNull();
  });

  it('난수 경계(0, 1)에서도 상품을 돌려준다', () => {
    expect(pickPrizeByRemainingQty(prizes(), 0)?.name).toBe('A');
    expect(pickPrizeByRemainingQty(prizes(), 1)?.name).toBe('C');
  });
});

describe('누적 스케줄 게이트', () => {
  const gate = (remainingQty: number, now: Date) =>
    scheduleGateOpen({ totalQty: 360, remainingQty, startsAt: START, endsAt: END, now });

  const atDay = (day: number) => new Date(START.getTime() + day * 24 * HOUR);

  it('계획선에 도달하면 닫힌다', () => {
    // 10일차 계획량 120개. 정확히 120개 나갔으면 더 내보내지 않는다.
    expect(gate(240, atDay(10))).toBe(false);
    expect(gate(241, atDay(10))).toBe(true);
  });

  it('뒤처진 만큼은 몰아서 내보낼 수 있다', () => {
    // 10일차에 100개만 나갔으면 계획선(120)까지 20개 여유.
    expect(gate(260, atDay(10))).toBe(true);
  });

  it('재고가 없거나 캠페인이 시작 전이면 닫힌다', () => {
    expect(gate(0, atDay(10))).toBe(false);
    expect(gate(360, START)).toBe(false);
  });
});

describe('구간 길이와 계획량', () => {
  it('360개/30일 → 2시간, 계획량 1', () => {
    const plan = windowPlan(360, START, END);
    expect(plan.lengthMs).toBe(2 * HOUR);
    expect(plan.targetWins).toBe(1);
  });

  it('재고가 밀집하면 구간은 하한에 걸리고 계획량이 커진다 (3000개/30일)', () => {
    const plan = windowPlan(3000, START, END);
    expect(plan.lengthMs).toBe(MIN_WINDOW_MS);
    expect(plan.targetWins).toBe(8); // 2시간 / 14.4분
  });

  it('재고가 희소하면 구간이 하루를 넘어도 그대로 성립한다 (10개/30일)', () => {
    expect(windowPlan(10, START, END).lengthMs).toBe(72 * HOUR);
  });
});

describe('보정 배수', () => {
  const base = 0.005;
  const state = (overrides: Partial<WindowState> = {}): WindowState => ({
    windowStartedAt: START,
    windowWinCount: 0,
    windowEntryCount: 100,
    paceMultiplier: 1,
    ...overrides,
  });
  const roll = (current: WindowState, hoursLater: number) =>
    rollForwardWindow(current, {
      remainingQty: 360,
      endsAt: END,
      now: new Date(current.windowStartedAt.getTime() + hoursLater * HOUR),
      baseProbability: base,
    });

  it('구간 안에서는 아무것도 바뀌지 않는다', () => {
    const current = state();
    expect(roll(current, 1)).toBe(current);
  });

  it('계획량 미달이면 ×1.5 로 오른다', () => {
    let current = state();
    for (const expected of [1.5, 2.25, 3.375]) {
      current = roll(current, 2);
      expect(current.paceMultiplier).toBeCloseTo(expected, 6);
      current = { ...current, windowEntryCount: 100 };
    }
  });

  it('계획량을 채우면 ×0.5 로 내려가 하한 1 에서 멈춘다', () => {
    let current = state({ paceMultiplier: 3.375, windowWinCount: 1 });
    current = roll(current, 2);
    expect(current.paceMultiplier).toBeCloseTo(1.6875, 6);

    current = roll({ ...current, windowEntryCount: 100, windowWinCount: 1 }, 2);
    expect(current.paceMultiplier).toBe(1);

    current = roll({ ...current, windowEntryCount: 100, windowWinCount: 1 }, 2);
    expect(current.paceMultiplier).toBe(1);
  });

  it('응모가 0건이었던 구간은 배수를 건드리지 않는다', () => {
    const current = roll(state({ windowEntryCount: 0, paceMultiplier: 2.25 }), 2);
    expect(current.paceMultiplier).toBe(2.25);
    expect(current.windowStartedAt.getTime()).toBe(START.getTime() + 2 * HOUR);
  });

  it('응모 없이 여러 구간을 건너뛰어도 배수는 한 번만 평가된다', () => {
    // 12구간(24시간)을 통째로 건너뛰어도 복리로 치솟지 않는다.
    const current = roll(state({ windowEntryCount: 0 }), 24);
    expect(current.paceMultiplier).toBe(1);
    expect(current.windowStartedAt.getTime()).toBe(START.getTime() + 24 * HOUR);
  });

  it('배수 상한은 적용 확률 50% 에서 역산된다', () => {
    expect(clampMultiplier(1e6, base)).toBe(MAX_APPLIED_PROBABILITY / base);
    expect(appliedProbability(base, clampMultiplier(1e6, base))).toBe(MAX_APPLIED_PROBABILITY);
  });

  it('기준 확률이 0이면 배수는 하한에 고정된다', () => {
    expect(clampMultiplier(10, 0)).toBe(1);
    expect(appliedProbability(0, 1)).toBe(0);
  });
});
