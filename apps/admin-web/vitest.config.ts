import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 순수 함수 전용 러너. jsdom·testing-library 는 도입하지 않는다(설계 §6).
 * vite.config.ts 를 재사용하지 않는 이유: sentry 플러그인과 dev 프록시가 테스트에 불필요하다.
 * `@i18n` alias 는 순수 함수가 AdminTranslationKey 타입을 참조할 때 필요하다.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@i18n": path.resolve(__dirname, "../../i18n"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
