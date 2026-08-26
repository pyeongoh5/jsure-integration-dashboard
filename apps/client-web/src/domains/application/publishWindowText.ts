import { publishWindowState, resolvePostingDeadline } from "@jsure/shared";
import type { PublishWindowState } from "@jsure/shared";
import { t } from "@i18n";

export interface PublishWindowText {
  state: PublishWindowState;
  /** "9月1日" — state 가 NONE 이면 빈 문자열 */
  startText: string;
  /** "9月10日" — state 가 NONE 이면 빈 문자열 */
  endText: string;
  /** 마감까지 남은 일수. 마감이 없으면 null */
  remainingDays: number | null;
}

function formatMonthDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? "0");
  return `${part("month")}${t("application.dateFormat.monthSuffix")}${part("day")}${t("application.dateFormat.daySuffix")}`;
}

/**
 * 게시 기간 상태와 표시 문구. 게시 기간이 없으면 state 가 NONE 이고,
 * 화면은 기존 "수령 후 N일" 문구를 그대로 쓴다.
 */
export function publishWindowText(input: {
  publishStartAt: string | null;
  publishEndAt: string | null;
  anchorAt: string | null;
  postingPeriodDays: number;
  now?: Date;
}): PublishWindowText {
  const now = input.now ?? new Date();
  const state = publishWindowState({
    publishStartAt: input.publishStartAt,
    publishEndAt: input.publishEndAt,
    now,
  });
  const deadline = resolvePostingDeadline({
    publishEndAt: input.publishEndAt,
    anchorAt: input.anchorAt,
    postingPeriodDays: input.postingPeriodDays,
  });
  const remainingDays = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  if (state === "NONE") {
    return { state, startText: "", endText: "", remainingDays };
  }
  return {
    state,
    startText: input.publishStartAt
      ? formatMonthDay(new Date(input.publishStartAt))
      : "",
    endText: input.publishEndAt
      ? formatMonthDay(new Date(input.publishEndAt))
      : "",
    remainingDays,
  };
}
