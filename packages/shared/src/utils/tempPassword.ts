/**
 * 임시 비밀번호 생성기.
 *
 * 서버(메일 발송)와 어드민 화면(OWNER 의 멤버 재설정)이 같은 규칙으로 만들어야
 * "받아 적기 쉬운 글자만 쓴다"는 약속이 한쪽에서만 지켜지는 일이 없다.
 * Web Crypto 는 Node 20+ 와 브라우저 모두에 있으므로 구현 하나로 양쪽을 덮는다.
 */

/** 사람이 받아 적기 쉬운 문자만. 0/O, 1/l/I 처럼 헷갈리는 글자는 뺀다. */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXY345679";

export const TEMP_PASSWORD_LENGTH = 16;

/** 나머지 연산의 쏠림을 없애기 위해, 알파벳 길이로 나누어떨어지는 구간만 받는다. */
const ACCEPT_LIMIT = 256 - (256 % ALPHABET.length);

/** 임시 비밀번호. 서버 비밀번호 최소 길이(8)를 넉넉히 넘긴다. */
export function generateTempPassword(): string {
  let out = "";
  const buffer = new Uint8Array(TEMP_PASSWORD_LENGTH);
  while (out.length < TEMP_PASSWORD_LENGTH) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= ACCEPT_LIMIT) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === TEMP_PASSWORD_LENGTH) break;
    }
  }
  return out;
}
