# 빌더 제품 + 앙케이트 빌더 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민 상단에 "빌더" 제품 탭을 신설하고, 그 사이드바의 "앙케이트" 메뉴에서 단일 선택·다중 선택·리커트 척도·주관식 문항으로 설문을 만들고 목록에서 복사·수정·삭제한다.

**Architecture:** 빌더는 별도 앱이 아니라 `admin-web` 의 세 번째 제품(`/builder` prefix)이다. 문항은 정규화하지 않고 `builder_surveys.questions` JSONB 한 컬럼에 배열로 들어가며, 그 모양은 `packages/shared` 의 zod discriminated union 하나가 서버 검증과 화면 폼 양쪽의 단일 소스가 된다. DB·API 는 기존 `apps/api` 를 공유하되, 나중에 전용 서버·DB 로 떼어낼 수 있도록 **기존 테이블과 FK 를 걸지 않고**, 경로는 `admin/builder/` 한 덩어리로, 프런트는 전용 axios 인스턴스 `builderApi` 만 쓴다.

**Tech Stack:** Turborepo + pnpm / NestJS + Prisma 5(PostgreSQL) / React 18 + Vite / zod / `@dnd-kit` / 테스트: `apps/api` jest, `packages/shared` vitest, `apps/admin-web` vitest

**Spec:** [docs/superpowers/specs/2026-11-16-builder-survey-design.md](../specs/2026-11-16-builder-survey-design.md)

## Global Constraints

- **운영 중인 서비스다.** 이 작업의 DB 변경은 `CREATE TABLE` 하나뿐이어야 한다. 기존 테이블·컬럼을 건드리면 안 된다.
- **마이그레이션 적용(`prisma migrate deploy`)과 API 재시작은 사용자가 직접 한다.** 구현자는 마이그레이션 SQL 파일을 작성하고 보고만 한다. `prisma migrate dev` 를 실행하지 않는다.
- **`packages/shared` 를 수정하면 반드시 `pnpm --filter @jsure/shared build`** 를 먼저 돌린다. api 와 웹 앱은 `dist` 를 참조한다.
- **zod 단일 소스**: 요청/응답 모양은 `packages/shared/src/types/builderSurvey.ts` 에서만 정의하고 타입은 `z.infer` 로 파생한다. 컨트롤러·프런트에서 손으로 다시 정의하지 않는다.
- **`ZodValidationPipe` 는 `@Body()` 파라미터에 직접 붙인다.** 메서드 레벨 `@UsePipes` 는 `@Param("id")` 까지 검증해서 깨진다.
- **api 예외 `message` 는 한국어**, `code` 는 대문자 상수.
- **admin-web 문자열은 `i18n/admin/messages.ts` 에 ko/en/ja 세 언어 모두** 넣고 `useT()` 로 참조한다. 하나라도 비면 `pnpm --filter @jsure/admin-web build` 가 `validate-i18n` 에서 실패한다. `// new` 주석은 붙이지 않는다(그 규칙은 `i18n/client/messages.ts` 전용).
- **빌더 격리 규칙 5가지**(설계 문서 §7) — ① 빌더 테이블은 기존 테이블과 FK 금지, ② 테이블명 `builder_` prefix, ③ API 경로는 전부 `admin/builder/` 아래, ④ 빌더 서비스는 기존 서비스를 import 하지 않음, ⑤ 프런트 빌더 코드는 `builderApi` 만 사용(`api` 직접 호출 금지).
- **문항 `id` 는 생성 후 불변.** 프런트가 `crypto.randomUUID()` 로 만들고, 서버는 중복만 검증한다.
- **`schemaVersion` 은 요청 바디로 받지 않는다.** 서버가 상수 `1` 을 박는다.
- `any`, `as` 남용, `@ts-ignore`, non-null `!` 금지. 변수·파라미터 약어 금지(`req`, `e`, `val`). 중첩 삼항 금지.
- `components/ui/*`, `components/composites/*` 는 **읽기만** 하고 수정하지 않는다(기존 화면 회귀 위험).
- 커밋 메시지는 한국어.
- **완료 보고에 배포 대상과 사이드이펙트를 명시한다**(CODE_RULES §0): `apps/api` 재배포(Railway) + 마이그레이션 적용 필요, `apps/admin-web` 재배포(Vercel), `packages/shared` 변경이 `api` 재배포를 유발함, `client-web`·`jwin-*` 무변경. 공유 파일(`lib/navigation.ts`, `App.tsx`, `lib/api.ts`, `i18n/admin/messages.ts`)은 **추가만** 했고 기존 항목을 건드리지 않았음을 함께 적는다.

## Review Focus

- **같은 `updatedAt` 을 가진 설문이 페이지 경계에 걸림** — 복사로 만들어진 설문은 원본과 초 단위까지 같을 수 있다. `id` 타이브레이커가 없으면 행이 중복 표시되거나 누락된다. → Task 3 테스트.
- **문항 `id` 중복** — 문항 복제(`⧉`)가 새 `id` 발급을 빠뜨리면 2차에서 응답 키가 충돌한다. 서버가 거부해야 한다. → Task 1 테스트.
- **삭제된 설문에 대한 조회·수정** — `deletedAt` 이 찍힌 행이 `GET :id` / `PUT :id` 로 되살아나면 soft delete 가 무의미해진다. 404 여야 한다. → Task 3 테스트.
- **문항 타입 변경 시 잔여 필드** — 단일 선택 → 주관식으로 바꿨는데 `options` 가 남아 전송되면 저장은 통과해도(zod 는 strip) 화면 상태와 DB 가 어긋난다. 타입 전환은 그 타입에 필요한 필드만 남겨야 한다. → Task 6 테스트.
- **리커트 `CUSTOM` 라벨 개수 경계** — 1개 또는 11개가 저장되면 응답 화면이 깨진다. 2~10 범위를 shared 가 막아야 한다. → Task 1 테스트.

---

### Task 1: shared — 설문 문항 zod 스키마

빌더 전체가 이 스키마 하나를 공유한다. 서버 검증·프런트 폼·API 계약이 전부 여기서 파생되므로 가장 먼저 만든다.

**Files:**
- Create: `packages/shared/src/types/builderSurvey.ts`
- Create: `packages/shared/src/types/builderSurvey.test.ts`
- Modify: `packages/shared/src/index.ts` (export 추가)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `LIKERT_PRESETS = ["AGREEMENT", "SATISFACTION", "FREQUENCY", "NUMERIC"] as const`
  - `type LikertPreset`, `type SurveyQuestion`, `type SurveyQuestionType = "SINGLE" | "MULTI" | "LIKERT" | "TEXT"`
  - `SurveyQuestionSchema`, `SurveyQuestionsSchema`
  - `BuilderSurveyListItemSchema` / `type BuilderSurveyListItem`
    — `{ id, title, createdAt, updatedAt, createdByName, updatedByName }` (모두 string)
  - `BuilderSurveyPageResponseSchema` / `type BuilderSurveyPageResponse`
    — `{ items: BuilderSurveyListItem[], nextCursor: string | null, total: number }`
  - `BuilderSurveyResponseSchema` / `type BuilderSurveyResponse`
    — 목록 항목 + `{ description: string | null, questions: SurveyQuestion[] }`
  - `CreateBuilderSurveyRequestSchema` / `type CreateBuilderSurveyRequest`
    — `{ title: string, description?: string, questions: SurveyQuestion[] }`
  - `UpdateBuilderSurveyRequestSchema` / `type UpdateBuilderSurveyRequest` (Create 와 같은 모양)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// packages/shared/src/types/builderSurvey.test.ts
import { describe, it, expect } from "vitest";
import { SurveyQuestionsSchema } from "./builderSurvey.js";

const single = { id: "q1", type: "SINGLE", title: "어디서 알았나요", required: true,
  options: ["인스타", "검색"] };
const likertPreset = { id: "q2", type: "LIKERT", title: "재구매 의향", required: false,
  scale: { preset: "AGREEMENT" } };
const text = { id: "q3", type: "TEXT", title: "개선점", required: false, multiline: true };

describe("SurveyQuestionsSchema", () => {
  it("네 타입을 모두 통과시킨다", () => {
    const multi = { ...single, id: "q4", type: "MULTI" };
    expect(SurveyQuestionsSchema.safeParse([single, multi, likertPreset, text]).success).toBe(true);
  });

  it("문항이 하나도 없으면 거부한다", () => {
    expect(SurveyQuestionsSchema.safeParse([]).success).toBe(false);
  });

  it("문항 id 가 중복되면 거부한다", () => {
    expect(SurveyQuestionsSchema.safeParse([single, { ...text, id: "q1" }]).success).toBe(false);
  });

  it("선택지가 2개 미만이면 거부한다", () => {
    expect(SurveyQuestionsSchema.safeParse([{ ...single, options: ["하나"] }]).success).toBe(false);
  });

  it("리커트 CUSTOM 라벨은 2~10개만 허용한다", () => {
    const custom = (labels: string[]) =>
      SurveyQuestionsSchema.safeParse([{ ...likertPreset, scale: { preset: "CUSTOM", labels } }]);
    expect(custom(["하나"]).success).toBe(false);
    expect(custom(["나쁨", "보통", "좋음"]).success).toBe(true);
    expect(custom(Array.from({ length: 11 }, (_, index) => `라벨${index}`)).success).toBe(false);
  });

  it("프리셋이 아닌 척도 이름을 거부한다", () => {
    expect(SurveyQuestionsSchema.safeParse([
      { ...likertPreset, scale: { preset: "WHATEVER" } },
    ]).success).toBe(false);
  });

  it("타입에 맞지 않는 필드는 걸러낸다", () => {
    const parsed = SurveyQuestionsSchema.parse([{ ...text, options: ["남은 값"] }]);
    expect(parsed[0]).not.toHaveProperty("options");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/shared test`
Expected: FAIL — `builderSurvey.js` 를 찾을 수 없음

- [ ] **Step 3: `packages/shared/src/types/builderSurvey.ts` 를 구현한다**

설계 문서 §5 "문항 스키마" 의 모양을 그대로 쓴다. 제약은 아래 값으로 고정:

| 필드 | 제약 |
|---|---|
| `id` | `z.string().min(1)` |
| `title` | `z.string().min(1).max(200)` |
| `description` | `z.string().max(500).optional()` |
| `required` | `z.boolean()` |
| `options` (SINGLE/MULTI) | `z.array(z.string().min(1).max(200)).min(2).max(30)` |
| `scale` (LIKERT) | `{ preset: z.enum(LIKERT_PRESETS) }` 또는 `{ preset: "CUSTOM", labels: z.array(z.string().min(1).max(50)).min(2).max(10) }` 의 discriminated union |
| `multiline` (TEXT) | `z.boolean()` |

`SurveyQuestionsSchema` 는 `z.array(SurveyQuestionSchema).min(1)` 에 `superRefine` 으로 `id` 중복을 막는다(중복된 첫 항목의 인덱스에 이슈를 붙인다).

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm --filter @jsure/shared test`
Expected: PASS (7 tests)

- [ ] **Step 5: `packages/shared/src/index.ts` 에 `export * from "./types/builderSurvey.js";` 를 추가하고 빌드한다**

Run: `pnpm --filter @jsure/shared build && pnpm --filter @jsure/shared typecheck`
Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/types/builderSurvey.ts packages/shared/src/types/builderSurvey.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): 앙케이트 문항 zod 스키마 추가"
```

---

### Task 2: api — `builder_surveys` 테이블과 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (모델 추가, 기존 모델 수정 금지)
- Create: `apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_add_builder_surveys/migration.sql`

**Interfaces:**
- Consumes: 없음
- Produces: Prisma 모델 `BuilderSurvey` — `prisma.builderSurvey.*` 로 Task 3 이 접근한다.

- [ ] **Step 1: `schema.prisma` 에 모델을 추가한다**

설계 문서 §5 의 블록을 그대로 쓴다. 파일 끝의 다른 모델들과 같은 스타일로 두고, 주석(FK 를 걸지 않는 이유)을 함께 남긴다. **기존 모델에는 한 줄도 손대지 않는다** — `AdminUser` 에 `builderSurveys` relation 을 추가하지 않는 것이 핵심이다.

- [ ] **Step 2: 마이그레이션 SQL 을 손으로 작성한다**

`prisma migrate dev` 를 실행하지 않는다(운영 DB 를 가리킨다). 디렉토리명의 타임스탬프는 기존 마이그레이션들의 형식을 따른다.

```sql
CREATE TABLE "builder_surveys" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "builder_surveys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "builder_surveys_deletedAt_updatedAt_id_idx" ON "builder_surveys"("deletedAt", "updatedAt", "id");
```

- [ ] **Step 3: Prisma 클라이언트를 생성하고 타입을 확인한다**

Run: `pnpm --filter @jsure/api prisma:generate && pnpm --filter @jsure/api typecheck`
Expected: 오류 없음. (워크트리에서 작업 중이면 그 워크트리에서도 `prisma:generate` 가 필요하다.)

- [ ] **Step 4: 커밋하고, 마이그레이션 적용이 필요함을 사용자에게 보고한다**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): builder_surveys 테이블 추가"
```

보고 문구에 포함할 것: 추가된 테이블 이름, `prisma migrate deploy` 가 **사용자 작업**이라는 점, 기존 테이블 변경 없음.

---

### Task 3: api — `builder-surveys` 모듈 (CRUD + 커서 페이지네이션)

**Files:**
- Create: `apps/api/src/builder-surveys/builder-surveys.service.ts`
- Create: `apps/api/src/builder-surveys/builder-surveys.controller.ts`
- Create: `apps/api/src/builder-surveys/builder-surveys.module.ts`
- Create: `apps/api/src/builder-surveys/builder-surveys.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (`BuilderSurveysModule` 등록)

**Interfaces:**
- Consumes: Task 1 의 `BuilderSurveyPageResponse`, `BuilderSurveyResponse`, `CreateBuilderSurveyRequest`, `UpdateBuilderSurveyRequest`, `SurveyQuestionsSchema`. Task 2 의 `prisma.builderSurvey`.
- Produces:
  - `BuilderSurveysService.listPage(cursor: string | null, limit: number): Promise<BuilderSurveyPageResponse>`
  - `BuilderSurveysService.get(id: string): Promise<BuilderSurveyResponse>`
  - `BuilderSurveysService.create(adminUserId: string, body: CreateBuilderSurveyRequest): Promise<BuilderSurveyResponse>`
  - `BuilderSurveysService.update(id: string, adminUserId: string, body: UpdateBuilderSurveyRequest): Promise<BuilderSurveyResponse>`
  - `BuilderSurveysService.softDelete(id: string): Promise<void>`
  - `export const UNKNOWN_ADMIN_NAME = "unknown"`
  - HTTP: `GET|POST /admin/builder/surveys`, `GET|PUT|DELETE /admin/builder/surveys/:id`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`admin-reports.service.spec.ts` 처럼 prisma 스텁 객체를 손으로 만들고 NestJS 테스팅 모듈 없이 생성자에 넣는다.

```ts
// apps/api/src/builder-surveys/builder-surveys.service.spec.ts
describe("BuilderSurveysService", () => {
  it("limit+1 을 받아 nextCursor 를 마지막 행 id 로 돌려준다", async () => {
    // 31건을 돌려주는 스텁 + limit 30 → items 30개, nextCursor = 30번째 id
  });

  it("마지막 페이지면 nextCursor 가 null 이다", async () => {
    // 5건 + limit 30 → nextCursor null
  });

  it("정렬은 updatedAt desc, id desc 두 키를 쓴다", async () => {
    // findMany 에 넘어간 orderBy 를 그대로 검증:
    // [{ updatedAt: "desc" }, { id: "desc" }]
    // (같은 updatedAt 인 복사본과 원본이 페이지 경계에서 밀리지 않게 하는 키다)
  });

  it("목록·조회는 deletedAt: null 로 거른다", async () => {
    // findMany / findFirst 에 넘어간 where 에 deletedAt: null 이 있는지
  });

  it("삭제된 설문 조회는 NotFoundException", async () => {
    // findFirst 가 null → get() rejects
  });

  it("삭제된 설문 수정은 NotFoundException 이고 update 를 호출하지 않는다", async () => {});

  it("작성자 이름이 비면 unknown 으로 채운다", async () => {
    // adminUser.findMany 가 [{ id: "u1", name: null, ... }] → createdByName === "unknown"
    // adminUser 조회 결과에 아예 없는 id 도 "unknown"
  });

  it("삭제는 deletedAt 을 채우고 행을 지우지 않는다", async () => {
    // update 가 { deletedAt: <Date> } 로 호출되고 delete 는 호출되지 않는다
  });

  it("create 는 schemaVersion 1 과 createdBy=updatedBy=요청자로 저장한다", async () => {});

  it("update 는 updatedBy 만 바꾸고 createdBy 는 건드리지 않는다", async () => {});
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/api test -- builder-surveys`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: `builder-surveys.service.ts` 를 구현한다**

- 커서는 `influencers.service.ts:205-234` 의 `listForAdminPage` 패턴을 그대로 따른다 — `take: limit + 1`, `...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})`, 한 건 더 받아 `hasMore` 판정.
- `orderBy: [{ updatedAt: "desc" }, { id: "desc" }]`, `where: { deletedAt: null }`, `total` 은 같은 `where` 로 `count`.
- 작성자 이름: 페이지의 `createdBy`/`updatedBy` 를 모아 `prisma.adminUser.findMany({ where: { id: { in: [...] } }, select: { id: true, name: true } })` 로 한 번에 읽고 `Map` 으로 채운다. **relation include 를 쓰지 않는다**(FK 가 없다). 없거나 `name` 이 비면 `UNKNOWN_ADMIN_NAME`.
- `questions` 는 DB 에서 읽을 때 `SurveyQuestionsSchema.parse()` 를 거쳐 응답에 담는다(JSONB 는 Prisma 가 `JsonValue` 로 주므로 여기서 모양을 확정한다).
- 쓰기 시 `questions` 는 `body.questions` 를 그대로, `schemaVersion: 1` 은 서버 상수.
- 없는 id·삭제된 id 는 `NotFoundException({ code: "SURVEY_NOT_FOUND", message: "앙케이트를 찾을 수 없습니다" })`.

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm --filter @jsure/api test -- builder-surveys`
Expected: PASS (10 tests)

- [ ] **Step 5: 컨트롤러와 모듈을 만들고 `app.module.ts` 에 등록한다**

`admin-notices.controller.ts` 를 형태 레퍼런스로 삼는다. `@UseGuards(JwtAuthGuard)` + `@Controller("admin/builder/surveys")`.

```ts
@Get()    list(@Query("cursor") cursor?: string, @Query("limit") limit?: string): Promise<BuilderSurveyPageResponse>
@Get(":id")    get(@Param("id") id: string): Promise<BuilderSurveyResponse>
@Post()        create(@Req() request: { user: AuthenticatedUser },
                      @Body(new ZodValidationPipe(CreateBuilderSurveyRequestSchema)) body: CreateBuilderSurveyRequest)
@Put(":id")    update(@Param("id") id: string, @Req() request: { user: AuthenticatedUser },
                      @Body(new ZodValidationPipe(UpdateBuilderSurveyRequestSchema)) body: UpdateBuilderSurveyRequest)
@Delete(":id") @HttpCode(204) remove(@Param("id") id: string): Promise<void>
```

`limit` 은 파싱 실패·범위 밖이면 기본 30, 상한 100 으로 잘라 서비스에 넘긴다.

- [ ] **Step 6: 전체 테스트와 타입을 확인한다**

Run: `pnpm --filter @jsure/api test && pnpm --filter @jsure/api typecheck`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add apps/api/src/builder-surveys apps/api/src/app.module.ts
git commit -m "feat(api): 앙케이트 CRUD 모듈 추가"
```

---

### Task 4: admin-web — 빌더 제품 탭과 라우트 뼈대

이 태스크가 끝나면 상단에 빌더 탭이 보이고 `/builder/surveys` 가 빈 화면으로 열린다. 목록·편집은 다음 태스크에서 이 자리에 들어간다.

**Files:**
- Modify: `apps/admin-web/src/lib/navigation.ts`
- Create: `apps/admin-web/src/lib/navigation.test.ts`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `i18n/admin/messages.ts`
- Create: `apps/admin-web/src/pages/Builder/Surveys.tsx` (플레이스홀더)
- Modify: `apps/admin-web/src/lib/api.ts` (`builderApi` 추가)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `ProductKey` 에 `"builder"` 추가, `PRODUCTS` 에 `BUILDER_PRODUCT`
  - `builderApi: AxiosInstance` (`@/lib/api`)
  - 라우트 `/builder`, `/builder/surveys`, `/builder/surveys/new`, `/builder/surveys/:id/edit`
  - i18n 키 `nav.products.builder`, `nav.products.builderDescription`, `nav.groups.builder`, `nav.items.surveys`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// apps/admin-web/src/lib/navigation.test.ts
import { describe, it, expect } from "vitest";
import { findProductByPath } from "./navigation";

describe("findProductByPath", () => {
  it("/builder 하위는 빌더 제품이다", () => {
    expect(findProductByPath("/builder/surveys").key).toBe("builder");
    expect(findProductByPath("/builder/surveys/abc/edit").key).toBe("builder");
  });

  it("빌더 탭 추가가 기존 제품 판정을 바꾸지 않는다", () => {
    expect(findProductByPath("/jwin/campaigns").key).toBe("jwin");
    expect(findProductByPath("/campaigns").key).toBe("influencer");
    expect(findProductByPath("/builders-note").key).toBe("influencer");
  });
});
```

마지막 단언이 중요하다 — prefix 매칭이 `startsWith("/builder")` 로 느슨해지면 `/builders-note` 같은 경로가 빌더로 빨려 들어간다. 기존 `findProductByPath` 는 `pathname === prefix || startsWith(prefix + "/")` 라 안전하므로, 이 테스트는 그 성질을 고정한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/admin-web test -- navigation`
Expected: FAIL — `/builder/surveys` 가 `influencer` 로 판정됨

- [ ] **Step 3: `navigation.ts` 에 `BUILDER_PRODUCT` 를 추가한다**

설계 문서 §4 의 블록 그대로. `ProductKey` 에 `"builder"` 를 더하고 `PRODUCTS` 배열 끝에 넣는다. 아이콘은 제품 `fa-solid fa-screwdriver-wrench`, 메뉴 `fa-solid fa-clipboard-question`.

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm --filter @jsure/admin-web test -- navigation`
Expected: PASS

- [ ] **Step 5: i18n 키를 ko/en/ja 로 추가한다**

| 키 | ko | en | ja |
|---|---|---|---|
| `nav.products.builder` | 빌더 | Builder | ビルダー |
| `nav.products.builderDescription` | 앙케이트·양식 제작 | Survey & form builder | アンケート・フォーム作成 |
| `nav.groups.builder` | 제작 | Build | 作成 |
| `nav.items.surveys` | 앙케이트 | Surveys | アンケート |

- [ ] **Step 6: `builderApi` 와 라우트를 추가한다**

`lib/api.ts` 에 설계 문서 §4 의 인스턴스를 `jwinApi` 바로 아래에 두고, `attachAuthInterceptors(builderApi)` 를 `attachAuthInterceptors(jwinApi)` 옆에 한 줄 추가한다(`lib/api.ts:115`).

`App.tsx` 의 J-WIN 라우트 블록 아래에 빌더 블록을 추가한다. `/builder` → `/builder/surveys` redirect, 나머지 세 경로는 Task 5·6 의 페이지가 들어올 자리다. 이 태스크에서는 `Surveys.tsx` 가 제목과 빈 상태 문구만 렌더링한다.

- [ ] **Step 7: 검증하고 커밋한다**

Run: `pnpm --filter @jsure/admin-web test && pnpm --filter @jsure/admin-web build`
Expected: 전부 PASS (`build` 가 `validate-i18n` 을 돌려 3개 언어 누락을 잡는다)

수동 확인: `pnpm --filter @jsure/admin-web dev` 로 띄워 상단 탭이 3개로 늘어나도 레이아웃이 깨지지 않는지, 빌더 탭 클릭 시 `/builder/surveys` 로 가는지 본다.

```bash
git add apps/admin-web/src/lib/navigation.ts apps/admin-web/src/lib/navigation.test.ts apps/admin-web/src/lib/api.ts apps/admin-web/src/App.tsx apps/admin-web/src/pages/Builder i18n/admin/messages.ts
git commit -m "feat(admin-web): 빌더 제품 탭과 앙케이트 라우트 추가"
```

---

### Task 5: admin-web — 앙케이트 목록 화면

**Files:**
- Create: `apps/admin-web/src/domains/builderSurvey/api.ts`
- Create: `apps/admin-web/src/components/BuilderSurveys/copyTitle.ts`
- Create: `apps/admin-web/src/components/BuilderSurveys/copyTitle.test.ts`
- Create: `apps/admin-web/src/components/BuilderSurveys/useSurveyListData.ts`
- Create: `apps/admin-web/src/components/BuilderSurveys/useSurveyMutations.ts`
- Create: `apps/admin-web/src/components/BuilderSurveys/SurveyTable.tsx`
- Modify: `apps/admin-web/src/pages/Builder/Surveys.tsx` (플레이스홀더 → 조립)
- Modify: `i18n/admin/messages.ts`

**Interfaces:**
- Consumes: Task 1 의 응답 타입들, Task 4 의 `builderApi`
- Produces:
  - `listSurveysPage(cursor: string | null, limit: number): Promise<BuilderSurveyPageResponse>`
  - `fetchSurvey(id: string): Promise<BuilderSurveyResponse>`
  - `createSurvey(body: CreateBuilderSurveyRequest): Promise<BuilderSurveyResponse>`
  - `updateSurvey(id: string, body: UpdateBuilderSurveyRequest): Promise<BuilderSurveyResponse>`
  - `deleteSurvey(id: string): Promise<void>`
  - `copyTitle(title: string, suffix: string): string`
  - `SURVEYS_PAGE_SIZE = 30`
  - `useSurveyListData()` → `{ state, surveys, total, hasMore, loadingMore, loadMore, reload }`

- [ ] **Step 1: 복사 제목 생성의 실패하는 테스트를 쓴다**

```ts
// apps/admin-web/src/components/BuilderSurveys/copyTitle.test.ts
describe("copyTitle", () => {
  it("접미사를 괄호로 덧붙인다", () => {
    expect(copyTitle("7월 설문", "사본")).toBe("7월 설문 (사본)");
  });

  it("이미 복사본인 제목에도 그대로 덧붙인다", () => {
    expect(copyTitle("7월 설문 (사본)", "사본")).toBe("7월 설문 (사본) (사본)");
  });

  it("200자를 넘기지 않도록 원본 제목을 자른다", () => {
    const long = "가".repeat(200);
    const result = copyTitle(long, "사본");
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(" (사본)")).toBe(true);
  });
});
```

세 번째가 핵심이다 — 제목 상한이 200자(Task 1)라 긴 제목을 그대로 복사하면 서버가 400을 돌려준다.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/admin-web test -- copyTitle`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `copyTitle(title: string, suffix: string): string` 을 구현한다**

`" (" + suffix + ")"` 를 붙이되 전체가 200자를 넘으면 앞의 제목을 잘라 맞춘다.

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm --filter @jsure/admin-web test -- copyTitle`
Expected: PASS

- [ ] **Step 5: `domains/builderSurvey/api.ts` 를 만든다**

`domains/influencer/api.ts:23` 의 `listInfluencersPage` 를 형태 레퍼런스로 삼는다. 호출은 전부 `builderApi`, 응답은 전부 `Schema.parse(res.data)`.

- [ ] **Step 6: `useSurveyListData.ts` 를 만든다**

`domains/influencer/useInfluencersData.ts` 를 그대로 따른다 — `useInfiniteQuery`, `SURVEYS_PAGE_SIZE = 30`, `getNextPageParam: (lastPage) => lastPage.nextCursor`, 로드 상태는 `{ kind: "loading" | "ready" | "error" }` 유니온.

- [ ] **Step 7: `useSurveyMutations.ts` 를 만든다**

복사·삭제와 확인 다이얼로그 상태를 담는다. 복사는 **전용 엔드포인트 없이** `fetchSurvey(id)` → `copyTitle(원본.title, t("..."))` → `createSurvey({ title, description, questions })`. 성공하면 `onMutated` 로 알리고 호출부가 `reload()` + 선택 해제.

- [ ] **Step 8: `SurveyTable.tsx` 와 페이지를 조립한다**

설계 문서 §9-1 의 표 구성. presentational 컴포넌트는 props 로만 동작한다(fetch·route 접근 금지).

- 컬럼: 선택 라디오 / 제목 / 생성일 / 수정일 / 생성자 / 수정자 / `[···]`
- `[···]` 는 `components/composites/ActionMenu` — 수정(편집으로 이동), 삭제(`danger: true`)
- 삭제 확인은 `components/composites/ConfirmDialog`
- 표는 `components/composites/ScrollTable`
- 무한 스크롤 sentinel 과 `IntersectionObserver` 는 `pages/Influencers/index.tsx:160-180` 의 `loadMoreRef` 처리까지 그대로 가져온다
- 상단 우측: 복사(선택된 행이 있을 때만 활성) / 생성 버튼

i18n 키는 `pages.builderSurveys.*` 네임스페이스로 ko/en/ja 전부(제목, 컬럼명, 버튼, 빈 상태, 삭제 확인 문구, 복사 접미사 `copySuffix`, 로드 실패 메시지).

- [ ] **Step 9: 검증하고 커밋한다**

Run: `pnpm --filter @jsure/admin-web test && pnpm --filter @jsure/admin-web build`

수동 확인: 목록이 뜨고, 31건 이상일 때 스크롤로 다음 페이지가 붙고, 복사 → 새 행이 맨 위에 생기고, 삭제 → 행이 사라지고 선택이 풀리는지.

```bash
git add apps/admin-web/src/domains/builderSurvey apps/admin-web/src/components/BuilderSurveys apps/admin-web/src/pages/Builder i18n/admin/messages.ts
git commit -m "feat(admin-web): 앙케이트 목록 화면 추가"
```

---

### Task 6: admin-web — 앙케이트 생성·수정 화면

**Files:**
- Modify: `apps/admin-web/package.json` (`@dnd-kit/*` 3종 추가)
- Create: `apps/admin-web/src/components/BuilderSurveys/questionDefaults.ts`
- Create: `apps/admin-web/src/components/BuilderSurveys/questionDefaults.test.ts`
- Create: `apps/admin-web/src/components/BuilderSurveys/SurveyEditorForm.tsx`
- Create: `apps/admin-web/src/components/BuilderSurveys/QuestionCard.tsx`
- Create: `apps/admin-web/src/components/BuilderSurveys/QuestionOptionsEditor.tsx`
- Create: `apps/admin-web/src/components/BuilderSurveys/LikertScaleEditor.tsx`
- Create: `apps/admin-web/src/pages/Builder/SurveyEdit.tsx`
- Modify: `apps/admin-web/src/App.tsx` (`/builder/surveys/new`, `/builder/surveys/:id/edit` 연결)
- Modify: `i18n/admin/messages.ts`

**Interfaces:**
- Consumes: Task 1 의 `SurveyQuestion`·`SurveyQuestionsSchema`·`LIKERT_PRESETS`, Task 5 의 `fetchSurvey`/`createSurvey`/`updateSurvey`
- Produces:
  - `newQuestion(type: SurveyQuestionType): SurveyQuestion` — 새 `id` 와 타입별 기본값
  - `changeQuestionType(question: SurveyQuestion, nextType: SurveyQuestionType): SurveyQuestion`
  - `duplicateQuestion(question: SurveyQuestion): SurveyQuestion`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// apps/admin-web/src/components/BuilderSurveys/questionDefaults.test.ts
// SurveyQuestion 은 discriminated union 이라 .options / .scale 에 직접 접근하면
// 타입 에러가 난다. 단언은 toMatchObject 로 쓴다.
describe("newQuestion", () => {
  it("선택형은 빈 선택지 2개로 시작한다", () => {
    expect(newQuestion("SINGLE")).toMatchObject({ type: "SINGLE", options: ["", ""] });
  });

  it("리커트는 AGREEMENT 프리셋으로 시작한다", () => {
    expect(newQuestion("LIKERT")).toMatchObject({ scale: { preset: "AGREEMENT" } });
  });

  it("주관식은 여러 줄로 시작한다", () => {
    expect(newQuestion("TEXT")).toMatchObject({ type: "TEXT", multiline: true });
  });

  it("매번 다른 id 를 발급한다", () => {
    expect(newQuestion("TEXT").id).not.toBe(newQuestion("TEXT").id);
  });
});

describe("changeQuestionType", () => {
  it("선택형 → 주관식이면 options 가 사라지고 multiline 이 생긴다", () => {
    const changed = changeQuestionType(newQuestion("SINGLE"), "TEXT");
    expect(changed).not.toHaveProperty("options");
    expect(changed).toMatchObject({ type: "TEXT", multiline: true });
  });

  it("주관식 → 리커트면 multiline 이 사라지고 scale 이 생긴다", () => {
    const changed = changeQuestionType(newQuestion("TEXT"), "LIKERT");
    expect(changed).not.toHaveProperty("multiline");
    expect(changed).toMatchObject({ scale: { preset: "AGREEMENT" } });
  });

  it("단일 → 다중은 선택지와 id, 제목, 필수여부를 유지한다", () => {
    const single = { ...newQuestion("SINGLE"), title: "질문", required: true,
      options: ["가", "나", "다"] };
    const changed = changeQuestionType(single, "MULTI");
    expect(changed).toMatchObject({ id: single.id, title: "질문", required: true,
      type: "MULTI", options: ["가", "나", "다"] });
  });
});

describe("duplicateQuestion", () => {
  it("내용은 같고 id 만 새로 발급한다", () => {
    const original = { ...newQuestion("SINGLE"), title: "원본" };
    const copy = duplicateQuestion(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.title).toBe("원본");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/admin-web test -- questionDefaults`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `questionDefaults.ts` 를 구현한다**

`id` 는 `crypto.randomUUID()`. 타입 분기는 중첩 삼항이 아니라 `switch` 로 쓴다(모든 케이스를 적으면 타입 체커가 누락을 잡는다). `changeQuestionType` 은 공통 필드(`id`, `title`, `description`, `required`)만 옮기고 나머지는 새 타입의 기본값으로 다시 만든다 — 단, `SINGLE ↔ MULTI` 는 `options` 를 유지한다.

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm --filter @jsure/admin-web test -- questionDefaults`
Expected: PASS (9 tests)

- [ ] **Step 5: `@dnd-kit` 의존성을 추가한다**

```bash
pnpm --filter @jsure/admin-web add @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2
```

- [ ] **Step 6: 문항 내부 에디터 둘을 만든다**

- `QuestionOptionsEditor` — 선택지 목록 + `+ 선택지 추가` / `×` 삭제. 2개 미만으로는 못 내려간다(마지막 두 개의 `×` 는 비활성).
- `LikertScaleEditor` — 프리셋 5종(`AGREEMENT`/`SATISFACTION`/`FREQUENCY`/`NUMERIC`/`CUSTOM`) 선택. 프리셋이면 라벨은 읽기 전용 미리보기, `CUSTOM` 이면 라벨 2~10개를 `QuestionOptionsEditor` 와 같은 방식으로 입력. 프리셋 라벨 문구는 i18n 키(`builderSurveys.likert.AGREEMENT.1` … `.5`)에서 읽는다 — **DB 에는 프리셋 이름만 저장한다.** `NUMERIC` 은 1~5 숫자를 그리고 양끝에만 라벨을 붙인다.

둘 다 presentational — `value` 와 `onChange` props 로만 동작한다(fetch·route 접근 금지).

- [ ] **Step 7: `QuestionCard` 와 `SurveyEditorForm` 을 만든다 (드래그앤드롭 포함)**

- `QuestionCard` — 제목·설명·타입 select·필수 토글 + Step 6 의 두 에디터 + `⧉` 복제 / `🗑` 삭제. 타입 변경은 `changeQuestionType` 을 통해서만 한다. `useSortable({ id: question.id })` 로 드래그 핸들(`⠿`)을 단다.
- `SurveyEditorForm` — 설문 제목·설명 + 문항 카드 스택 + `+ 문항 추가` + 저장/취소.
  - `DndContext`(`PointerSensor` + `KeyboardSensor`, `closestCenter`) + `SortableContext`(`verticalListSortingStrategy`), `onDragEnd` 에서 `arrayMove`.
  - `useSortable` 의 `id` 는 문항 `id`(UUID) — 인덱스를 쓰면 정렬 중 키가 바뀌어 애니메이션이 튄다.
  - 세로 이탈 방지는 CSS `transform` 의 x 를 0으로 고정한다(`@dnd-kit/modifiers` 를 추가하지 않는다).
  - 검증은 `SurveyQuestionsSchema` 를 `zodResolver` 로 그대로 쓴다.
  - `↑` `↓` 버튼은 두지 않는다 — `KeyboardSensor` 가 키보드 경로를 제공한다.

- [ ] **Step 8: 페이지를 조립하고 라우트를 연결한다**

`pages/Builder/SurveyEdit.tsx` 는 `mode: "create" | "edit"` prop 을 받아 조립만 한다(`pages/Notices/Edit.tsx` 가 같은 방식). `edit` 이면 `fetchSurvey` 로 채우고, 저장은 `createSurvey`/`updateSurvey`, 성공 후 `/builder/surveys` 로 이동. 저장하지 않고 나가려 하면 `ConfirmDialog`.

`App.tsx` 의 Task 4 자리에 `/builder/surveys/new` → `<SurveyEdit mode="create" />`, `/builder/surveys/:id/edit` → `<SurveyEdit mode="edit" />` 를 연결한다.

i18n 키는 `pages.builderSurveys.editor.*` 와 `builderSurveys.likert.*` 로 ko/en/ja 전부.

- [ ] **Step 9: 검증하고 커밋한다**

Run: `pnpm --filter @jsure/admin-web test && pnpm --filter @jsure/admin-web build && pnpm typecheck`

수동 확인: 문항 4종을 섞어 만들고 저장 → 목록에 뜨고 → 다시 열었을 때 그대로인지. 드래그로 순서를 바꾸고 저장 → 순서가 유지되는지. 핸들에 Tab 으로 포커스를 주고 Space → ↓ → Space 로 키보드 재정렬이 되는지. 리커트 `CUSTOM` 라벨을 1개로 줄이면 저장이 막히는지.

```bash
git add apps/admin-web/package.json pnpm-lock.yaml apps/admin-web/src/components/BuilderSurveys apps/admin-web/src/pages/Builder apps/admin-web/src/App.tsx i18n/admin/messages.ts
git commit -m "feat(admin-web): 앙케이트 생성·수정 화면 추가"
```
