# Import Alias (apps/api 런타임 마무리) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/api`에서 TS `paths`로 정의된 `@/*` alias를 nest build(webpack), `node dist/main.js`, `nest start --watch`, `jest` 모든 환경에서 동작시킨다.

**Architecture:** webpack 빌드 시점에 `tsconfig-paths-webpack-plugin`으로 alias를 실제 상대경로로 인라인 → dist에 alias 흔적 0. jest는 `moduleNameMapper`로 동일하게 매핑. `apps/admin-web`, `apps/client-web`, `packages/shared`는 변경 없음.

**Tech Stack:** NestJS 10 + webpack(nest-cli 내장) + jest + ts-jest. Node 20, pnpm 9, turbo.

**Repository note:** 작업 트리가 git 저장소가 아니다 (`git rev-parse --is-inside-work-tree` 실패 예상). 따라서 각 Task의 "Commit" 스텝은 git이 초기화되어 있을 때만 실행한다 — 없으면 스킵하고 다음 Task로 넘어간다.

---

## File Structure

생성:
- `apps/api/webpack.config.js` — nest CLI가 요구하는 함수 형태의 webpack 설정. 역할 단 하나: 기본 옵션에 `tsconfig-paths-webpack-plugin`을 끼워넣는다.

수정:
- `apps/api/nest-cli.json` — `compilerOptions.webpack: true`, `webpackConfigPath: "webpack.config.js"` 추가.
- `apps/api/package.json` — devDependency `tsconfig-paths-webpack-plugin` 추가, `jest` 키(전체 jest config 인라인) 추가.
- `apps/api/src/app.module.ts` — 검증 목적으로 import 1줄을 `@/...` 형태로 변환 (롤백하지 않음, 동작 증거).

손대지 않음:
- `apps/admin-web/**`, `apps/client-web/**`, `packages/**`

---

## Task 1: tsconfig-paths-webpack-plugin devDep 추가

**Files:**
- Modify: `apps/api/package.json` (devDependencies 블록)

- [ ] **Step 1: package.json에 devDep 추가**

`apps/api/package.json`의 `devDependencies` 객체에 다음 한 줄을 추가한다 (알파벳 순 유지: `tsconfig-paths` 바로 아래):

```json
    "tsconfig-paths": "^4.2.0",
    "tsconfig-paths-webpack-plugin": "^4.1.0",
```

- [ ] **Step 2: 설치**

작업 디렉토리: 모노레포 루트.

```bash
pnpm install
```

Expected:
- `apps/api/node_modules/tsconfig-paths-webpack-plugin` 디렉토리가 생긴다.
- 종료코드 0.

확인 명령:
```bash
ls apps/api/node_modules/tsconfig-paths-webpack-plugin/package.json
```
Expected: 파일 경로가 출력된다.

- [ ] **Step 3: Commit (git repo인 경우만)**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add tsconfig-paths-webpack-plugin devDep"
```

git이 초기화되어있지 않으면 스킵.

---

## Task 2: webpack.config.js 생성

**Files:**
- Create: `apps/api/webpack.config.js`

- [ ] **Step 1: 파일 생성**

`apps/api/webpack.config.js`:

```js
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    plugins: [
      ...((options.resolve && options.resolve.plugins) || []),
      new TsconfigPathsPlugin({ configFile: "tsconfig.json" }),
    ],
  },
});
```

이 설정은 nest CLI가 넘겨주는 기본 webpack `options`에 `TsconfigPathsPlugin`만 추가한다. 기존 resolve plugin이 있으면 보존한다.

- [ ] **Step 2: 구문 확인**

```bash
node -e "require('./apps/api/webpack.config.js')(\
  { resolve: { plugins: [] } }\
); console.log('ok')"
```

Expected: `ok` 출력. 종료코드 0.

(이 시점에는 `nest-cli.json`이 아직 webpack을 활성화하지 않았으므로 nest build에는 영향 없음.)

- [ ] **Step 3: Commit (git repo인 경우만)**

```bash
git add apps/api/webpack.config.js
git commit -m "feat(api): add webpack config wiring tsconfig-paths plugin"
```

---

## Task 3: nest-cli.json에서 webpack 활성화

**Files:**
- Modify: `apps/api/nest-cli.json`

- [ ] **Step 1: 변경 전 상태 확인**

`apps/api/nest-cli.json`의 현재 내용은 다음과 같아야 한다:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": false,
    "watchAssets": true
  }
}
```

- [ ] **Step 2: webpack 옵션 추가**

`compilerOptions` 블록을 다음으로 교체한다:

```json
  "compilerOptions": {
    "deleteOutDir": false,
    "watchAssets": true,
    "webpack": true,
    "webpackConfigPath": "webpack.config.js"
  }
```

전체 파일은 다음과 같아진다:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": false,
    "watchAssets": true,
    "webpack": true,
    "webpackConfigPath": "webpack.config.js"
  }
}
```

- [ ] **Step 3: Commit (git repo인 경우만)**

```bash
git add apps/api/nest-cli.json
git commit -m "feat(api): enable webpack build with custom config"
```

---

## Task 4: build/런타임 검증 — 실제 import 변환

**Files:**
- Modify: `apps/api/src/app.module.ts`

이 Task에서는 import 1줄을 `@/...`로 바꾸고, 빌드 → 실행이 정상인지 확인한다. 통과하지 못하면 Task 2/3 설정에 문제가 있는 것이므로 먼저 디버깅한다.

- [ ] **Step 1: 변환 전 typecheck (베이스라인)**

```bash
pnpm --filter @jsure/api typecheck
```

Expected: 종료코드 0. (이미 통과해야 하는 상태)

- [ ] **Step 2: app.module.ts의 import 1줄을 alias로 변환**

`apps/api/src/app.module.ts`에서 다음 줄:

```ts
import { HealthModule } from "./health/health.module";
```

을 다음으로 교체:

```ts
import { HealthModule } from "@/health/health.module";
```

(다른 import는 건드리지 않는다 — 한 줄만 바꿔서 alias 동작 여부를 정확히 격리한다.)

- [ ] **Step 3: typecheck 재실행**

```bash
pnpm --filter @jsure/api typecheck
```

Expected: 종료코드 0. 실패 시 `tsconfig.json`의 `paths` 설정 점검 (이미 정의되어 있음).

- [ ] **Step 4: build 실행**

```bash
pnpm --filter @jsure/api build
```

Expected:
- 종료코드 0.
- 출력 끝에 `Successfully compiled` 등 nest 빌드 완료 메시지.
- `apps/api/dist/main.js`가 생성된다.

확인 명령:
```bash
ls apps/api/dist/main.js
```
Expected: 파일 경로 출력.

- [ ] **Step 5: 번들에 alias가 남지 않았는지 확인**

```bash
grep -c '"@/' apps/api/dist/main.js || echo "no matches"
```

Expected: `0` 또는 `no matches`. 만약 matches가 있다면 `tsconfig-paths-webpack-plugin`이 제대로 hooks 되지 않은 것 → Task 2/3 디버깅.

- [ ] **Step 6: 부팅 검증 (포트가 비어있을 때만)**

```bash
PORT=3399 node apps/api/dist/main.js &
APIPID=$!
sleep 3
curl -fsS http://localhost:3399/api/health || echo "health endpoint check skipped/failed"
kill $APIPID 2>/dev/null || true
wait $APIPID 2>/dev/null || true
```

Expected:
- 백그라운드 부팅 후 `Bootstrap` 로그에 `API ready on http://localhost:3399/api` 가 보인다.
- `/api/health` 응답이 200 (health 컨트롤러가 그렇게 등록되어 있다면) 또는 최소한 부팅 자체는 에러 없이 진행.
- DB(Prisma) 연결 환경변수가 없어 health가 실패하더라도, 이 Task의 목표는 **모듈 해석(`@/...`) 성공**이다. 부팅 로그에 `Cannot find module '@/health/...'` 같은 에러가 **없으면 통과**.

만약 모듈 해석 에러가 보이면 → 빌드가 alias를 인라인하지 못한 것 → Task 2/3 재검토.

- [ ] **Step 7: Commit (git repo인 경우만)**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): use @/ alias for HealthModule import (verification)"
```

---

## Task 5: jest moduleNameMapper 설정

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: package.json에 jest 키 추가**

`apps/api/package.json`의 최상위에 (예: `devDependencies` 다음, 닫는 `}` 직전) 다음 키를 추가한다:

```json
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": ".",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1"
    },
    "testEnvironment": "node"
  }
```

추가 후 JSON 유효성 확인:
```bash
node -e "JSON.parse(require('fs').readFileSync('apps/api/package.json','utf8')); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 2: jest 실행 (테스트 파일 존재 여부와 무관하게)**

```bash
pnpm --filter @jsure/api test
```

Expected (둘 중 하나):
- 케이스 A: 매칭되는 `*.spec.ts`가 없으면 jest는 "No tests found" 에러로 종료(코드 1)할 수 있다. 이때는 jest config 자체는 정상 파싱된 것이므로 통과로 본다 — 단, 출력에 **`Configuration error`**가 없어야 한다.
- 케이스 B: spec이 하나라도 있으면 통과해야 한다.

확인 포인트:
- 출력에 `Configuration error` 또는 `Module mapper` 관련 에러가 없을 것.
- `moduleNameMapper`가 올바른 정규식이라는 것은 jest가 config를 로드한 시점에 검증된다.

- [ ] **Step 3: 매핑 동작 미니 검증 (선택, 테스트 1개 추가하지 않고)**

직접 모듈 해석을 흉내내는 한 줄:
```bash
node -e "
const r = '<rootDir>/src/\$1'.replace('<rootDir>','apps/api').replace('\$1','health/health.module');
console.log(require('fs').existsSync(r + '.ts') ? 'ok' : 'missing: ' + r);
"
```
Expected: `ok` (`apps/api/src/health/health.module.ts`가 실제 존재).

이는 jest의 매퍼 정규식이 우리가 의도한 경로로 풀린다는 직관 확인이다. 실제 jest의 모듈 해석은 Step 2에서 검증된다.

- [ ] **Step 4: Commit (git repo인 경우만)**

```bash
git add apps/api/package.json
git commit -m "feat(api): wire @/ alias into jest moduleNameMapper"
```

---

## Task 6: 최종 회귀 검증

**Files:** (변경 없음 — 검증만)

- [ ] **Step 1: api 전체 typecheck + build + test 한 번 더**

```bash
pnpm --filter @jsure/api typecheck && \
pnpm --filter @jsure/api build && \
pnpm --filter @jsure/api test || true
```

Expected:
- typecheck, build 모두 종료코드 0.
- test는 spec 부재 시 1로 끝날 수 있으나 `Configuration error` 없으면 OK (마지막 `|| true`로 체인 계속).

- [ ] **Step 2: 다른 워크스페이스 회귀 없는지 확인**

```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/client-web typecheck
pnpm --filter @jsure/shared typecheck
```

Expected: 모두 종료코드 0. (이번 변경은 api 외부에 영향 없어야 한다.)

- [ ] **Step 3: 최종 커밋 (git repo인 경우만, 잔여 변경이 있다면)**

```bash
git status
```

잔여 변경 없으면 스킵. 있으면 적절히 커밋.

---

## 완료 기준

- `apps/api/src/app.module.ts`가 `@/health/health.module`을 import하고 빌드/부팅이 성공한다.
- `apps/api/dist/main.js`에 `@/`로 시작하는 require/import가 0개.
- `pnpm --filter @jsure/api test` 실행 시 jest config가 에러 없이 로드된다.
- admin-web, client-web, shared 어느 것도 회귀하지 않는다.
