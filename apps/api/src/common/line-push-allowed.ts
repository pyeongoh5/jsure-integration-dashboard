/**
 * 프로덕션 외 환경에서 실제 LINE 발송을 막는 단일 판단 지점.
 *
 * 개발/스테이징이 프로덕션 채널 토큰을 들고 있으면 그 환경의 크론과 관리자
 * 액션이 실제 인플루언서에게 메시지를 보낸다(리마인더가 하루 두 번 도착한 사례).
 * 개발 중 실제 발송이 필요하면 LINE_PUSH_ENABLED=true 로 명시적으로 연다.
 */
export function linePushAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return true;
  return env.LINE_PUSH_ENABLED === "true";
}
