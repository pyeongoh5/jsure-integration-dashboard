# Import Alias 정비 — Design

- **Date:** 2026-05-06
- **Scope:** `apps/api`만 (런타임 alias 마무리)
- **Out of scope:** `apps/admin-web`, `apps/client-web` (이미 동작), `packages/shared` (의도적으로 작게 유지, 상대경로 유지)

## 배경

현재 모노레포의 alias 상태:

| 위치 | TS `paths` | 런타임 alias | 비고 |
|---|---|---|---|
| `apps/admin-web` | `@/* → src/*` | Vite alias 연결됨 | 동작 |
| `apps/client-web` | `@/* → src/*` | Vite alias 연결됨 | 동작 |
| `apps/api` | `@/* → src/*` | **미연결** | 타입체크는 통과, 런타임에서 모듈 해석 실패 |
| `packages/shared` | 없음 | — | 라이브러리 빌드 (`tsc → dist/`)이라 alias 도입 시 후처리 필요. 파일 3개 규모로 도입 이득 < 비용 |

원칙: **각 app은 자기 `src/` 안에서만 `@/*`를 쓴다.** 패키지 경계를 넘는 import는 항상 workspace 패키지명(`@jsure/shared`)으로만 한다 — 기존 `CODE_RULES.md` §1 그대로.

## 목표

`apps/api`에서 `import { X } from "@/..."` 형태가 다음 모든 환경에서 동작하게 만든다:

1. `pnpm --filter @jsure/api typecheck` (이미 통과)
2. `pnpm --filter @jsure/api build` 후 `node dist/main.js` (현재 깨짐)
3. `pnpm --filter @jsure/api dev` (`nest build && nest start --watch`) (현재 깨짐)
4. `pnpm --filter @jsure/api test` (jest) (현재 깨짐)

## 비목표

- `apps/admin-web`, `apps/client-web`의 alias 변경 (이미 동작)
- `packages/shared` 내부 alias 도입
- 기존 import 일괄 변환 (이번 작업은 alias가 **동작 가능한** 상태로 만드는 것까지. 실제 사용 여부는 추후 자유)
- 별도 prettier/eslint 룰 (`import/order` 등) 추가

## 설계

### 1. nest build (webpack) — alias 인라인

NestJS는 `nest build` 내부에서 webpack을 사용한다. webpack에 `tsconfig-paths-webpack-plugin`을 연결하면 빌드 시점에 `@/*`가 실제 상대경로로 인라인되어 `dist/`에 alias 흔적이 남지 않는다 → `node dist/main.js`가 그대로 동작.

**변경 1:** `apps/api/nest-cli.json`
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

**변경 2:** `apps/api/webpack.config.js` (신규)
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

`nest-cli.json`의 `webpack: true` + `webpackConfigPath`는 nest CLI가 webpack 옵션을 함수 형태로 export한 파일에 위임하는 표준 방식이다.

### 2. jest — moduleNameMapper

api에는 별도 `jest.config.*`가 없고 `package.json`에도 `jest` 키가 없다. 새로 `jest` 키를 `package.json`에 추가한다 (별도 파일 만들지 않음 — 기존 nest 컨벤션과 동일).

**변경 3:** `apps/api/package.json`
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

(test 디렉토리 e2e는 별도 `test/jest-e2e.json` 사용 — `package.json`의 `test:e2e` 스크립트 참고. e2e config가 실제 존재한다면 동일 mapper를 추가, 없다면 이번 작업 범위 밖.)

### 3. devDependency 추가

- `tsconfig-paths-webpack-plugin` (api 전용)

`tsconfig-paths`, `ts-jest`는 이미 api `devDependencies`에 있음.

### 4. 검증 케이스

- 검증용으로 기존 import 1곳을 `@/...`로 바꿔본다 (예: `src/main.ts` 또는 진입점에서 가까운 파일). 작업 완료 후 원복은 하지 않음 — 동작 증거로 남긴다.
- 검증 명령:
  - `pnpm --filter @jsure/api typecheck`
  - `pnpm --filter @jsure/api build`
  - `node apps/api/dist/main.js` (혹은 `pnpm --filter @jsure/api start`) — 부팅 로그 확인
  - `pnpm --filter @jsure/api test` (테스트가 1개 이상 있을 경우)

## 위험 / 트레이드오프

- **webpack config 도입의 비용:** 지금까지 nest-cli 기본 설정만 썼는데 이번에 webpack config 파일이 추가된다. 단, 함수가 `tsconfig-paths-webpack-plugin`만 끼워넣고 나머지는 nest 기본을 그대로 spread하므로 유지보수 표면은 매우 좁다.
- **jest 설정 위치:** `package.json` 인라인 vs `jest.config.js` 별도 파일. nest 표준은 인라인 — 이쪽을 따른다.
- **`packages/shared` 미적용:** shared가 커지면 alias 필요성이 생길 수 있다. 그 시점에 `tsc-alias` 도입 여부를 별도 의사결정. 지금 도입 안 하는 이유는 빌드 출력물이 외부 패키지로 export되는 라이브러리이기 때문 — alias는 후처리 없이는 런타임에서 깨진다.

## 작업 단위 요약

1. `apps/api/nest-cli.json` 수정 (webpack 활성화)
2. `apps/api/webpack.config.js` 생성
3. `apps/api/package.json`에 `jest` 키 추가, `tsconfig-paths-webpack-plugin` devDep 추가
4. `pnpm install`
5. import 1곳을 `@/...`로 바꿔 검증 (typecheck → build → 부팅 → test)
