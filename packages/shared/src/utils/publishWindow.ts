const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 캠페인 게시(투고) 기간의 현재 상태.
 * NONE = 게시 기간 미설정(제약 없음), BEFORE = 시작 전(제출 차단),
 * OPEN = 기간 중, AFTER = 종료 후(제출은 허용하고 안내만).
 */
export type PublishWindowState = "NONE" | "BEFORE" | "OPEN" | "AFTER";

export function publishWindowState(input: {
  publishStartAt: string | Date | null;
  publishEndAt: string | Date | null;
  now: Date;
}): PublishWindowState {
  if (!input.publishStartAt || !input.publishEndAt) return "NONE";
  const startMs = new Date(input.publishStartAt).getTime();
  const endMs = new Date(input.publishEndAt).getTime();
  const nowMs = input.now.getTime();
  if (nowMs < startMs) return "BEFORE";
  if (nowMs > endMs) return "AFTER";
  return "OPEN";
}

/**
 * 게시 마감. 게시 기간이 설정돼 있으면 그 종료 시각이 마감이고,
 * 없으면 기존 상대 마감(수령일·주문일 + postingPeriodDays).
 * 게시 기간도 기준일도 없으면 마감이 없다(null).
 */
export function resolvePostingDeadline(input: {
  publishEndAt: string | Date | null;
  /** SNS·단순 리뷰 = receivedAt, 가구매 = orderSubmittedAt */
  anchorAt: string | Date | null;
  postingPeriodDays: number;
}): Date | null {
  if (input.publishEndAt) return new Date(input.publishEndAt);
  if (!input.anchorAt) return null;
  return new Date(
    new Date(input.anchorAt).getTime() + input.postingPeriodDays * DAY_MS,
  );
}
