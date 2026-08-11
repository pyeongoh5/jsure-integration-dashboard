import * as Sentry from "@sentry/react";
import { env } from "./env";

export function initSentry(): void {
  if (!env.VITE_SENTRY_DSN) return;

  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: env.VITE_SENTRY_RELEASE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
    sendDefaultPii: false,
  });
}

/** /login 으로 튕겨내는 모든 지점에서 호출 — 어떤 가드가 왜 튕겼는지 Sentry 에 남긴다. */
export function logAuthBounce(reason: string): void {
  Sentry.captureMessage(`auth-bounce: ${reason}`, {
    level: "warning",
    extra: { url: window.location.href },
  });
}

/** LINE 로그인 성공 경로의 각 단계 — 콜백과 튕김 사이 깜깜한 구간을 밝힌다. */
export function logAuthTrace(step: string): void {
  Sentry.captureMessage(`auth-trace: ${step}`, {
    level: "info",
    extra: { url: window.location.href },
  });
}
