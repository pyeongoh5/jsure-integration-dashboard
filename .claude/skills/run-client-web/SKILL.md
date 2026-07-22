---
name: run-client-web
description: >
  인플루언서 웹(apps/client-web, Vite + React)을 로컬에서 띄우고 브라우저로
  구동·검증하는 방법. UI 변경이 실제로 동작하는지 확인하거나 스크린샷을 찍어야
  할 때 사용한다. 회원가입(/signup/*) 등 게이트가 걸린 화면 진입법과, 사전
  설치된 Chromium + 글로벌 Playwright 로 페이지를 조작하는 검증 스크립트 골격을 포함.
---

# apps/client-web 실행·구동 가이드

Vite + React SPA. 포트 **5174**, `/api` 는 `localhost:3000`(api 서버)로 프록시된다.
i18n 는 빌드 타임에 `VITE_I18N_REGION`(`jp`|`kr`) 으로 리전을 고정한다(기본 `kr`).

## 1. 준비 (최초 1회)

```bash
pnpm install
# @jsure/shared 는 .js 확장자로 dist 를 참조하므로 먼저 빌드해야
# 타입체크·dev 서버에서 "Cannot find module '@jsure/shared'" 가 안 난다.
pnpm --filter @jsure/shared build
```

## 2. dev 서버 띄우기 (백그라운드)

```bash
cd apps/client-web
VITE_I18N_REGION=jp nohup pnpm dev > /tmp/vite.log 2>&1 &
# 기동까지 수 초. 확인:
sleep 5 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5174/
```

- `pnpm dev` 만 쓰면 리전이 `kr` 로 뜬다. 운영은 `jp`(일본 인플루언서 대상)이므로
  실제 문구를 보려면 `VITE_I18N_REGION=jp` 로 띄운다.
- api 를 함께 띄우지 않아도 UI/클라이언트 검증은 가능(콘솔에 `/api` 404 가 보일 수 있음 — 무해).

## 3. 게이트가 걸린 화면 진입

- **회원가입 `/signup/*`** (`/signup/line` 제외)은 `SignupShell` 의 `LineGate` 가
  `sessionStorage["lineSignupToken"]` 을 요구한다. 없으면 `/login` 으로 리다이렉트.
  → 진입 전 아무 페이지나 연 뒤 `sessionStorage.setItem("lineSignupToken", "…")` 주입.
- **로그인 필요 화면**(`/`, `/me/*`, `/applications` 등)은 `AppShell` 가드가 있으므로
  인증 컨텍스트가 필요하다(해당 화면 검증 시 별도 세션 주입/모킹 고려).

## 4. 브라우저로 구동 (사전 설치 Chromium + 글로벌 Playwright)

프로젝트에는 Playwright 가 설치돼 있지 않다. **글로벌 Playwright** 와
`/opt/pw-browsers` 의 Chromium 을 직접 쓴다. ESM(`.mjs`) 에서는 글로벌 모듈을
**절대경로 + default import** 로 불러온다(named export 불가, `NODE_PATH` 무시됨).

검증 스크립트 골격 (`drive.mjs`):

```js
import pw from "/opt/node22/lib/node_modules/playwright/index.js"; // npm root -g 로 확인
const { chromium } = pw;

// 리비전이 바뀔 수 있으니 실제 디렉터리를 찾는다: ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:5174";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

// (게이트 통과 예시) 회원가입 진입
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => sessionStorage.setItem("lineSignupToken", "e2e-test-token"));
await page.goto(`${BASE}/signup/sns`, { waitUntil: "networkidle" });

// … 조작(click/fill/blur) 후 상태 단언 + 스크린샷 …
await page.screenshot({ path: "/tmp/shot.png" });
await browser.close();
```

실행:

```bash
node drive.mjs            # 글로벌 경로를 절대경로로 import 하므로 프로젝트 밖에서도 실행 가능
```

- 모바일 폭 뷰포트(≈420px)로 확인한다 — 인플루언서 웹은 모바일 퍼스트.
- **스크린샷은 반드시 눈으로 확인**한다. 빈 화면이면 기동 실패다.
- `pageerror` 리스너로 런타임 에러를 잡는다(React Router v7 예고 경고·리소스 404 는 무해).

## 5. 정리

```bash
pkill -f vite   # dev 서버 종료
```
