# 앙케이트 2차 — 캠페인 연결 + 응답 수집 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 캠페인에 앙케이트를 연결하면, 인플루언서가 인사이트 제출 마지막 단계에서 설문에 답하고, 운영자가 그 응답을 검수 팝업과 캠페인 리포트 엑셀에서 본다.

**Architecture:** 연결은 `campaigns.surveyId` 한 컬럼(FK 없음), 응답은 `builder_survey_responses` 한 테이블(`applicationId` 유니크 + 문항 스냅샷). 답의 모양과 "이 답이 이 문항에 맞나" 판정은 `packages/shared` 의 zod 스키마와 순수 함수 하나가 단일 소스이며, 서버와 client-web 이 같은 함수를 호출한다. 설문 응답은 인사이트 지표와 **같은 요청**으로 들어오므로 정산 차단 조건(`ensure-settlement.ts`)은 건드리지 않는다.

**Tech Stack:** Turborepo + pnpm / NestJS + Prisma 5(PostgreSQL) / React 18 + Vite / zod / ExcelJS / 테스트: `apps/api` jest, `packages/shared` vitest, `apps/admin-web` vitest(순수 함수 전용), **`apps/client-web` 은 테스트 러너가 없다**

**Spec:** [docs/superpowers/specs/2026-11-18-survey-campaign-link-design.md](../specs/2026-11-18-survey-campaign-link-design.md)

## Global Constraints

- **운영 중인 서비스다.** 이 작업의 DB 변경은 **컬럼 1개 추가 + 테이블 1개 추가**뿐이어야 한다. 기존 컬럼·테이블을 수정하지 않는다.
- **마이그레이션 적용(`prisma migrate deploy`)과 API 재시작은 사용자가 직접 한다.** 구현자는 SQL 파일을 작성하고 보고만 한다. `prisma migrate dev` 를 실행하지 않는다(`.env` 가 원격 운영 DB 를 가리킨다).
- **설문이 연결되지 않은 캠페인은 지금과 완전히 동일하게 동작해야 한다.** 이 무회귀가 최우선 요구다 — `InsightSubmitForm` 은 모든 SNS 캠페인 인플루언서가 지나는 경로이고, 리포트 엑셀은 모든 캠페인이 공유한다.
- **1차 격리 규칙을 잇는다**(1차 설계 §7): ① `campaigns.surveyId` 와 `builder_survey_responses.applicationId` 는 **FK 가 아니다** — relation `include` 로 설문을 가져오는 것은 불가능하고 `builderSurvey.findUnique` 로 애플리케이션에서 합친다. ② 응답 테이블은 `builder_` prefix. ③ 빌더 API 경로는 `admin/builder/` 아래. ④ 빌더 서비스는 기존 도메인 서비스를 import 하지 않는다. **역방향(기존 서비스가 빌더 테이블을 Prisma 로 직접 읽는 것)은 `influencer-applications`·`admin-reports`·`campaigns` 세 곳에서만 허용한다.** ⑤ 프런트의 설문 조회는 `builderApi` 만 쓴다.
- **`packages/shared` 를 수정하면 반드시 `pnpm --filter @jsure/shared build`** 를 먼저 돌린다. api 와 웹 앱은 `dist` 를 참조한다.
- **zod 단일 소스**: 요청/응답 모양은 `packages/shared/src/types/*.ts` 에서만 정의하고 타입은 `z.infer` 로 파생한다. 컨트롤러·프런트에서 손으로 다시 정의하지 않는다.
- **`ZodValidationPipe` 는 `@Body()` 파라미터에 직접 붙인다.** 메서드 레벨 `@UsePipes` 는 `@Param("id")` 까지 검증해서 깨진다.
- **api 예외 `message` 는 한국어**, `code` 는 대문자 상수. 프론트 분기는 `code` 로만.
- **admin-web 문자열은 `i18n/admin/messages.ts` 에 ko/en/ja 세 언어 모두** + `useT()`. **client-web 문자열은 `i18n/client/messages.ts` 에 키 추가 + `t()`**, 그리고 그 파일의 **문구 라인 끝에만 `// new` 주석**을 붙인다(코드 파일에는 절대 붙이지 않는다). admin 쪽에는 `// new` 를 붙이지 않는다.
- **운영자가 입력한 값은 번역하지 않는다** — 문항 제목·설명·선택지·CUSTOM 라벨. 리커트 프리셋 라벨만 i18n 에서 읽는다.
- **리커트 답은 단계 번호(1-based 정수)를 저장한다.** 라벨 문자열이 아니다. **SINGLE/MULTI 답은 선택지 문자열을 저장한다.** 인덱스가 아니다.
- 공유 파일(`i18n/*/messages.ts`, `App.tsx`, 기존 zod 스키마 블록)은 **추가만** 한다. 기존 항목 수정·재정렬 금지.
- 기존 공용 컴포넌트(`components/ui/*`, `components/composites/*`)를 **수정하지 않는다** — 읽고 쓰기만.
- `any`, `as` 남용, `@ts-ignore`, non-null 단언 `!` 금지. 변수·파라미터 약어 금지(`req`, `e`, `val`). **중첩 삼항 금지 — JSX 안에서도 분기 2개까지.**
- **작업 무관한 포맷팅 변경 금지.** `prettier --write` 를 파일 전체에 돌리지 않는다. 바꾼 줄만 바뀌어야 한다.
- 커밋 메시지는 한국어.
- **완료 보고에 배포 대상과 사이드이펙트를 명시한다**: `packages/shared` → api 재배포(Railway), 마이그레이션 적용은 사용자 작업, `admin-web`·**`client-web`**(이번에 처음 포함) Vercel 재배포, 그리고 **api 를 client-web 보다 먼저 배포해야 한다**(`surveyAnswers` 를 모르는 서버가 제출을 거부하지 않도록).

## Review Focus

- **설문 미연결 캠페인의 제출이 변한다** — 기존 캠페인 전부가 `surveyId: null` 이다. 검증 한 줄이 잘못 들어가면 전 캠페인의 인사이트 제출이 막힌다. → Task 4 테스트.
- **인사이트 재제출이 500 을 낸다** — `applicationId` 가 유니크인데 insert 로 짜면 두 번째 제출에서 제약 위반이 난다. 재제출은 기존에도 허용된다. → Task 4 테스트.
- **필수 문항 누락·선택지에 없는 값·리커트 범위 밖이 그냥 저장된다** — 서버가 거르지 않으면 엑셀에 쓰레기 값이 들어간다. → Task 1 테스트.
- **설문을 바꾼 뒤 들어온 응답의 스냅샷이 옛 문항으로 박힌다** — 스냅샷은 저장 시점 설문이어야 과거 응답 해석이 고정된다. → Task 4 테스트.
- **설문 미연결 캠페인의 엑셀 시트가 바뀐다** — 모든 캠페인 리포트가 같은 코드를 지난다. 컬럼이 하나라도 붙으면 기존 보고서 양식이 깨진다. → Task 8 테스트.

---

### Task 1: shared — 응답 스키마와 검증 순수 함수

서버와 client-web 이 같은 규칙으로 답을 검증해야 한다. 판정만 하는 순수 함수를 먼저 만든다. 이것이 없으면 뒤 태스크가 규칙을 각자 복제한다.

**Files:**
- Modify: `packages/shared/src/types/builderSurvey.ts`
- Modify: `packages/shared/src/types/builderSurvey.test.ts`

**Interfaces:**
- Consumes: 1차의 `SurveyQuestion`, `SurveyQuestionSchema`, `LIKERT_PRESETS` (같은 파일)
- Produces:
  - `SurveyAnswerSchema` / `type SurveyAnswer` — `z.union([z.string().max(2000), z.array(z.string().max(200)), z.number().int().positive()])`
  - `SurveyAnswersSchema` / `type SurveyAnswers` — `z.record(z.string().min(1), SurveyAnswerSchema)`
  - `type SurveyAnswerIssue = { questionId: string; kind: "REQUIRED_MISSING" | "UNKNOWN_OPTION" | "OUT_OF_RANGE" | "WRONG_SHAPE" }`
  - `surveyAnswerIssues(questions: SurveyQuestion[], answers: SurveyAnswers): SurveyAnswerIssue[]`
  - `likertStepCount(scale: Extract<SurveyQuestion, { type: "LIKERT" }>["scale"]): number` — 프리셋이면 5, `CUSTOM` 이면 `labels.length`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

기존 테스트 블록은 건드리지 않고 아래를 덧붙인다.

```ts
const single = { id: "q1", type: "SINGLE" as const, title: "어디서", required: true,
  options: ["인스타", "검색"] };
const multi = { id: "q2", type: "MULTI" as const, title: "무엇을", required: false,
  options: ["A", "B", "C"] };
const likert = { id: "q3", type: "LIKERT" as const, title: "만족도", required: true,
  scale: { preset: "AGREEMENT" as const } };
const text = { id: "q4", type: "TEXT" as const, title: "한마디", required: false,
  multiline: true };
const allQuestions = [single, multi, likert, text];

describe("surveyAnswerIssues", () => {
  it("전부 올바르면 빈 배열", () => {
    expect(surveyAnswerIssues(allQuestions, {
      q1: "검색", q2: ["A", "C"], q3: 4, q4: "좋았어요",
    })).toEqual([]);
  });

  it("선택 문항이 아니면 빈 답을 허용한다", () => {
    expect(surveyAnswerIssues(allQuestions, { q1: "검색", q3: 1 })).toEqual([]);
  });

  it("필수 문항이 비면 REQUIRED_MISSING", () => {
    expect(surveyAnswerIssues(allQuestions, { q3: 1 }))
      .toEqual([{ questionId: "q1", kind: "REQUIRED_MISSING" }]);
  });

  it("필수 주관식의 공백만 입력은 비어 있는 것으로 본다", () => {
    expect(surveyAnswerIssues([{ ...text, required: true }], { q4: "   " }))
      .toEqual([{ questionId: "q4", kind: "REQUIRED_MISSING" }]);
  });

  it("필수 다중선택의 빈 배열은 비어 있는 것으로 본다", () => {
    expect(surveyAnswerIssues([{ ...multi, required: true }], { q2: [] }))
      .toEqual([{ questionId: "q2", kind: "REQUIRED_MISSING" }]);
  });

  it("선택지에 없는 값이면 UNKNOWN_OPTION", () => {
    expect(surveyAnswerIssues([single], { q1: "텔레비전" }))
      .toEqual([{ questionId: "q1", kind: "UNKNOWN_OPTION" }]);
    expect(surveyAnswerIssues([multi], { q2: ["A", "없는값"] }))
      .toEqual([{ questionId: "q2", kind: "UNKNOWN_OPTION" }]);
  });

  it("리커트 프리셋은 1~5 를 벗어나면 OUT_OF_RANGE", () => {
    expect(surveyAnswerIssues([likert], { q3: 0 }))
      .toEqual([{ questionId: "q3", kind: "OUT_OF_RANGE" }]);
    expect(surveyAnswerIssues([likert], { q3: 6 }))
      .toEqual([{ questionId: "q3", kind: "OUT_OF_RANGE" }]);
  });

  it("리커트 CUSTOM 은 labels 길이가 상한이다", () => {
    const custom = { ...likert, scale: { preset: "CUSTOM" as const, labels: ["나쁨", "좋음"] } };
    expect(surveyAnswerIssues([custom], { q3: 2 })).toEqual([]);
    expect(surveyAnswerIssues([custom], { q3: 3 }))
      .toEqual([{ questionId: "q3", kind: "OUT_OF_RANGE" }]);
  });

  it("타입에 맞지 않는 모양이면 WRONG_SHAPE", () => {
    expect(surveyAnswerIssues([single], { q1: ["배열은 단일선택에 맞지 않는다"] }))
      .toEqual([{ questionId: "q1", kind: "WRONG_SHAPE" }]);
    expect(surveyAnswerIssues([likert], { q3: "문자열은 리커트에 맞지 않는다" }))
      .toEqual([{ questionId: "q3", kind: "WRONG_SHAPE" }]);
  });

  it("설문에 없는 questionId 는 무시한다", () => {
    expect(surveyAnswerIssues([single], { q1: "검색", 유령: "값" })).toEqual([]);
  });

  it("문항 순서대로 이슈를 돌려준다", () => {
    expect(surveyAnswerIssues(allQuestions, {}).map((issue) => issue.questionId))
      .toEqual(["q1", "q3"]);
  });
});

describe("likertStepCount", () => {
  it("프리셋은 5단계", () => {
    expect(likertStepCount({ preset: "AGREEMENT" })).toBe(5);
    expect(likertStepCount({ preset: "NUMERIC" })).toBe(5);
  });
  it("CUSTOM 은 labels 길이", () => {
    expect(likertStepCount({ preset: "CUSTOM", labels: ["가", "나", "다"] })).toBe(3);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/shared test`
Expected: FAIL — `surveyAnswerIssues` 가 정의되지 않음

- [ ] **Step 3: `SurveyAnswerSchema`·`SurveyAnswersSchema`·`likertStepCount`·`surveyAnswerIssues` 를 구현한다**

`surveyAnswerIssues` 는 문항을 순회하며 문항당 **최대 한 건**의 이슈를 낸다(먼저 걸리는 종류 하나). 타입 분기는 중첩 삼항이 아니라 `switch (question.type)` 으로 쓴다. 빈 값 판정: `undefined`/`null`, 공백만 있는 문자열, 빈 배열.

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm --filter @jsure/shared test`
Expected: PASS (기존 8개 + 신규 13개)

- [ ] **Step 5: export 하고 빌드한다**

`src/index.ts` 는 이미 `export * from "./types/builderSurvey.js"` 를 갖고 있으므로 수정이 필요 없다. 확인만 하고 빌드한다.

Run: `pnpm --filter @jsure/shared build && pnpm --filter @jsure/shared typecheck`
Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/types/builderSurvey.ts packages/shared/src/types/builderSurvey.test.ts
git commit -m "feat(shared): 앙케이트 응답 스키마와 검증 순수 함수 추가"
```

---

### Task 2: api — DB 스키마 (연결 컬럼 + 응답 테이블)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_add_survey_link_and_responses/migration.sql`

**Interfaces:**
- Consumes: 없음
- Produces: `prisma.campaign.surveyId`, `prisma.builderSurveyResponse.*`

- [ ] **Step 1: 스키마를 추가한다**

`Campaign` 모델에 `surveyId String?` 한 줄(주석: FK 를 걸지 않는 이유), 그리고 설계 문서 §4 의 `BuilderSurveyResponse` 모델 전체. **기존 필드·모델은 한 줄도 건드리지 않는다.** `AdminUser`/`Campaign`/`CampaignApplication` 어디에도 relation 을 추가하지 않는다.

- [ ] **Step 2: 마이그레이션 SQL 을 손으로 작성한다**

`prisma migrate dev` 를 실행하지 않는다. 기존 마이그레이션 디렉토리명 형식과 타임스탬프 순서를 따른다.

```sql
ALTER TABLE "campaigns" ADD COLUMN "surveyId" TEXT;

CREATE TABLE "builder_survey_responses" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionsSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "builder_survey_responses_applicationId_key" ON "builder_survey_responses"("applicationId");
CREATE INDEX "builder_survey_responses_surveyId_idx" ON "builder_survey_responses"("surveyId");
```

- [ ] **Step 3: 클라이언트 생성과 타입을 확인한다**

Run: `pnpm --filter @jsure/api prisma:generate && pnpm --filter @jsure/api typecheck`
Expected: 오류 없음

- [ ] **Step 4: 커밋하고 마이그레이션 적용이 사용자 작업임을 보고한다**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): 캠페인-앙케이트 연결 컬럼과 응답 테이블 추가"
```

---

### Task 3: api — 캠페인 연결 저장·조회 + 빌더 목록 검색

**Files:**
- Modify: `packages/shared/src/types/campaign.ts`
- Modify: `packages/shared/src/types/builderSurvey.ts` (목록 요청에 `q`)
- Modify: `apps/api/src/campaigns/campaigns.service.ts`, `apps/api/src/campaigns/campaigns.controller.ts` (필요 시)
- Modify: `apps/api/src/builder-surveys/builder-surveys.service.ts`, `.controller.ts`
- Test: `apps/api/src/campaigns/campaigns.service.spec.ts` (기존 파일에 추가), `apps/api/src/builder-surveys/builder-surveys.service.spec.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 2 의 `prisma.campaign.surveyId`
- Produces:
  - `CampaignFormSchema`/`UpdateCampaignRequestSchema` 에 `surveyId: z.string().nullable().default(null)`
  - `CampaignResponseSchema` 에 `surveyId: z.string().nullable()`, `surveyTitle: z.string().nullable()`
  - `BuilderSurveysService.listPage(cursor, limit, query?: string)` — 세 번째 인자 추가
  - `GET /admin/builder/surveys?q=<검색어>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// builder-surveys.service.spec.ts 에 추가
it("q 를 주면 제목 부분 일치로 거른다", async () => {
  // findMany 에 넘어간 where 가
  // { deletedAt: null, title: { contains: "7월", mode: "insensitive" } } 인지
  // count 에도 같은 where 가 가는지
});

it("q 가 비어 있거나 공백뿐이면 제목 조건을 걸지 않는다", async () => {
  // where 에 title 키가 없다
});

// campaigns.service.spec.ts 에 추가
it("surveyId 를 저장한다", async () => {});

it("surveyId 가 있으면 응답에 surveyTitle 을 채운다", async () => {
  // builderSurvey.findUnique 가 { title: "7월 설문" } → surveyTitle === "7월 설문"
  // include 로 가져오지 않는다 (FK 가 없다)
});

it("surveyId 가 null 이면 surveyTitle 도 null 이고 설문을 조회하지 않는다", async () => {
  // builderSurvey.findUnique 가 호출되지 않는다
});

it("연결된 설문이 삭제됐어도 제목을 그대로 내린다", async () => {
  // deletedAt 이 찍힌 행도 findUnique 로는 읽힌다 → 제목이 나온다
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/api test -- builder-surveys campaigns`
Expected: FAIL

- [ ] **Step 3: shared 스키마를 고치고 빌드한다**

`CampaignFormSchema`(= `CreateCampaignRequestSchema`)와 `UpdateCampaignRequestSchema`, `CampaignResponseSchema` 에 위 Produces 의 필드를 **추가만** 한다. 목록 요청 쪽에는 `q: z.string().trim().max(200).optional()`.

Run: `pnpm --filter @jsure/shared build`

- [ ] **Step 4: 서버를 구현한다**

- 빌더 목록: `q` 가 공백 아닌 값일 때만 `title: { contains: query, mode: "insensitive" }` 를 `where` 에 더한다. `findMany` 와 `count` 가 **같은 `where`** 를 써야 `total` 이 맞는다.
- 캠페인: 생성·수정에서 `surveyId` 를 저장하고, 응답 매핑에서 `surveyId` 가 있을 때만 `prisma.builderSurvey.findUnique({ where: { id }, select: { title: true } })` 로 제목을 채운다. 목록 응답을 만들 때 캠페인마다 조회하면 N+1 이므로, **목록은 `surveyId` 들을 모아 `findMany` 한 번으로** 읽고 `Map` 으로 합친다.

- [ ] **Step 5: 통과를 확인한다**

Run: `pnpm --filter @jsure/api test && pnpm --filter @jsure/api typecheck`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/types/campaign.ts packages/shared/src/types/builderSurvey.ts apps/api/src/campaigns apps/api/src/builder-surveys
git commit -m "feat(api): 캠페인에 앙케이트 연결 + 설문 목록 검색"
```

---

### Task 4: api — 인사이트 제출 시 설문 검증·응답 저장

이 태스크가 가장 위험하다. 모든 SNS 캠페인 인플루언서가 지나는 경로를 고친다.

**Files:**
- Modify: `packages/shared/src/types/application.ts`
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts`
- Modify: `apps/api/src/influencer-applications/influencer-applications.controller.ts` (필요 시)
- Test: `apps/api/src/influencer-applications/submit-insights-survey.spec.ts` (신규)

**Interfaces:**
- Consumes: Task 1 의 `SurveyAnswersSchema`·`surveyAnswerIssues`, Task 2 의 `prisma.builderSurveyResponse`
- Produces:
  - `SubmitInsightsRequestSchema` 에 `surveyAnswers: SurveyAnswersSchema.optional()`
  - `InfluencerApplicationSchema` 에 `survey: z.object({ id, title, description: z.string().nullable(), questions: z.array(SurveyQuestionSchema) }).nullable()`
  - 예외 코드 `SURVEY_ANSWERS_REQUIRED`, `SURVEY_ANSWERS_INVALID`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

기존 스펙 파일들의 prisma 스텁 방식(`admin-reports.service.spec.ts` 참조)을 따른다.

```ts
describe("submitInsights — 앙케이트", () => {
  it("설문 미연결 캠페인은 surveyAnswers 없이도 성공한다", async () => {
    // campaign.surveyId = null → 기존과 동일하게 지표만 저장
    // builderSurveyResponse.upsert 가 호출되지 않는다
  });

  it("설문 미연결인데 surveyAnswers 가 와도 조용히 무시한다", async () => {
    // 400 을 내지 않는다. upsert 도 호출하지 않는다
    // (운영자가 방금 설문을 뗀 타이밍에 제출이 들어올 수 있다)
  });

  it("설문 연결됐는데 surveyAnswers 가 없으면 SURVEY_ANSWERS_REQUIRED", async () => {});

  it("필수 문항이 비면 SURVEY_ANSWERS_INVALID 이고 지표도 저장하지 않는다", async () => {
    // submittedPost.update 가 호출되지 않는다 — 검증은 쓰기 전에 끝난다
  });

  it("정상 응답이면 지표와 함께 응답을 저장한다", async () => {
    // upsert 가 where: { applicationId } 로 호출된다
  });

  it("questionsSnapshot 은 저장 시점 설문의 questions 다", async () => {
    // 설문을 바꾼 뒤 제출 → 스냅샷이 '바뀐 뒤' 문항이어야 한다
  });

  it("재제출이면 upsert 로 갱신한다 — create 로 중복 삽입하지 않는다", async () => {
    // upsert 의 update 쪽에도 questionsSnapshot/answers 가 들어간다
    // (applicationId 가 유니크라 insert 면 제약 위반 500 이 난다)
  });

  it("설문 조회는 relation include 가 아니라 builderSurvey.findUnique 로 한다", async () => {
    // campaign.select 에 survey relation 이 없다 (FK 가 없다)
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/api test -- submit-insights-survey`
Expected: FAIL

- [ ] **Step 3: shared 스키마를 고치고 빌드한다**

`SubmitInsightsRequestSchema` 에 `surveyAnswers` 를 **추가만** 한다(기존 `insights` 블록은 그대로). `InfluencerApplicationSchema` 에 `survey` 추가.

Run: `pnpm --filter @jsure/shared build`

- [ ] **Step 4: `submitInsights` 를 고친다**

설계 문서 §6 의 순서를 그대로 따른다. **기존 검증(SNS 카테고리 / 참여 서브타입 전부 제출 / 게시물 선제출)은 순서와 코드를 바꾸지 않는다.** 설문 검증은 그 뒤, **지표 쓰기 앞**에 둔다. 응답 저장은 지표 저장과 같은 흐름 안에서 `upsert` 한다.

`INCLUDE` 의 `campaign.select` 에 `surveyId` 를 더하고, 응답 매핑에서 `survey` 를 채운다(문항까지 필요하므로 `findUnique` 로 `questions` 도 읽는다).

- [ ] **Step 5: 통과를 확인한다**

Run: `pnpm --filter @jsure/api test && pnpm --filter @jsure/api typecheck`
Expected: 전부 PASS (기존 436개가 하나도 깨지지 않아야 한다)

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/types/application.ts apps/api/src/influencer-applications
git commit -m "feat(api): 인사이트 제출 시 앙케이트 응답 검증·저장"
```

---

### Task 5: admin-web — 캠페인 폼의 앙케이트 선택

**Files:**
- Modify: `apps/admin-web/src/domains/builderSurvey/api.ts` (목록 호출에 `q`)
- Create: `apps/admin-web/src/components/CampaignForm/SurveySelectField.tsx`
- Modify: `apps/admin-web/src/components/CampaignForm/` 의 폼 본체 (캠페인 단위 필드 영역)
- Modify: `i18n/admin/messages.ts`

**Interfaces:**
- Consumes: Task 3 의 `GET /admin/builder/surveys?q=`, `CampaignResponse.surveyId`/`surveyTitle`
- Produces: 캠페인 폼 값에 `surveyId: string | null`

- [ ] **Step 1: `listSurveysPage` 에 `query` 인자를 더한다**

`domains/builderSurvey/api.ts` 의 시그니처를 `listSurveysPage(cursor, limit, query?)` 로 늘리고 `q` 를 쿼리스트링에 싣는다. **`builderApi` 를 계속 쓴다.** 기존 목록 화면의 호출부는 세 번째 인자를 주지 않으므로 동작이 변하지 않는다.

- [ ] **Step 2: `SurveySelectField` 를 만든다**

props 로만 동작하는 presentational 컴포넌트 + 자체 검색 상태. 설계 §5 의 배치(캠페인 단위 필드 영역, recruit 행이 아님).

- 선택 안 함(`null`)이 기본이자 첫 항목
- 입력하면 서버에 `q` 로 재조회(디바운스는 기존 `useDebouncedValue` 재사용)
- 현재 연결된 설문이 첫 페이지 밖에 있어도 **선택된 값은 항상 보여야 한다** — `CampaignResponse.surveyTitle` 을 받아 표시한다
- 보조 문구: "연결하면 인플루언서가 인사이트 제출 시 이 설문에 답합니다."

- [ ] **Step 3: 폼에 연결하고 경고를 단다**

수정 모드에서 **이미 응답이 있으면** 설문을 바꿀 때 경고 문구를 띄운다(설계 §5). 응답 수는 이번 범위에서 별도 API 를 만들지 않으므로, **경고는 "이미 응답이 있을 수 있습니다"가 아니라 조건 없는 안내 문구로 둔다** — 정확한 응답 수가 필요해지면 그때 API 를 추가한다. 이 단순화는 구현자 재량이 아니라 이 계획의 결정이다.

- [ ] **Step 4: i18n 키를 ko/en/ja 로 추가하고 검증한다**

Run: `pnpm --filter @jsure/admin-web test && pnpm --filter @jsure/admin-web build`
Expected: 전부 PASS (`build` 가 3개 언어 누락을 잡는다)

- [ ] **Step 5: 커밋**

```bash
git add apps/admin-web/src/domains/builderSurvey apps/admin-web/src/components/CampaignForm i18n/admin/messages.ts
git commit -m "feat(admin-web): 캠페인 폼에 앙케이트 연결 필드 추가"
```

---

### Task 6: client-web — 인사이트 제출의 앙케이트 단계

**client-web 에는 테스트 러너가 없다.** 검증은 `pnpm typecheck` + 수동 확인이다. 로직(검증)은 Task 1 의 shared 순수 함수가 이미 테스트로 덮고 있으므로, 이 태스크는 그 함수를 호출하는 UI 만 만든다 — **검증 규칙을 여기서 다시 적지 마라.**

**Files:**
- Create: `apps/client-web/src/domains/application/components/SurveyStepForm.tsx` (+ `.module.css`)
- Modify: `apps/client-web/src/domains/application/components/InsightSubmitForm.tsx`
- Modify: `apps/client-web/src/domains/application/api.ts` (제출 요청에 `surveyAnswers`)
- Modify: `apps/client-web/src/pages/Applications/Detail.tsx` (`survey` 전달)
- Modify: `i18n/client/messages.ts`

**Interfaces:**
- Consumes: Task 1 의 `SurveyAnswers`·`surveyAnswerIssues`·`likertStepCount`, Task 4 의 `InfluencerApplication.survey`·`SubmitInsightsRequest.surveyAnswers`
- Produces: 없음 (최종 소비자)

- [ ] **Step 1: `SurveyStepForm` 을 만든다**

props: `{ survey, initialAnswers, onBack, onSubmit, submitting }`. 설계 §6 의 스케치대로 문항 타입 4종을 렌더한다.

- 타입 분기는 `switch`, JSX 중첩 삼항 금지
- 필수 문항에 `*`
- 리커트 라벨은 `i18n/client/messages.ts` 의 프리셋 키에서 읽고, `CUSTOM` 은 저장된 라벨을 그대로 쓴다(번역하지 않는다). 단계 수는 `likertStepCount`
- `NUMERIC` 은 1~5 숫자 + 양끝 라벨
- **문항 제목·설명·선택지는 운영자 입력이라 번역하지 않는다**
- 제출 시도 시 `surveyAnswerIssues` 로 판정하고, `kind` 별 i18n 문구를 해당 문항 아래에 붙인다. **문구는 여기서, 규칙은 shared 에서**
- 입력 상태는 이 컴포넌트가 소유한다(부모로 끌어올리면 IME 가 깨진다)

- [ ] **Step 2: 마법사에 단계를 더한다**

`InsightSubmitForm` 이 `survey` prop 을 받는다. `survey` 가 `null` 이면 **지금과 완전히 동일하게** 동작한다(단계 수·버튼 문구·제출 페이로드 전부). `survey` 가 있으면 마지막에 단계를 하나 더 붙이고, 최종 제출에서 지표와 응답을 **한 번에** `onSubmit` 으로 넘긴다. 단계 표시(n/m)에 설문 단계가 포함된다.

- [ ] **Step 3: API 호출과 페이지를 연결한다**

`submitInsights` 가 `surveyAnswers` 를 함께 보낸다(없으면 필드 자체를 넣지 않는다). `Detail.tsx` 가 `data.survey` 를 `InsightSubmitForm` 에 내린다.

- [ ] **Step 4: i18n 키를 추가한다**

`i18n/client/messages.ts` 에 ja/ko 를 채우고, **그 파일의 문구 라인 끝에만 `// new`** 를 붙인다. 코드 파일에는 붙이지 않는다.

- [ ] **Step 5: 검증한다**

Run: `pnpm --filter @jsure/client-web build && pnpm typecheck`
Expected: 오류 없음

수동 확인(자동 테스트 불가): 설문 미연결 캠페인의 제출이 종전과 같은지 / 설문 단계가 마지막에 붙는지 / 필수 문항을 비우면 막히는지 / 한글·일본어 IME 입력 중 focus 가 끊기지 않는지.

- [ ] **Step 6: 커밋**

```bash
git add apps/client-web/src i18n/client/messages.ts
git commit -m "feat(client-web): 인사이트 제출에 앙케이트 단계 추가"
```

---

### Task 7: 검수 팝업의 응답 표시 (api + admin-web)

**Files:**
- Modify: `packages/shared/src/types/adminInfluencer.ts` (`AdminSubmissionSchema`)
- Modify: `apps/api/src/admin-applications/` 의 제출물 상세 서비스
- Create: `apps/admin-web/src/domains/application/components/drafts/SurveyResponseSection.tsx`
- Modify: `apps/admin-web/src/domains/application/components/drafts/InsightDetailDialog.tsx`
- Modify: `i18n/admin/messages.ts`
- Test: 해당 api 서비스 스펙 (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 2 의 `prisma.builderSurveyResponse`, Task 1 의 `SurveyAnswers`
- Produces: `AdminSubmissionSchema.surveyResponse` — `{ questionsSnapshot: SurveyQuestion[], answers: SurveyAnswers, submittedAt: string } | null`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it("응답이 없으면 surveyResponse 가 null", async () => {});
it("응답이 있으면 스냅샷·답·제출시각을 내린다", async () => {});
it("응답 조회는 applicationId 로 한 번만 한다", async () => {
  // findUnique({ where: { applicationId } }) — relation include 가 아니다
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm --filter @jsure/api test -- admin-applications`
Expected: FAIL

- [ ] **Step 3: shared 스키마와 서버를 구현하고 빌드한다**

`surveyResponse` 를 **추가만** 한다. 서버는 `builderSurveyResponse.findUnique({ where: { applicationId } })` 로 읽는다(FK 없음).

Run: `pnpm --filter @jsure/shared build`

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm --filter @jsure/api test`
Expected: PASS

- [ ] **Step 5: `SurveyResponseSection` 을 만들고 팝업에 붙인다**

설계 §7-1 의 스케치. **문항과 순서는 `questionsSnapshot` 에서 읽는다**(현재 설문이 아니다 — 그 사람이 답한 그대로를 보여주는 자리다). 리커트는 `라벨 (4/5)` 형태로, 라벨은 현재 어드민 언어의 i18n 에서 읽는다. 답이 없는 문항은 빈 값 표시. `surveyResponse` 가 `null` 이면 섹션을 그리지 않는다.

`InsightDetailDialog` 의 **지표 섹션 아래**에 둔다. 기존 섹션들의 마크업·클래스를 바꾸지 않는다.

- [ ] **Step 6: 검증하고 커밋한다**

Run: `pnpm --filter @jsure/admin-web test && pnpm --filter @jsure/admin-web build`

```bash
git add packages/shared/src/types/adminInfluencer.ts apps/api/src/admin-applications apps/admin-web/src/domains/application/components/drafts i18n/admin/messages.ts
git commit -m "feat: 인사이트 검수 팝업에 앙케이트 응답 표시"
```

---

### Task 8: 캠페인 리포트 엑셀의 설문 컬럼 (api + admin-web)

이 작업의 핵심 산출물이다.

**Files:**
- Modify: `packages/shared/src/types/adminReport.ts`
- Modify: `apps/api/src/admin-reports/admin-reports.service.ts`, `.controller.ts`
- Create: `apps/admin-web/src/pages/Reports/surveyColumns.ts`
- Create: `apps/admin-web/src/pages/Reports/surveyColumns.test.ts`
- Modify: `apps/admin-web/src/pages/Reports/index.tsx`
- Modify: `i18n/admin/messages.ts` (필요 시)
- Test: `apps/api/src/admin-reports/admin-reports.service.spec.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 2 의 `prisma.builderSurveyResponse`, Task 1 의 `SurveyAnswers`·`likertStepCount`
- Produces:
  - `CampaignReportParticipantSchema` 에 `surveyAnswers: SurveyAnswersSchema.nullable()`
  - `CampaignParticipantsResponseSchema` 에 `survey: z.object({ id: z.string(), questions: z.array(SurveyQuestionSchema) }).nullable()`
  - `buildSurveyColumns(questions: SurveyQuestion[] | null, translateLabel: Translator): { key: string; label: string; value: (participant: CampaignReportParticipant) => string }[]` — `questions` 가 `null` 이면 빈 배열

- [ ] **Step 1: 서버 테스트를 쓴다**

```ts
it("설문 미연결 캠페인은 survey 가 null 이고 참가자 surveyAnswers 도 null", async () => {});
it("설문 연결 캠페인은 survey.questions 를 함께 내린다", async () => {});
it("같은 응모의 서브타입 행들이 같은 surveyAnswers 를 갖는다", async () => {
  // Instagram + TikTok 참여 → 2행, 둘 다 같은 답 (응답은 응모 단위)
});
it("응답 조회는 applicationId 묶음으로 한 번에 한다", async () => {
  // findMany({ where: { applicationId: { in: [...] } } }) — 행마다 조회하지 않는다
});
```

- [ ] **Step 2: 프런트 순수 함수 테스트를 쓴다**

```ts
// surveyColumns.test.ts
const questions = [
  { id: "q1", type: "SINGLE", title: "어디서 알았나요", required: true, options: ["인스타", "검색"] },
  { id: "q2", type: "MULTI", title: "무엇을 샀나요", required: false, options: ["A", "B"] },
  { id: "q3", type: "LIKERT", title: "만족도", required: true, scale: { preset: "AGREEMENT" } },
  { id: "q4", type: "TEXT", title: "한마디", required: false, multiline: true },
];

describe("buildSurveyColumns", () => {
  it("헤더가 Q번호. 문항제목 형식이다", () => {
    expect(buildSurveyColumns(questions, label).map((column) => column.label))
      .toEqual(["Q1. 어디서 알았나요", "Q2. 무엇을 샀나요", "Q3. 만족도", "Q4. 한마디"]);
  });

  it("설문이 null 이면 빈 배열 — 시트에 컬럼이 붙지 않는다", () => {
    expect(buildSurveyColumns(null, label)).toEqual([]);
  });

  it("미응답 참가자는 빈 문자열", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns.map((column) => column.value({ surveyAnswers: null })))
      .toEqual(["", "", "", ""]);
  });

  it("다중선택은 하나의 셀에 모아 쓴다", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns[1].value({ surveyAnswers: { q2: ["A", "B"] } })).toBe("A, B");
  });

  it("리커트는 라벨과 단계를 함께 쓴다", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns[2].value({ surveyAnswers: { q3: 4 } })).toBe("그렇다 (4/5)");
  });

  it("현재 설문에 없는 questionId 의 답은 버린다", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns).toHaveLength(4); // 지워진 문항의 컬럼은 생기지 않는다
  });

  it("문항에 답이 없으면 그 칸만 빈다", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns[3].value({ surveyAnswers: { q1: "검색" } })).toBe("");
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `pnpm --filter @jsure/api test -- admin-reports && pnpm --filter @jsure/admin-web test -- surveyColumns`
Expected: 양쪽 FAIL

- [ ] **Step 4: shared 와 서버를 구현하고 빌드한다**

참가자 행은 이미 `subTypes` 별로 펼쳐진다(`admin-reports.service.ts:198`). 응답은 응모 단위이므로 **그 행들에 같은 답을 반복해 싣는다.** 응답은 `applicationId` 묶음으로 `findMany` 한 번에 읽는다.

Run: `pnpm --filter @jsure/shared build`

- [ ] **Step 5: `buildSurveyColumns` 를 구현한다**

`packages/shared` 가 아니라 `pages/Reports/` 에 둔다 — 리커트 라벨 i18n 과 엑셀 표현(배열 잇기)이 섞이기 때문이다. 리커트 라벨은 Task 7 과 같은 i18n 키를 쓴다.

- [ ] **Step 6: 엑셀 생성에 컬럼을 붙인다**

`pages/Reports/index.tsx:511` 의 `sheet.columns` 에서 `recruitPeriodColumns` **뒤에** 설문 컬럼을 잇고, 행 작성 루프에도 같은 순서로 더한다. **설문이 없으면 빈 배열이라 시트가 지금과 완전히 동일하다.**

- [ ] **Step 7: 통과를 확인하고 커밋한다**

Run: `pnpm --filter @jsure/api test && pnpm --filter @jsure/admin-web test && pnpm --filter @jsure/admin-web build && pnpm typecheck`
Expected: 전부 PASS

수동 확인: 설문 연결 캠페인과 미연결 캠페인을 함께 선택해 받았을 때, 미연결 시트에는 컬럼이 안 붙고 연결 시트에만 우측에 `Q1.`… 이 붙는지.

```bash
git add packages/shared/src/types/adminReport.ts apps/api/src/admin-reports apps/admin-web/src/pages/Reports i18n/admin/messages.ts
git commit -m "feat: 캠페인 리포트 엑셀에 앙케이트 문항 컬럼 추가"
```
