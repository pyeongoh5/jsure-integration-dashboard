import axios from "axios";

/**
 * jwin-api 는 실패를 `{ error: "한국어 메시지" }` 로 돌려준다.
 *
 * axios 에러일 때:
 *   - 서버가 한국어 문자열로 `{ error: "..." }` 를 주면 그 메시지를 그대로 반환한다.
 *   - zod 검증 실패(`{ error: { fieldErrors: {} } }`) 또는 네트워크 오류는 fallback 을 반환한다.
 *
 * 일반 Error 이면 Error.message 를 반환한다(non-axios 라이브러리 에러 등).
 *
 * 그 외는 fallback 을 반환한다(예: 던져진 문자열, 객체).
 *
 * i18n 은 호출부가 넘기는 `fallback` — 즉 클라이언트가 만든 문구 — 에만 적용된다.
 */
export function jwinErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: unknown } | undefined;
    if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
    return fallback;
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}
