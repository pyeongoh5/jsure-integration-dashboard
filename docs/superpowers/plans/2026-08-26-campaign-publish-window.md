# 캠페인 게시(투고) 기간 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민이 캠페인마다 게시(투고) 기간을 지정하고, 그 시작 시각 이전에는 인플루언서가 투고 URL 을 제출할 수 없게 만든다.

**Architecture:** `Campaign` 에 nullable `publishStartAt`/`publishEndAt` 두 컬럼을 추가한다. 차단은 `apps/api` 의 세 제출 메서드가 공통으로 부르는 가드 하나로 처리한다. 게시 마감 계산은 지금 4곳에 복제돼 있는데, `@jsure/shared` 의 순수 함수 하나로 모으고 "게시 기간이 있으면 그 종료 시각이 마감"이라는 규칙을 그 함수에만 둔다. 클라이언트는 상태(`BEFORE`/`OPEN`/`AFTER`)를 받아 버튼 비활성화와 안내 문구를 렌더링한다.

**Tech Stack:** Turborepo + pnpm 모노레포 / NestJS + Prisma(PostgreSQL) / React + Vite / zod / jest(api 전용)

**설계 문서:** [docs/superpowers/specs/2026-08-26-campaign-publish-window-design.md](../specs/2026-08-26-campaign-publish-window-design.md)

## Global Constraints

- **운영 중인 서비스다.** 기존 캠페인은 `publishStartAt`/`publishEndAt` 이 NULL 이므로 차단·문구·리마인더가 **현재와 완전히 동일하게** 동작해야 한다. 이 무회귀가 최우선 요구다.
- **테스트 러너는 `apps/api` 의 jest 뿐이다.** `packages/shared` 와 두 웹 앱에는 테스트 러너가 없다. shared 순수 함수의 테스트도 `apps/api` 안에 `.spec.ts` 로 둔다. 웹 앱 변경의 검증은 `pnpm typecheck` + 명시된 수동 확인 절차다.
- **`packages/shared` 를 수정하면 반드시 `pnpm --filter @jsure/shared build` 를 먼저 돌린다.** api 의 jest 와 두 웹 앱은 `dist` 를 참조하므로, 빌드하지 않으면 타입/런타임이 어긋난다.
- **zod 단일 소스**: 요청/응답 모양은 `packages/shared/src/types/*.ts` 에서 정의하고 타입은 `z.infer` 로만 파생한다. 컨트롤러나 프론트에서 손으로 다시 정의하지 않는다.
- **`ZodValidationPipe` 는 `@Body()` 파라미터에 직접 붙인다.** 메서드 레벨 `@UsePipes` 는 `@Param("id")` 까지 검증해서 깨진다.
- **api 예외 `message` 는 한국어**, `code` 는 대문자 상수. 프론트 분기는 `code` 로만.
- **client-web 의 화면 문자열은 전부 `i18n/messages.ts` 키 + `t("...")`.** 인라인 리터럴 금지. `// new` 주석은 **`i18n/*/messages.ts` 의 문구 라인 끝에만** 붙인다 — `.ts`/`.tsx` 코드 파일에는 절대 붙이지 않는다.
- **admin-web 문자열은 `i18n/admin/messages.ts` 에 ko/en/ja 세 언어 모두** 추가하고 `useT()`/`translate()` 로 참조한다.
- `any`, `as` 남용, `@ts-ignore`, non-null `!` 금지. 변수·파라미터 이름에 약어 금지 (`req`, `e`, `val` 등).
- 시간대는 **JST(UTC+9)** 고정. 어드민 입력값은 JST 로컬 문자열, DB 와 인플루언서 응답은 UTC ISO.
- 게시 종료 시각은 **차단에 쓰지 않는다.** 종료 후에도 제출은 허용하고 안내만 띄운다.
- 커밋 메시지는 한국어.

---

### Task 1: shared — 게시 기간 상태와 마감 계산 순수 함수

게시 마감 계산이 지금 4곳에 복제돼 있다. 먼저 단일 소스가 될 순수 함수를 만든다. 이 함수가 없으면 뒤 태스크가 전부 계산을 또 복제하게 된다.

**Files:**
- Create: `packages/shared/src/utils/publishWindow.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/api/src/influencer-applications/publish-window.spec.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `type PublishWindowState = "NONE" | "BEFORE" | "OPEN" | "AFTER"`
  - `publishWindowState(input: { publishStartAt: string | Date | null; publishEndAt: string | Date | null; now: Date }): PublishWindowState`
  - `resolvePostingDeadline(input: { publishEndAt: string | Date | null; anchorAt: string | Date | null; postingPeriodDays: number }): Date | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/influencer-applications/publish-window.spec.ts` 생성:

```ts
import { publishWindowState, resolvePostingDeadline } from "@jsure/shared";

const START = "2026-09-01T01:00:00.000Z"; // JST 2026-09-01 10:00
const END = "2026-09-10T14:59:59.000Z"; // JST 2026-09-10 23:59

describe("publishWindowState", () => {
  it("게시 기간이 없으면 NONE", () => {
    expect(
      publishWindowState({
        publishStartAt: null,
        publishEndAt: null,
        now: new Date("2026-08-28T00:00:00Z"),
      }),
    ).toBe("NONE");
  });

  it("시작 이전이면 BEFORE", () => {
    expect(
      publishWindowState({
        publishStartAt: START,
        publishEndAt: END,
        now: new Date("2026-08-28T00:00:00Z"),
      }),
    ).toBe("BEFORE");
  });

  it("시작 시각과 동일하면 OPEN — 경계는 열려 있다", () => {
    expect(
      publishWindowState({
        publishStartAt: START,
        publishEndAt: END,
        now: new Date(START),
      }),
    ).toBe("OPEN");
  });

  it("기간 중이면 OPEN", () => {
    expect(
      publishWindowState({
        publishStartAt: START,
        publishEndAt: END,
        now: new Date("2026-09-05T00:00:00Z"),
      }),
    ).toBe("OPEN");
  });

  it("종료 이후면 AFTER", () => {
    expect(
      publishWindowState({
        publishStartAt: START,
        publishEndAt: END,
        now: new Date("2026-09-11T00:00:00Z"),
      }),
    ).toBe("AFTER");
  });
});

describe("resolvePostingDeadline", () => {
  it("게시 종료가 있으면 그것이 마감", () => {
    expect(
      resolvePostingDeadline({
        publishEndAt: END,
        anchorAt: "2026-08-20T00:00:00Z",
        postingPeriodDays: 14,
      })?.toISOString(),
    ).toBe(new Date(END).toISOString());
  });

  it("게시 종료가 없으면 기준일 + postingPeriodDays", () => {
    expect(
      resolvePostingDeadline({
        publishEndAt: null,
        anchorAt: "2026-08-20T00:00:00Z",
        postingPeriodDays: 14,
      })?.toISOString(),
    ).toBe("2026-09-03T00:00:00.000Z");
  });

  it("게시 종료도 기준일도 없으면 null", () => {
    expect(
      resolvePostingDeadline({
        publishEndAt: null,
        anchorAt: null,
        postingPeriodDays: 14,
      }),
    ).toBeNull();
  });

  it("기준일이 없어도 게시 종료가 있으면 마감이 나온다", () => {
    expect(
      resolvePostingDeadline({
        publishEndAt: END,
        anchorAt: null,
        postingPeriodDays: 14,
      })?.toISOString(),
    ).toBe(new Date(END).toISOString());
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm --filter @jsure/api test -- publish-window.spec
```
Expected: FAIL — `publishWindowState` / `resolvePostingDeadline` 이 `@jsure/shared` 에서 export 되지 않아 컴파일 에러.

- [ ] **Step 3: 순수 함수 구현**

`packages/shared/src/utils/publishWindow.ts` 생성:

```ts
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 캠페인 게시(투고) 기간의 현재 상태.
 * NONE = 게시 기간 미설정(제약 없음), BEFORE = 시작 전(제출 차단),
 * OPEN = 기간 중, AFTER = 종료 후(제출은 허용하고 안내만).
 */
export type PublishWindowState = "NONE" | "BEFORE" | "OPEN" | "AFTER";

export function publishWindowState(input: {
  publishStartAt: string | Date | null;
  publishEndAt: string | Date | null;
  now: Date;
}): PublishWindowState {
  if (!input.publishStartAt || !input.publishEndAt) return "NONE";
  const startMs = new Date(input.publishStartAt).getTime();
  const endMs = new Date(input.publishEndAt).getTime();
  const nowMs = input.now.getTime();
  if (nowMs < startMs) return "BEFORE";
  if (nowMs > endMs) return "AFTER";
  return "OPEN";
}

/**
 * 게시 마감. 게시 기간이 설정돼 있으면 그 종료 시각이 마감이고,
 * 없으면 기존 상대 마감(수령일·주문일 + postingPeriodDays).
 * 게시 기간도 기준일도 없으면 마감이 없다(null).
 */
export function resolvePostingDeadline(input: {
  publishEndAt: string | Date | null;
  /** SNS·단순 리뷰 = receivedAt, 가구매 = orderSubmittedAt */
  anchorAt: string | Date | null;
  postingPeriodDays: number;
}): Date | null {
  if (input.publishEndAt) return new Date(input.publishEndAt);
  if (!input.anchorAt) return null;
  return new Date(
    new Date(input.anchorAt).getTime() + input.postingPeriodDays * DAY_MS,
  );
}
```

`packages/shared/src/index.ts` — `utils/krAddress.js` export 아래에 추가:

```ts
export * from "./utils/publishWindow.js";
```

- [ ] **Step 4: 빌드하고 테스트 통과 확인**

```bash
pnpm --filter @jsure/shared build
pnpm --filter @jsure/api test -- publish-window.spec
```
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/utils/publishWindow.ts packages/shared/src/index.ts apps/api/src/influencer-applications/publish-window.spec.ts
git commit -m "feat(shared): 게시 기간 상태·게시 마감 계산 순수 함수 추가"
```

---

### Task 2: DB 컬럼과 어드민 캠페인 계약

게시 기간을 저장할 곳과 어드민이 주고받을 계약을 만든다. UI 는 아직 없고, 스키마·서비스·마이그레이션까지만.

**Files:**
- Modify: `apps/api/prisma/schema.prisma:139` (Campaign 모델, `postingPeriodDays` 아래)
- Create: `apps/api/prisma/migrations/<타임스탬프>_add_campaign_publish_window/migration.sql`
- Modify: `packages/shared/src/types/campaign.ts` (`CampaignFormSchema`, `UpdateCampaignRequestSchema`, `CampaignDraftRequestSchema`, `CampaignResponseSchema`)
- Modify: `apps/api/src/campaigns/campaigns.service.ts` (JST 헬퍼, `toResponse`, `toDraftCampaignData`, `create`, `update`)
- Test: `apps/api/src/campaigns/campaigns.service.spec.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - Prisma: `Campaign.publishStartAt: DateTime?`, `Campaign.publishEndAt: DateTime?`
  - `jstDateTimeToUtc(dateTimeStr: string): Date` — `"2026-09-01T10:00"` → JST 해석 UTC Date
  - `utcToJstDateTimeStr(date: Date): string` — UTC Date → `"2026-09-01T10:00"`
  - 어드민 계약 필드 `publishStartDateTime`, `publishEndDateTime` (`string | null`, JST 로컬 `YYYY-MM-DDTHH:mm`)

- [ ] **Step 1: JST datetime 변환 헬퍼의 실패하는 테스트 작성**

`apps/api/src/campaigns/campaigns.service.spec.ts` 의 `describe("JST date conversion helpers", ...)` 블록 안, 기존 `utcToJstDateStr` 테스트 뒤에 추가:

```ts
  it("jstDateTimeToUtc converts YYYY-MM-DDTHH:mm as JST", () => {
    // 2026-09-01 10:00 JST === 2026-09-01 01:00 UTC
    expect(jstDateTimeToUtc("2026-09-01T10:00").toISOString()).toBe(
      "2026-09-01T01:00:00.000Z",
    );
  });

  it("utcToJstDateTimeStr round-trips through jstDateTimeToUtc", () => {
    expect(utcToJstDateTimeStr(jstDateTimeToUtc("2026-09-10T23:59"))).toBe(
      "2026-09-10T23:59",
    );
  });
```

같은 파일 맨 위 import 에 `jstDateTimeToUtc`, `utcToJstDateTimeStr` 를 추가한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm --filter @jsure/api test -- campaigns.service.spec
```
Expected: FAIL — `jstDateTimeToUtc` is not exported.

- [ ] **Step 3: 헬퍼 구현**

`apps/api/src/campaigns/campaigns.service.ts` 의 `utcToJstDateStr` 아래에 추가:

```ts
/** 어드민 폼의 JST 로컬 문자열("2026-09-01T10:00") → UTC Date. */
export function jstDateTimeToUtc(dateTimeStr: string): Date {
  return new Date(`${dateTimeStr}:00+09:00`);
}

/** UTC Date → 어드민 폼용 JST 로컬 문자열("2026-09-01T10:00"). */
export function utcToJstDateTimeStr(date: Date): string {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm --filter @jsure/api test -- campaigns.service.spec
```
Expected: PASS

- [ ] **Step 5: Prisma 스키마에 컬럼 추가**

`apps/api/prisma/schema.prisma` 의 `Campaign` 모델, `postingPeriodDays Int @default(14)` 바로 아래:

```prisma
  /// 게시(투고) 기간 시작. null 이면 투고 시점 제약이 없다.
  /// publishEndAt 과 항상 함께 설정되거나 함께 null 이다.
  publishStartAt     DateTime?
  /// 게시(투고) 기간 종료. 지난 뒤에도 제출은 허용하며 안내·마감 계산에만 쓴다.
  publishEndAt       DateTime?
```

- [ ] **Step 6: 마이그레이션 생성**

```bash
pnpm --filter @jsure/api exec prisma migrate dev --name add_campaign_publish_window --create-only
```

생성된 `migration.sql` 이 아래와 같은지 **눈으로 확인한다.** `ALTER TABLE ... ADD COLUMN` 두 줄만 있어야 하고, `DROP` 이나 `NOT NULL` 이 있으면 잘못된 것이다:

```sql
ALTER TABLE "campaigns" ADD COLUMN     "publishEndAt" TIMESTAMP(3),
ADD COLUMN     "publishStartAt" TIMESTAMP(3);
```

이어서 로컬 DB 에 적용하고 클라이언트를 재생성한다:

```bash
pnpm --filter @jsure/api exec prisma migrate dev
```

- [ ] **Step 7: shared 계약 필드 추가**

`packages/shared/src/types/campaign.ts` — 파일 상단 `DateOnly` 정의 옆에 추가:

```ts
/** 어드민 폼의 JST 로컬 날짜·시각. `<input type="datetime-local">` 값 형식. */
const JstDateTime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    "YYYY-MM-DD HH:mm 형식이어야 합니다",
  );
```

`CampaignFormSchema` 의 `postingPeriodDays` 필드 아래에 추가:

```ts
    publishStartDateTime: JstDateTime.nullable().default(null),
    publishEndDateTime: JstDateTime.nullable().default(null),
```

`CampaignFormSchema` 의 기존 `.refine((d) => d.recruitStartDate <= d.recruitEndDate, ...)` 체인 뒤에 두 개를 더 붙인다:

```ts
  .refine(
    (form) =>
      (form.publishStartDateTime === null) ===
      (form.publishEndDateTime === null),
    {
      path: ["publishEndDateTime"],
      message: "게시 기간은 시작과 종료를 함께 입력해주세요",
    },
  )
  .refine(
    (form) =>
      form.publishStartDateTime === null ||
      form.publishEndDateTime === null ||
      form.publishStartDateTime < form.publishEndDateTime,
    {
      path: ["publishEndDateTime"],
      message: "게시 종료는 시작 이후여야 합니다",
    },
  )
```

`UpdateCampaignRequestSchema` 의 `postingPeriodDays` 아래에 추가:

```ts
    publishStartDateTime: JstDateTime.nullable().optional(),
    publishEndDateTime: JstDateTime.nullable().optional(),
```

`CampaignDraftRequestSchema` 의 `recruitEndDate` 아래에 추가 (임시저장은 작성 중인 빈 값을 허용):

```ts
  publishStartDateTime: z
    .union([JstDateTime, z.literal("")])
    .nullable()
    .optional(),
  publishEndDateTime: z
    .union([JstDateTime, z.literal("")])
    .nullable()
    .optional(),
```

`CampaignResponseSchema` 의 `postingPeriodDays` 아래에 추가 (`default(null)` 은 이 필드를 아직 내려주지 않는 구 api 와의 배포 갭 대비 — 기존 `fullOptions` 와 같은 이유):

```ts
  /** 게시(투고) 기간. JST 로컬 문자열. null 이면 투고 시점 제약 없음. */
  publishStartDateTime: z.string().nullable().default(null),
  publishEndDateTime: z.string().nullable().default(null),
```

- [ ] **Step 8: 어드민 서비스의 저장·응답 매핑 4곳 수정**

`apps/api/src/campaigns/campaigns.service.ts`

`toResponse` — `postingPeriodDays: row.postingPeriodDays,` 아래:

```ts
    publishStartDateTime: row.publishStartAt
      ? utcToJstDateTimeStr(row.publishStartAt)
      : null,
    publishEndDateTime: row.publishEndAt
      ? utcToJstDateTimeStr(row.publishEndAt)
      : null,
```

`toDraftCampaignData` — `postingPeriodDays: ...` 아래 (빈 문자열도 미입력으로 취급):

```ts
    publishStartAt: input.publishStartDateTime
      ? jstDateTimeToUtc(input.publishStartDateTime)
      : null,
    publishEndAt: input.publishEndDateTime
      ? jstDateTimeToUtc(input.publishEndDateTime)
      : null,
```

`create` 의 `prisma.campaign.create({ data: ... })` — `postingPeriodDays: input.postingPeriodDays,` 아래:

```ts
        publishStartAt: input.publishStartDateTime
          ? jstDateTimeToUtc(input.publishStartDateTime)
          : null,
        publishEndAt: input.publishEndDateTime
          ? jstDateTimeToUtc(input.publishEndDateTime)
          : null,
```

`update` — `if (input.postingPeriodDays !== undefined) { ... }` 블록 아래:

```ts
    if (input.publishStartDateTime !== undefined) {
      data.publishStartAt = input.publishStartDateTime
        ? jstDateTimeToUtc(input.publishStartDateTime)
        : null;
    }
    if (input.publishEndDateTime !== undefined) {
      data.publishEndAt = input.publishEndDateTime
        ? jstDateTimeToUtc(input.publishEndDateTime)
        : null;
    }
```

- [ ] **Step 9: 계약 검증 테스트 추가**

`apps/api/src/campaigns/campaign-drafts.spec.ts` 맨 아래에 추가:

```ts
describe("CampaignDraftRequestSchema 게시 기간", () => {
  it("빈 문자열과 null 을 모두 허용한다", () => {
    const parsed = CampaignDraftRequestSchema.parse({
      title: "작성 중",
      publishStartDateTime: "",
      publishEndDateTime: null,
    });
    expect(parsed.publishStartDateTime).toBe("");
    expect(parsed.publishEndDateTime).toBeNull();
  });
});
```

`apps/api/src/campaigns/campaigns.service.spec.ts` 맨 아래에 추가 (import 에 `CreateCampaignRequestSchema` 를 `@jsure/shared` 에서 가져온다):

```ts
describe("CreateCampaignRequestSchema 게시 기간", () => {
  const base = {
    category: "SNS" as const,
    title: "테스트 캠페인",
    tags: [],
    rewardType: "UNIFIED" as const,
    rewardJpy: 1000,
    recruitStartDate: "2026-08-01",
    recruitEndDate: "2026-08-20",
    postingPeriodDays: 14,
    recruits: [
      {
        subType: "INSTAGRAM" as const,
        minFollowers: 0,
        recruitCount: 1,
        subTypeOptions: ["FEED"],
        insightRequired: true,
        isRequired: false,
        productPriceJpy: null,
        productUrl: null,
        options: [],
      },
    ],
    productSummary: "요약",
    productDetailUrls: ["https://example.com/product"],
    guideline: "가이드",
    referenceMediaUrls: [],
    cautions: "주의",
    thumbnailUrl: null,
    excludedCampaignIds: [],
  };

  it("게시 기간 미입력이면 null 로 통과한다", () => {
    const parsed = CreateCampaignRequestSchema.parse(base);
    expect(parsed.publishStartDateTime).toBeNull();
    expect(parsed.publishEndDateTime).toBeNull();
  });

  it("시작만 입력하면 거부한다", () => {
    const result = CreateCampaignRequestSchema.safeParse({
      ...base,
      publishStartDateTime: "2026-09-01T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("종료가 시작보다 이르면 거부한다", () => {
    const result = CreateCampaignRequestSchema.safeParse({
      ...base,
      publishStartDateTime: "2026-09-10T10:00",
      publishEndDateTime: "2026-09-01T10:00",
    });
    expect(result.success).toBe(false);
  });

  it("정상 게시 기간은 통과한다", () => {
    const parsed = CreateCampaignRequestSchema.parse({
      ...base,
      publishStartDateTime: "2026-09-01T10:00",
      publishEndDateTime: "2026-09-10T23:59",
    });
    expect(parsed.publishStartDateTime).toBe("2026-09-01T10:00");
  });
});
```

- [ ] **Step 10: 빌드 · 테스트 · 타입 확인**

```bash
pnpm --filter @jsure/shared build
pnpm --filter @jsure/api test -- campaigns
pnpm typecheck
```
Expected: 전부 PASS

- [ ] **Step 11: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations packages/shared/src/types/campaign.ts apps/api/src/campaigns/campaigns.service.ts apps/api/src/campaigns/campaigns.service.spec.ts apps/api/src/campaigns/campaign-drafts.spec.ts
git commit -m "feat(api): 캠페인 게시 기간 컬럼과 어드민 계약 추가"
```

---

### Task 3: 서버 제출 차단 가드

세 카테고리의 URL 제출 경로가 게시 시작 전이면 거부하도록 만든다. 이 태스크가 요건의 핵심 수용 조건이다.

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts` (`assertOwnedWithCampaign`, `submitSubmission`, `submitReview`, `submitSimpleReview`, 신규 private 메서드)
- Test: `apps/api/src/influencer-applications/influencer-applications.service.spec.ts`

**Interfaces:**
- Consumes: `publishWindowState` (Task 1)
- Produces: 예외 `code: "PUBLISH_NOT_STARTED"` — 프론트가 이 코드로 분기할 수 있다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/influencer-applications/influencer-applications.service.spec.ts` 맨 아래에 추가:

```ts
describe("게시 기간 시작 전 제출 차단", () => {
  const FUTURE_START = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const FUTURE_END = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const PAST_START = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const PAST_END = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

  const snsPosts = [{ subType: "INSTAGRAM" as const, url: "https://x.test/p/1" }];

  function snsPrisma(publishStartAt: Date | null, publishEndAt: Date | null) {
    return {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "DELIVERED",
          subTypes: ["INSTAGRAM"],
          receivedAt: new Date("2026-08-20T00:00:00Z"),
          submissionReviewStatus: "PENDING",
          campaign: { category: "SNS", publishStartAt, publishEndAt },
        })),
      },
    };
  }

  it("SNS: 게시 시작 전이면 PUBLISH_NOT_STARTED", async () => {
    const svc = makeService({ prisma: snsPrisma(FUTURE_START, FUTURE_END) });
    await expect(
      svc.submitSubmission("inf-1", "app-1", snsPosts, []),
    ).rejects.toThrow(/PUBLISH_NOT_STARTED|게시 기간 시작 전/);
  });

  it("SNS: 게시 기간 미설정이면 차단하지 않는다", async () => {
    const svc = makeService({ prisma: snsPrisma(null, null) });
    // 차단 가드를 통과하면 이후 로직(트랜잭션 미구성)에서 실패하므로,
    // PUBLISH_NOT_STARTED 가 아닌 다른 이유로 실패하는 것이 통과 조건이다.
    await expect(
      svc.submitSubmission("inf-1", "app-1", snsPosts, []),
    ).rejects.not.toThrow(/PUBLISH_NOT_STARTED/);
  });

  it("SNS: 게시 종료 후에도 차단하지 않는다", async () => {
    const svc = makeService({ prisma: snsPrisma(PAST_START, PAST_END) });
    await expect(
      svc.submitSubmission("inf-1", "app-1", snsPosts, []),
    ).rejects.not.toThrow(/PUBLISH_NOT_STARTED/);
  });

  it("가구매 리뷰: 게시 시작 전이면 PUBLISH_NOT_STARTED", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "ORDER_SUBMITTED",
          submissionReviewStatus: "PENDING",
          orderSubmittedAt: new Date("2026-08-20T00:00:00Z"),
          posts: [],
          campaign: {
            category: "FAKE_PURCHASE",
            publishStartAt: FUTURE_START,
            publishEndAt: FUTURE_END,
            recruits: [{ subType: "QOO10", subTypeOptions: ["LIPS"] }],
          },
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitReview("inf-1", "app-1", [], { LIPS: "https://lips.test/1" }),
    ).rejects.toThrow(/PUBLISH_NOT_STARTED|게시 기간 시작 전/);
  });

  it("단순 리뷰: 게시 시작 전이면 PUBLISH_NOT_STARTED", async () => {
    const prisma = {
      campaignApplication: {
        findUnique: jest.fn(async () => ({
          id: "app-1",
          influencerId: "inf-1",
          status: "DELIVERED",
          receivedAt: new Date("2026-08-20T00:00:00Z"),
          submissionReviewStatus: "PENDING",
          posts: [],
          campaign: {
            category: "SIMPLE_REVIEW",
            publishStartAt: FUTURE_START,
            publishEndAt: FUTURE_END,
          },
        })),
      },
    };
    const svc = makeService({ prisma });
    await expect(
      svc.submitSimpleReview(
        "inf-1",
        "app-1",
        [{ subType: "LIPS", url: "https://lips.test/1" }],
        [],
      ),
    ).rejects.toThrow(/PUBLISH_NOT_STARTED|게시 기간 시작 전/);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm --filter @jsure/api test -- influencer-applications.service.spec
```
Expected: 게시 기간 관련 3개 케이스(SNS·가구매·단순 리뷰)가 FAIL — 차단이 없어 다른 예외가 던져진다.

- [ ] **Step 3: 가드 구현**

`apps/api/src/influencer-applications/influencer-applications.service.ts`

import 에 `publishWindowState` 추가 (`@jsure/shared`).

클래스 맨 아래 `assertOwnedWithCampaign` 옆에 private 메서드 추가:

```ts
  /**
   * 게시(투고) 기간 시작 전 제출을 막는다. 종료 후는 막지 않는다 —
   * 이미 게시된 URL 을 수집하지 못하면 검토·정산이 멈춘다.
   */
  private assertPublishStarted(campaign: {
    publishStartAt: Date | null;
    publishEndAt: Date | null;
  }): void {
    const state = publishWindowState({
      publishStartAt: campaign.publishStartAt,
      publishEndAt: campaign.publishEndAt,
      now: new Date(),
    });
    if (state === "BEFORE") {
      throw new BadRequestException({
        code: "PUBLISH_NOT_STARTED",
        message: "게시 기간 시작 전에는 제출할 수 없습니다",
      });
    }
  }
```

`assertOwnedWithCampaign` 의 select 를 확장:

```ts
      include: {
        campaign: {
          select: { category: true, publishStartAt: true, publishEndAt: true },
        },
      },
```

`submitSubmission` — 카테고리·수령·상태 전이 검사를 모두 통과한 직후, `const submittedSubTypes = ...` 앞에 삽입:

```ts
    this.assertPublishStarted(app.campaign);
```

`submitReview` — Prisma `campaign.select` 에 `publishStartAt: true, publishEndAt: true` 를 추가하고, `if (!isFirstSubmission && !isResubmission) { ... }` 블록 직후에 삽입:

```ts
    this.assertPublishStarted(application.campaign);
```

`submitSimpleReview` — `campaign: { select: { category: true } }` 를 `campaign: { select: { category: true, publishStartAt: true, publishEndAt: true } }` 로 바꾸고, 상태 전이 검사 직후에 같은 한 줄을 삽입.

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm --filter @jsure/api test -- influencer-applications.service.spec
```
Expected: PASS — 신규 5개 포함, 기존 케이스도 전부 통과 (기존 mock 은 `publishStartAt` 이 `undefined` 라 `NONE` 으로 떨어져 차단되지 않는다).

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/influencer-applications/influencer-applications.service.ts apps/api/src/influencer-applications/influencer-applications.service.spec.ts
git commit -m "feat(api): 게시 기간 시작 전 투고 URL 제출 차단"
```

---

### Task 4: 게시 마감 일원화 — 응모 응답 · LINE 변수 · 6-r 리마인더

지금 마감 계산이 4곳에 복제돼 있다. Task 1 의 함수로 모으고, 게시 기간이 있으면 그 종료일이 마감이 되게 한다. **회귀 위험이 가장 높은 태스크**다 — 게시 기간 미설정 캠페인의 발송 시점이 흔들리면 안 된다.

**Files:**
- Modify: `packages/shared/src/types/application.ts` (`InfluencerApplicationSchema`)
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts` (`toResponse`, `ApplicationRow` 타입, `INCLUDE` 의 campaign select)
- Modify: `apps/api/src/line-templates/trigger-meta.ts` (`postingDeadline`, `reviewDeadline` resolver, campaign select)
- Modify: `apps/api/src/line-templates/line-reminders.service.ts` (`runDeadlineReminders`)
- Test: `apps/api/src/line-templates/line-reminders.service.spec.ts`

**Interfaces:**
- Consumes: `resolvePostingDeadline` (Task 1), `Campaign.publishStartAt`/`publishEndAt` (Task 2)
- Produces: `InfluencerApplication.publishStartAt`, `InfluencerApplication.publishEndAt` (ISO 문자열 또는 null) — Task 7 이 소비한다.

- [ ] **Step 1: 리마인더의 실패하는 테스트 작성**

`apps/api/src/line-templates/line-reminders.service.spec.ts` 맨 아래에 추가. 이 파일의 기존 헬퍼(`makePrismaMock`, `campaign`, `anchorForRemainingDays`)와 `DAY_MS` 상수를 그대로 재사용하고, 캠페인 픽스처에 `publishStartAt`/`publishEndAt` 만 얹는다. 새 mock 방식을 도입하지 않는다:

```ts
describe("LineRemindersService - 게시 기간이 설정된 캠페인", () => {
  it("수령일이 아니라 publishEndAt 기준으로 마감 3일 전에 보낸다", async () => {
    const now = Date.now();
    // 수령은 20일 전 — 기존 규칙(수령 + 14일)이면 마감이 이미 6일 지나
    // 3일 전 리마인더가 나갈 수 없다. 게시 종료가 3일 뒤이므로 나가야 한다.
    const withPublishWindow = {
      id: "pubwin",
      status: "DELIVERED",
      reviewedAt: new Date(now - 30 * DAY_MS),
      receivedAt: new Date(now - 20 * DAY_MS),
      submissionReviewStatus: "PENDING",
      submissionReviewedAt: null,
      posts: [],
      campaign: {
        ...campaign,
        publishStartAt: new Date(now - 10 * DAY_MS),
        publishEndAt: new Date(now + 3 * DAY_MS),
      },
    };
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([withPublishWindow]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).toHaveBeenCalledWith(
      "SIMPLE_REVIEW_DEADLINE_REMINDER",
      expect.objectContaining({
        application: expect.objectContaining({ id: "pubwin" }),
        extra: { remainingDays: 3 },
      }),
    );
  });

  it("게시 기간이 있으면 수령일 기준 마감 시점에는 보내지 않는다", async () => {
    const now = Date.now();
    // 수령 기준으로는 마감 3일 전이지만, 게시 종료는 10일 뒤다.
    const shifted = {
      id: "shifted",
      status: "DELIVERED",
      reviewedAt: new Date(now - 20 * DAY_MS),
      receivedAt: anchorForRemainingDays(now, 3),
      submissionReviewStatus: "PENDING",
      submissionReviewedAt: null,
      posts: [],
      campaign: {
        ...campaign,
        publishStartAt: new Date(now - DAY_MS),
        publishEndAt: new Date(now + 10 * DAY_MS),
      },
    };
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const svc = new LineRemindersService(
      makePrismaMock([shifted]),
      { dispatch } as unknown as LineDispatcherService,
    );

    await svc.runNow();

    expect(dispatch).not.toHaveBeenCalledWith(
      "SIMPLE_REVIEW_DEADLINE_REMINDER",
      expect.anything(),
    );
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
pnpm --filter @jsure/api test -- line-reminders.service.spec
```
Expected: FAIL — 신규 케이스만 실패. 기존 케이스는 전부 통과해야 한다(무회귀 기준선).

- [ ] **Step 3: 리마인더의 마감 계산 교체**

`apps/api/src/line-templates/line-reminders.service.ts` — import 에 `resolvePostingDeadline` 추가. `runDeadlineReminders` 안의

```ts
      const deadlineMs =
        anchorAt.getTime() + application.campaign.postingPeriodDays * DAY_MS;
      const deadlineDayStart = startOfJstDay(new Date(deadlineMs));
```

를 다음으로 교체:

```ts
      const deadline = resolvePostingDeadline({
        publishEndAt: application.campaign.publishEndAt,
        anchorAt,
        postingPeriodDays: application.campaign.postingPeriodDays,
      });
      if (!deadline) continue;
      const deadlineDayStart = startOfJstDay(deadline);
```

`DISPATCH_APPLICATION_INCLUDE` 의 campaign select 에 `publishStartAt: true, publishEndAt: true` 가 포함되도록 `trigger-meta.ts` 를 함께 수정한다(Step 5 에서 처리). 대상 조건(`anchor not null`, 미제출)과 3일 전·1일 전·익일 발송 로직은 **건드리지 않는다.**

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm --filter @jsure/api test -- line-reminders.service.spec
```
Expected: PASS — 신규 + 기존 전부.

- [ ] **Step 5: LINE 마감일 변수 2개 교체**

`apps/api/src/line-templates/trigger-meta.ts`

campaign select(파일 내 `postingPeriodDays: true` 가 있는 include 정의)에 추가:

```ts
      publishStartAt: true,
      publishEndAt: true,
```

`postingDeadline` resolver 를 교체:

```ts
const postingDeadline: TriggerVariableWithResolver = {
  key: "postingDeadline",
  label: "게시 마감일",
  description:
    "게시 마감일 (JST). 캠페인에 게시 기간이 설정되면 그 종료일, 없으면 수령일 + postingPeriodDays",
  sample: "7月20日",
  resolver: (ctx) => {
    const deadline = resolvePostingDeadline({
      publishEndAt: ctx.application.campaign.publishEndAt,
      anchorAt: ctx.application.receivedAt,
      postingPeriodDays: ctx.application.campaign.postingPeriodDays,
    });
    return deadline ? formatJstMonthDay(deadline) : "";
  },
};
```

`reviewDeadline` resolver 를 교체 (기준일만 `orderSubmittedAt`):

```ts
const reviewDeadline: TriggerVariableWithResolver = {
  key: "reviewDeadline",
  label: "리뷰 마감일",
  description:
    "レビュー提出期限 (JST). 게시 기간이 설정되면 그 종료일, 없으면 orderSubmittedAt + postingPeriodDays",
  sample: "7月17日",
  resolver: (ctx) => {
    const deadline = resolvePostingDeadline({
      publishEndAt: ctx.application.campaign.publishEndAt,
      anchorAt: ctx.application.orderSubmittedAt,
      postingPeriodDays: ctx.application.campaign.postingPeriodDays,
    });
    return deadline ? formatJstMonthDay(deadline) : "";
  },
};
```

- [ ] **Step 6: 응모 응답에 게시 기간과 통합 마감 반영**

`packages/shared/src/types/application.ts` — `postingDeadlineAt` 아래에 추가:

```ts
  /** 캠페인 게시(투고) 기간. null 이면 제출 시점 제약이 없다. */
  publishStartAt: z.string().datetime().nullable().default(null),
  publishEndAt: z.string().datetime().nullable().default(null),
```

`apps/api/src/influencer-applications/influencer-applications.service.ts`

- `ApplicationRow` 의 campaign 타입에 `publishStartAt: Date | null; publishEndAt: Date | null;` 추가
- `INCLUDE` 의 campaign select 에 `publishStartAt: true, publishEndAt: true` 추가
- `toResponse` 의 마감 계산 교체:

```ts
  const deadline = resolvePostingDeadline({
    publishEndAt: row.campaign.publishEndAt,
    anchorAt: deadlineAnchor,
    postingPeriodDays: row.campaign.postingPeriodDays,
  });
```

- `toResponse` 반환 객체의 `postingDeadlineAt` 옆에 추가:

```ts
    publishStartAt: row.campaign.publishStartAt
      ? row.campaign.publishStartAt.toISOString()
      : null,
    publishEndAt: row.campaign.publishEndAt
      ? row.campaign.publishEndAt.toISOString()
      : null,
```

- [ ] **Step 7: 전체 api 테스트와 타입 확인**

```bash
pnpm --filter @jsure/shared build
pnpm --filter @jsure/api test
pnpm typecheck
```
Expected: 전부 PASS. **기존 리마인더·트리거 테스트가 하나도 깨지지 않아야 한다.**

- [ ] **Step 8: 커밋**

```bash
git add packages/shared/src/types/application.ts apps/api/src/influencer-applications/influencer-applications.service.ts apps/api/src/line-templates/trigger-meta.ts apps/api/src/line-templates/line-reminders.service.ts apps/api/src/line-templates/line-reminders.service.spec.ts
git commit -m "refactor(api): 게시 마감 계산을 게시 기간 기준으로 일원화"
```

---

### Task 5: 인플루언서 캠페인 상세 응답 + 화면 표시

응모 전 단계에서 게시 기간을 보여준다. 응모 동의 문구(Task 7)도 이 응답 필드를 쓴다.

**Files:**
- Modify: `packages/shared/src/types/campaign.ts` (`InfluencerCampaignDetailSchema`)
- Modify: `apps/api/src/influencer-campaigns/influencer-campaigns.service.ts` (`detail` 반환 객체)
- Modify: `apps/client-web/src/pages/CampaignDetail/index.tsx:118-123`
- Modify: `i18n/client/messages.ts`

**Interfaces:**
- Consumes: `Campaign.publishStartAt`/`publishEndAt` (Task 2)
- Produces: `InfluencerCampaignDetail.publishStartAt`, `InfluencerCampaignDetail.publishEndAt` (ISO 또는 null) — Task 7 의 Apply 화면이 소비한다.

- [ ] **Step 1: shared 상세 스키마에 필드 추가**

`packages/shared/src/types/campaign.ts` 의 `InfluencerCampaignDetailSchema` 안, `fullOptions` 아래에 추가:

```ts
    /** 게시(투고) 기간. null 이면 투고 시점 제약이 없다. */
    publishStartAt: z.string().datetime().nullable().default(null),
    publishEndAt: z.string().datetime().nullable().default(null),
```

`InfluencerCampaignCardSchema`(목록 카드)에는 **추가하지 않는다.**

- [ ] **Step 2: api 상세 응답에 매핑**

`apps/api/src/influencer-campaigns/influencer-campaigns.service.ts` 의 `detail()` 반환 객체, `fullOptions,` 아래에 추가 (`detail` 은 `include` 로 캠페인 전체 행을 읽으므로 select 수정은 불필요):

```ts
      publishStartAt: row.publishStartAt ? row.publishStartAt.toISOString() : null,
      publishEndAt: row.publishEndAt ? row.publishEndAt.toISOString() : null,
```

- [ ] **Step 3: i18n 키 추가**

`i18n/client/messages.ts` 의 `pages.campaignDetail` 그룹에서 `recruitLabel` 옆에 추가 (jp/kr 두 언어 모두, 문구 라인 끝에 `// new`):

```ts
        publishLabel: { ja: "投稿期間", ko: "게시 기간" }, // new
```

> 이 파일의 기존 키가 쓰는 언어 필드 이름·구조를 그대로 따른다.

- [ ] **Step 4: 캠페인 상세 화면에 표시**

`apps/client-web/src/pages/CampaignDetail/index.tsx` — 모집 기간을 보여주는 `<div className={styles.period}>` 블록 **바로 아래**에 추가. 게시 기간이 없으면 아무것도 렌더링하지 않는다. 시각까지 보여줘야 하므로 기존 `formatDate` 대신 파일 안에 날짜+시각 포맷 함수를 하나 둔다:

```tsx
        {data.publishStartAt && data.publishEndAt && (
          <div className={styles.period}>
            {t("pages.campaignDetail.publishLabel")}{" "}
            {formatDateTime(data.publishStartAt)} 〜{" "}
            {formatDateTime(data.publishEndAt)}
          </div>
        )}
```

같은 파일의 `formatDate` 정의 옆에 추가:

```tsx
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(iso)} ${hours}:${minutes}`;
}
```

- [ ] **Step 5: 타입 확인과 수동 검증**

```bash
pnpm --filter @jsure/shared build
pnpm typecheck
```

수동 확인: api 와 client-web 을 로컬에서 띄우고 (1) 게시 기간을 설정한 캠페인 상세에 "게시 기간: 9월 1일 10:00 〜 9월 10일 23:59" 가 보이는지, (2) 게시 기간이 없는 기존 캠페인 상세에는 그 줄이 **아예 없는지** 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/types/campaign.ts apps/api/src/influencer-campaigns/influencer-campaigns.service.ts apps/client-web/src/pages/CampaignDetail/index.tsx i18n/client/messages.ts
git commit -m "feat(client-web): 캠페인 상세에 게시 기간 표시"
```

---

### Task 6: 어드민 캠페인 폼의 게시 기간 입력

**Files:**
- Modify: `apps/admin-web/src/domains/campaign/components/CampaignForm.tsx` (`EMPTY_CAMPAIGN_FORM`, 모집 기간 필드 아래, `postingPeriodDays` 입력)
- Modify: `apps/admin-web/src/domains/campaign/useCampaignFormInitial.ts` (`toFormValues`, `toCopyValues`)
- Modify: `i18n/admin/messages.ts`

**Interfaces:**
- Consumes: 어드민 계약 필드 `publishStartDateTime`/`publishEndDateTime` (Task 2)
- Produces: 없음 (UI 종단)

- [ ] **Step 1: i18n 키 추가**

`i18n/admin/messages.ts` 의 `domains.campaign.form` 그룹, `recruitEndLabel` 옆에 ko/en/ja 세 언어로 추가:

```ts
        publishStartLabel: {
          ko: "게시 시작",
          en: "Publish start",
          ja: "投稿開始",
        },
        publishEndLabel: { ko: "게시 종료", en: "Publish end", ja: "投稿終了" },
        publishPeriodHint: {
          ko: "선택 사항. 설정하면 시작 시각 이전에는 인플루언서가 투고 URL 을 제출할 수 없습니다.",
          en: "Optional. When set, influencers cannot submit post URLs before the start time.",
          ja: "任意。設定すると開始時刻より前は投稿URLを提出できません。",
        },
        postingPeriodDaysIgnored: {
          ko: "게시 기간이 설정되어 이 값은 사용되지 않습니다.",
          en: "Ignored because a publish period is set.",
          ja: "投稿期間が設定されているため、この値は使用されません。",
        },
```

- [ ] **Step 2: 폼 기본값과 초기값 매핑**

`apps/admin-web/src/domains/campaign/components/CampaignForm.tsx` 의 `EMPTY_CAMPAIGN_FORM`, `postingPeriodDays: Number.NaN,` 아래:

```ts
  publishStartDateTime: null,
  publishEndDateTime: null,
```

`apps/admin-web/src/domains/campaign/useCampaignFormInitial.ts` 의 `toFormValues`, `postingPeriodDays: campaign.postingPeriodDays,` 아래:

```ts
    publishStartDateTime: campaign.publishStartDateTime,
    publishEndDateTime: campaign.publishEndDateTime,
```

같은 파일 `toCopyValues` — 모집 기간을 비우는 것과 같은 이유로(복사한 캠페인이 과거 엠바고를 물려받지 않도록) 게시 기간도 비운다:

```ts
    recruitStartDate: "",
    recruitEndDate: "",
    publishStartDateTime: null,
    publishEndDateTime: null,
```

- [ ] **Step 3: 입력 필드 추가**

`CampaignForm.tsx` — 모집 종료일 필드(`cf-end`)를 담은 블록 바로 뒤에 게시 기간 블록을 추가한다. 빈 입력은 `null` 로 보내야 하므로 `register` 의 `setValueAs` 를 쓴다:

```tsx
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cf-publish-start">
                {t("domains.campaign.form.publishStartLabel")}
              </label>
              <input
                id="cf-publish-start"
                type="datetime-local"
                className={styles.input}
                {...methods.register("publishStartDateTime", {
                  setValueAs: (value: string) => (value === "" ? null : value),
                })}
                disabled={submitting}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cf-publish-end">
                {t("domains.campaign.form.publishEndLabel")}
              </label>
              <input
                id="cf-publish-end"
                type="datetime-local"
                className={styles.input}
                {...methods.register("publishEndDateTime", {
                  setValueAs: (value: string) => (value === "" ? null : value),
                })}
                disabled={submitting}
              />
              {rootError("publishEndDateTime") && (
                <div className={styles.error}>
                  {rootError("publishEndDateTime")}
                </div>
              )}
              <div className={styles.hint}>
                {t("domains.campaign.form.publishPeriodHint")}
              </div>
            </div>
```

> `styles.hint` 클래스가 이 파일의 CSS 모듈에 없으면, 같은 파일이 이미 쓰는 보조 설명 클래스를 그대로 재사용한다. 새 클래스를 만들지 말고 기존 것을 찾아 쓴다.

- [ ] **Step 4: 게시 기간 설정 시 postingPeriodDays 비활성화**

`CampaignForm.tsx` 의 `postingPeriodDays` 입력(`name="postingPeriodDays"`)을 감싼 블록에서, 게시 기간이 입력됐는지 `methods.watch` 로 보고 입력을 비활성화하고 안내를 띄운다. 값 자체는 그대로 두므로 게시 기간을 지우면 되살아난다:

```tsx
const publishStartDateTime = methods.watch("publishStartDateTime");
const publishEndDateTime = methods.watch("publishEndDateTime");
const postingPeriodIgnored =
  publishStartDateTime !== null && publishEndDateTime !== null;
```

입력에는 `disabled={submitting || postingPeriodIgnored}` 를 주고, 바로 아래에:

```tsx
{postingPeriodIgnored && (
  <div className={styles.hint}>
    {t("domains.campaign.form.postingPeriodDaysIgnored")}
  </div>
)}
```

- [ ] **Step 5: 타입 확인과 수동 검증**

```bash
pnpm typecheck
```

수동 확인 4가지:
1. 신규 캠페인 등록 — 게시 기간을 비운 채 저장 → 성공하고, 상세 재진입 시 두 입력이 비어 있다.
2. 게시 기간 `2026-09-01 10:00 ~ 2026-09-10 23:59` 로 저장 → 재진입 시 같은 값이 그대로 보인다(JST 왕복 확인).
3. 시작만 입력하고 저장 → "게시 기간은 시작과 종료를 함께 입력해주세요" 에러.
4. 게시 기간을 입력하면 게시 기간(일수) 입력이 회색으로 잠기고 안내가 뜬다. 비우면 다시 풀린다.

- [ ] **Step 6: 커밋**

```bash
git add apps/admin-web/src/domains/campaign/components/CampaignForm.tsx apps/admin-web/src/domains/campaign/useCampaignFormInitial.ts i18n/admin/messages.ts
git commit -m "feat(admin-web): 캠페인 폼에 게시 기간 입력 추가"
```

---

### Task 7: 인플루언서 제출 화면 — 차단 UI와 문구

**Files:**
- Create: `apps/client-web/src/domains/application/publishWindowText.ts`
- Create: `apps/client-web/src/domains/application/components/PublishWindowNotice.tsx`
- Modify: `apps/client-web/src/domains/application/components/PostSubmitForm.tsx`
- Modify: `apps/client-web/src/domains/application/components/ReviewSubmitForm.tsx`
- Modify: `apps/client-web/src/domains/application/components/SimpleReviewSubmitForm.tsx`
- Modify: `apps/client-web/src/domains/application/components/ReceiptConfirmDialog.tsx`
- Modify: `apps/client-web/src/pages/Applications/Detail.tsx`
- Modify: `apps/client-web/src/pages/Apply/index.tsx`
- Modify: `i18n/client/messages.ts`

**Interfaces:**
- Consumes: `publishWindowState`, `resolvePostingDeadline` (Task 1); `InfluencerApplication.publishStartAt`/`publishEndAt` (Task 4); `InfluencerCampaignDetail.publishStartAt`/`publishEndAt` (Task 5)
- Produces: 없음 (UI 종단)

- [ ] **Step 1: i18n 키 추가**

`i18n/client/messages.ts` — `application` 그룹 아래에 `publishWindow` 그룹을 새로 만든다. 각 문구 라인 끝에 `// new`:

```ts
    publishWindow: {
      periodLabel: { ja: "投稿期間", ko: "게시 기간" }, // new
      rangeSeparator: { ja: "〜", ko: "~" }, // new
      beforePrefix: { ja: "", ko: "" }, // new
      beforeSuffix: { ja: "から提出できます", ko: "부터 제출할 수 있습니다" }, // new
      untilSuffix: { ja: "までに投稿してください", ko: "까지 게시해주세요" }, // new
      afterNotice: {
        ja: "投稿期間が終了しました。遅れても提出をお願いします。",
        ko: "게시 기간이 종료되었습니다. 늦었지만 제출해주세요.",
      }, // new
      applyConfirmMiddle: { ja: "の間に投稿します", ko: " 사이에 게시합니다" }, // new
    },
```

> 기존 `application` 그룹의 언어 필드 이름과 중첩 구조를 그대로 따른다. 날짜의 "월/일" 접미사는 이미 있는 `application.dateFormat.monthSuffix`/`daySuffix` 를 재사용한다.

- [ ] **Step 2: 문구 헬퍼 작성**

`apps/client-web/src/domains/application/publishWindowText.ts` 생성:

```ts
import { publishWindowState, resolvePostingDeadline } from "@jsure/shared";
import type { PublishWindowState } from "@jsure/shared";
import { t } from "@i18n";

export interface PublishWindowText {
  state: PublishWindowState;
  /** "9月1日" — state 가 NONE 이면 빈 문자열 */
  startText: string;
  /** "9月10日" — state 가 NONE 이면 빈 문자열 */
  endText: string;
  /** 마감까지 남은 일수. 마감이 없으면 null */
  remainingDays: number | null;
}

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}${t("application.dateFormat.monthSuffix")}${date.getDate()}${t("application.dateFormat.daySuffix")}`;
}

/**
 * 게시 기간 상태와 표시 문구. 게시 기간이 없으면 state 가 NONE 이고,
 * 화면은 기존 "수령 후 N일" 문구를 그대로 쓴다.
 */
export function publishWindowText(input: {
  publishStartAt: string | null;
  publishEndAt: string | null;
  anchorAt: string | null;
  postingPeriodDays: number;
  now?: Date;
}): PublishWindowText {
  const now = input.now ?? new Date();
  const state = publishWindowState({
    publishStartAt: input.publishStartAt,
    publishEndAt: input.publishEndAt,
    now,
  });
  const deadline = resolvePostingDeadline({
    publishEndAt: input.publishEndAt,
    anchorAt: input.anchorAt,
    postingPeriodDays: input.postingPeriodDays,
  });
  const remainingDays = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  if (state === "NONE") {
    return { state, startText: "", endText: "", remainingDays };
  }
  return {
    state,
    startText: input.publishStartAt
      ? formatMonthDay(new Date(input.publishStartAt))
      : "",
    endText: input.publishEndAt
      ? formatMonthDay(new Date(input.publishEndAt))
      : "",
    remainingDays,
  };
}
```

- [ ] **Step 3: 안내 컴포넌트 작성**

`apps/client-web/src/domains/application/components/PublishWindowNotice.tsx` 생성. props 만으로 동작하는 presentational 컴포넌트다 — fetch·라우팅 금지:

```tsx
import { t } from "@i18n";
import type { PublishWindowText } from "../publishWindowText";

interface Props {
  window: PublishWindowText;
}

const NOTICE_STYLE = {
  fontSize: 12,
  marginTop: 10,
  textAlign: "center",
  fontWeight: 600,
} as const;

export function PublishWindowNotice({ window }: Props) {
  if (window.state === "NONE") return null;
  if (window.state === "BEFORE") {
    return (
      <p style={{ ...NOTICE_STYLE, color: "#dc2626" }}>
        {t("application.publishWindow.beforePrefix")}
        {window.startText}
        {t("application.publishWindow.beforeSuffix")}
      </p>
    );
  }
  if (window.state === "AFTER") {
    return (
      <p style={{ ...NOTICE_STYLE, color: "#dc2626" }}>
        {t("application.publishWindow.afterNotice")}
      </p>
    );
  }
  return (
    <p style={{ ...NOTICE_STYLE, color: "#6b7280" }}>
      {window.endText}
      {t("application.publishWindow.untilSuffix")}
    </p>
  );
}
```

- [ ] **Step 4: 세 제출 폼에 연결**

세 폼 모두 같은 방식으로 고친다.

**`PostSubmitForm.tsx`** — props 에 추가:

```tsx
  publishWindow: PublishWindowText;
```

제출 버튼의 `disabled` 를 바꾸고, 기존 마감 문구(`postingDeadlineAt` 블록)를 `PublishWindowNotice` 로 대체한다. 게시 기간이 없을 때(`state === "NONE"`)는 지금 문구가 그대로 나와야 하므로 기존 블록을 지우지 말고 조건을 더한다:

```tsx
        <PrimaryButton
          type="submit"
          disabled={submitting || publishWindow.state === "BEFORE"}
          style={{ marginTop: 18 }}
        >
```

기존 `{postingDeadlineAt && ( ... )}` 블록의 조건에 `publishWindow.state === "NONE"` 을 더하고, 그 위에 `PublishWindowNotice` 를 둔다. 블록 내부(스타일·문구)는 손대지 않는다:

```tsx
        <PublishWindowNotice window={publishWindow} />
        {publishWindow.state === "NONE" && postingDeadlineAt && (
          <p
            style={{
              fontSize: 11,
              color: "#dc2626",
              marginTop: 4,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {t("application.postForm.deadlineLabelPrefix")}
            {formatDeadline(postingDeadlineAt)}
          </p>
        )}
```

**`ReviewSubmitForm.tsx`** — 같은 prop 을 받고, 로컬 `computeRemainingDays` 호출을 지우고 `publishWindow.remainingDays` 를 쓴다. `deadlinePassed` 판정도 `publishWindow.remainingDays !== null && publishWindow.remainingDays < 0` 으로 바꾼다. 제출 버튼에 `publishWindow.state === "BEFORE"` 비활성 조건을 더하고 `PublishWindowNotice` 를 렌더링한다.

**`SimpleReviewSubmitForm.tsx`** — 같은 prop 을 받고, 제출 버튼 비활성 조건과 `PublishWindowNotice` 렌더링을 더한다.

- [ ] **Step 5: 응모 상세 페이지에서 값 주입**

`apps/client-web/src/pages/Applications/Detail.tsx` — 렌더링 앞부분(`data` 가 확정된 뒤)에 한 번만 계산한다:

```tsx
  const publishWindow = publishWindowText({
    publishStartAt: data.publishStartAt,
    publishEndAt: data.publishEndAt,
    anchorAt: data.orderSubmittedAt ?? data.receivedAt,
    postingPeriodDays: data.postingPeriodDays,
  });
```

`PostSubmitForm`(2곳: `POSTING`, `POST_REJECTED`), `ReviewSubmitForm`(2곳), `SimpleReviewSubmitForm`(2곳)에 `publishWindow={publishWindow}` 를 넘긴다.

배송중 안내(`awaitingReceiptPrefix`/`Suffix` 로 "수령 후 N일" 을 보여주는 블록)는 게시 기간이 있으면 기간 문구로 바꾼다:

```tsx
            {publishWindow.state === "NONE" ? (
              <p className={styles.msg}>
                {t("pages.applications.detail.awaitingReceiptPrefix")}
                {data.postingPeriodDays}
                {t("pages.applications.detail.awaitingReceiptSuffix")}
              </p>
            ) : (
              <p className={styles.msg}>
                {t("application.publishWindow.periodLabel")}{" "}
                {publishWindow.startText}{" "}
                {t("application.publishWindow.rangeSeparator")}{" "}
                {publishWindow.endText}
              </p>
            )}
```

`ReceiptConfirmDialog` 호출부에도 `publishWindow={publishWindow}` 를 넘긴다.

- [ ] **Step 6: 수령 확인 다이얼로그 문구 분기**

`ReceiptConfirmDialog.tsx` — props 에 `publishWindow: PublishWindowText` 를 추가하고, 본문 `<p className={styles.body}>` 를 분기한다. 게시 기간이 없을 때의 문구는 지금과 한 글자도 달라지지 않아야 한다:

```tsx
        {publishWindow.state === "NONE" ? (
          <p className={styles.body}>
            {t("application.receiptConfirm.bodyPrefix")}
            {postingPeriodDays}
            {t("application.receiptConfirm.bodySuffix")}
          </p>
        ) : (
          <p className={styles.body}>
            {t("application.publishWindow.periodLabel")}{" "}
            {publishWindow.startText}{" "}
            {t("application.publishWindow.rangeSeparator")}{" "}
            {publishWindow.endText}
          </p>
        )}
```

- [ ] **Step 7: 응모 동의 체크 문구 분기**

`apps/client-web/src/pages/Apply/index.tsx` — `confirmLabel` 이 지금 `postingPeriodDays` 만 받는다. 캠페인의 게시 기간을 함께 받아 `DEADLINE` 항목만 분기한다:

```tsx
function confirmLabel(
  key: ConfirmKey,
  postingPeriodDays: number,
  publishWindow: PublishWindowText,
): string {
  switch (key) {
    // ... 다른 case 는 그대로
    case "DEADLINE":
      if (publishWindow.state === "NONE") {
        return `${t("pages.apply.confirmDeadlinePrefix")}${postingPeriodDays}${t("pages.apply.confirmDeadlineSuffix")}`;
      }
      return `${publishWindow.startText}${t("application.publishWindow.rangeSeparator")}${publishWindow.endText}${t("application.publishWindow.applyConfirmMiddle")}`;
    // ...
  }
}
```

호출부(`confirmLabel(k, campaign.data.postingPeriodDays)`)에 세 번째 인자를 넘긴다. 응모 화면에는 수령일이 없으므로 `anchorAt: null` 로 계산한다:

```tsx
const publishWindow = publishWindowText({
  publishStartAt: campaign.data.publishStartAt,
  publishEndAt: campaign.data.publishEndAt,
  anchorAt: null,
  postingPeriodDays: campaign.data.postingPeriodDays,
});
```

- [ ] **Step 8: 타입 확인과 수동 검증**

```bash
pnpm typecheck
```

수동 확인 — 게시 기간 `9/1~9/10` 캠페인으로 확인한다(로컬에서 시작일을 미래로 잡아 시나리오를 만든다):
1. 게시 시작 전: 제출 버튼이 비활성이고 "9월 1일부터 제출할 수 있습니다" 가 보인다.
2. 개발자 도구로 버튼 비활성을 풀고 강제 제출 → api 가 400 `PUBLISH_NOT_STARTED` 로 거부한다(서버 차단이 실제로 동작하는지가 수용 조건이다).
3. 기간 중: 버튼 활성, "9월 10일까지 게시해주세요".
4. 종료 후: 버튼 활성, "게시 기간이 종료되었습니다..." 안내.
5. **게시 기간 미설정 캠페인: 모든 문구와 버튼 동작이 변경 전과 동일하다.** (응모 동의 체크, 수령 다이얼로그, 배송중 안내, 제출 폼 마감 문구 4곳 확인)

- [ ] **Step 9: 커밋**

```bash
git add apps/client-web/src/domains/application apps/client-web/src/pages/Applications/Detail.tsx apps/client-web/src/pages/Apply/index.tsx i18n/client/messages.ts
git commit -m "feat(client-web): 게시 기간 시작 전 투고 제출 차단 UI와 안내 문구"
```

---

### Task 8: 최종 검증과 배포 준비

**Files:**
- Test: 전체
- Modify: 없음 (문제 발견 시에만)

**Interfaces:**
- Consumes: Task 1~7 전부
- Produces: 배포 가능 상태

- [ ] **Step 1: 전체 검증**

```bash
pnpm --filter @jsure/shared build
pnpm typecheck
pnpm --filter @jsure/api test
pnpm --filter @jsure/api lint
```
Expected: 전부 통과. 실패가 있으면 해당 태스크로 돌아가 고친다.

- [ ] **Step 2: 무회귀 확인 — 기존 캠페인 경로**

게시 기간을 설정하지 않은 기존 캠페인으로 다음을 확인한다:
1. 어드민에서 캠페인 수정 후 저장 → 게시 기간이 계속 비어 있다.
2. 인플루언서 응모 → 수령 확인 → 투고 URL 제출까지 차단 없이 진행된다.
3. 응모 동의 체크·수령 다이얼로그·제출 폼 문구가 변경 전과 동일하다.

- [ ] **Step 3: 배포 순서 확인 (실제 배포는 사용자 승인 후)**

1. `pnpm --filter @jsure/shared build`
2. **api (Railway)** — Prisma 마이그레이션 `add_campaign_publish_window` 포함. `prisma migrate deploy` 가 컬럼 2개만 추가하는지 배포 로그로 확인.
3. **admin-web · client-web (Vercel)**

응답 스키마의 신규 필드는 모두 `.default(null)` 이라 구 api + 신 프론트 조합에서도 파싱이 깨지지 않는다.

- [ ] **Step 4: 운영 후속 항목 전달**

`{postingPeriodDays}` 변수를 본문에 직접 넣어둔 LINE 템플릿은 게시 기간을 설정한 캠페인에서 문구가 어긋난다("受け取りから14日以内" ↔ 실제 마감 9/10). 템플릿 텍스트는 DB 에 있어 코드로 고칠 수 없으므로, 어드민 LINE 템플릿 화면에서 해당 템플릿을 `{postingDeadline}` 변수 기반 문구로 바꿔야 한다는 것을 운영자에게 전달한다.

- [ ] **Step 5: 커밋 (수정이 있었다면)**

```bash
git add -u
git commit -m "fix: 게시 기간 최종 검증 반영"
```
