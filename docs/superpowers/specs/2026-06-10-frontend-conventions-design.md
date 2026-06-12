# 프론트엔드 코드 컨벤션 및 리팩토링 설계

작성일: 2026-06-10
대상: `apps/admin-web`, `apps/client-web`

---

## 0. 절대 원칙 — 동작·외관 유지

이 리팩토링의 **가장 엄격한 룰**은 다음과 같다.

- **사용자가 보는 화면의 외관(레이아웃, 색상, 간격, 폰트, 인터랙션 결과)이 동일해야 한다.**
- **API 호출, 상태 전이, 라우팅, 권한 체크, 알림 등 모든 런타임 동작이 동일해야 한다.**

리팩토링 PR은 "동작 동치"를 우선 증명해야 하며, 그 위에서만 구조 변화를 허용한다. 외관·동작 변화가 발생하는 경우는 별도 PR + 별도 이슈로 분리한다.

검증 방식:
- 각 PR은 머지 전 직접 화면 비교(전후 스크린샷 또는 동일 시나리오 수동 워크스루) 수행
- 회귀를 발견하면 즉시 revert 후 재작업
- 신규 추상화로 인해 미세하게 스타일이 바뀌는 경우(예: 마진 1px 차이)도 회귀로 간주

---

## 1. 목적

현재 두 프론트엔드(`admin-web`, `client-web`)는 다음 문제를 갖고 있다.

- 기본 컴포넌트(Button, Input, Select 등)가 정의돼 있지 않거나(admin-web), 일부만 있고(client-web의 `form/`) 일관되게 쓰이지 않음.
- 비즈니스 규칙(D-day 계산, 신청 단계 판정, 종료 판정 등)이 페이지·카드·상세 화면 등 여러 곳에 중복.
- 폼 처리가 페이지마다 `useState` + 수동 검증으로 반복.
- 스타일이 컴포넌트별 `.css` 파일에 BEM 유사 명명으로 흩어져 있고, 색·간격이 하드코딩됨.

이 문서는 컨벤션을 확정하고, 두 앱을 6 PR로 빅뱅 리팩토링하는 가이드라인을 제공한다.

---

## 2. 공용 컴포넌트 범위

**앱 내부 공유만 한다. cross-app 공유 패키지는 만들지 않는다.**

- admin-web과 client-web은 디자인 톤(데스크탑 데이터 밀도 vs 모바일 우선)이 달라 진짜 공유 가치가 적다.
- 각 앱이 `components/ui/`, `components/composites/`, `domains/`를 갖는 구조.
- 추후 진짜 공유 자산이 누적되면 그때 `packages/ui/` 신설을 재검토.

`packages/shared/`는 기존대로 타입과 zod schema만 담당. UI 코드는 들어가지 않는다.

---

## 3. 컴포넌트 3계층 분류

```
src/
  components/
    ui/          # 원자 — 도메인 모름, 단일 책임
    composites/  # 조합 — ui로 만들어졌고 도메인 모름, 재사용
  domains/
    <domain>/
      components/  # 도메인 모델을 prop으로 받는 컴포넌트
```

### 3.1 ui (Atoms)

다른 컴포넌트를 거의 쓰지 않거나, 단일 HTML 요소를 감싸는 수준. 도메인 지식 없음.

- 후보: `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Badge`, `Spinner`, `Skeleton`, `Avatar`, `Divider`, `Dialog`, `Drawer`, `Tooltip`, `Tag`
- prop은 HTML 표준에 가까운 인터페이스 + 변형(variant, size, tone) 정도만.
- 도메인 enum/모델 타입을 prop으로 받지 않는다.

### 3.2 composites (Reusable Compositions)

여러 ui를 조합해 자주 쓰이는 패턴을 묶은 것. **여전히 도메인 모름.**

- 후보: `FormField`(label + Input + error), `LabeledInput`, `RadioGroup`, `ConfirmDialog`, `PageHeader`, `EmptyState`, `ErrorBanner`, `Stepper`, `StatCard`, `DataTable`, `SearchInput`
- 두 곳 이상에서 재사용 또는 재사용 의도가 명확해야 한다. "지금은 한 군데지만 곧 다른 데서도"는 금지(YAGNI). 두 번째 사용처가 생긴 시점에 추출한다.

### 3.3 domain components

`domains/<domain>/components/` 또는 `src/components/<domain>/` 어느 쪽이든 한 위치로 통일한다. 본 설계는 **`domains/<domain>/components/`** 위치를 택한다 — 도메인 자산을 한 폴더에 모으는 도메인 모듈 패턴과 일치하기 위해.

- 도메인 모델 타입(`Campaign`, `Influencer`, `Application` 등)을 prop으로 받거나, 도메인 규칙을 내부에 가짐.
- 후보: `CampaignCard`, `ApplicationStepper`, `BankSelect`, `SnsRecruitList`, `SettlementStatusBadge`, `InfluencerProfileSummary`

### 3.4 판정 규칙 (한 줄로)

prop 타입에 **도메인 모델이 등장**하면 → domain.
ui로 조합돼 있고 prop이 일반 타입(string, number, ReactNode, 일반 enum)으로만 구성 → composite.
다른 컴포넌트 거의 안 쓰거나 단일 HTML 요소를 감싸는 수준 → ui.

---

## 4. 도메인 모듈 패턴

비즈니스 로직을 도메인 단위로 격리한다.

```
src/domains/<domain>/
  api.ts         # axios 래퍼 (기존 lib/api/* 이동)
  hooks.ts       # react-query 훅 (useCampaign, useCampaignList, ...)
  utils.ts       # 순수 함수 (isEnded, deriveDisplayStage, formatPeriod, ...)
  types.ts       # @jsure/shared 재-export + 화면 전용 타입
  components/    # 도메인 컴포넌트
  index.ts       # 외부 노출 인터페이스 (barrel export)
```

### 4.1 도메인 식별

두 앱에서 필요한 도메인은 대략 다음과 같다(앱별로 다를 수 있음).

**admin-web**: `campaign`, `application`, `influencer`, `settlement`, `notice`, `broadcast`, `overview`, `team`

**client-web**: `campaign`, `application`, `notice`, `me`(또는 `profile`), `auth`

각 도메인의 정확한 경계는 PR 4 진행 시 확정한다.

### 4.2 import 규칙

- 페이지는 도메인 모듈의 `index.ts`를 통해서만 import한다. `import { useCampaign } from "@/domains/campaign"` 만 허용.
- 도메인 모듈 내부 파일(`api.ts`, `utils.ts` 등)을 외부에서 직접 import 금지.
- 도메인 간 의존은 최소화하되 필요 시 도메인 A가 도메인 B의 `index.ts`만 import. 양방향 의존은 금지.

### 4.3 비즈니스 로직 위치

- D-day 계산, isEnded 판정, 신청 단계(deriveDisplayStage), 종료 판정, 금액 포맷 등 모든 도메인 규칙은 `utils.ts` 또는 도메인 컴포넌트 내부.
- 페이지/UI 컴포넌트엔 **비즈니스 규칙 인라인 금지**. props로 받은 값을 표시만 한다.
- 단순 표시 포맷(예: 일반 날짜 포맷팅, 통화 포맷)도 도메인성이 없으면 `src/lib/format.ts` 같은 일반 util에 둔다.

---

## 5. 스타일링

### 5.1 CSS Modules 전환

- 모든 `.css`를 `Component.module.css`로 마이그레이션.
- 클래스명은 BEM(`.ccard__title`)에서 일반 명사(`.title`)로 단순화. CSS Modules가 스코프를 보장.
- 동작·외관은 그대로. 클래스명만 바뀐다.

### 5.2 디자인 토큰

`src/styles/tokens.css`에 CSS 변수로 중앙화한다.

```css
:root {
  /* color */
  --color-primary: #1d6cf3;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-bg: #ffffff;
  --color-bg-subtle: #f9fafb;
  --color-danger: #ef4444;
  --color-warn: #f59e0b;
  --color-ok: #10b981;

  /* spacing (4px scale) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 999px;

  /* font */
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-md: 13px;
  --font-size-lg: 15px;
  --font-size-xl: 17px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  /* shadow */
  --shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.04);
  --shadow-md: 0 6px 18px rgba(17, 24, 39, 0.06);
}
```

토큰 값은 **기존 코드에서 실제 사용된 값들을 그대로 추출**해서 정한다. 새 디자인 시스템을 발명하지 않는다(동작·외관 유지 원칙).

admin/client가 다른 값을 쓰는 경우 각자의 `tokens.css`를 가질 수 있다.

### 5.3 사용 규칙

- 컴포넌트 CSS에서 색·간격·반경·폰트 사이즈는 토큰 변수만 사용. 하드코딩 금지.
- 토큰에 없는 값이 필요하면 토큰을 먼저 추가하고 사용.

---

## 6. 폼 처리

### 6.1 react-hook-form + zodResolver

- 모든 폼은 `react-hook-form` + `@hookform/resolvers/zod`로 통일.
- Zod schema는 `@jsure/shared`에서 그대로 가져온다.
- 필드는 `register` 또는 `Controller`로 등록. 페이지에서 필드별 `useState` 금지.

### 6.2 FormField composite

ui의 `Input`, `Select` 등을 RHF와 연결하는 공통 wrapper를 `composites/FormField.tsx`로 제공.

- label, error, hint를 표준 위치에 표시
- `name` prop으로 RHF와 연결
- 검증 메시지는 schema가 정한 메시지를 그대로 출력

### 6.3 제출 핸들링

- `onSubmit`은 RHF의 `handleSubmit(submitFn)` 사용.
- API 호출은 도메인 모듈의 mutation 훅 사용. 페이지에서 axios 직접 호출 금지.

---

## 7. 폴더 구조 (최종)

각 앱은 다음 구조를 따른다.

```
src/
  components/
    ui/              # 원자 컴포넌트
    composites/      # 조합 컴포넌트
  domains/
    <domain>/
      api.ts
      hooks.ts
      utils.ts
      types.ts
      components/
      index.ts
  pages/             # 라우트 단위 (기존 유지)
  layouts/           # 페이지 셸 (AppShell 등, 기존 유지)
  styles/
    tokens.css
    global.css       # reset, font 등
  lib/               # 도메인 무관 유틸 (axios 인스턴스, date format 등)
  context/           # 전역 상태 (인증 등, 기존 유지)
  App.tsx
  main.tsx
```

기존의 페이지 단위 `Component.css` + 컴포넌트 사이드카 패턴은 유지하되, 위치는 컴포넌트 분류(ui / composites / domain)에 따라 옮겨진다.

---

## 8. 네이밍 및 import

- 컴포넌트: PascalCase 파일명 + 동일 export 이름. `Button.tsx` → `export function Button(...)`.
- 훅: `useXxx` camelCase.
- CSS Modules: `Component.module.css`. import 변수는 `styles`.
- 도메인 모듈 외부 노출: `index.ts` barrel.
- 경로 alias: `@/` = `src/`. 상대 경로 `../../` 두 단계 이상 금지.

---

## 9. 금지 패턴

ESLint 또는 코드 리뷰로 다음을 차단한다.

1. **페이지에서 axios 직접 호출** — 도메인 모듈의 훅 사용
2. **컴포넌트 내부 비즈니스 규칙 인라인** — utils로 이동 (예: `dataEndDate < now` 식 인라인 판정 금지)
3. **폼 필드를 `useState`로 관리** — RHF 사용
4. **하드코딩된 색·간격·폰트 사이즈** — 토큰 변수 사용
5. **도메인 모듈 내부 파일 직접 import** — index.ts 통해서만
6. **`../../` 두 단계 이상 상대 경로** — `@/` alias 사용
7. **`packages/shared/dist/` 직접 수정** — 빌드 산출물, src만 수정 후 빌드

ESLint로 자동 검증 가능한 항목(1, 5, 6 일부)은 PR 1에서 룰 추가.

---

## 10. 리팩토링 — 6단계 빅뱅

기능 동결 상태이므로 6 PR로 나눈 빅뱅을 수행한다. PR 단위는 1~2일 작업 + 1일 리뷰로 좁게.

### PR 1 — Foundation
- 본 문서를 `docs/superpowers/specs/`에 머지
- 루트에 `CONVENTIONS.md` 추가 (본 문서 요약 + 링크)
- 두 앱에 `src/styles/tokens.css` 추가 + 토큰 값 추출
- `src/components/ui/`, `src/components/composites/`, `src/domains/` 빈 폴더 + `.gitkeep`
- ESLint 규칙 추가:
  - `no-restricted-imports` (도메인 모듈 내부 직접 import 차단, `packages/shared/dist/` 차단)
  - `import/no-relative-parent-imports`(2단계 이상 차단)
- vite alias `@/` = `src/` 설정 확인/추가
- **기존 코드 변경 없음**

### PR 2 — UI 원자 (app별로 두 PR로 더 쪼개도 가능)
- `components/ui/` 구현: Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Badge, Spinner, Dialog 등
- 각 컴포넌트는 `Component.tsx` + `Component.module.css`
- **기존 사용처는 아직 변경 안 함**. 신규 ui는 다음 PR에서 도입.
- 빌드/타입체크 통과 + 신규 컴포넌트 단독 동작 확인

### PR 3 — Composites
- `components/composites/`로 LabeledInput, RadioGroup, FormField, ConfirmDialog, PageHeader, ErrorBanner, EmptyState 등을 이동/구현
- 기존 `components/form/`, `components/layout/`의 해당 컴포넌트는 새 위치로 이동하고 import 경로 자동 갱신
- 외관·동작 동일 확인 (이 단계는 위치만 옮기는 ratio가 큼)

### PR 4 — 도메인 모듈
- `domains/<domain>/` 폴더 생성, 도메인 단위로 다음을 이동:
  - `lib/api/<domain>.ts` → `domains/<domain>/api.ts`
  - 페이지/컴포넌트의 비즈니스 규칙 → `utils.ts`
  - react-query 사용처 → `hooks.ts`로 추출
  - 도메인 컴포넌트(CampaignCard 등) → `components/`
- 페이지는 도메인 모듈의 barrel만 import
- **외관·동작 변경 없음**. 위치 이동 + 추출만.

### PR 5 — 폼 마이그레이션
- 모든 폼을 react-hook-form + zodResolver로 전환
- `composites/FormField`로 통일
- Zod schema는 그대로 재사용
- **검증 메시지, 검증 시점(touched 처리), 제출 동작이 기존과 동일**한지 폼별로 워크스루

### PR 6 — 페이지/스타일 정리
- 모든 `.css`를 `.module.css`로 전환
- 클래스명 단순화 (BEM 제거)
- 하드코딩된 색·간격을 토큰으로 치환
- 사용되지 않는 옛 컴포넌트/CSS 삭제
- ESLint 룰 본격 적용 (이전 PR들에서 도입한 룰 위반 0 확인)

각 PR 머지 전 체크리스트:
- [ ] 빌드 통과
- [ ] 타입체크 통과
- [ ] ESLint 통과
- [ ] 영향받은 화면 수동 워크스루 (스크린샷 비교)
- [ ] API 호출 동치성 확인 (network 탭 비교 또는 도메인 훅 직접 테스트)

---

## 11. 스코프 밖

다음 항목은 본 리팩토링 범위 밖이며 별도 이슈로 다룬다.

- 테스트 전략 (현재 자동화 테스트 거의 없음 — 별도 도입 계획 필요)
- 접근성(WAI-ARIA, 키보드 네비게이션) 전반 개선
- 다국어 처리 (현재 일본어 하드코딩 — 추후 i18n 도입 시 별도)
- 백엔드 도메인 모듈화 (본 설계는 프론트엔드만)
- 성능 최적화 (코드 스플리팅, 메모이제이션 등)

---

## 12. 성공 기준

리팩토링 완료 시점에 다음이 충족되어야 한다.

1. 두 앱의 `components/ui/`, `components/composites/`, `domains/`가 채워져 있고, 페이지의 import는 도메인 모듈 또는 composites에서만 온다.
2. ESLint 룰 위반 0.
3. CSS 안의 색·간격·폰트 사이즈는 토큰 변수만. 하드코딩 grep 결과 0.
4. 폼 코드 안에 필드별 `useState` 또는 수동 validate 핸들러 0.
5. **모든 화면의 외관·동작이 리팩토링 이전과 동일.**
