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

````
src/domains/<domain>/
  api.ts        # axios 래퍼
  hooks.ts      # react-query 훅
  utils.ts      # 순수 함수
  types.ts      # 화면 전용 타입
  components/   # 도메인 컴포넌트
  index.ts      # barrel
````

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
