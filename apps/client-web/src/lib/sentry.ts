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
