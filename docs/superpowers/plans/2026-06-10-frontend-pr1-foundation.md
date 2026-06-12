# PR 1 — Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 프론트엔드 앱(`apps/admin-web`, `apps/client-web`)에 새 컨벤션의 골격(폴더, 디자인 토큰, ESLint 룰, 루트 CONVENTIONS.md)을 추가한다. 기존 컴포넌트·페이지·스타일 코드는 일체 수정하지 않는다.

**Architecture:** 두 앱 각각에 `src/components/ui/`, `src/components/composites/`, `src/domains/`, `src/styles/tokens.css`를 만들고, ESLint flat config에 새 디렉터리 스코프의 import 제약 + 전역 deep-import 차단 룰을 추가한다. Vite/TS의 `@/` alias는 이미 설정돼 있어 변경 없이 사용한다.

**Tech Stack:** React 18 + Vite + TypeScript, ESLint 9 flat config (typescript-eslint v8), pnpm + turbo monorepo, CSS 변수 기반 토큰.

**Reference spec:** [docs/superpowers/specs/2026-06-10-frontend-conventions-design.md](../specs/2026-06-10-frontend-conventions-design.md)

**불변 조건 (스펙 0번):** 어떤 화면의 외관·동작도 바뀌어선 안 된다. PR 1은 신규 파일 추가 + 설정 변경만 다루며 기존 페이지·컴포넌트의 import 경로조차 건드리지 않는다.

---

## File Structure

신규/변경 파일 (총 14개 파일 신규 + 4개 파일 수정):

**루트**
- Create: `CONVENTIONS.md` — 스펙 요약 + 링크

**apps/admin-web**
- Create: `src/components/ui/.gitkeep`
- Create: `src/components/composites/.gitkeep`
- Create: `src/domains/.gitkeep`
- Create: `src/styles/tokens.css`
- Modify: `src/main.tsx` — `tokens.css` import 한 줄 추가
- Modify: `eslint.config.js` — 룰 추가

**apps/client-web** (admin-web과 동일 구성)
- Create: `src/components/ui/.gitkeep`
- Create: `src/components/composites/.gitkeep`
- Create: `src/domains/.gitkeep`
- Create: `src/styles/tokens.css`
- Modify: `src/main.tsx` — `tokens.css` import 한 줄 추가
- Modify: `eslint.config.js` — 룰 추가

**검증할 기존 설정 (수정 없음)**
- `apps/admin-web/vite.config.ts` — `@/` alias 이미 존재
- `apps/admin-web/tsconfig.app.json` — `paths.@/*` 이미 존재
- `apps/client-web/vite.config.ts` — `@/` alias 이미 존재
- `apps/client-web/tsconfig.app.json` — `paths.@/*` 이미 존재

---

## Task 1: 루트 CONVENTIONS.md 추가

**Files:**
- Create: `CONVENTIONS.md`

- [ ] **Step 1: 파일 생성**

다음 내용 그대로 작성:

````markdown
# Frontend Code Conventions

이 문서는 `apps/admin-web`과 `apps/client-web`의 코드 컨벤션을 요약한다. 전체 설계와 리팩토링 절차는 [docs/superpowers/specs/2026-06-10-frontend-conventions-design.md](docs/superpowers/specs/2026-06-10-frontend-conventions-design.md) 를 참조.

## 절대 원칙

리팩토링은 **사용자가 보는 화면의 외관·인터랙션·동작을 그대로 유지**해야 한다. 동작 동치를 증명하지 못한 변경은 머지 금지.

## 컴포넌트 3계층

- `src/components/ui/` — 원자. 도메인 모름. (Button, Input, Select, Badge, …)
- `src/components/composites/` — ui 조합. 도메인 모름. 두 곳 이상 재사용. (FormField, ConfirmDialog, PageHeader, …)
- `src/domains/<domain>/components/` — 도메인 모델을 prop으로 받음. (CampaignCard, ApplicationStepper, …)

prop 타입에 도메인 모델이 등장 → domain. ui 조합이지만 도메인 무관 → composite. 단일 HTML 요소 감싸기 → ui.

## 도메인 모듈

```
src/domains/<domain>/
  api.ts        # axios 래퍼
  hooks.ts      # react-query 훅
  utils.ts      # 순수 함수
  types.ts      # 화면 전용 타입
  components/   # 도메인 컴포넌트
  index.ts      # barrel
```

페이지는 `import { useCampaign } from "@/domains/campaign"` 만. 내부 파일 직접 import 금지.

## 스타일

- 컴포넌트 스타일은 CSS Modules (`Component.module.css`).
- 색·간격·반경·폰트 사이즈는 `src/styles/tokens.css`의 CSS 변수만 사용. 하드코딩 금지.

## 폼

`react-hook-form` + `@hookform/resolvers/zod`. 페이지/컴포넌트에서 필드별 `useState` 금지. Zod schema는 `@jsure/shared`에서 그대로 가져온다.

## 네이밍·import

- 컴포넌트 PascalCase, 훅 `useXxx` camelCase, 파일명 = export 이름.
- CSS Modules: `Component.module.css`.
- `@/` = `src/`. `../../` 두 단계 이상 금지.
- `@jsure/shared/dist/*` 직접 import 금지(빌드 산출물).

## 금지 패턴

1. 페이지에서 axios 직접 호출 — 도메인 훅 사용
2. 컴포넌트 내부 비즈니스 규칙 인라인 — utils로 이동
3. 폼 필드를 `useState`로 관리 — react-hook-form 사용
4. 하드코딩된 색/간격/폰트 사이즈 — 토큰 변수 사용
5. 도메인 모듈 내부 파일 직접 import — `index.ts` 통해서만
6. `../../` 두 단계 이상 상대 경로 — `@/` alias 사용
7. `packages/shared/dist/` 직접 수정 — `src/`만 수정 후 빌드
````

- [ ] **Step 2: 변경 사항 확인**

```bash
cat CONVENTIONS.md | head -5
```

Expected: 첫 줄에 `# Frontend Code Conventions`.

- [ ] **Step 3: Commit**

```bash
git add CONVENTIONS.md
git commit -m "docs(conventions): 루트 CONVENTIONS.md 추가 (스펙 요약)"
```

---

## Task 2: admin-web 폴더 골격 생성

**Files:**
- Create: `apps/admin-web/src/components/ui/.gitkeep`
- Create: `apps/admin-web/src/components/composites/.gitkeep`
- Create: `apps/admin-web/src/domains/.gitkeep`

- [ ] **Step 1: 폴더와 .gitkeep 생성**

```bash
cd /Users/pyoh/Desktop/project/jsure-integration-dashboard
mkdir -p apps/admin-web/src/components/ui apps/admin-web/src/components/composites apps/admin-web/src/domains
touch apps/admin-web/src/components/ui/.gitkeep apps/admin-web/src/components/composites/.gitkeep apps/admin-web/src/domains/.gitkeep
```

- [ ] **Step 2: 폴더 존재 확인**

```bash
ls apps/admin-web/src/components/ui apps/admin-web/src/components/composites apps/admin-web/src/domains
```

Expected: 각 디렉터리에 `.gitkeep` 표시.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web/src/components/ui/.gitkeep apps/admin-web/src/components/composites/.gitkeep apps/admin-web/src/domains/.gitkeep
git commit -m "chore(admin-web): ui/composites/domains 폴더 골격 생성"
```

---

## Task 3: admin-web 디자인 토큰 추가

**Files:**
- Create: `apps/admin-web/src/styles/tokens.css`
- Modify: `apps/admin-web/src/main.tsx`

토큰 값은 스펙 5.2의 예시 값(기존 코드에서 자주 등장하는 색/간격/폰트 기반). 후속 PR에서 실제 사용된 값을 추가 추출·확정한다.

- [ ] **Step 1: tokens.css 작성**

`apps/admin-web/src/styles/tokens.css`:

```css
/*
 * 디자인 토큰. 색·간격·반경·폰트 사이즈는 이 변수를 통해서만 사용한다.
 * 새 값을 쓰려면 토큰을 먼저 추가하고 사용한다.
 */
:root {
  /* color */
  --color-primary: #1d6cf3;
  --color-primary-hover: #2563eb;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-text-subtle: #9ca3af;
  --color-border: #e5e7eb;
  --color-border-strong: #d1d5db;
  --color-bg: #ffffff;
  --color-bg-subtle: #f9fafb;
  --color-bg-muted: #f3f4f6;
  --color-danger: #ef4444;
  --color-danger-bg: #fee2e2;
  --color-danger-text: #991b1b;
  --color-warn: #f59e0b;
  --color-warn-bg: #fef3c7;
  --color-warn-text: #92400e;
  --color-ok: #10b981;
  --color-ok-bg: #d1fae5;
  --color-ok-text: #065f46;

  /* sns brand */
  --color-sns-instagram: #e1306c;
  --color-sns-tiktok: #111827;
  --color-sns-x: #111827;
  --color-sns-youtube: #ff0000;

  /* spacing (4px scale) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 999px;

  /* font */
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-md: 13px;
  --font-size-base: 14px;
  --font-size-lg: 15px;
  --font-size-xl: 17px;
  --font-size-2xl: 22px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* shadow */
  --shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.04);
  --shadow-md: 0 6px 18px rgba(17, 24, 39, 0.06);
}
```

- [ ] **Step 2: main.tsx에 import 한 줄 추가**

먼저 현재 `apps/admin-web/src/main.tsx` 첫 부분을 읽어 기존 import를 파악한다.

```bash
head -10 apps/admin-web/src/main.tsx
```

기존 import 블록 가장 첫 줄에 다음을 추가한다(정확한 위치: 다른 어떤 stylesheet/CSS import보다도 위. 다른 CSS가 없으면 첫 import 라인 다음에 둔다):

```ts
import "./styles/tokens.css";
```

`Edit` 도구로 처리. 기존 코드 구조 보존.

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter @jsure/admin-web build
```

Expected: 빌드 성공. `dist/` 산출. 토큰이 정의됐지만 아직 사용처가 없어 그대로 통과.

- [ ] **Step 4: 외관 회귀 없음 확인**

`pnpm dev:admin`을 띄워 주요 페이지(Overview, Campaigns 목록, Drafts, Payouts)를 열고 시각 회귀가 없는지 본다. tokens.css는 `:root` 변수만 정의하고 어떤 셀렉터에도 영향을 주지 않으므로 시각 변화는 없어야 한다.

회귀가 발견되면 toks.css의 변수 이름이 우연히 기존 코드의 변수와 충돌하지 않는지 확인하고 수정한다.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web/src/styles/tokens.css apps/admin-web/src/main.tsx
git commit -m "feat(admin-web): 디자인 토큰 추가 (src/styles/tokens.css)"
```

---

## Task 4: admin-web ESLint 룰 추가

**Files:**
- Modify: `apps/admin-web/eslint.config.js`

세 가지 룰을 추가한다:
1. `@jsure/shared/dist/*` 직접 import 차단 (전역)
2. `@/domains/*/api`, `@/domains/*/hooks` 등 도메인 모듈 내부 직접 import 차단 (전역) — PR 1에서는 domains 폴더가 비어 위반 0
3. `../../*` 등 두 단계 이상 상대 경로 차단 — **신규 디렉터리(`src/components/ui`, `src/components/composites`, `src/domains`)에만** 적용. 기존 코드는 영향 없음.

- [ ] **Step 1: eslint.config.js 수정**

`apps/admin-web/eslint.config.js` 전체를 다음으로 교체한다.

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const SHARED_RESTRICTED_PATTERNS = [
  {
    group: ["@jsure/shared/dist", "@jsure/shared/dist/*"],
    message:
      "@jsure/shared 의 dist 경로를 직접 import 하지 마세요. 패키지 루트('@jsure/shared')에서 가져옵니다.",
  },
  {
    group: [
      "@/domains/*/api",
      "@/domains/*/api/*",
      "@/domains/*/hooks",
      "@/domains/*/hooks/*",
      "@/domains/*/utils",
      "@/domains/*/utils/*",
      "@/domains/*/types",
      "@/domains/*/types/*",
      "@/domains/*/components/*",
    ],
    message:
      "도메인 모듈의 내부 파일을 직접 import 하지 마세요. '@/domains/<domain>'(barrel)을 사용합니다.",
  },
];

const PARENT_RELATIVE_PATTERNS = [
  {
    group: ["../../*", "../../../*", "../../../../*"],
    message:
      "두 단계 이상 상대 경로(../../)는 금지입니다. '@/' alias 를 사용하세요.",
  },
];

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".turbo"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: SHARED_RESTRICTED_PATTERNS },
      ],
    },
  },
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/composites/**/*.{ts,tsx}",
      "src/domains/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...SHARED_RESTRICTED_PATTERNS,
            ...PARENT_RELATIVE_PATTERNS,
          ],
        },
      ],
    },
  },
);
```

- [ ] **Step 2: lint 실행하여 통과 확인**

```bash
pnpm --filter @jsure/admin-web lint
```

Expected: PASS. 위반 0.

기존 코드는 `@jsure/shared/dist/*`나 도메인 모듈 내부 import를 하지 않으므로 (스펙 9번 금지 패턴은 새 컨벤션이므로 기존 코드엔 자연히 없음) 위반이 없어야 한다.

만약 위반이 보고되면:
- `@jsure/shared/dist` 패턴 위반: `import ... from "@jsure/shared"` 인지 확인. dist 경로를 명시한 코드는 즉시 수정 (드물지만 PR 1에서 처리한다 — 동작 동치 유지).
- 위 외 메시지: 본 PR 스코프 밖이므로 rule 패턴이 잘못된 것. 패턴을 다시 점검.

- [ ] **Step 3: typecheck 통과 확인**

```bash
pnpm --filter @jsure/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-web/eslint.config.js
git commit -m "chore(admin-web): ESLint 에 도메인 모듈/dist/상대경로 import 룰 추가"
```

---

## Task 5: admin-web alias 설정 점검 (수정 없음 확인)

**Files:**
- Verify: `apps/admin-web/vite.config.ts`, `apps/admin-web/tsconfig.app.json`

- [ ] **Step 1: vite alias 확인**

```bash
grep -A2 "alias" apps/admin-web/vite.config.ts
```

Expected 출력 포함:
```
"@": path.resolve(__dirname, "./src"),
```

확인되면 변경 불필요.

- [ ] **Step 2: tsconfig paths 확인**

```bash
grep -A1 "paths" apps/admin-web/tsconfig.app.json
```

Expected 출력 포함:
```
"@/*": ["src/*"]
```

확인되면 변경 불필요. 두 설정이 일치한다.

- [ ] **Step 3: 빠진 경우 추가**

만약 둘 중 하나라도 빠져 있으면 추가한다. 본 프로젝트는 현재 둘 다 설정돼 있어 일반적으로 이 단계는 스킵된다. (변경이 있었다면 별도 commit: `chore(admin-web): @/ alias 설정 보강`)

---

## Task 6: client-web 폴더 골격 생성

Task 2와 동일하나 경로만 다름.

**Files:**
- Create: `apps/client-web/src/components/ui/.gitkeep`
- Create: `apps/client-web/src/components/composites/.gitkeep`
- Create: `apps/client-web/src/domains/.gitkeep`

- [ ] **Step 1: 폴더와 .gitkeep 생성**

```bash
cd /Users/pyoh/Desktop/project/jsure-integration-dashboard
mkdir -p apps/client-web/src/components/ui apps/client-web/src/components/composites apps/client-web/src/domains
touch apps/client-web/src/components/ui/.gitkeep apps/client-web/src/components/composites/.gitkeep apps/client-web/src/domains/.gitkeep
```

- [ ] **Step 2: 존재 확인**

```bash
ls apps/client-web/src/components/ui apps/client-web/src/components/composites apps/client-web/src/domains
```

Expected: 각 디렉터리에 `.gitkeep`.

- [ ] **Step 3: Commit**

```bash
git add apps/client-web/src/components/ui/.gitkeep apps/client-web/src/components/composites/.gitkeep apps/client-web/src/domains/.gitkeep
git commit -m "chore(client-web): ui/composites/domains 폴더 골격 생성"
```

---

## Task 7: client-web 디자인 토큰 추가

**Files:**
- Create: `apps/client-web/src/styles/tokens.css`
- Modify: `apps/client-web/src/main.tsx`

admin-web과 동일한 토큰을 우선 적용한다. 추후 모바일 클라이언트 고유 값(예: 더 큰 라운드, 다른 헤로 색)이 누적되면 분기한다. 현 단계에선 같은 변수 셋으로 시작한다.

- [ ] **Step 1: tokens.css 작성**

`apps/client-web/src/styles/tokens.css` — Task 3 Step 1의 내용을 그대로 사용. (apps/admin-web/src/styles/tokens.css 와 동일)

```bash
cp apps/admin-web/src/styles/tokens.css apps/client-web/src/styles/tokens.css
```

또는 수동 복제. 동일 내용이어야 한다.

- [ ] **Step 2: main.tsx import 추가**

```bash
head -10 apps/client-web/src/main.tsx
```

Task 3 Step 2와 동일 방식으로 다음 한 줄을 다른 CSS import보다 위에 추가:

```ts
import "./styles/tokens.css";
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm --filter @jsure/client-web build
```

Expected: PASS.

- [ ] **Step 4: 외관 회귀 없음 확인**

`pnpm dev:client`로 인플루언서 웹 주요 화면(Browse, CampaignDetail, Applications, Me) 시각 회귀 없음 확인.

- [ ] **Step 5: Commit**

```bash
git add apps/client-web/src/styles/tokens.css apps/client-web/src/main.tsx
git commit -m "feat(client-web): 디자인 토큰 추가 (src/styles/tokens.css)"
```

---

## Task 8: client-web ESLint 룰 추가

Task 4와 동일 룰. 경로만 client-web.

**Files:**
- Modify: `apps/client-web/eslint.config.js`

- [ ] **Step 1: eslint.config.js 수정**

`apps/client-web/eslint.config.js` 전체를 다음으로 교체한다. (Task 4 Step 1 내용과 동일)

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const SHARED_RESTRICTED_PATTERNS = [
  {
    group: ["@jsure/shared/dist", "@jsure/shared/dist/*"],
    message:
      "@jsure/shared 의 dist 경로를 직접 import 하지 마세요. 패키지 루트('@jsure/shared')에서 가져옵니다.",
  },
  {
    group: [
      "@/domains/*/api",
      "@/domains/*/api/*",
      "@/domains/*/hooks",
      "@/domains/*/hooks/*",
      "@/domains/*/utils",
      "@/domains/*/utils/*",
      "@/domains/*/types",
      "@/domains/*/types/*",
      "@/domains/*/components/*",
    ],
    message:
      "도메인 모듈의 내부 파일을 직접 import 하지 마세요. '@/domains/<domain>'(barrel)을 사용합니다.",
  },
];

const PARENT_RELATIVE_PATTERNS = [
  {
    group: ["../../*", "../../../*", "../../../../*"],
    message:
      "두 단계 이상 상대 경로(../../)는 금지입니다. '@/' alias 를 사용하세요.",
  },
];

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".turbo"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: SHARED_RESTRICTED_PATTERNS },
      ],
    },
  },
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/composites/**/*.{ts,tsx}",
      "src/domains/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...SHARED_RESTRICTED_PATTERNS,
            ...PARENT_RELATIVE_PATTERNS,
          ],
        },
      ],
    },
  },
);
```

- [ ] **Step 2: lint / typecheck 통과 확인**

```bash
pnpm --filter @jsure/client-web lint
pnpm --filter @jsure/client-web typecheck
```

Expected: 둘 다 PASS.

만약 `@jsure/shared/dist` 패턴 위반이 발견되면:
- 해당 파일을 찾아 `import ... from "@jsure/shared"` 로 수정. (동작 동치 유지)
- 그 외 위반 메시지는 룰 패턴 점검.

- [ ] **Step 3: Commit**

```bash
git add apps/client-web/eslint.config.js
git commit -m "chore(client-web): ESLint 에 도메인 모듈/dist/상대경로 import 룰 추가"
```

---

## Task 9: client-web alias 설정 점검

Task 5와 동일 방식.

- [ ] **Step 1: vite alias 확인**

```bash
grep -A2 "alias" apps/client-web/vite.config.ts
```

Expected: `"@": path.resolve(__dirname, "./src")` 포함.

- [ ] **Step 2: tsconfig paths 확인**

```bash
grep -A1 "paths" apps/client-web/tsconfig.app.json
```

Expected: `"@/*": ["src/*"]` 포함.

본 프로젝트는 둘 다 설정돼 있어 변경 불필요.

---

## Task 10: 전체 통합 검증 + PR 정리

루트에서 한 번에 전 워크스페이스 빌드/타입체크/린트를 돌려 회귀 없음을 확인한다.

- [ ] **Step 1: 전체 lint**

```bash
pnpm lint
```

Expected: 모든 워크스페이스 PASS. `--max-warnings=0` 조건이므로 warning도 없어야 한다.

- [ ] **Step 2: 전체 typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: 전체 build**

```bash
pnpm build
```

Expected: PASS. admin-web/client-web/api/shared 모두 정상 빌드.

- [ ] **Step 4: 화면 회귀 수동 확인**

```bash
pnpm dev:admin
```

브라우저에서 다음 화면을 차례로 열어 외관·인터랙션 회귀 없음 확인:
- [ ] Overview
- [ ] Campaigns 목록 / 상세 / 수정
- [ ] Applicants
- [ ] Drafts
- [ ] Payouts
- [ ] Influencers
- [ ] Notices
- [ ] Team

이어서:

```bash
pnpm dev:client
```

- [ ] Login / Signup 전체 단계
- [ ] Browse
- [ ] Campaign Detail
- [ ] Apply
- [ ] Applications 목록 / 상세
- [ ] Me / Profile / SNS / Bank / Address

회귀 발견 시 즉시 revert 후 원인 파악. tokens.css는 `:root` 변수만 정의하고 import 추가 외 변경이 없으므로 정상적으로는 회귀가 없어야 한다.

- [ ] **Step 5: 최종 정리 commit (필요 시)**

이전 태스크에서 모두 commit 했으므로 추가 변경이 없으면 생략. 추가 발견 사항이 있다면 별도 commit.

- [ ] **Step 6: 로그 확인**

```bash
git log --oneline -10
```

Expected (순서대로):
- `chore(client-web): ESLint 에 도메인 모듈/dist/상대경로 import 룰 추가`
- `feat(client-web): 디자인 토큰 추가 (src/styles/tokens.css)`
- `chore(client-web): ui/composites/domains 폴더 골격 생성`
- `chore(admin-web): ESLint 에 도메인 모듈/dist/상대경로 import 룰 추가`
- `feat(admin-web): 디자인 토큰 추가 (src/styles/tokens.css)`
- `chore(admin-web): ui/composites/domains 폴더 골격 생성`
- `docs(conventions): 루트 CONVENTIONS.md 추가 (스펙 요약)`

총 7개 커밋. PR 생성 시 이 시퀀스가 그대로 보여야 한다.

- [ ] **Step 7: PR 생성**

원격 브랜치 푸시 + PR 생성. PR 제목:

```
chore(frontend): PR 1 — 코드 컨벤션 foundation (CONVENTIONS, tokens, ESLint, 폴더 골격)
```

PR 본문:

```
스펙: docs/superpowers/specs/2026-06-10-frontend-conventions-design.md
플랜: docs/superpowers/plans/2026-06-10-frontend-pr1-foundation.md

본 PR 변경 사항:
- 루트 CONVENTIONS.md
- apps/{admin,client}-web/src/components/{ui,composites}/ 와 src/domains/ 빈 폴더 + .gitkeep
- apps/{admin,client}-web/src/styles/tokens.css + main.tsx 에서 import
- apps/{admin,client}-web/eslint.config.js 에 dist/도메인내부/상대경로 import 룰

기존 컴포넌트·페이지·스타일 코드는 일체 수정하지 않음.
외관·동작 회귀 없음 — Overview, Campaigns, Drafts, Payouts, Browse, CampaignDetail, Applications, Me 페이지 수동 워크스루 완료.

후속 PR (별도 plan):
- PR 2: UI 원자 컴포넌트 구현
- PR 3: Composites
- PR 4: 도메인 모듈
- PR 5: 폼 마이그레이션
- PR 6: 페이지/스타일 정리
```

---

## 완료 정의

- [ ] 7개 커밋이 위 순서대로 main에 머지 가능한 상태로 누적됨
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` 모두 PASS
- [ ] admin-web, client-web의 모든 화면 시각·동작 회귀 없음
- [ ] `apps/admin-web/src/components/ui`, `composites`, `apps/admin-web/src/domains` 폴더가 존재(빈 상태 + .gitkeep)
- [ ] 동일하게 client-web 폴더 존재
- [ ] `apps/admin-web/src/styles/tokens.css`, `apps/client-web/src/styles/tokens.css` 존재 및 main.tsx 에서 import됨
- [ ] 두 앱 모두 `eslint.config.js`에 `no-restricted-imports` 룰이 추가됨
- [ ] 루트에 `CONVENTIONS.md` 존재
