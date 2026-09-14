/**
 * 재발송 스로틀 — 부수효과 없는 판정만 담는다.
 * 임시 비밀번호 생성은 어드민 화면과 규칙을 공유해야 해서 shared 에 있다.
 */
export { generateTempPassword, TEMP_PASSWORD_LENGTH } from "@jsure/shared";

/** 같은 주소로 연달아 요청하는 것을 막는 간격. */
export const RESET_THROTTLE_MS = 60_000;

export function isThrottled(
  lastRequestedAt: number | undefined,
  now: number,
  windowMs: number = RESET_THROTTLE_MS,
): boolean {
  if (lastRequestedAt === undefined) return false;
  return now - lastRequestedAt < windowMs;
}
