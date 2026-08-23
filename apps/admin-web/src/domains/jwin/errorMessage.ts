import axios from "axios";

/**
 * jwin-api 는 실패를 `{ error: "한국어 메시지" }` 로 돌려준다.
 * axios 의 기본 Error.message 는 "Request failed with status code 400" 이라
 * 운영자에게 아무 정보도 주지 못한다 — 서버가 준 메시지를 우선 꺼낸다.
 *
 * 서버 메시지는 한국어 원문 그대로 노출한다(API 예외 메시지는 한국어 규칙).
 * i18n 은 호출부가 넘기는 `fallback` — 즉 클라이언트가 만든 문구 — 에만 적용된다.
 *
 * zod 검증 실패는 `{ error: <flatten 객체> }` 라 문자열이 아니다. 그때는 fallback 을 쓴다.
 */
export function jwinErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: unknown } | undefined;
    if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}
