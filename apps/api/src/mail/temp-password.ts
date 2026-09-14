import { randomInt } from "crypto";

/**
 * 임시 비밀번호 생성기와 재발송 스로틀 — 부수효과 없는 판정만 담는다.
 */

/** 사람이 받아 적기 쉬운 문자만. 0/O, 1/l/I 처럼 헷갈리는 글자는 뺀다. */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXY345679";

export const TEMP_PASSWORD_LENGTH = 16;

/** 임시 비밀번호. 서버 비밀번호 최소 길이(8)를 넉넉히 넘긴다. */
export function generateTempPassword(): string {
  let out = "";
  for (let index = 0; index < TEMP_PASSWORD_LENGTH; index += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

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
