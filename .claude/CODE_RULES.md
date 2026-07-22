# Code Rules

이 프로젝트에서 코드를 작성/수정할 때 Claude가 따라야 하는 규칙. 새 패턴을 도입하기 전에 항상 이 문서를 확인한다.

레포: Turborepo + pnpm 모노레포 — `apps/{admin-web, client-web, api}` + `packages/{shared, tsconfig}`.

---

## 0. 메타 — Claude 작업 방식

- **⚠️ 서비스가 정식 오픈(라이브)된 상태다. 모든 코드 수정은 운영 중인 시스템을 건드린다는 전제로 조심스럽게 진행한다.**
  - **DO** 기존 서비스 동작(하위 호환)을 깨지 않는지 먼저 확인. 영향받는 호출부/데이터를 파악한 뒤 수정.
  - **DO** DB 모델(Prisma 스키마) 변경 시 반드시 마이그레이션을 함께 계획·작성한다. 컬럼/테이블 삭제, 타입 변경 등은 기존 데이터에 미치는 영향을 먼저 검토.
  - **DON'T** 파괴적·비가역적 변경(컬럼/테이블 drop, 데이터 이관, 계약 breaking change)을 사용자 확인 없이 진행하지 않는다.
- **DO** 변경 후 `pnpm typecheck`로 검증한 뒤 완료 보고.
- **DO** 구현/수정을 제안·보고할 때 항상 아래 두 가지를 함께 검토해 명시한다.
  - **배포 대상**: 수정 후 배포가 필요한 앱(`api`=Railway, `client-web`·`admin-web`=Vercel)과 각 앱의 배포 필요 여부·이유. 특히 `packages/shared` 변경은 이를 소비하는 앱(주로 `api`) 재배포가 필요함을 유의.
  - **사이드이펙트**: 기존 서비스에 미치는 영향 — 공용 컴포넌트(여러 화면 공유), 공유 스키마/유틸(`packages/shared`), API 계약, i18n 키의 영향 범위를 파악해 회귀 위험을 보고.
- **DO** 기존 코드 패턴을 먼저 읽고 따라간다. 새 패턴 도입 전 사용자에게 확인.
- **DO** 작은 단위로 변경. 한 작업에서 무관한 리팩토링을 끼워넣지 않는다.
- **DO** 새 엔드포인트/스키마/패키지 경계를 건드리는 작업이면 §1, §2 절차를 먼저 확인.
- **DO** 코드의 작성은 항상 가독성과 재사용성을 고려한 설계를 기반으로 한다.
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
- **DON'T** `@UsePipes(new ZodValidationPipe(...))`를 **메서드 레벨**에 붙이지 않는다. NestJS는 그 파이프를 메서드의 **모든 파라미터**에 적용하므로, 같이 선언된 `@Param("id")` 문자열이 zod 스키마로 검증되며 `"expected object, received string"`으로 실패한다(`@Req()`는 예외적으로 파이프를 거치지 않음). 항상 `@Body(new ZodValidationPipe(Schema))` 형태로 파라미터에 직접 부착.
- **DON'T** Prisma 모델을 그대로 응답으로 반환 금지 — shared 스키마 모양으로 매핑 후 반환.

### 예시 — 컨트롤러

```ts
// OK — 파이프를 @Body 파라미터에 직접 부착
@Patch(":id")
update(
  @Param("id") id: string,
  @Body(new ZodValidationPipe(UpdateCampaignRequestSchema))
  body: UpdateCampaignRequest,
): Promise<CampaignResponse> {
  return this.campaigns.update(id, body);
}

// BAD — @Param("id") 문자열이 zod로 들어가서 검증 실패
@Patch(":id")
@UsePipes(new ZodValidationPipe(UpdateCampaignRequestSchema))
update(@Param("id") id: string, @Body() body: UpdateCampaignRequest) { ... }
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

### 변수 / 파라미터 네이밍

- **DO** 변수/파라미터는 의미가 그대로 드러나는 단어로 적는다. `applicant`, `campaign`, `media`, `event`, `handlers`.
- **DO** 콜백/콜렉션 메서드의 파라미터도 도메인 이름으로 적는다. `items.map((applicant) => ...)`, `accounts.find((account) => ...)`.
- **DON'T** 약어 금지. 다음은 모두 금지:
  - 도메인 타입의 첫 글자만 따서 변수명으로 쓰지 않는다 (`Applicant a`, `Campaign c`, `Media m`).
  - 일반 약어 (`val`, `tmp`, `obj`, `req`, `res`, `cb`, `fn`, `mut`, `data1`).
  - 의미가 죽은 한 글자 파라미터 (`e` for event, `s` for seed, `n` for count, `v` for value 등).
- **DO** 예외로만 한 글자 이름을 허용:
  - 표준 관용 루프 인덱서: `for (let i = 0; ...)` / `arr.forEach((_, index) => ...)`.
  - 수학·좌표 변수 (`x`, `y`, `dx`, `dy`).
  - 그 외에는 단어로 풀어 쓴다.

### `apps/api` (NestJS)

- 도메인별 디렉토리: `src/<domain>/` (예: `auth/`, `users/`).
- 파일명: `<domain>.controller.ts`, `<domain>.service.ts`, `<domain>.module.ts`.
- 가드/전략: `<domain>/guards/<name>.guard.ts`, `<domain>/strategies/<name>.strategy.ts`.
- 공통 파이프/필터: `src/common/<kebab-case>.<role>.ts` (예: `zod-validation.pipe.ts`).
- **DO** 예외 `message` (`BadRequestException`, `NotFoundException`, `ConflictException` 등) 는 **한국어**로 작성. 개발자가 한국인이므로 응답 로그/스택을 즉시 읽을 수 있도록.
  - 예외의 `code` 필드는 그대로 대문자 상수 유지 (`CATEGORY_MISMATCH` 등). 프론트 분기는 `code` 로만.
  - LINE 템플릿 본문·샘플·설명(`line-templates/trigger-meta.ts` 등 최종 사용자에게 노출되는 텍스트) 은 예외 — 인플루언서용 일본어 유지.

### `apps/client-web` (인플루언서 웹) 전용

- **DO** 화면에 노출되는 문자열은 항상 `i18n/messages.ts` 에 키를 추가하고 `t("...")` 로 참조. 인라인 리터럴 하드코딩 금지 (jp/kr 대응 필요).
- **DO** 이 앱을 수정하거나 신규 기능을 추가할 때, 새로 추가된/수정된 property 라인 끝에 `// new` 주석을 부착 (i18n 키 신설·객체 필드 추가·매핑 값 변경 등이 대상). 사용자가 diff 를 빠르게 스캔할 수 있도록.
  - 이 규칙은 §0 의 "변경 이력 주석 금지"에 대한 **client-web 한정 예외**. 다른 앱에는 적용하지 않는다.
  - 이후 별개 작업으로 파일을 다시 편집할 때 앞선 `// new` 는 정리(제거)해도 되고 유지해도 된다 — 사용자가 리뷰 후 요청한 대로 처리.

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

---

## 6. SNS 핸들 (`@username`) 정책

`@@username`처럼 prefix가 두 번 붙는 버그가 반복돼서 규칙을 박아둠. SNS 핸들(`SnsAccount.handle`)을 **저장·전송·내부 로직**에서 다룰 때는 **bare**(앞에 `@` 없음)로 통일한다. `@`는 **표시(render)** 시점에만 붙인다.

### 룰

- **DO** 저장/전송/내부 비교는 항상 bare 문자열(`yamada_hanako`).
- **DO** 입력 폼은 사용자가 `@`를 붙여 넣어도 받아준다 — 정규화는 `@jsure/shared`의 `normalizeSnsHandle()` 또는 `InfluencerSnsAccountInputSchema`(이미 `.transform(normalizeSnsHandle)` 적용)에 맡긴다.
- **DO** 표시 측은 `@{handle}` 형태로 직접 prefix 하거나, 헬퍼가 필요하면 `displaySnsHandle(handle)`을 쓴다.
- **DON'T** 입력 placeholder에 `@your_handle`처럼 `@`를 박지 않는다 (사용자가 prefix까지 그대로 입력해서 저장 데이터 오염을 유발한다).
- **DON'T** 컴포넌트/서비스 안에서 임시로 `handle.replace(/^@/, "")` 같은 정규화를 흩뿌리지 않는다. 한 곳(schema 또는 `normalizeSnsHandle`)에 집중.
- **DON'T** API 응답을 만들 때 `@`를 붙여서 내려주지 않는다. 응답은 bare, 표시 책임은 클라이언트.
- **DON'T** DB 시드/픽스처에 `@`-prefixed 값을 넣지 않는다.

### 새 필드/화면 추가 시 체크

1. 신규 입력 폼: zod 스키마에서 `InfluencerSnsAccountInputSchema`처럼 `.transform(normalizeSnsHandle)`를 거치는지 확인.
2. 신규 표시 위치: `@{handle}` 한 군데에서만 prefix 붙이는지 확인.
3. seed/마이그레이션: 이미 `@`가 섞여 들어간 row가 있는지 점검(`SELECT * FROM "InfluencerSnsAccount" WHERE handle LIKE '@%'`).

---

## 7. 컴포넌트 설계 — 단일 책임 + 로직/UI 분리

화면 파일(`pages/*.tsx`)이 fetch + 필터 상태 + 선택 상태 + mutation 상태 + 변환 + 렌더링을 다 떠안으면 다음과 같은 버그가 반복된다.
- 부모 한 곳에서 들고 있는 모달용 입력 상태가 부모 re-render 때문에 focus가 튄다.
- 비즈니스 변환(toApplicant, formatRelative…)이 페이지 안에 박혀서 재사용 불가능.
- 무관한 책임끼리 같은 useEffect 안에 묶여 의존성 배열이 거짓말을 하기 시작한다.

규칙은 단순함: **한 파일 = 한 책임**. 데이터 로드, mutation, URL state, 표시 변환, 렌더링은 서로 다른 파일에 둔다.

### 디렉토리 컨벤션 (admin-web / client-web)

페이지 단위의 도메인(`Applicants`, `Campaigns`, `Influencers` …)은 `src/components/<Domain>/` 아래에 자기 부품을 모은다.

```
src/components/Applicants/
  types.ts                       // 도메인 공용 타입/상수
  applicantTransform.ts          // 순수 변환 함수 (API 모델 -> view 모델)
  useApplicantsData.ts           // 목록/카운트 fetch + reload
  useCampaignOptions.ts          // 필터용 부가 데이터 fetch
  useApplicantMutations.ts       // approve/reject/undo + dialog state
  ApplicantTabs.tsx              // presentational
  ApplicantFilters.tsx           // presentational
  ApplicantTable.tsx             // presentational
  ApplicantConfirmDialog.tsx     // dialog 자체 + 로컬 입력 상태
src/pages/Applicants/index.tsx   // 위 부품을 조립만 한다
```

페이지 파일은 **조립**만 한다. 페이지에 새 `useEffect`/`useState`가 늘어나는 게 보이면 알맞은 hook 파일로 옮길 신호.

### 룰

- **DO** 데이터 fetch는 `use<Domain>Data.ts` / `use<Thing>Options.ts` 같은 커스텀 hook에 격리. 로딩/에러/reload는 hook이 노출하는 상태로만 다룬다.
- **DO** mutation(승인, 삭제 등)은 `use<Domain>Mutations.ts`로 묶어 pending/mutating/error를 한 곳에서 관리. 성공 시 hook 사용자에게 `onMutated` 콜백으로 알리고, 데이터 hook의 `reload()`를 호출.
- **DO** API 모델 → view 모델 변환은 `<domain>Transform.ts`의 **순수 함수**로 둔다. React 훅 호출 금지.
- **DO** Dialog/Modal처럼 자기만의 입력 상태가 있는 컴포넌트는 그 상태를 **자기 안에서** 관리. 부모는 열림/닫힘과 confirm 콜백만 다룬다. (`Applicants` 페이지의 `반려 사유` textarea가 매 키 입력마다 focus가 튄 사고가 이 규칙으로 막힌다.)
- **DO** Presentational 컴포넌트(`ApplicantTable` 등)는 props로만 동작. 자체적으로 fetch / global state / route 접근 금지.
- **DO** 페이지 파일은 URL state(`useSearchParams`)와 부품 간 데이터 전달만 한다. 100줄 넘어가면 분리 신호.
- **DON'T** Modal/Dialog 내부 입력 상태를 부모에 끌어올리지 않는다. 부모 re-render가 입력 컴포넌트의 focus·캐럿·IME 합성을 깬다.
- **DON'T** `useEffect` 안에서 두 가지 이상의 책임을 동시에 처리하지 않는다 (예: 목록 로드 + 카운트 로드를 한 effect로 묶지 말 것).
- **DON'T** `useMemo`/`useCallback`을 의미 없는 곳에 흩뿌리지 않는다. 안정적인 참조가 정말 필요한 경계(자식 컴포넌트 props, effect 의존성)에서만 쓴다.
- **DON'T** Presentational 컴포넌트 안에서 `useNavigate`/`useSearchParams`/`api.*` 호출 금지. 그건 페이지나 hook의 일.
- **DON'T** 한 파일에서 두 도메인을 섞지 않는다 — `useApplicantsData` 안에서 캠페인 목록을 같이 불러오지 않는다. 별도 hook(`useCampaignOptions`)으로 분리.

### 새 화면 추가 시 체크

1. **변환 함수**: 외부 모델을 view 모델로 바꾸는 코드는 `<domain>Transform.ts`의 순수 함수로 빼라.
2. **데이터 hook**: fetch + reload + 캐싱은 `use<Domain>Data.ts`.
3. **mutation hook**: 쓰기 작업은 `use<Domain>Mutations.ts`. 데이터 hook과 `onMutated` 콜백으로만 연결.
4. **다이얼로그/입력 컴포넌트**: 텍스트 상태는 컴포넌트 내부 `useState`. 부모는 `open` 토글과 `onConfirm(value)`만 알면 된다.
5. **페이지**: 위 부품들을 import해서 JSX로 엮는 것 이상의 로직을 두지 않는다.

레퍼런스 구현: `apps/admin-web/src/components/Applicants/` + `apps/admin-web/src/pages/Applicants/index.tsx`. 새 도메인 페이지를 만들기 전에 이 구조를 그대로 따라간다.

---

## 8. 도메인 개념의 시각 표현은 단일 컴포넌트

같은 도메인 개념(서브타입 pill, 카테고리 배지, 상태 배지, SNS 미디어 아이콘, 인플루언서 아바타 등)이 두 화면 이상에서 노출되면 **표현 방식을 한 컴포넌트로 격리**한다. 색/라벨/폰트/여백을 화면마다 손으로 다시 조합하지 않는다.

### 왜

- `DraftTable` 이 LIPS/ATCOSME 를 `mediaPillQoo10` 클래스로 잘못 매핑하고 있는데도 `ApplicantTable` 은 각각 `mediaPillLips`/`mediaPillAtcosme` 로 올바르게 매핑돼 있어 화면마다 색이 달라졌던 사고가 있었음. 로컬 `Record<..., string>` 상수로 스타일을 흩뿌리면 이런 드리프트가 반드시 재발한다.
- 라벨 하나 바꾸려고 여러 파일을 grep 하는 상황이 생기면 이 규칙을 이미 어긴 것.

### 룰

- **DO** 도메인 pill/badge/아이콘은 `src/components/composites/<Name>/` 에 컴포넌트로 두고, 사용처는 `<SubTypePill subType={...} />` 처럼 props 만 넘긴다. 클래스 계산은 컴포넌트 내부에서만.
- **DO** 새 화면에서 기존 도메인 개념(`subType`, `category`, `status`, `media`)을 그리기 전에 먼저 `src/components/composites/` 에 이미 컴포넌트가 있는지 확인. 없으면 사용자 확인 후 신설.
- **DON'T** 여러 파일에서 같은 개념을 `Record<..., string>` (예: `SUB_TYPE_PILL_CLASS`) + 인라인 JSX 조합으로 다시 만들지 않는다. 두 번째 사용처가 생기는 순간 컴포넌트로 승격.
- **DON'T** 동일 개념에 대해 화면마다 다른 CSS 클래스(mediaPillQoo10 vs mediaPillLips)를 손으로 매핑하지 않는다.

### 레퍼런스

- `apps/admin-web/src/components/composites/SubTypePill/` — 서브타입(QOO10/LIPS/ATCOSME) pill. `ApplicantTable`, `DraftTable` 이 공유.

---

## 9. DB 마이그레이션 안전 (운영 중)

서비스가 라이브라서, 스키마 변경은 코드 버그와 성격이 다르다. 코드는 재배포로 롤백되지만 **DB 변경은 되돌리기 어렵거나 불가능**하다(컬럼 drop = 데이터 소실). §0 의 "조심"을 실제 설계 방향으로 바꾸는 규칙.

### 핵심 사고 프레임 — Expand → Migrate → Contract

스키마를 **한 배포에 한 번에** 바꾸지 않는다. 절대 "삭제 + 이름변경"을 같은 배포에 넣지 않는다. 단계로 쪼갠다:

1. **Expand (확장)** — 새 구조를 *추가*만 한다. 기존 컬럼/테이블은 그대로 둔다. 새 컬럼은 nullable 또는 default 를 준다(기존 row 가 깨지지 않도록).
2. **Migrate (이행)** — 코드가 새 구조를 쓰도록 배포하고, 필요하면 기존 데이터를 백필한다. 이 시점엔 옛 구조와 새 구조가 공존한다.
3. **Contract (축소)** — 옛 구조를 아무도 안 쓰는 것을 확인한 뒤, *다음 배포에서* 제거한다.

예) 컬럼 이름 `foo` → `bar` 로 변경:
- ❌ 한 번에 rename → 배포 순간 옛 코드/새 코드가 섞이면 즉시 깨짐.
- ✅ ① `bar` 추가 → ② 코드가 `bar` 를 읽고 쓰도록 + `foo` 백필 → ③ 안정화 후 `foo` 제거.

### 룰

- **DO** 스키마 변경은 우선 **additive(추가형)** 으로 설계한다. 새 컬럼은 nullable 이거나 default 를 갖는다.
- **DO** `schema.prisma` 를 고쳤으면 반드시 대응 마이그레이션(`prisma migrate dev`)을 같은 작업에서 생성한다. 스키마만 고치고 마이그레이션을 빼먹지 않는다(설계도와 실제 DB 가 어긋난다).
- **DO** 마이그레이션 SQL 을 사람이 직접 읽고, 의도한 변경만 들어있는지 확인한다. Prisma 가 자동 생성한 SQL 에 예상 못 한 rename/drop 이 섞여 있지 않은지 특히 주의.
- **DON'T** 컬럼/테이블 삭제, 이름변경, non-null 제약 추가, 타입 변경 같은 **파괴적/비가역 변경을 사용자 확인 없이** 진행하지 않는다.
- **DON'T** 데이터가 있는 컬럼에 default 없는 `NOT NULL` 을 한 번에 추가하지 않는다(기존 row 가 위반).
- **DON'T** 한 마이그레이션에 무관한 변경 여러 개를 뭉치지 않는다. 롤백/리뷰 단위를 작게.

### 스키마 변경 전 체크리스트

1. 이 변경이 **하위 호환**인가? 배포 순간 옛 코드가 돌아도 안 깨지나?
2. 파괴적(drop/rename/타입변경/NOT NULL 추가)인가? → 그렇다면 expand-contract 로 쪼갤 수 있는지 검토하고, 사용자에게 확인.
3. `schema.prisma` 변경과 마이그레이션 파일이 **짝**으로 있는가?
4. 생성된 마이그레이션 SQL 을 눈으로 확인했는가? 예상 밖 구문이 없는가?
5. 기존 데이터가 새 제약을 위반하지 않는가? (default·nullable·백필 필요 여부)
