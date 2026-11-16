# 캠페인별 운영 담당자 지정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캠페인에 어드민 담당자를 복수로 붙이고, 그 꼬리표로 거르고 집계하고 일괄 교체할 수 있게 한다.

**Architecture:** `Campaign.managerIds String[]` 한 컬럼이 단일 소스다 (`audienceInfluencerIds` 와 같은 취급, FK 없음). API 는 목록 응답에서 어드민을 한 번에 모아 `managers: {id, name, email}[]` 로 풀어 내려주고, admin-web 은 이미 있는 `MultiSelectFilterChip` 에 optional prop 두 개만 더해 폼 선택기·필터·카드 칩에 재사용한다. 일괄 교체는 `updateMany` 덮어쓰기 엔드포인트 하나.

**Tech Stack:** Prisma/PostgreSQL, NestJS + Jest (`apps/api`), zod (`packages/shared`), React + Vite + Vitest (`apps/admin-web`), ExcelJS

**Spec:** `docs/superpowers/specs/2026-11-16-campaign-manager-assign-design.md`

## Global Constraints

- 라이브 서비스다. 스키마 변경은 **additive 만**. 새 컬럼은 default 를 갖는다 (CODE_RULES §9).
- **마이그레이션 실행·API 재시작은 사용자가 직접 한다.** `prisma migrate deploy` / `migrate dev` 를 대신 실행하지 않는다. 마이그레이션 SQL 파일만 작성한다.
- API 계약은 `packages/shared` zod 단일 소스. 스키마 수정 후 `pnpm --filter @jsure/shared build`.
- `@Body(new ZodValidationPipe(Schema))` — 메서드 레벨 `@UsePipes` 금지 (CODE_RULES §2).
- admin-web 의 **모든 신규 UI 문자열**은 `i18n/admin/messages.ts` 에 ko/en/ja 3개 언어 키를 추가하고 `useT()` 로 참조. 인라인 리터럴 금지.
- 변수·파라미터 **약어 금지** (`a`, `c`, `req`, `mut` 등). 도메인 이름으로 풀어 쓴다 (CODE_RULES §4).
- 중첩 삼항연산자 금지. early return 함수 / `Record` 상수 / `switch` 로 (CODE_RULES §10).
- 예외 `message` 는 한국어, `code` 상수는 대문자 그대로.
- `InfluencerCampaignCardSchema` / `InfluencerCampaignDetailSchema` 에 담당자를 **절대 추가하지 않는다**. 어드민 전용이다.
- 커밋 메시지는 한글. `git add` 는 항상 명시 경로만 (`-A` 금지).
- 담당자 상한: 캠페인당 20명, 일괄 지정 요청당 캠페인 200건.

## Review Focus

사양이 함의하지만 놓치기 쉬운 입력들. 각 줄의 테스트를 담당 Task 에 넣어 뒀다.

1. **담당자가 없는 기존 캠페인** (`managerIds = []`) — 마이그레이션 직후 전 캠페인이 이 상태다. 목록·카드·필터 어디서도 깨지지 않고, 카드에는 아무 표기도 그리지 않아야 한다. → Task 2, Task 7
2. **유령 담당자 id** — AdminUser 에 없는 id 가 `managerIds` 에 남은 경우. 응답에서 조용히 빠지고 나머지 담당자는 정상 표시돼야 한다. 행 전체가 죽으면 안 된다. → Task 2
3. **`manager=me` 인데 로그인 정보 없음** — `getStoredUser()` 가 null 이면 아무것도 매치하지 않고, 빈 목록을 보여줄 뿐 예외를 던지지 않아야 한다. → Task 7
4. **일괄 지정에 삭제된 캠페인이 섞임** — 논리 삭제(`deletedAt`)된 캠페인은 교체 대상에서 제외되고, `updatedCount` 가 요청 건수보다 작게 돌아와야 한다. → Task 3
5. **`managers` 필드가 없는 구 API 응답** — admin-web 이 api 보다 먼저 배포되는 갭. `.default([])` 로 받아 넘어가야 하고 파싱에서 죽으면 안 된다. 대시보드의 `myRecruitingCampaignCount` 도 같다(`.default(0)`). → Task 1

---

### Task 1: 스키마 기반 — prisma 컬럼 + shared 계약

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`model Campaign`, 145-209)
- Create: `apps/api/prisma/migrations/<timestamp>_add_campaign_manager_ids/migration.sql`
- Modify: `packages/shared/src/types/campaign.ts`
- Modify: `packages/shared/src/types/adminOverview.ts`
- Modify: `packages/shared/src/types/adminReport.ts`
- Modify: `packages/shared/src/types/adminActivity.ts:28-38`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/admin-web/src/domains/application/components/history/activityLabels.ts`
- Modify: `i18n/admin/messages.ts`
- Test: `packages/shared/src/types/campaignManager.test.ts` (신규)

**Interfaces:**
- Consumes: 없음 (첫 Task)
- Produces:
  - `CampaignManagerSchema` / `CampaignManager` = `{ id: string; name: string | null; email: string }`
  - `CampaignResponse.managers: CampaignManager[]`
  - `CampaignForm.managerIds: string[]`, `UpdateCampaignRequest.managerIds?: string[]`, `CampaignDraftRequest.managerIds?: string[]`
  - `BulkAssignCampaignManagersRequest` = `{ campaignIds: string[]; managerIds: string[] }`
  - `BulkAssignCampaignManagersResponse` = `{ updatedCount: number }`
  - `AdminOverviewResponse.myRecruitingCampaignCount: number`
  - `CampaignReportRow.managers: CampaignManager[]`
  - `AdminActivityAction` 에 `"CAMPAIGN_MANAGERS_ASSIGN"` 추가

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/shared/src/types/campaignManager.test.ts`:

기존 shared 테스트 관례대로 `.js` 확장자를 붙인 상대 경로로 import 한다 (`residence.test.ts:2` 참고).

```ts
import { describe, expect, it } from "vitest";
import {
  CampaignResponseSchema,
  BulkAssignCampaignManagersRequestSchema,
} from "./campaign.js";
import { AdminOverviewResponseSchema } from "./adminOverview.js";

/** CampaignResponseSchema 를 통과하는 최소 리터럴. toResponse 가 만드는 모양을 따른다. */
const VALID_CAMPAIGN_RESPONSE = { /* 이 파일 안에 상수로 둔다 */ };

describe("CampaignResponseSchema.managers", () => {
  it("managers 가 없는 구 API 응답도 빈 배열로 파싱한다", () => {
    const parsed = CampaignResponseSchema.parse(VALID_CAMPAIGN_RESPONSE);
    expect(parsed.managers).toEqual([]);
  });

  it("managers 를 그대로 보존한다", () => {
    const parsed = CampaignResponseSchema.parse({
      ...VALID_CAMPAIGN_RESPONSE,
      managers: [{ id: "admin-1", name: "선희", email: "sunhee@example.com" }],
    });
    expect(parsed.managers).toHaveLength(1);
  });
});

describe("AdminOverviewResponseSchema", () => {
  it("myRecruitingCampaignCount 가 없는 구 응답은 0 으로 채운다", () => {
    const parsed = AdminOverviewResponseSchema.parse({
      recruitingCampaignCount: 3,
      pendingApplicationCount: 0,
      pendingPostReviewCount: 0,
      pendingSettlementAmountJpy: 0,
      pendingSettlementCount: 0,
    });
    expect(parsed.myRecruitingCampaignCount).toBe(0);
  });
});

describe("BulkAssignCampaignManagersRequestSchema", () => {
  it("campaignIds 가 비면 거부한다", () => {
    const result = BulkAssignCampaignManagersRequestSchema.safeParse({
      campaignIds: [],
      managerIds: ["admin-1"],
    });
    expect(result.success).toBe(false);
  });

  it("managerIds 가 비면 허용한다 — 담당자 해제다", () => {
    const result = BulkAssignCampaignManagersRequestSchema.safeParse({
      campaignIds: ["c1"],
      managerIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("campaignIds 200건 초과를 거부한다", () => {
    const result = BulkAssignCampaignManagersRequestSchema.safeParse({
      campaignIds: Array.from({ length: 201 }, (_, index) => `c${index}`),
      managerIds: [],
    });
    expect(result.success).toBe(false);
  });
});
```

`VALID_CAMPAIGN_RESPONSE` 는 `apps/api/src/campaigns/campaigns.service.ts` 의 `toResponse` 가 만드는 모양을 참고해 채운다. `managers` 키는 넣지 않는다 — 구 API 응답을 흉내내는 게 첫 테스트의 요점이다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/shared test`
Expected: FAIL — `managers` / `myRecruitingCampaignCount` / `BulkAssignCampaignManagersRequestSchema` 미정의

- [ ] **Step 3: prisma 스키마에 컬럼 추가**

`model Campaign` 에 `audienceInfluencerIds` 아래로:

```prisma
/// 이 캠페인의 운영 담당 어드민 id. 표시·필터용 꼬리표이며 권한과 무관하다.
/// AdminUser 와 FK 로 묶지 않는다 — audience* 배열과 같은 취급.
managerIds String[] @default([])
```

그리고 `@@index([recruitStartAt])` 옆에 `@@index([managerIds], type: Gin)`.

- [ ] **Step 4: 마이그레이션 SQL 작성**

`apps/api/prisma/migrations/<timestamp>_add_campaign_manager_ids/migration.sql` 을 손으로 만든다. **`prisma migrate dev` 를 실행하지 않는다** — 운영 DB 를 가리킨다.

```sql
ALTER TABLE "campaigns" ADD COLUMN "managerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "campaigns_managerIds_idx" ON "campaigns" USING GIN ("managerIds");
```

기존 디렉토리의 timestamp 포맷(`YYYYMMDDHHMMSS_`)을 그대로 따른다.

- [ ] **Step 5: shared 스키마 수정**

`packages/shared/src/types/campaign.ts`:
- `CampaignManagerSchema` / `CampaignManager` 정의. 주석으로 "어드민 전용 — 인플루언서 응답 스키마에 절대 포함하지 않는다" 를 남긴다.
- `CampaignFormSchema` 에 `managerIds: z.array(z.string()).max(20).default([])`
- `UpdateCampaignRequestSchema` · `CampaignDraftRequestSchema` 에 `managerIds: z.array(z.string()).max(20).optional()`
- `CampaignResponseSchema` 에 `managers: z.array(CampaignManagerSchema).default([])`
- `BulkAssignCampaignManagersRequestSchema` = `{ campaignIds: z.array(z.string()).min(1).max(200), managerIds: z.array(z.string()).max(20) }`
- `BulkAssignCampaignManagersResponseSchema` = `{ updatedCount: z.number().int().nonnegative() }`

`adminOverview.ts`: `myRecruitingCampaignCount: z.number().int().nonnegative().default(0)`
`adminReport.ts`: `CampaignReportRowSchema` 에 `managers: z.array(CampaignManagerSchema).default([])`. `CampaignReportSortKeySchema` 는 건드리지 않는다.
`adminActivity.ts`: 캠페인 블록에 `"CAMPAIGN_MANAGERS_ASSIGN"` 추가.

`packages/shared/src/index.ts` 에서 신규 export 전부 노출.

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --filter @jsure/shared test && pnpm --filter @jsure/shared build`
Expected: PASS

- [ ] **Step 7: activity 라벨과 i18n 키 추가**

`AdminActivityAction` 에 값이 늘어 `ACTIVITY_ACTION_LABEL` 이 typecheck 로 깨진다. `CAMPAIGN_MANAGERS_ASSIGN: "domains.application.history.actions.campaignManagersAssign"` 추가.

`i18n/admin/messages.ts` 에 ko/en/ja 로:
- `domains.application.history.actions.campaignManagersAssign` — ko "담당자 지정" / en "Managers assigned" / ja "担当者の指定"

- [ ] **Step 8: 타입 체크**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 9: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations packages/shared/src packages/shared/src/index.ts apps/admin-web/src/domains/application/components/history/activityLabels.ts i18n/admin/messages.ts
git commit -m "feat(shared): 캠페인 담당자 스키마와 prisma 컬럼 추가"
```

- [ ] **Step 10: 사용자에게 마이그레이션 안내**

아래를 사용자에게 전달하고 **직접 실행하지 않는다**:

```
pnpm --filter @jsure/shared build
cd apps/api && pnpm prisma migrate deploy
pnpm prisma generate   # 실행할 워크트리에서도 각각
```

---

### Task 2: API 쓰기 경로 — managerIds 저장과 managers 해석

**Files:**
- Modify: `apps/api/src/campaigns/campaigns.service.ts`
- Modify: `apps/api/src/campaigns/campaign-drafts.controller.ts` (필요 시)
- Test: `apps/api/src/campaigns/campaign-managers.spec.ts` (신규)

**Interfaces:**
- Consumes: Task 1 의 `CampaignManager`, `CampaignForm.managerIds`, `UpdateCampaignRequest.managerIds`, `CampaignDraftRequest.managerIds`
- Produces:
  - `export function pickManagers(managerIds: string[], byId: Map<string, CampaignManager>): CampaignManager[]` — `campaigns.service.ts` 에서 export
  - `CampaignsService` 의 private `loadManagers(campaignRows: { managerIds: string[] }[]): Promise<Map<string, CampaignManager>>`
  - `CampaignsService` 의 private `assertManagersExist(managerIds: string[]): Promise<void>`
  - `toResponse(row, counts, managers)` — 3번째 파라미터 추가, 기본값 `[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/campaigns/campaign-managers.spec.ts`. 앞부분은 순수 함수, 뒷부분은 `campaign-drafts.spec.ts` 의 `makeService` stub-prisma 패턴을 그대로 따른다.

```ts
describe("pickManagers", () => {
  const byId = new Map([
    ["admin-1", { id: "admin-1", name: "선희", email: "sunhee@example.com" }],
    ["admin-2", { id: "admin-2", name: null, email: "karin@example.com" }],
  ]);

  it("managerIds 순서대로 풀어낸다", () => {
    expect(pickManagers(["admin-2", "admin-1"], byId).map((manager) => manager.id))
      .toEqual(["admin-2", "admin-1"]);
  });

  it("빈 managerIds 는 빈 배열이다", () => {
    expect(pickManagers([], byId)).toEqual([]);
  });

  it("유령 id 는 건너뛰고 나머지는 남긴다", () => {
    expect(pickManagers(["ghost", "admin-1"], byId).map((manager) => manager.id))
      .toEqual(["admin-1"]);
  });
});

describe("캠페인 생성 시 담당자 저장", () => {
  it("managerIds 를 그대로 저장한다", async () => { /* onCreate 로 data.managerIds 캡처 */ });

  it("존재하지 않는 어드민 id 가 섞이면 BadRequest 를 던진다", async () => {
    await expect(/* create */).rejects.toThrow(BadRequestException);
  });

  it("managerIds 가 비어 있으면 그대로 빈 배열로 저장한다", async () => {});
});

describe("캠페인 수정 시 담당자 저장", () => {
  it("managerIds 를 보내면 통째로 교체한다", async () => {});

  it("managerIds 를 생략하면 기존 담당자를 건드리지 않는다", async () => {
    // onUpdate 로 캡처한 data 에 managerIds 키가 없어야 한다
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/api test -- campaign-managers`
Expected: FAIL — `pickManagers` 미정의

- [ ] **Step 3: 구현**

`campaigns.service.ts`:
- `pickManagers` 를 모듈 레벨 export 순수 함수로 작성. `managerIds` 를 돌며 맵에 있는 것만 모은다.
- `loadManagers(rows)` — 전 행의 `managerIds` 를 합집합으로 모아 `adminUser.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true } })` **한 번**. 합집합이 비면 쿼리하지 않고 빈 맵.
- `assertManagersExist(managerIds)` — 비어 있으면 즉시 반환. 아니면 `adminUser.count({ where: { id: { in: managerIds } } })` 로 개수를 비교하고 불일치면 `BadRequestException("존재하지 않는 담당자가 포함돼 있습니다")`.
- `toResponse(row, counts, managers = [])` — `managers` 를 응답에 싣는다.
- `create` / `applyCampaignUpdate` / 임시저장 경로에서 `input.managerIds` 가 `undefined` 가 아닐 때만 `data.managerIds` 에 싣고, 싣기 전에 `assertManagersExist` 를 호출한다.
- `findAll` — `loadCounts` 옆에서 `loadManagers(rows)` 를 호출하고 `toResponse(row, counts, pickManagers(row.managerIds, managersById))`.
- `findById` 와 단건을 돌려주는 모든 경로(`create`, `update`, `bump`, `close`, `hide`, `unhide`, `publishDraft`)도 같은 방식으로 `managers` 를 채운다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/api test -- campaign-managers`
Expected: PASS

- [ ] **Step 5: 기존 테스트 회귀 확인**

Run: `pnpm --filter @jsure/api test`
Expected: PASS (기존 캠페인 spec 전부)

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/campaigns
git commit -m "feat(api): 캠페인 생성·수정·임시저장에 담당자 저장과 응답 해석 추가"
```

---

### Task 3: API 일괄 지정 엔드포인트

**Files:**
- Modify: `apps/api/src/campaigns/campaigns.service.ts`
- Modify: `apps/api/src/campaigns/campaigns.controller.ts`
- Test: `apps/api/src/campaigns/campaign-managers.spec.ts` (Task 2 파일에 describe 추가)

**Interfaces:**
- Consumes: Task 1 의 `BulkAssignCampaignManagersRequest/Response`, Task 2 의 `assertManagersExist`
- Produces:
  - `CampaignsService.assignManagers(input: BulkAssignCampaignManagersRequest, actor: AuditActor): Promise<BulkAssignCampaignManagersResponse>`
  - `POST /campaigns/managers/bulk`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe("assignManagers", () => {
  it("선택한 캠페인의 담당자를 통째로 교체한다 — 추가가 아니다", async () => {
    // onUpdateMany 로 캡처: data.managerIds === ["admin-2"] (set 이지 push 가 아님)
  });

  it("삭제된 캠페인은 대상에서 제외한다", async () => {
    // where 에 deletedAt: null 이 포함되고, updatedCount 가 stub 의 count 를 그대로 돌려준다
  });

  it("managerIds 가 비면 담당자를 해제한다", async () => {
    // data.managerIds === []
  });

  it("존재하지 않는 어드민 id 가 섞이면 BadRequest 를 던지고 updateMany 를 호출하지 않는다", async () => {});

  it("CAMPAIGN_MANAGERS_ASSIGN 감사 로그를 남긴다", async () => {
    // audit.record 호출 캡처: action, actor, campaignId
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/api test -- campaign-managers`
Expected: FAIL — `assignManagers` 미정의

- [ ] **Step 3: 서비스 구현**

`assignManagers(input, actor)`:
1. `assertManagersExist(input.managerIds)`
2. `this.prisma.campaign.updateMany({ where: { id: { in: input.campaignIds }, deletedAt: null }, data: { managerIds: input.managerIds } })`
3. 캠페인마다 `audit.record({ action: "CAMPAIGN_MANAGERS_ASSIGN", actor, campaignId, metadata: { managerCount: input.managerIds.length } })`. 감사는 best-effort 이므로 기존 호출부와 같이 await 하되 실패가 액션을 깨지 않는 `AuditService` 의 기존 동작에 맡긴다.
4. `{ updatedCount: result.count }` 반환

- [ ] **Step 4: 컨트롤러 라우트 추가**

`campaigns.controller.ts` 에, **`@Post(":id/bump")` 보다 위에** (이미 `@Post("audience/preview")` 가 같은 이유로 위에 있다):

```ts
@Post("managers/bulk")
assignManagers(
  @Req() request: { user: AuthenticatedUser },
  @Body(new ZodValidationPipe(BulkAssignCampaignManagersRequestSchema))
  body: BulkAssignCampaignManagersRequest,
): Promise<BulkAssignCampaignManagersResponse> {
  return this.campaigns.assignManagers(body, request.user);
}
```

권한은 컨트롤러 수준 `JwtAuthGuard` 만. 캠페인 생성·수정에 role 가드가 없으므로 같은 수준으로 맞춘다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @jsure/api test -- campaign-managers`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/campaigns
git commit -m "feat(api): 캠페인 담당자 일괄 지정 엔드포인트 추가"
```

---

### Task 4: API 읽기 부가 — 대시보드 KPI와 리포트 담당자

**Files:**
- Modify: `apps/api/src/admin-overview/admin-overview.service.ts`
- Modify: `apps/api/src/admin-overview/admin-overview.controller.ts`
- Modify: `apps/api/src/admin-reports/admin-reports.service.ts`
- Test: `apps/api/src/admin-overview/admin-overview.service.spec.ts` (신규)
- Test: `apps/api/src/admin-reports/admin-reports.service.spec.ts` (기존에 추가)

**Interfaces:**
- Consumes: Task 1 의 `AdminOverviewResponse.myRecruitingCampaignCount`, `CampaignReportRow.managers`, Task 2 의 `pickManagers`
- Produces: `AdminOverviewService.stats(adminUserId: string): Promise<AdminOverviewResponse>` (시그니처 변경)

- [ ] **Step 1: 실패하는 테스트 작성**

`admin-overview.service.spec.ts` — stub prisma 로 `campaign.count` 호출 인자를 캡처한다:

```ts
describe("AdminOverviewService.stats", () => {
  it("내 담당 모집중 집계에 managerIds has 조건을 건다", async () => {
    // 두 번째 campaign.count 호출의 where 에 managerIds: { has: "admin-1" } 가 있어야 한다
  });

  it("담당자가 없는 캠페인은 내 담당 집계에 들어가지 않는다", async () => {
    // stub 이 where 를 실제로 평가: managerIds: [] 인 행은 0 으로 센다
  });
});
```

`admin-reports.service.spec.ts` 의 기존 `makeService` stub 캠페인에 `managerIds: ["admin-1"]` 을 더하고:

```ts
it("리포트 행에 담당자를 담는다", async () => {
  const { rows } = await service.reports(/* 기존 인자 */);
  expect(rows[0].managers).toEqual([
    { id: "admin-1", name: "선희", email: "sunhee@example.com" },
  ]);
});

it("담당자가 없는 캠페인은 빈 배열이다", async () => {});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/api test -- admin-overview admin-reports`
Expected: FAIL

- [ ] **Step 3: 대시보드 구현**

`admin-overview.service.ts` — `stats(adminUserId: string)` 로 시그니처를 바꾸고 `Promise.all` 배열에 `campaign.count` 를 하나 더한다. where 는 기존 "모집 중" 조건(`PUBLISHED_CAMPAIGN_WHERE` + `closedAt: null` + 모집 기간) 에 `managerIds: { has: adminUserId }` 를 더한 것.

`admin-overview.controller.ts` — `@Req() request: { user: AuthenticatedUser }` 를 받아 `request.user.id` 를 넘긴다 (`admin-notices.controller.ts:43` 과 같은 패턴).

- [ ] **Step 4: 리포트 구현**

`admin-reports.service.ts` — 기존 `campaign.findMany` 의 select/include 에 `managerIds` 를 더하고, 전 캠페인의 합집합으로 `adminUser.findMany` 를 한 번 돌린 뒤 행마다 `pickManagers` 로 붙인다. `campaigns.service.ts` 의 export 를 재사용한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @jsure/api test`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/admin-overview apps/api/src/admin-reports
git commit -m "feat(api): 내 담당 모집중 집계와 리포트 담당자 추가"
```

---

### Task 5: admin-web 공용 부품

**Files:**
- Create: `apps/admin-web/src/components/composites/FilterChip/buildMultiSelectLabel.ts`
- Create: `apps/admin-web/src/components/composites/FilterChip/buildMultiSelectLabel.test.ts`
- Modify: `apps/admin-web/src/components/composites/FilterChip/index.tsx`
- Modify: `apps/admin-web/src/components/composites/FilterChip/FilterChip.module.css`
- Create: `apps/admin-web/src/domains/team/adminUserLabel.ts`
- Modify: `apps/admin-web/src/domains/team/index.ts`
- Create: `apps/admin-web/src/domains/campaign/useAdminUserOptions.ts`
- Create: `apps/admin-web/src/domains/campaign/components/CampaignManagerPicker.tsx`
- Create: `apps/admin-web/src/domains/campaign/components/CampaignManagerChips.tsx`
- Modify: `apps/admin-web/src/domains/campaign/index.ts`
- Modify: `i18n/admin/messages.ts`

**Interfaces:**
- Consumes: Task 1 의 `CampaignManager`
- Produces:
  - `buildMultiSelectLabel(labels: string[], maxVisibleLabels?: number): { text: string; title: string }`
  - `adminUserLabel(user: { name: string | null; email: string }): string`
  - `useAdminUserOptions(): { managers: PublicAdminUser[]; loading: boolean }`
  - `<CampaignManagerPicker value={string[]} onChange={(managerIds: string[]) => void} managers={PublicAdminUser[]} />`
  - `<CampaignManagerChips managers={CampaignManager[]} maxVisible={number} />`
  - `FilterChipProps.activeTitle?: string`, `MultiSelectFilterChipProps.maxVisibleLabels?: number`

- [ ] **Step 1: 실패하는 테스트 작성**

`buildMultiSelectLabel.test.ts`:

```ts
describe("buildMultiSelectLabel", () => {
  it("상한이 없으면 전부 이어 붙인다", () => {
    expect(buildMultiSelectLabel(["선희", "카린"])).toEqual({
      text: "선희, 카린",
      title: "선희, 카린",
    });
  });

  it("정확히 상한만큼이면 접지 않는다", () => {
    expect(buildMultiSelectLabel(["선희", "카린"], 2).text).toBe("선희, 카린");
  });

  it("상한을 넘으면 앞 N개만 보이고 나머지는 +M 으로 접는다", () => {
    expect(buildMultiSelectLabel(["선희", "카린", "치하루", "유나"], 2)).toEqual({
      text: "선희, 카린 +2",
      title: "선희, 카린, 치하루, 유나",
    });
  });

  it("빈 목록은 빈 문자열이다", () => {
    expect(buildMultiSelectLabel([], 2)).toEqual({ text: "", title: "" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/admin-web test -- buildMultiSelectLabel`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `buildMultiSelectLabel` 구현**

`+M` 의 `M` 은 `labels.length - maxVisibleLabels`. `maxVisibleLabels` 가 `undefined` 면 접지 않는다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/admin-web test -- buildMultiSelectLabel`
Expected: PASS

- [ ] **Step 5: `FilterChip` 에 optional prop 두 개 추가**

`FilterChipProps` 에 `activeTitle?: string` → 칩 `<button>` 의 네이티브 `title` 속성으로 내린다. 호버 툴팁은 브라우저 기본 동작으로 해결한다.

`MultiSelectFilterChipProps` 에 `maxVisibleLabels?: number` → `buildMultiSelectLabel` 로 `activeLabel` / `activeTitle` 을 만든다. 기존 `selectedLabels.join(", ")` 자리를 이걸로 대체한다 (상한을 안 넘기면 결과가 같다).

기존 호출부 4곳(`Reports`, `Influencers`, `ApplicantFilters`, `ApplicantStatusFilter`, `DraftStatusFilter`, `InfluencerTagFilterChip`)은 새 prop 을 넘기지 않으므로 동작이 그대로여야 한다.

- [ ] **Step 6: `adminUserLabel` 과 `useAdminUserOptions` 구현**

`adminUserLabel` — 이름이 비어 있으면 이메일로 대체하는 한 줄 순수 함수.

`useAdminUserOptions` — `listAdminUsers()` 로 받아 `status === "ACTIVE"` 만 남기고 `adminUserLabel` 기준으로 정렬해 돌려준다. role 은 가리지 않는다. 데이터 fetch 전용 훅이며 다른 도메인을 섞지 않는다 (CODE_RULES §7).

- [ ] **Step 7: `CampaignManagerPicker` 와 `CampaignManagerChips` 구현**

`CampaignManagerPicker` — `FilterChipBar` 로 감싼 `MultiSelectFilterChip` 하나. `maxVisibleLabels={2}`. 옵션 라벨은 `adminUserLabel`. 자체 fetch 하지 않는다 (presentational).

`CampaignManagerChips` — 표시 전용. `buildMultiSelectLabel` 로 `text` / `title` 을 만들고 `title` 속성을 건다. `managers` 가 비면 `null` 을 반환한다. 도메인 개념을 두 화면이 공유하므로 컴포넌트 하나로 격리한다 (CODE_RULES §8).

- [ ] **Step 8: i18n 키 추가**

`i18n/admin/messages.ts` 에 ko/en/ja:
- `domains.campaign.managers.label` — "운영 담당자"
- `domains.campaign.managers.chipEmpty` — "+ 담당자"
- `domains.campaign.managers.popoverTitle` — "담당자 선택"

- [ ] **Step 9: 전체 테스트와 타입 체크**

Run: `pnpm --filter @jsure/admin-web test && pnpm typecheck`
Expected: PASS

- [ ] **Step 10: 커밋**

```bash
git add apps/admin-web/src/components/composites/FilterChip apps/admin-web/src/domains/team apps/admin-web/src/domains/campaign i18n/admin/messages.ts
git commit -m "feat(admin-web): 담당자 선택·표시 공용 부품 추가"
```

---

### Task 6: admin-web 캠페인 생성·수정 폼

**Files:**
- Create: `apps/admin-web/src/domains/campaign/initialManagerIds.ts`
- Create: `apps/admin-web/src/domains/campaign/initialManagerIds.test.ts`
- Modify: `apps/admin-web/src/domains/campaign/components/CampaignForm.tsx`
- Modify: `apps/admin-web/src/pages/Campaigns/New.tsx`
- Modify: `apps/admin-web/src/pages/Campaigns/Edit.tsx`
- Modify: `apps/admin-web/src/pages/Campaigns/Campaigns.module.css`
- Modify: `apps/admin-web/src/domains/campaign/index.ts`

**Interfaces:**
- Consumes: Task 5 의 `CampaignManagerPicker`, `useAdminUserOptions`
- Produces:
  - `initialManagerIds(mode: "new" | "copy" | "edit", campaign: { managers: CampaignManager[] } | null, currentAdminUserId: string | null): string[]` — `CampaignResponse` 전체가 아니라 필요한 모양만 받는다. 테스트가 최소 리터럴을 넘길 수 있어야 한다.
  - `CampaignFormProps` 에 `managerIds: string[]`, `onManagerIdsChange: (managerIds: string[]) => void`

- [ ] **Step 1: 실패하는 테스트 작성**

`initialManagerIds.test.ts`:

```ts
describe("initialManagerIds", () => {
  it("신규는 본인 하나로 시작한다", () => {
    expect(initialManagerIds("new", null, "admin-1")).toEqual(["admin-1"]);
  });

  it("복사도 원본을 승계하지 않고 본인으로 시작한다", () => {
    const source = { managers: [{ id: "admin-9", name: "유나", email: "yuna@example.com" }] };
    expect(initialManagerIds("copy", source, "admin-1")).toEqual(["admin-1"]);
  });

  it("수정은 저장된 담당자를 그대로 복원한다", () => {
    const saved = { managers: [{ id: "admin-9", name: "유나", email: "yuna@example.com" }] };
    expect(initialManagerIds("edit", saved, "admin-1")).toEqual(["admin-9"]);
  });

  it("담당자가 없는 기존 캠페인을 수정하면 빈 배열이다 — 본인으로 채우지 않는다", () => {
    expect(initialManagerIds("edit", { managers: [] }, "admin-1")).toEqual([]);
  });

  it("로그인 정보가 없으면 신규도 빈 배열이다", () => {
    expect(initialManagerIds("new", null, null)).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/admin-web test -- initialManagerIds`
Expected: FAIL

- [ ] **Step 3: `initialManagerIds` 구현**

`switch (mode)` 로 쓴다 (중첩 삼항 금지).

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/admin-web test -- initialManagerIds`
Expected: PASS

- [ ] **Step 5: 폼 배선**

`CampaignForm.tsx` — props 에 `managerIds` / `onManagerIdsChange` 를 더하고, submit 과 임시저장 콜백에 넘기는 값을 `{ ...values, managerIds }` 로 합친다. 담당자는 검증 규칙이 없는 id 배열이라 react-hook-form 바깥에 둔다.

`New.tsx` — `useState(initialManagerIds(copyFrom ? "copy" : "new", state.campaign, getStoredUser()?.id ?? null))`. 헤더(`cmp__header`) 우측에 `CampaignManagerPicker` 를 놓는다. `useAdminUserOptions()` 로 후보를 받는다.

`Edit.tsx` — 같은 자리에 같은 피커. 초기값은 `initialManagerIds("edit", state.campaign, ...)`. 기존 "복사" 버튼과 같은 줄에 나란히 둔다.

헤더를 좌(제목·부제) / 우(담당자 피커 + 기존 버튼) 로 나누는 CSS 를 `Campaigns.module.css` 에 더한다. `Edit.tsx` 는 이미 `styles.headerRow` 를 쓰고 있으므로 그 패턴을 `New.tsx` 에도 적용한다.

- [ ] **Step 6: 타입 체크**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add apps/admin-web/src/domains/campaign apps/admin-web/src/pages/Campaigns
git commit -m "feat(admin-web): 캠페인 생성·수정 폼에 담당자 선택 추가"
```

---

### Task 7: admin-web 캠페인 관리 페이지 — 선택·우클릭·필터·카드 칩

**Files:**
- Create: `apps/admin-web/src/domains/campaign/managerFilter.ts`
- Create: `apps/admin-web/src/domains/campaign/managerFilter.test.ts`
- Modify: `apps/admin-web/src/pages/Campaigns/index.tsx`
- Modify: `apps/admin-web/src/domains/campaign/types.ts`
- Modify: `apps/admin-web/src/domains/campaign/components/CampaignCardTitle.tsx`
- Modify: `apps/admin-web/src/pages/Campaigns/Campaigns.module.css`
- Modify: `i18n/admin/messages.ts`

**Interfaces:**
- Consumes: Task 5 의 `CampaignManagerChips`, `useAdminUserOptions`; Task 1 의 `CampaignResponse.managers`
- Produces:
  - `parseManagerFilter(param: string | null): string[]` — `"me"` 와 어드민 id 가 섞인 목록
  - `matchesManagerFilter(managerIds: string[], filter: string[], currentAdminUserId: string | null): boolean`
  - `Campaign` 뷰 타입에 `managers: CampaignManager[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`managerFilter.test.ts`:

```ts
describe("parseManagerFilter", () => {
  it("null 은 빈 필터다", () => {
    expect(parseManagerFilter(null)).toEqual([]);
  });

  it("쉼표로 이은 id 를 가른다", () => {
    expect(parseManagerFilter("admin-1,admin-2")).toEqual(["admin-1", "admin-2"]);
  });

  it("me 를 그대로 보존한다 — id 로 치환하지 않는다", () => {
    expect(parseManagerFilter("me,admin-2")).toEqual(["me", "admin-2"]);
  });
});

describe("matchesManagerFilter", () => {
  it("필터가 비면 전부 통과한다", () => {
    expect(matchesManagerFilter([], [], "admin-1")).toBe(true);
    expect(matchesManagerFilter(["admin-9"], [], "admin-1")).toBe(true);
  });

  it("담당자가 없는 캠페인은 필터가 걸리면 탈락한다", () => {
    expect(matchesManagerFilter([], ["admin-1"], "admin-1")).toBe(false);
  });

  it("여러 담당자를 고르면 OR 이다", () => {
    expect(matchesManagerFilter(["admin-2"], ["admin-1", "admin-2"], null)).toBe(true);
  });

  it("me 는 현재 로그인 id 로 푼다", () => {
    expect(matchesManagerFilter(["admin-1"], ["me"], "admin-1")).toBe(true);
    expect(matchesManagerFilter(["admin-9"], ["me"], "admin-1")).toBe(false);
  });

  it("로그인 정보가 없으면 me 는 아무것도 매치하지 않는다", () => {
    expect(matchesManagerFilter(["admin-1"], ["me"], null)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/admin-web test -- managerFilter`
Expected: FAIL

- [ ] **Step 3: 순수 함수 구현**

`parseManagerFilter` — 쉼표로 가르고 빈 조각을 버린다.
`matchesManagerFilter` — 필터가 비면 `true`. 아니면 필터 항목을 `me` → `currentAdminUserId` 로 풀어(없으면 매치 불가) `managerIds` 와 교집합이 있는지 본다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/admin-web test -- managerFilter`
Expected: PASS

- [ ] **Step 5: 카드 담당자 표기**

`domains/campaign/types.ts` 의 `Campaign` 뷰 타입에 `managers` 를 더하고 `pages/Campaigns/index.tsx` 의 `toCard` 가 `campaign.managers` 를 싣게 한다.

`CampaignCardTitle` 에 `managers: CampaignManager[]` prop 을 더하고, 우측 D-day 왼쪽에 `CampaignManagerChips` 를 둔다. 담당자가 없으면 아무것도 그리지 않는다.

```
[모집중] [SNS] [대상자]        선희 카린 +2  D-5
[종료]   [가구매]                      선희
[모집중] [SNS]                              D-5   ← 담당자 없음
```

- [ ] **Step 6: 카드 인터랙션 전환**

`pages/Campaigns/index.tsx`:
- `selectedIds: Set<string>` 상태 추가.
- 카드 `onClick` → 선택 토글 (지금의 `setOpenMenu` 를 걷어낸다).
- 카드 `onContextMenu` → `event.preventDefault()` 후 `setOpenMenu({ id, x, y })`. 기존 `CampaignActionsMenu` 는 그대로다.
- 선택된 카드에 시각 표시(테두리 강조 + 체크). 스타일은 `Campaigns.module.css` 의 기존 톤에 맞춰 정한다.
- `statusFilter` / `categoryFilter` / `debouncedQuery` / `managerFilter` 가 바뀌면 선택을 비운다. 화면에 없는 카드가 선택된 채 남으면 "N개" 가 거짓말이 된다.
- `Esc` 키로 전체 선택 해제.

- [ ] **Step 7: 담당자 필터 칩**

툴바의 `FilterChipBar` 에 담당자 `MultiSelectFilterChip` 을 더한다. 옵션은 맨 위 `내 캠페인만 보기`(키 `me`) + `useAdminUserOptions()` 의 활성 어드민. URL 파라미터는 `manager`, 기존 `status`/`category` 와 같은 방식으로 읽고 쓴다.

`filtered` 의 `useMemo` 에 `matchesManagerFilter(campaign.managers.map((manager) => manager.id), managerFilter, currentAdminUserId)` 를 더한다. 필터링은 지금의 다른 필터와 같이 클라이언트에서 한다 — 이 페이지는 이미 전량 로드 후 클라 필터 구조다.

- [ ] **Step 8: i18n 키 추가**

ko/en/ja 로:
- `domains.campaign.managers.overflow` — "외 {count}명"
- `pages.campaigns.managerFilter.chipEmpty` — "+ 담당자"
- `pages.campaigns.managerFilter.prefix` — "담당자"
- `pages.campaigns.managerFilter.title` — "담당자 필터"
- `pages.campaigns.managerFilter.mine` — "내 캠페인만 보기"

- [ ] **Step 9: 테스트와 타입 체크**

Run: `pnpm --filter @jsure/admin-web test && pnpm typecheck`
Expected: PASS

- [ ] **Step 10: 커밋**

```bash
git add apps/admin-web/src/domains/campaign apps/admin-web/src/pages/Campaigns i18n/admin/messages.ts
git commit -m "feat(admin-web): 캠페인 카드 다중선택·우클릭 메뉴·담당자 필터 추가"
```

---

### Task 8: admin-web 일괄 지정 다이얼로그

**Files:**
- Modify: `apps/admin-web/src/domains/campaign/api.ts`
- Create: `apps/admin-web/src/domains/campaign/components/BulkAssignManagersDialog.tsx`
- Modify: `apps/admin-web/src/domains/campaign/index.ts`
- Modify: `apps/admin-web/src/pages/Campaigns/index.tsx`
- Modify: `apps/admin-web/src/pages/Campaigns/Campaigns.module.css`
- Modify: `i18n/admin/messages.ts`

**Interfaces:**
- Consumes: Task 1 의 `BulkAssignCampaignManagersRequest/Response`, Task 3 의 `POST /campaigns/managers/bulk`, Task 5 의 `CampaignManagerPicker`, Task 7 의 `selectedIds`
- Produces:
  - `bulkAssignCampaignManagers(input: BulkAssignCampaignManagersRequest): Promise<BulkAssignCampaignManagersResponse>`
  - `<BulkAssignManagersDialog campaignIds={string[]} onDone={() => void} onCancel={() => void} />`

- [ ] **Step 1: API 클라이언트 함수 추가**

`domains/campaign/api.ts` 에, 기존 함수들과 같이 `Schema.parse(res.data)` 로 응답을 파싱한다.

- [ ] **Step 2: 다이얼로그 구현**

`BulkAssignManagersDialog.tsx`:
- 선택한 담당자 상태를 **자기 안에서** `useState` 로 관리한다. 부모는 `campaignIds` 와 `onDone` / `onCancel` 만 안다 (CODE_RULES §7).
- 본문에 `CampaignManagerPicker` 와 대상 캠페인 건수.
- "저장" 을 누르면 바로 보내지 않고 기존 `ConfirmDialog` composite 로 경고를 띄운다:
  > 선택한 N개 캠페인의 담당자가 지정한 담당자로 **모두 교체**됩니다. 기존 담당자는 해제됩니다.
- 확인 시 `bulkAssignCampaignManagers` 호출. 성공하면 `onDone()`.
- 실패하면 다이얼로그 안에 메시지를 남기고 닫지 않는다.
- 액션별 독립 다이얼로그 원칙에 따라 기존 `CampaignActionDialog` 에 type 분기를 더하지 않는다.

- [ ] **Step 3: 툴바 버튼 배선**

`pages/Campaigns/index.tsx` — `selectedIds.size > 0` 일 때 `+ 새 캠페인` **왼쪽**에 `N개 캠페인 담당자 지정` 버튼을 그린다. 클릭하면 다이얼로그를 연다. `onDone` 에서 선택을 비우고 `setReloadKey((key) => key + 1)` 로 목록을 다시 읽는다.

- [ ] **Step 4: i18n 키 추가**

ko/en/ja 로:
- `pages.campaigns.bulkAssign.button` — "{count}개 캠페인 담당자 지정"
- `pages.campaigns.bulkAssign.title` — "담당자 일괄 지정"
- `pages.campaigns.bulkAssign.subtitle` — "선택한 {count}개 캠페인의 담당자를 지정합니다."
- `pages.campaigns.bulkAssign.submit` — "저장"
- `pages.campaigns.bulkAssign.confirmTitle` — "담당자를 모두 교체합니다"
- `pages.campaigns.bulkAssign.confirmBody` — "선택한 {count}개 캠페인의 담당자가 지정한 담당자로 모두 교체됩니다. 기존 담당자는 해제됩니다."
- `pages.campaigns.bulkAssign.failed` — "담당자 지정에 실패했습니다"

- [ ] **Step 5: 타입 체크**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/admin-web/src/domains/campaign apps/admin-web/src/pages/Campaigns i18n/admin/messages.ts
git commit -m "feat(admin-web): 담당자 일괄 지정 다이얼로그 추가"
```

---

### Task 9: admin-web 대시보드 KPI와 리포트 엑셀 컬럼

**Files:**
- Modify: `apps/admin-web/src/pages/Overview/index.tsx`
- Modify: `apps/admin-web/src/pages/Reports/index.tsx`
- Modify: `i18n/admin/messages.ts`

**Interfaces:**
- Consumes: Task 1 의 `AdminOverviewResponse.myRecruitingCampaignCount`, `CampaignReportRow.managers`; Task 5 의 `adminUserLabel`; Task 7 의 `manager` URL 파라미터
- Produces: 없음 (말단)

- [ ] **Step 1: 대시보드 KPI 카드 추가**

`pages/Overview/index.tsx` 의 `buildKpis` 에 카드 한 장을 더한다. 라벨은 `pages.overview.kpi.myRecruitingCampaigns`, 값은 `stats.myRecruitingCampaignCount`, `to: "/campaigns?manager=me"`. 기존 카드가 이미 `to` 로 딥링크하므로 추가 배선이 없다.

`stats` 의 기본값 객체(`index.tsx:134-140`)에 `myRecruitingCampaignCount: 0` 을 더한다.

- [ ] **Step 2: 리포트 엑셀 컬럼 추가**

`pages/Reports/index.tsx` 의 엑셀 생성부(요약 시트)에 `담당자` 컬럼을 더한다. 값은 `row.managers.map(adminUserLabel).join(", ")`, 담당자가 없으면 빈 문자열.

화면 테이블의 `COLUMNS` 는 **건드리지 않는다**.

- [ ] **Step 3: i18n 키 추가**

ko/en/ja 로:
- `pages.overview.kpi.myRecruitingCampaigns` — "내 담당 모집중 캠페인"
- `pages.reports.columns.managers` — "담당자"

- [ ] **Step 4: 전체 검증**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/admin-web/src/pages/Overview apps/admin-web/src/pages/Reports i18n/admin/messages.ts
git commit -m "feat(admin-web): 내 담당 모집중 KPI 카드와 리포트 엑셀 담당자 컬럼 추가"
```

---

## 완료 후 사용자 확인 사항

자동 테스트가 덮지 못하는 것들. 구현이 끝나면 사용자에게 안내한다.

**배포 순서** — `packages/shared` 변경이 있으므로 **api 를 먼저 배포**한다. `.default()` 방패를 걸어 뒀지만 순서를 지키는 쪽이 안전하다.
1. `pnpm --filter @jsure/shared build`
2. `cd apps/api && pnpm prisma migrate deploy` (사용자 직접)
3. api 재배포 (Railway)
4. admin-web 재배포 (Vercel)
5. 실행할 워크트리마다 `pnpm prisma generate`

`apps/client-web` 은 변경 없음.

**수동 확인**
- 담당자 없는 기존 캠페인이 목록에 그대로 보이는가.
- 우클릭으로 기존 액션(수정·복사·마감·비공개·삭제·응모자) 전부 도달 가능한가.
- 좌클릭 선택이 눈에 띄는가. 필터를 바꾸면 선택이 풀리는가.
- 일괄 지정 후 카드 담당자 표기와 필터 결과가 일치하는가.
- 대시보드 "내 담당 모집중" 카드를 누르면 `?manager=me` 가 걸린 목록으로 가는가.
- 응모자·인플루언서·리포트의 기존 필터 칩이 그대로 동작하는가 (`MultiSelectFilterChip` 공유).
- 인플루언서 웹에 담당자가 노출되지 않는가.
