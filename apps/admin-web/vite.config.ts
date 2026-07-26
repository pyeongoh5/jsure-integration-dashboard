import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "node:path";

export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@i18n": path.resolve(__dirname, "../../i18n"),
    },
  },
  server: {
    // 0.0.0.0 바인딩 — 같은 Wi-Fi 의 폰에서 확인할 수 있게 한다.
    host: true,
    port: 5173,
    // 개발 서버 전용. 폰에서 확인할 때 쓰는 터널 도메인을 허용한다
    // (Vite 5.4.12+ 는 알 수 없는 Host 헤더를 차단한다).
    allowedHosts: [
      ".trycloudflare.com",
      ".ngrok-free.app",
      ".ngrok-free.dev",
      ".ngrok.io",
    ],
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // J-WIN API (@jsure/jwin-api). dev 에서 CORS 없이 붙기 위한 프록시.
      // 운영에서는 VITE_JWIN_API_BASE_URL 로 Railway 도메인을 직접 지정한다.
      "/jwin-api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/jwin-api/, ""),
      },
    },
  },
});
