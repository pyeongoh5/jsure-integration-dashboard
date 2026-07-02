# client-web i18n 설계

## 배경

`apps/client-web`은 일본인 사용자용 UI지만, 개발자(한국인)가 일본어 문자열을 코드에 직접 관리하는 데 어려움이 있다. 현재 `src` 아래에 하드코딩된 일본어 문자열이 약 400개 존재한다.

목표:

- 개발자는 한국어 기준으로 개발/코드 리뷰가 가능
- QA 팀(일본어 사용자)이 한국어에 대응되는 일본어를 검수·수정
- 프로덕션 빌드는 일본어로 출력

## 범위

- 대상: `apps/client-web`만
- `admin-web`, `api` 등 다른 앱은 이번 범위 밖

## 아키텍처

### 1. 언어 결정 방식

- **빌드타임 고정**: 환경변수 `VITE_I18N_REGION` (`kr` | `jp`) 값에 따라 `t()`가 반환할 locale이 결정된다.
- 언어 스위처 UI는 만들지 않는다.
- dev 서버는 기본 `kr`, 프로덕션 빌드는 `jp`.

### 2. 파일 구조

```
i18n/                # 저장소 최상위 (QA 접근성 우선)
  messages.ts        # 소스 오브 트루스 (QA가 GitHub 웹 에디터에서 편집)
  t.ts               # t() 함수 및 타입 유틸
  index.ts           # 재export
  scripts/
    validate-i18n.ts # 빌드 전 검증 스크립트
```

### 3. 소스 파일 형태

```ts
// i18n/messages.ts
export const messages = {
  home: {
    title:  { kr: '메인',   jp: 'ホーム' },
    submit: { kr: '확인',   jp: 'OK' },
  },
  auth: {
    terms: {
      agreeAll: { kr: '모든 항목에 동의합니다', jp: 'すべての項目に同意します' },
    },
  },
} as const;
```

규칙:

- 중첩 구조 자유 (feature/subfeature 단위 그룹핑 권장).
- 모든 leaf는 `{ kr: string; jp: string }` 두 필드를 갖는다.
- `as const`로 리터럴 타입을 유지해 `t()`의 key 자동완성/오타 감지에 활용한다.

### 4. `t()` API

```ts
import { t } from '@i18n';

<button>{t('home.submit')}</button>
<span>{t('auth.terms.agreeAll')}</span>
```

- 인자는 leaf까지의 dot-path 문자열.
- 반환은 `import.meta.env.VITE_I18N_REGION` 값에 해당하는 문자열.
- TypeScript 리터럴 union 타입(`DotPath<typeof messages>`)으로 컴파일 시점 오타 감지 + IDE 자동완성.
- 두 언어의 원본 문자열 모두 번들에 포함된다 (tree-shaking 불가). 규모상 무시 가능한 오버헤드로 판단.

### 5. 빌드 검증

- `i18n/scripts/validate-i18n.ts`
  - `messages.ts`를 파싱해서 모든 leaf가 `kr`, `jp` 두 필드를 갖고 두 값 모두 non-empty 문자열인지 확인.
  - 누락된 key 경로 리스트를 출력하고 `process.exit(1)`.
- `apps/client-web/package.json`의 `build` 스크립트를 다음 순서로 구성:
  ```
  tsx ../../i18n/scripts/validate-i18n.ts && tsc -b && vite build
  ```
- dev 서버(`vite`)에서는 검증하지 않는다. 개발 중엔 `jp`가 비어있는 상태가 정상이기 때문.

### 6. 환경변수

- `apps/client-web/.env.development`: `VITE_I18N_REGION=kr`
- 프로덕션 빌드 명령: `VITE_I18N_REGION=jp pnpm --filter @jsure/client-web build`
- Railway 배포 환경변수에 `VITE_I18N_REGION=jp` 명시.
- QA가 로컬에서 일본어 확인이 필요할 경우 `VITE_I18N_REGION=jp pnpm --filter @jsure/client-web dev` 로 실행.

## 마이그레이션

현재 `src` 아래 하드코딩된 일본어 약 400개 문자열을 하나의 큰 PR로 일괄 이동한다.

절차:

1. i18n 인프라 세팅 (`messages.ts` 빈 골격, `t.ts`, `validate-i18n.mjs`).
2. 각 컴포넌트/모듈을 순회하며:
   - 하드코딩된 일본어 → 적절한 key로 `messages.ts`에 등록 (`jp`는 원문 그대로, `kr`는 초안 번역).
   - 사용측 코드는 `t('...')`로 치환.
3. 마이그레이션 완료 후엔 하드코딩된 일본어가 코드에 남지 않도록 lint 규칙 도입 검토 (별도 후속 작업).

한국어 초안 번역은 개발자 또는 AI가 채우고, QA 팀이 이후 최종 검수를 수행한다.

## QA 작업 흐름

1. QA는 GitHub 웹 에디터에서 `i18n/messages.ts`만 편집한다.
2. `jp` 필드를 채우거나 수정하고 PR을 연다.
3. 개발자가 리뷰·머지.
4. 프로덕션 빌드 시 `validate-i18n.ts`가 누락 여부를 재확인.

## 안 하는 것

- 런타임 언어 스위처.
- plural / gender / 문맥별 변형 처리 (지금 필요 없음 — 추후 `t(key, params)` 시그니처 확장 여지만 남긴다).
- 문자열 보간 (필요해지면 이후 추가).
- 관리 UI (오버킬).
- CSV/스프레드시트 파이프라인 (GitHub 편집으로 충분).
- Vite plugin을 이용한 반대 locale strip (번들 사이즈 문제 실제 발생 시 재검토).
- `admin-web`의 i18n (범위 밖).
