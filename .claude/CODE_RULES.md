# Code Rules

이 프로젝트에서 코드를 작성/수정할 때 Claude가 따라야 하는 규칙. 새 패턴을 도입하기 전에 항상 이 문서를 확인한다.

레포: Turborepo + pnpm 모노레포 — `apps/{admin-web, client-web, api}` + `packages/{shared, tsconfig}`.

---

## 0. 메타 — Claude 작업 방식

- **DO** 변경 후 `pnpm typecheck`로 검증한 뒤 완료 보고.
- **DO** 기존 코드 패턴을 먼저 읽고 따라간다. 새 패턴 도입 전 사용자에게 확인.
- **DO** 작은 단위로 변경. 한 작업에서 무관한 리팩토링을 끼워넣지 않는다.
- **DO** 새 엔드포인트/스키마/패키지 경계를 건드리는 작업이면 §1, §2 절차를 먼저 확인.
- **DON'T** 추측으로 의존성 추가/삭제. `package.json` 수정은 명시 요청 시에만.
- **DON'T** 주석으로 "변경 이력"을 남기지 않는다 (`// 추가됨`, `// 기존 X 제거`).
- **DON'T** 작업 무관한 파일 포맷팅/정렬 변경 금지.
- **DON'T** 사용자 요청 없이 README/문서 신규 생성 금지.

---

## 1. 모노레포 경계

### Import 규칙
- **DO** 모든 앱은 공통 타입/스키마를 `@jsure/shared`에서만 import.
- **DO** `@jsure/shared` 변경 시 `pnpm --filter @jsure/shared build` 실행.
- **DON'T** `apps/*` 끼리 서로 import 금지 (admin-web ↔ client-web, web ↔ api 모두).
- **DON'T** `apps/api` 코드를 `packages/shared`에서 import 금지.

### `packages/shared`에 절대 두지 않는 것
- `@prisma/client` 또는 Prisma 모델 직접 export → 브라우저 번들에 Node 코드 유입.
- 내부 필드(`passwordHash`, 내부 ID 등) → 외부 노출용은 `PublicUser`처럼 별도 모양으로.
- 비밀, 외부 자격 증명, 환경별 설정값.

### shared에 두는 것
- zod 스키마 + `z.infer` 타입.
- 양쪽(웹/api)에서 모두 의미 있는 순수 상수/유틸 (Node/브라우저 API 의존 X).

### 예시 — 사용자 응답 스키마
```ts
// packages/shared/src/types/user.ts
export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  // passwordHash 등 내부 필드 절대 포함 금지
});
export type PublicUser = z.infer<typeof PublicUserSchema>;
```

---

## 2. API 계약 (zod)

`packages/shared`가 **API 계약의 단일 소스**. 모든 요청/응답은 zod 스키마로 정의되고, 타입은 `z.infer`로만 파생한다.

### 새 엔드포인트 추가 절차 (순서 고정)
1. `packages/shared/src/types/<domain>.ts`에 Request/Response zod 스키마 + `z.infer` 타입 정의.
2. `packages/shared/src/index.ts`에서 export.
3. `pnpm --filter @jsure/shared build`.
4. 백엔드 컨트롤러: `@UsePipes(new ZodValidationPipe(<RequestSchema>))`로 입력 검증.
5. 프론트엔드: `Schema.parse(res.data)`로 응답 파싱 (런타임 드리프트 차단).
6. `pnpm typecheck`로 양쪽 정합성 확인.

### 룰
- **DO** 요청/응답 모양 변경 시 shared 스키마부터 수정. 그 다음 양쪽 코드 수정.
- **DO** 프론트의 응답 핸들링은 `Schema.parse()` 또는 `Schema.safeParse()` 경유.
- **DON'T** 컨트롤러나 프론트 코드 안에서 응답/요청 타입을 손으로 다시 정의 금지.
- **DON'T** `ZodValidationPipe` 없이 `@Body()`만으로 받은 입력을 신뢰 금지.
- **DON'T** Prisma 모델을 그대로 응답으로 반환 금지 — shared 스키마 모양으로 매핑 후 반환.

### 예시 — 컨트롤러
```ts
@Post("login")
@UsePipes(new ZodValidationPipe(LoginRequestSchema))
login(@Body() dto: LoginRequest): Promise<LoginResponse> { ... }
```

### 예시 — 프론트
```ts
const res = await api.get("/health");
return HealthResponseSchema.parse(res.data);
```

---

## 3. 타입 안전성

### 룰
- **DO** 타입은 zod 스키마에서 `z.infer`로 파생. 같은 모양을 손으로 두 번 정의하지 않는다.
- **DO** 외부 경계(API 응답, `localStorage`, URL 파라미터, env)는 zod로 파싱 후 사용.
- **DO** `unknown`을 받은 뒤 좁히기. 모르는 값에 `any`로 도망가지 않는다.
- **DON'T** `any` 사용 금지. 정말 불가피하면 사용자에게 이유와 함께 확인.
- **DON'T** `as` 단언 남용 금지. 다음 경우만 허용:
  - zod `parse` 결과처럼 이미 검증된 값
  - `as const` (리터럴 좁히기)
  - 라이브러리 타입 정의가 부정확할 때 (이유 주석 1줄)
- **DON'T** `// @ts-ignore` / `// @ts-expect-error` 금지. 필요하면 사용자 확인 후, 이유 주석 필수.
- **DON'T** non-null 단언 `!` 사용 자제. 좁히기(`if (x)`)로 해결.

### env 변수
- **DO** API/웹 모두 env는 진입점에서 zod로 한 번 파싱하고, 이후 코드는 파싱된 객체만 참조.
- **DON'T** 코드 곳곳에서 `process.env.X` / `import.meta.env.X` 직접 참조.

---

## 4. 네이밍 / 파일 구조

### 공통
- **DO** 기존 디렉토리 컨벤션을 먼저 확인하고 따라간다. 새 폴더를 만들기 전에 사용자에게 확인.
- **DO** 한 파일 = 한 주된 책임. 파일이 커지면 분할 신호.

### `apps/api` (NestJS)
- 도메인별 디렉토리: `src/<domain>/` (예: `auth/`, `users/`).
- 파일명: `<domain>.controller.ts`, `<domain>.service.ts`, `<domain>.module.ts`.
- 가드/전략: `<domain>/guards/<name>.guard.ts`, `<domain>/strategies/<name>.strategy.ts`.
- 공통 파이프/필터: `src/common/<kebab-case>.<role>.ts` (예: `zod-validation.pipe.ts`).

### `apps/admin-web`, `apps/client-web` (Vite + React)
- `src/pages/<PascalCase>.tsx` — 라우트 단위 페이지.
- `src/components/<PascalCase>.tsx` — 재사용 컴포넌트.
- `src/layouts/<PascalCase>.tsx` — 레이아웃 셸.
- `src/lib/<camelCase>.ts` — Axios 인스턴스, 유틸, 클라이언트 사이드 헬퍼.
- 컴포넌트/페이지/레이아웃 파일은 PascalCase, 훅은 `useCamelCase.ts`, 그 외 모듈은 camelCase.
- **DON'T** 두 웹 앱이 동일한 컴포넌트를 따로 복제하지 않는다 — 진짜로 공유돼야 하면 `packages/shared`(순수)로, UI까지 공유해야 하면 사용자에게 새 패키지 생성 여부 확인.

### `packages/shared`
- `src/types/<domain>.ts`에 도메인별 스키마/타입.
- 모든 export는 `src/index.ts`를 통해 노출.

---

## 5. 보안

### 비밀 / 자격 증명
- **DON'T** 비밀, 토큰, env 값, 사용자 PII를 로그로 출력 금지.
- **DON'T** `.env*` 파일을 커밋하거나 내용을 코드에 하드코딩 금지.
- **DO** 새 비밀이 필요하면 `.env.example`에 키만 추가하고 사용자에게 알린다.

### 응답 노출
- **DON'T** `passwordHash`, 내부 ID, 비밀, 외부 시스템 식별자를 응답에 포함 금지.
- **DO** 응답은 항상 `PublicUser`처럼 외부 노출용 zod 스키마 모양으로 매핑.

### JWT / 인증
- 클라이언트 토큰 저장 키: `localStorage.accessToken` (고정).
- Axios 인터셉터가 `Authorization: Bearer <token>` 부착 — 라우트별 수동 헤더 추가 금지.
- 인증이 필요한 API 라우트는 항상 가드(`JwtAuthGuard` 등) 명시. 기본 비공개라고 가정하지 않는다.
- **DON'T** 토큰을 쿠키/세션스토리지/전역 변수로 옮기는 변경을 사용자 확인 없이 하지 않는다.

### CORS
- 허용 도메인은 `apps/api`의 `CORS_ORIGIN` env로만 관리. 코드에 도메인 하드코딩 금지.