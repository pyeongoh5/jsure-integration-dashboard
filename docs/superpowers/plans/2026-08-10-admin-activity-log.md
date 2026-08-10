# 어드민 액션 감사 로그(AdminActivityLog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** append-only 감사 로그 테이블 1개로 어드민 도메인 액션 전체를 시계열 기록하고, 응모건 단위 타임라인 UI 로 노출한다.

**Architecture:** `admin_activity_logs` 테이블(FK 없음, actor/문맥은 스냅샷) + `@Global()` `AuditService.record()`(best-effort, 예외 삼킴). 계측은 인터셉터가 아니라 각 도메인 서비스의 명시 호출. 기존 상태 컬럼(`reviewedById` 등)은 그대로 두고 로그를 **추가**하는 하이브리드.

**Tech Stack:** NestJS 11 + Prisma(PostgreSQL) + zod 3 (`@jsure/shared` 계약) + React/Vite(admin-web)

**설계 문서:** `docs/superpowers/specs/2026-08-09-admin-activity-log-design.md` — 액터 귀속 규칙표와 정책 결정은 그 문서가 단일 소스다.

## Global Constraints

- **서비스가 라이브다.** 스키마 변경은 additive 만. 테이블·enum 추가 외에 기존 테이블을 건드리지 않는다.
- `schema.prisma` 수정에는 항상 짝이 되는 마이그레이션 SQL 을 **직접 작성**한다. 이 레포는 `prisma migrate dev` 자동 생성이 아니라 `apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_<snake_name>/migration.sql` 을 손으로 쓰는 컨벤션이다(기존 마이그레이션 디렉토리명이 `20260809010000_campaign_order_period_days` 처럼 사람이 정한 시각).
- `packages/shared` 를 수정하면 반드시 `pnpm --filter @jsure/shared build` 를 실행한다. 안 하면 api/admin-web 타입체크가 옛 dist 를 본다.
- API 예외 `message` 는 **한국어**. `code` 상수는 대문자 유지.
- `any` 금지. `as` 는 zod parse 결과·`as const`·라이브러리 타입 부정확(이유 주석 1줄) 에만.
- 중첩 삼항 금지 (한 단계라도). early-return 함수 / `Record` 상수 / `switch` 로.
- 변수·파라미터 약어 금지 (`req`, `e`, `a`, `mut` 등). 단 `@Req() req` 는 기존 컨트롤러 전체가 쓰는 확립된 패턴이므로 그대로 따른다.
- 감사 로그 `metadata` 에 PII(계좌번호·주소·메모 본문) 를 넣지 않는다.
- 각 태스크 종료 시 `pnpm typecheck` (레포 루트) 통과. 태스크가 spec 을 건드리면 `pnpm --filter @jsure/api test -- <spec경로>` 도 통과.
- 커밋 메시지는 한글. `git add` 는 항상 의도한 파일만 명시 경로로 (`-A` 금지).

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `apps/api/prisma/migrations/20260810010000_admin_activity_log/migration.sql` | 테이블·enum 추가 |
| `packages/shared/src/types/adminActivity.ts` | 액션/origin/로그/응답 zod 계약 |
| `apps/api/src/audit/audit.service.ts` | `AuditService.record()`/`recordMany()` + `AuditActor`/`AuditEntry`/`AuditMetadata` 타입 |
| `apps/api/src/audit/audit.module.ts` | `@Global()` 모듈 |
| `apps/api/src/audit/audit.service.spec.ts` | best-effort 동작 단위 테스트 |
| `apps/api/src/audit/application-activity.ts` | 로그 row → `AdminActivityLog` 응답 매핑(순수 함수) |
| `apps/admin-web/src/domains/application/activityApi.ts` | activity 조회 fetch |
| `apps/admin-web/src/domains/application/components/applicants/useApplicationActivity.ts` | fetch hook |
| `apps/admin-web/src/domains/application/components/applicants/ActivityTimeline.tsx` | presentational 타임라인 |
| `apps/admin-web/src/domains/application/components/applicants/ActivityTimeline.module.css` | 타임라인 스타일 |
| `apps/admin-web/src/domains/application/components/applicants/activityLabels.ts` | `Record<AdminActivityAction, string>` 라벨 |

**수정**

| 파일 | 변경 |
|---|---|
| `apps/api/prisma/schema.prisma` | 모델·enum 추가 (파일 끝) |
| `packages/shared/src/index.ts` | `adminActivity.js` export |
| `apps/api/src/app.module.ts` | `AuditModule` 등록 |
| `apps/api/src/admin-applications/admin-applications.controller.ts` | undo/ship/deliver/undoSubmissionReview/settleSubmission 에 `@Req()` 추가, actor 전달, activity 엔드포인트 추가 |
| `apps/api/src/admin-applications/admin-applications.service.ts` | actor 파라미터화 + `audit.record` 10곳 + `listActivity` |
| `apps/api/src/settlements/ensure-settlement.ts` | 반환 `{ autoCompleted, createdSettlementId }` |
| `apps/api/src/settlements/ensure-settlement.spec.ts` | 반환 확장 검증 |
| `apps/api/src/influencer-applications/influencer-applications.service.ts` | ensure 호출부 `SYSTEM` 기록 |
| `apps/api/src/influencer-applications/influencer-applications.service.spec.ts` | audit mock |
| `apps/api/src/campaigns/campaigns.controller.ts` · `campaign-drafts.controller.ts` | 전 메서드 `@Req()` |
| `apps/api/src/campaigns/campaigns.service.ts` | actor 파라미터화 + record 9곳 + `applyCampaignUpdate` 추출 |
| `apps/api/src/campaigns/campaign-drafts.spec.ts` | 생성자 3인자 + actor 인자 |
| `apps/api/src/influencers/influencers.controller.ts` · `influencers.service.ts` | memo/flag/unflag 계측 |
| `apps/admin-web/src/domains/application/index.ts` | 신규 부품 export |
| `apps/admin-web/src/pages/Applicants/ApplicantDetailDialog.tsx` | 타임라인 섹션 |

---

### Task 1: Prisma 모델 + 마이그레이션

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (파일 끝, 현재 670행)
- Create: `apps/api/prisma/migrations/20260810010000_admin_activity_log/migration.sql`

**Interfaces:**
- Consumes: 없음
- Produces: Prisma 클라이언트에 `prisma.adminActivityLog` (delegate) 와 `AdminActivityOrigin` enum 타입

- [ ] **Step 1: `schema.prisma` 끝에 enum + 모델 추가**

`apps/api/prisma/schema.prisma` 의 **맨 끝**(`LineDispatchLog` 모델 닫는 `}` 다음)에 붙인다.

```prisma

enum AdminActivityOrigin {
  ADMIN
  CASCADE
  SYSTEM
}

/// 어드민 도메인 액션의 append-only 감사 로그. 상태 컬럼(reviewedById 등)은
/// "현재 값", 이 테이블은 "누가 언제 무엇을 했는지"의 이력을 담당한다.
model AdminActivityLog {
  id     String              @id @default(cuid())
  /// AdminActivityAction (packages/shared zod enum) 값. Prisma enum 이 아닌
  /// String 인 이유: 액션 종류는 계속 늘어나는데 PostgreSQL enum 은 값 제거가
  /// 불가능해 마이그레이션 부채가 쌓인다. 유효성은 AuditService 시그니처
  /// (z.infer 유니온 타입)가 컴파일 타임에 보장한다.
  action String
  origin AdminActivityOrigin @default(ADMIN)

  /// 수행 어드민. SYSTEM 이면 null.
  actorId   String?
  /// 행위 시점의 어드민 이름 스냅샷 — 계정 삭제/개명 후에도 감사 기록 보존.
  actorName String?

  /// 대상 참조. FK 를 걸지 않는다 — 감사 로그는 도메인 row 의 삭제를 막아서도,
  /// 삭제에 딸려 지워져서도 안 된다. 참조는 "그 시점의 사실"이고, 사람이 읽을
  /// 문맥은 metadata 스냅샷이 담당한다.
  applicationId String?
  campaignId    String?
  settlementId  String?
  influencerId  String?

  /// 액션 부가 정보(사유, 변경 필드명, 유발 이벤트 등). PII(계좌번호·주소 등)
  /// 는 넣지 않는다.
  metadata Json?

  createdAt DateTime @default(now())

  /// 1차는 실제로 쿼리되는 2개만. campaignId/influencerId/actorId 인덱스는
  /// 해당 조회 API 를 붙이는 후속 작업에서 additive 로 추가한다.
  @@index([applicationId, createdAt])
  @@index([createdAt])
  @@map("admin_activity_logs")
}
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`apps/api/prisma/migrations/20260810010000_admin_activity_log/migration.sql`:

```sql
-- 어드민 액션 감사 로그. 테이블·enum 추가만 하는 additive 마이그레이션 —
-- 기존 테이블 무변경이라 배포 순간 구버전 코드와 공존 가능하다.
CREATE TYPE "AdminActivityOrigin" AS ENUM ('ADMIN', 'CASCADE', 'SYSTEM');

CREATE TABLE "admin_activity_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "origin" "AdminActivityOrigin" NOT NULL DEFAULT 'ADMIN',
    "actorId" TEXT,
    "actorName" TEXT,
    "applicationId" TEXT,
    "campaignId" TEXT,
    "settlementId" TEXT,
    "influencerId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id")
);

-- 응모건별 타임라인 조회용. 대상 참조에 FK 를 걸지 않으므로 인덱스만 둔다.
CREATE INDEX "admin_activity_logs_applicationId_createdAt_idx" ON "admin_activity_logs"("applicationId", "createdAt");
CREATE INDEX "admin_activity_logs_createdAt_idx" ON "admin_activity_logs"("createdAt");
```

- [ ] **Step 3: Prisma 클라이언트 재생성**

Run: `pnpm --filter @jsure/api prisma:generate`
Expected: `Generated Prisma Client` 성공 메시지. (DB 접속 불필요 — generate 는 스키마만 읽는다.)

- [ ] **Step 4: 타입체크**

Run: `pnpm typecheck`
Expected: PASS (아직 사용처가 없으므로 통과해야 한다)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260810010000_admin_activity_log/migration.sql
git commit -m "feat(api): 어드민 감사 로그 테이블(AdminActivityLog) 추가

FK 없는 append-only 로그. 1차 인덱스는 (applicationId, createdAt) 과
(createdAt) 두 개만 — 나머지는 해당 조회 API 와 함께 추가한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: shared 계약 (`adminActivity.ts`)

**Files:**
- Create: `packages/shared/src/types/adminActivity.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `AdminActivityActionSchema` / `type AdminActivityAction` (24개 리터럴 유니온)
  - `AdminActivityOriginSchema` / `type AdminActivityOrigin` = `"ADMIN" | "CASCADE" | "SYSTEM"`
  - `AdminActivityLogSchema` / `type AdminActivityLog` = `{ id, action, origin, actor: { id, name } | null, metadata: Record<string, unknown> | null, createdAt: string }`
  - `ApplicationActivityResponseSchema` / `type ApplicationActivityResponse` = `{ items: AdminActivityLog[] }`

- [ ] **Step 1: 스키마 파일 작성**

`packages/shared/src/types/adminActivity.ts`:

```ts
import { z } from "zod";

/**
 * 어드민 감사 로그의 액션 종류. DB 는 String 컬럼이고, 이 유니온이 유일한
 * 유효성 보장 지점이다 — AuditService 시그니처가 이 타입을 받으므로 오타나
 * 미등록 액션은 컴파일 타임에 걸린다.
 */
export const AdminActivityActionSchema = z.enum([
  // 응모
  "APPLICATION_APPROVE",
  "APPLICATION_REJECT",
  "APPLICATION_REVIEW_UNDO",
  "APPLICATION_SHIP",
  "APPLICATION_DELIVER",
  // 제출물
  "SUBMISSION_APPROVE",
  "SUBMISSION_REJECT",
  "SUBMISSION_REVIEW_UNDO",
  // 정산
  "SETTLEMENT_CREATE",
  "SETTLEMENT_REGISTER",
  "SETTLEMENT_COMPLETE",
  "SETTLEMENT_AUTO_COMPLETE",
  // 캠페인
  "CAMPAIGN_CREATE",
  "CAMPAIGN_UPDATE",
  "CAMPAIGN_CLOSE",
  "CAMPAIGN_HIDE",
  "CAMPAIGN_UNHIDE",
  "CAMPAIGN_DELETE",
  "CAMPAIGN_DRAFT_CREATE",
  "CAMPAIGN_DRAFT_UPDATE",
  "CAMPAIGN_DRAFT_PUBLISH",
  // 인플루언서
  "INFLUENCER_MEMO_CREATE",
  "INFLUENCER_FLAG_SET",
  "INFLUENCER_FLAG_CLEAR",
]);
export type AdminActivityAction = z.infer<typeof AdminActivityActionSchema>;

/**
 * ADMIN = 어드민 직접 액션, CASCADE = 어드민 액션에 연쇄된 자동 처리,
 * SYSTEM = 크론·인플루언서 행동이 유발한 자동 처리(actor 없음).
 */
export const AdminActivityOriginSchema = z.enum(["ADMIN", "CASCADE", "SYSTEM"]);
export type AdminActivityOrigin = z.infer<typeof AdminActivityOriginSchema>;

export const AdminActivityActorSchema = z.object({
  id: z.string(),
  /** 행위 시점의 이름 스냅샷. 현재 AdminUser 를 조인하지 않는다. */
  name: z.string().nullable(),
});
export type AdminActivityActor = z.infer<typeof AdminActivityActorSchema>;

export const AdminActivityLogSchema = z.object({
  id: z.string(),
  action: AdminActivityActionSchema,
  origin: AdminActivityOriginSchema,
  actor: AdminActivityActorSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type AdminActivityLog = z.infer<typeof AdminActivityLogSchema>;

export const ApplicationActivityResponseSchema = z.object({
  items: z.array(AdminActivityLogSchema),
});
export type ApplicationActivityResponse = z.infer<
  typeof ApplicationActivityResponseSchema
>;
```

주: 설계 문서는 `createdAt: z.string()` 이었으나 레포의 다른 스키마(`auth.ts` 등)가 `z.string().datetime()` 을 쓰므로 그에 맞춘다.

- [ ] **Step 2: index export 추가**

`packages/shared/src/index.ts` 에서 `export * from "./types/lineTemplate.js";` **바로 다음 줄**에 추가:

```ts
export * from "./types/adminActivity.js";
```

- [ ] **Step 3: shared 빌드**

Run: `pnpm --filter @jsure/shared build`
Expected: 성공, `packages/shared/dist/types/adminActivity.d.ts` 생성

- [ ] **Step 4: 타입체크**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/types/adminActivity.ts packages/shared/src/index.ts
git commit -m "feat(shared): 감사 로그 계약(AdminActivityAction/Log/응답) 추가

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: AuditService

**Files:**
- Create: `apps/api/src/audit/audit.service.ts`
- Create: `apps/api/src/audit/audit.module.ts`
- Test: `apps/api/src/audit/audit.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: Task 1 의 `prisma.adminActivityLog`, Task 2 의 `AdminActivityAction`/`AdminActivityOrigin`
- Produces:
  - `type AuditActor = { id: string; name: string | null }`
  - `type AuditMetadata = Record<string, AuditMetadataValue>` (`AuditMetadataValue = string | number | boolean | null | AuditMetadataValue[]`)
  - `type AuditEntry = { action: AdminActivityAction; origin?: AdminActivityOrigin; actor?: AuditActor | null; applicationId?: string; campaignId?: string; settlementId?: string; influencerId?: string; metadata?: AuditMetadata }`
  - `class AuditService { record(entry: AuditEntry): Promise<void>; recordMany(entries: AuditEntry[]): Promise<void> }`
  - `class AuditModule` (`@Global()`, `AuditService` export)

`AuthenticatedUser`(= `PublicAdminUser & { sid }`)는 `id: string` + `name: string | null` 을 가지므로 **`AuditActor` 로 구조적으로 대입 가능**하다. 컨트롤러는 `req.user` 를 그대로 넘긴다 — 별도 변환 헬퍼를 만들지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/audit/audit.service.spec.ts`:

```ts
import { AuditService } from "./audit.service";

type CreateArgs = { data: Record<string, unknown> };

function makeService(overrides?: {
  onCreate?: (args: CreateArgs) => void;
  onCreateMany?: (args: { data: Record<string, unknown>[] }) => void;
  failCreate?: boolean;
}) {
  const prisma = {
    adminActivityLog: {
      create: async (args: CreateArgs) => {
        if (overrides?.failCreate) throw new Error("DB down");
        overrides?.onCreate?.(args);
        return { id: "log-1" };
      },
      createMany: async (args: { data: Record<string, unknown>[] }) => {
        if (overrides?.failCreate) throw new Error("DB down");
        overrides?.onCreateMany?.(args);
        return { count: args.data.length };
      },
    },
  };
  // PrismaService 전체를 목킹하지 않고 사용하는 delegate 만 제공한다.
  return new AuditService(prisma as never);
}

describe("AuditService.record", () => {
  it("액터와 대상 참조를 그대로 저장하고 origin 기본값은 ADMIN", async () => {
    let created: CreateArgs | null = null;
    const service = makeService({
      onCreate: (args) => {
        created = args;
      },
    });

    await service.record({
      action: "APPLICATION_APPROVE",
      actor: { id: "admin-1", name: "오피디" },
      applicationId: "app-1",
    });

    const data = created!.data;
    expect(data.action).toBe("APPLICATION_APPROVE");
    expect(data.origin).toBe("ADMIN");
    expect(data.actorId).toBe("admin-1");
    expect(data.actorName).toBe("오피디");
    expect(data.applicationId).toBe("app-1");
    expect(data.campaignId).toBeNull();
    // metadata 미지정은 undefined 로 남겨 컬럼을 건드리지 않는다.
    expect(data.metadata).toBeUndefined();
  });

  it("actor 를 생략하면 actorId/actorName 이 null 이고 origin 을 명시할 수 있다", async () => {
    let created: CreateArgs | null = null;
    const service = makeService({
      onCreate: (args) => {
        created = args;
      },
    });

    await service.record({
      action: "SETTLEMENT_AUTO_COMPLETE",
      origin: "SYSTEM",
      applicationId: "app-1",
      settlementId: "settle-1",
      metadata: { triggeredBy: "INSIGHT_SUBMITTED" },
    });

    const data = created!.data;
    expect(data.origin).toBe("SYSTEM");
    expect(data.actorId).toBeNull();
    expect(data.actorName).toBeNull();
    expect(data.settlementId).toBe("settle-1");
    expect(data.metadata).toEqual({ triggeredBy: "INSIGHT_SUBMITTED" });
  });

  it("기록이 실패해도 예외를 밖으로 던지지 않는다 (best-effort)", async () => {
    const service = makeService({ failCreate: true });

    await expect(
      service.record({ action: "APPLICATION_APPROVE", applicationId: "app-1" }),
    ).resolves.toBeUndefined();
  });
});

describe("AuditService.recordMany", () => {
  it("여러 entry 를 createMany 1회로 기록한다", async () => {
    let createManyArgs: { data: Record<string, unknown>[] } | null = null;
    const service = makeService({
      onCreateMany: (args) => {
        createManyArgs = args;
      },
    });

    await service.recordMany([
      {
        action: "SETTLEMENT_COMPLETE",
        actor: { id: "admin-1", name: null },
        applicationId: "app-1",
        settlementId: "settle-1",
        metadata: { batchSize: 2 },
      },
      {
        action: "SETTLEMENT_COMPLETE",
        actor: { id: "admin-1", name: null },
        applicationId: "app-2",
        settlementId: "settle-2",
        metadata: { batchSize: 2 },
      },
    ]);

    expect(createManyArgs!.data).toHaveLength(2);
    expect(createManyArgs!.data[0]!.settlementId).toBe("settle-1");
    expect(createManyArgs!.data[1]!.applicationId).toBe("app-2");
  });

  it("빈 배열이면 아무것도 호출하지 않는다", async () => {
    let calls = 0;
    const service = makeService({
      onCreateMany: () => {
        calls += 1;
      },
    });

    await service.recordMany([]);

    expect(calls).toBe(0);
  });

  it("일괄 기록 실패도 삼킨다", async () => {
    const service = makeService({ failCreate: true });

    await expect(
      service.recordMany([
        { action: "SETTLEMENT_COMPLETE", settlementId: "settle-1" },
      ]),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/api test -- src/audit/audit.service.spec.ts`
Expected: FAIL — `Cannot find module './audit.service'`

- [ ] **Step 3: `audit.service.ts` 작성**

`apps/api/src/audit/audit.service.ts`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import type {
  AdminActivityAction,
  AdminActivityOrigin,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

/** 행위 시점의 어드민 스냅샷. AuthenticatedUser 를 그대로 넘길 수 있다. */
export type AuditActor = { id: string; name: string | null };

type AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | AuditMetadataValue[];

/** JSON 직렬화 가능한 부가 정보. PII(계좌·주소·메모 본문)는 넣지 않는다. */
export type AuditMetadata = Record<string, AuditMetadataValue>;

export type AuditEntry = {
  action: AdminActivityAction;
  /** 기본 ADMIN. 연쇄 액션은 CASCADE, 어드민 미개입은 SYSTEM. */
  origin?: AdminActivityOrigin;
  /** SYSTEM 이면 생략하거나 null. */
  actor?: AuditActor | null;
  applicationId?: string;
  campaignId?: string;
  settlementId?: string;
  influencerId?: string;
  metadata?: AuditMetadata;
};

function toRow(entry: AuditEntry) {
  return {
    action: entry.action,
    origin: entry.origin ?? "ADMIN",
    actorId: entry.actor?.id ?? null,
    actorName: entry.actor?.name ?? null,
    applicationId: entry.applicationId ?? null,
    campaignId: entry.campaignId ?? null,
    settlementId: entry.settlementId ?? null,
    influencerId: entry.influencerId ?? null,
    // undefined 를 넘기면 Prisma 가 컬럼을 건드리지 않아 NULL 로 남는다.
    metadata: entry.metadata,
  };
}

/**
 * 어드민 도메인 액션의 감사 로그 기록.
 *
 * best-effort 다 — 기록 실패가 도메인 액션을 실패시키지 않는다. 현재 서비스
 * 대부분이 $transaction 을 쓰지 않아 mandatory 로 가려면 대규모 트랜잭션
 * 리팩토링이 동반되고 회귀 위험이 크다. 금전 액션의 in-transaction 승격은
 * 후속 과제.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.adminActivityLog.create({ data: toRow(entry) });
    } catch (error) {
      this.logger.error(`감사 로그 기록 실패: ${entry.action}`, error);
    }
  }

  /** 일괄 액션용 (정산 일괄 완료 등). createMany 1회. */
  async recordMany(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      await this.prisma.adminActivityLog.createMany({
        data: entries.map(toRow),
      });
    } catch (error) {
      const actions = entries.map((entry) => entry.action).join(",");
      this.logger.error(`감사 로그 일괄 기록 실패: ${actions}`, error);
    }
  }
}
```

`AuditMetadata` 가 Prisma 의 `InputJsonValue` 로 구조적 대입이 안 돼 타입 에러가 나면, `AuditMetadataValue` 에서 배열 케이스를 `readonly AuditMetadataValue[]` 로 바꿔본다. 그래도 안 되면 `as` 로 우회하지 말고 `AuditMetadataValue` 를 `string | number | boolean | null | string[]` 로 좁힌다 — 실제로 쓰는 배열은 `changedFields: string[]` 하나뿐이다.

- [ ] **Step 4: `audit.module.ts` 작성**

`apps/api/src/audit/audit.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";

/**
 * 감사 로그는 거의 모든 어드민 도메인이 쓰므로 모듈마다 import 하지 않도록
 * PrismaModule 과 같은 @Global() 로 둔다.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 5: `app.module.ts` 에 등록**

`apps/api/src/app.module.ts`:
- import 구문: `import { PrismaModule } from "./prisma/prisma.module";` 다음 줄에 `import { AuditModule } from "./audit/audit.module";` 추가
- `imports` 배열: `PrismaModule,` 다음 줄에 `AuditModule,` 추가

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --filter @jsure/api test -- src/audit/audit.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: 타입체크**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/audit apps/api/src/app.module.ts
git commit -m "feat(api): AuditService 추가 — best-effort 감사 로그 기록

기록 실패는 Logger.error 로만 남기고 도메인 액션에 전파하지 않는다.
PrismaModule 처럼 @Global() 로 등록해 모듈마다 import 하지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 계측 — 응모/제출물 (`admin-applications`)

**Files:**
- Modify: `apps/api/src/admin-applications/admin-applications.controller.ts`
- Modify: `apps/api/src/admin-applications/admin-applications.service.ts`

**Interfaces:**
- Consumes: `AuditService`, `AuditActor` (Task 3)
- Produces: 변경된 서비스 시그니처 — Task 5 가 이어서 같은 파일을 수정한다
  - `approve(id: string, actor: AuditActor): Promise<AdminApplication>`
  - `reject(id: string, actor: AuditActor, reason: string): Promise<AdminApplication>`
  - `undo(id: string, actor: AuditActor): Promise<AdminApplication>`
  - `ship(id: string, actor: AuditActor, trackingCarrier: string, trackingNumber: string): Promise<AdminApplication>`
  - `deliver(id: string, actor: AuditActor): Promise<AdminApplication>`
  - `approveSubmission(applicationId: string, actor: AuditActor): Promise<AdminSubmission>`
  - `rejectSubmission(applicationId: string, actor: AuditActor, comment: string): Promise<AdminSubmission>`
  - `undoSubmissionReview(applicationId: string, actor: AuditActor): Promise<AdminSubmission>`

`admin-applications` 에는 기존 spec 파일이 없다. 이 태스크는 `pnpm typecheck` 로 검증한다 (계측이 `audit.record` 호출 한 줄이라 단위 테스트 가치가 낮다 — 설계 문서 "테스트" 절 참조).

- [ ] **Step 1: 서비스에 AuditService 주입**

`apps/api/src/admin-applications/admin-applications.service.ts`:

import 블록(기존 `import { ensureSettlementForApplication, ... } from "../settlements/ensure-settlement";` 인근)에 추가:

```ts
import { AuditService } from "../audit/audit.service";
import type { AuditActor } from "../audit/audit.service";
```

생성자를 다음으로 교체 (현재 126~131행):

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
    private readonly dispatcher: LineDispatcherService,
    private readonly r2: R2Service,
    private readonly audit: AuditService,
  ) {}
```

- [ ] **Step 2: `approve` 계측**

시그니처를 `async approve(id: string, actor: AuditActor): Promise<AdminApplication> {` 로 바꾸고, 본문의 `reviewedById: reviewerId,` 를 `reviewedById: actor.id,` 로 바꾼다.

`await this.prisma.campaignApplication.update({...})` 직후, `const approveTriggerKey =` 앞에 삽입:

```ts
    await this.audit.record({
      action: "APPLICATION_APPROVE",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
    });
```

- [ ] **Step 3: `reject` 계측**

시그니처를 `async reject(id: string, actor: AuditActor, reason: string): Promise<AdminApplication> {` 로, `reviewedById: reviewerId,` → `reviewedById: actor.id,`.

`update` 직후, `const rejectTriggerKey =` 앞에 삽입:

```ts
    await this.audit.record({
      action: "APPLICATION_REJECT",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
      metadata: { reason: reason.trim() },
    });
```

- [ ] **Step 4: `undo` 계측 — 비우기 전 검토자 보존**

시그니처를 `async undo(id: string, actor: AuditActor): Promise<AdminApplication> {` 로. `update` 직후, `return this.fetch(id);` 앞에 삽입:

```ts
    // undo 는 reviewedById 를 null 로 소거하므로 이전 검토자를 로그에 보존한다.
    await this.audit.record({
      action: "APPLICATION_REVIEW_UNDO",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
      metadata: {
        previousStatus: existing.status,
        previousReviewerId: existing.reviewedById,
      },
    });
```

- [ ] **Step 5: `ship` 계측**

시그니처를 다음으로:

```ts
  async ship(
    id: string,
    actor: AuditActor,
    trackingCarrier: string,
    trackingNumber: string,
  ): Promise<AdminApplication> {
```

`update` 직후, `const shippedTriggerKey =` 앞에 삽입:

```ts
    await this.audit.record({
      action: "APPLICATION_SHIP",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
      metadata: { trackingCarrier, trackingNumber },
    });
```

- [ ] **Step 6: `deliver` 계측**

시그니처를 `async deliver(id: string, actor: AuditActor): Promise<AdminApplication> {` 로. `update` 직후, `const deliveredTriggerKey =` 앞에 삽입:

```ts
    await this.audit.record({
      action: "APPLICATION_DELIVER",
      actor,
      applicationId: id,
      campaignId: existing.campaignId,
    });
```

- [ ] **Step 7: `approveSubmission` 계측**

시그니처를 다음으로:

```ts
  async approveSubmission(
    applicationId: string,
    actor: AuditActor,
  ): Promise<AdminSubmission> {
```

`select: { id: true },` 를 `select: { id: true, campaignId: true },` 로 바꾼다 (로그의 campaignId 용).
`submissionReviewedById: reviewerId,` → `submissionReviewedById: actor.id,`.

`update` 직후, `// 인사이트가 이미 제출돼 있던 경우` 주석 앞에 삽입:

```ts
    await this.audit.record({
      action: "SUBMISSION_APPROVE",
      actor,
      applicationId,
      campaignId: existing.campaignId,
    });
```

(정산 연쇄 기록은 Task 5 에서 이 아래 `ensureSettlementForApplication` 호출부에 붙인다.)

- [ ] **Step 8: `rejectSubmission` 계측**

시그니처를 다음으로:

```ts
  async rejectSubmission(
    applicationId: string,
    actor: AuditActor,
    comment: string,
  ): Promise<AdminSubmission> {
```

`$transaction` 안의 `submissionReviewedById: reviewerId,` 와 `rejectedById: reviewerId,` 를 각각 `actor.id` 로 바꾼다.

`$transaction` 직후, `const resubmitDeadlineAt =` 앞에 삽입:

```ts
    await this.audit.record({
      action: "SUBMISSION_REJECT",
      actor,
      applicationId,
      campaignId: existing.campaignId,
      metadata: { reason: comment },
    });
```

- [ ] **Step 9: `undoSubmissionReview` 계측**

시그니처를 다음으로:

```ts
  async undoSubmissionReview(
    applicationId: string,
    actor: AuditActor,
  ): Promise<AdminSubmission> {
```

`update` 직후, `return this.fetchSubmission(applicationId);` 앞에 삽입:

```ts
    // 검토 취소는 submissionReviewedById 를 소거하므로 이전 검토자를 보존한다.
    await this.audit.record({
      action: "SUBMISSION_REVIEW_UNDO",
      actor,
      applicationId,
      campaignId: existing.campaignId,
      metadata: {
        previousStatus: existing.submissionReviewStatus,
        previousReviewerId: existing.submissionReviewedById,
      },
    });
```

- [ ] **Step 10: 컨트롤러 — actor 전달 + `@Req()` 추가**

`apps/api/src/admin-applications/admin-applications.controller.ts` 의 아래 8개 핸들러를 교체한다. `req.user` 는 `AuditActor` 로 구조적 대입이 되므로 그대로 넘긴다.

```ts
  @Post(":id/submission/approve")
  @HttpCode(200)
  approveSubmission(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminSubmission> {
    return this.svc.approveSubmission(id, req.user);
  }

  @Post(":id/submission/reject")
  @HttpCode(200)
  rejectSubmission(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectSubmissionRequestSchema))
    body: RejectSubmissionRequest,
  ): Promise<AdminSubmission> {
    return this.svc.rejectSubmission(id, req.user, body.comment.trim());
  }

  @Post(":id/submission/undo")
  @HttpCode(200)
  undoSubmissionReview(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminSubmission> {
    return this.svc.undoSubmissionReview(id, req.user);
  }
```

```ts
  @Post(":id/approve")
  @HttpCode(200)
  approve(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminApplication> {
    return this.svc.approve(id, req.user);
  }

  @Post(":id/reject")
  @HttpCode(200)
  reject(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectApplicationRequestSchema))
    body: RejectApplicationRequest,
  ): Promise<AdminApplication> {
    return this.svc.reject(id, req.user, body.reason);
  }

  @Post(":id/undo")
  @HttpCode(200)
  undo(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminApplication> {
    return this.svc.undo(id, req.user);
  }

  @Post(":id/ship")
  @HttpCode(200)
  ship(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ShipApplicationRequestSchema))
    body: ShipApplicationRequest,
  ): Promise<AdminApplication> {
    return this.svc.ship(
      id,
      req.user,
      body.trackingCarrier.trim(),
      body.trackingNumber.trim(),
    );
  }

  @Post(":id/deliver")
  @HttpCode(200)
  deliver(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminApplication> {
    return this.svc.deliver(id, req.user);
  }
```

`completeSettlements` 와 `settleSubmission` 은 Task 5 에서 다룬다.

- [ ] **Step 11: 타입체크**

Run: `pnpm typecheck`
Expected: PASS. 실패하면 남은 `reviewerId` 참조를 확인한다: `grep -n "reviewerId" apps/api/src/admin-applications/admin-applications.service.ts` 가 아무것도 반환하지 않아야 한다.

- [ ] **Step 12: 커밋**

```bash
git add apps/api/src/admin-applications/admin-applications.controller.ts apps/api/src/admin-applications/admin-applications.service.ts
git commit -m "feat(api): 응모·제출물 액션 감사 로그 계측

undo/ship/deliver/제출물 검토취소는 @Req() 를 새로 받는다. 검토 취소는
소거되는 reviewedById 를 metadata.previousReviewerId 로 보존한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 계측 — 정산

**Files:**
- Modify: `apps/api/src/settlements/ensure-settlement.ts:97-202`
- Modify: `apps/api/src/settlements/ensure-settlement.spec.ts`
- Modify: `apps/api/src/admin-applications/admin-applications.service.ts` (`approveSubmission` 연쇄, `settleSubmission`, `completeSettlements`)
- Modify: `apps/api/src/admin-applications/admin-applications.controller.ts` (`settleSubmission`, `completeSettlements`)
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts:868-873`
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.spec.ts`

**Interfaces:**
- Consumes: `AuditService` (Task 3), Task 4 의 서비스 시그니처
- Produces:
  - `ensureSettlementForApplication(prisma, applicationId): Promise<{ autoCompleted: boolean; createdSettlementId: string | null }>`
  - `settleSubmission(applicationId: string, actor: AuditActor): Promise<AdminSubmission>`
  - `completeSettlements(actor: AuditActor, ids?: string[]): Promise<{ completedCount: number }>`

`ensure-settlement.ts` 는 `AuditService` 를 주입받지 않는다 — 순수 함수 성격을 유지하고, 기록은 호출자가 각자의 액터 귀속(CASCADE vs SYSTEM)에 맞게 한다.

- [ ] **Step 1: `makeStubPrisma` 가 upsert 결과를 돌려주도록 고친다**

`apps/api/src/settlements/ensure-settlement.spec.ts` 의 `makeStubPrisma`(34~50행)는 현재 `upsert` 가 `null` 을 반환한다. 확장된 구현이 `created.id` 를 읽으므로 id 를 돌려주게 바꾼다 — 기존 테스트는 반환값을 쓰지 않으므로 영향 없다.

```ts
function makeStubPrisma(
  application: ApplicationSelect | null,
  createdSettlementId = "settle-created",
) {
  const upserts: unknown[] = [];
  const prisma = {
    campaignApplication: {
      findUnique: async () =>
        application
          ? { influencer: { bankAccount: null }, ...application }
          : null,
    },
    settlement: {
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: createdSettlementId };
      },
    },
  } as never;
  return { prisma, upserts };
}
```

- [ ] **Step 2: 실패하는 테스트 추가**

`describe("ensureSettlementForApplication — FAKE_PURCHASE", ...)` 블록 **뒤**, `describe("ensureSettlementForApplication — SNS", ...)` **앞**에 삽입.

```ts
describe("ensureSettlementForApplication — createdSettlementId", () => {
  const approvedFakePurchase: ApplicationSelect = {
    submissionReviewStatus: "APPROVED",
    subTypes: ["QOO10"],
    options: [],
    posts: [],
    campaign: {
      category: "FAKE_PURCHASE",
      rewardType: "UNIFIED",
      rewardJpy: 3000,
      recruits: [
        {
          subType: "QOO10",
          insightRequired: false,
          productPriceJpy: 1000,
          rewardJpy: null,
        },
      ],
    },
  };

  it("신규 생성 시 upsert 가 만든 정산 id 를 반환한다", async () => {
    const { prisma } = makeStubPrisma(approvedFakePurchase, "settle-new");

    const result = await ensureSettlementForApplication(prisma, "app-1");

    expect(result.createdSettlementId).toBe("settle-new");
    expect(result.autoCompleted).toBe(false);
  });

  it("이미 정산이 있으면 upsert 없이 createdSettlementId 는 null", async () => {
    const { prisma, upserts } = makeStubPrisma({
      ...approvedFakePurchase,
      settlement: { id: "settle-existing" },
    });

    const result = await ensureSettlementForApplication(prisma, "app-1");

    expect(result.createdSettlementId).toBeNull();
    expect(upserts).toHaveLength(0);
  });

  it("조건 미충족(제출물 미승인)이면 createdSettlementId 는 null", async () => {
    const { prisma } = makeStubPrisma({
      ...approvedFakePurchase,
      submissionReviewStatus: "PENDING",
    });

    const result = await ensureSettlementForApplication(prisma, "app-1");

    expect(result.createdSettlementId).toBeNull();
  });

  it("응모가 없으면 createdSettlementId 는 null", async () => {
    const { prisma } = makeStubPrisma(null);

    const result = await ensureSettlementForApplication(prisma, "app-1");

    expect(result.createdSettlementId).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/api test -- src/settlements/ensure-settlement.spec.ts`
Expected: FAIL — `expect(received).toBe("settle-new")` / `Property 'createdSettlementId' does not exist`

- [ ] **Step 4: `ensure-settlement.ts` 반환 확장**

`apps/api/src/settlements/ensure-settlement.ts`:

JSDoc 마지막 단락 뒤에 한 줄 추가:

```
 * 이번 호출에서 새로 생성한 경우에만 createdSettlementId 가 채워진다 —
 * 호출자가 감사 로그의 settlementId 로 쓴다.
```

시그니처를 다음으로:

```ts
export async function ensureSettlementForApplication(
  prisma: PrismaService,
  applicationId: string,
): Promise<{ autoCompleted: boolean; createdSettlementId: string | null }> {
```

조기 반환 4곳을 모두 `createdSettlementId: null` 을 포함하도록 바꾼다:

```ts
  if (!application) return { autoCompleted: false, createdSettlementId: null };
  if (application.submissionReviewStatus !== "APPROVED") {
    return { autoCompleted: false, createdSettlementId: null };
  }
  // 이미 정산이 생성돼 있으면 그대로 둔다 (멱등).
  if (application.settlement) {
    return { autoCompleted: false, createdSettlementId: null };
  }
```

그리고 SNS 인사이트 미제출 조기 반환:

```ts
    if (insightMissing) {
      return { autoCompleted: false, createdSettlementId: null };
    }
```

마지막 upsert + return 을 다음으로:

```ts
  const created = await prisma.settlement.upsert({
    where: { applicationId },
    create: {
      applicationId,
      amountJpy,
      rewardAmountJpy,
      productRefundJpy,
      status: autoCompleted ? "COMPLETED" : "PENDING",
      completedAt: autoCompleted ? new Date() : null,
      ...bankSnapshot,
    },
    update: {},
    select: { id: true },
  });
  return { autoCompleted, createdSettlementId: created.id };
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @jsure/api test -- src/settlements/ensure-settlement.spec.ts`
Expected: PASS (기존 테스트 전부 + 신규 3개)

- [ ] **Step 6: `approveSubmission` 의 연쇄 정산 기록 (CASCADE)**

`apps/api/src/admin-applications/admin-applications.service.ts` `approveSubmission` 안, 기존 호출부를 다음으로 교체:

```ts
    // 인사이트가 이미 제출돼 있던 경우, 승인 시점에 자동 정산.
    const { autoCompleted, createdSettlementId } =
      await ensureSettlementForApplication(this.prisma, applicationId);
    if (createdSettlementId) {
      // 어드민 승인의 부수효과 — 액터는 승인자지만 "직접 정산 버튼을 눌렀다"와
      // 구분되도록 origin 은 CASCADE.
      await this.audit.record({
        action: autoCompleted ? "SETTLEMENT_AUTO_COMPLETE" : "SETTLEMENT_CREATE",
        origin: "CASCADE",
        actor,
        applicationId,
        campaignId: existing.campaignId,
        settlementId: createdSettlementId,
      });
    }
```

- [ ] **Step 7: `settleSubmission` 계측 (REGISTER 1행) + `completedById` 채우기**

시그니처를 다음으로:

```ts
  async settleSubmission(
    applicationId: string,
    actor: AuditActor,
  ): Promise<AdminSubmission> {
```

조회의 `include` 에 `campaignId` 가 없으므로(현재 `include` 사용 → 스칼라 전체 포함) 그대로 `existing.campaignId` 를 쓸 수 있다.

upsert 블록을 다음으로 교체 (`completedById` 추가 + 결과 id 확보):

```ts
    const created = await this.prisma.settlement.upsert({
      where: { applicationId },
      create: {
        applicationId,
        amountJpy,
        rewardAmountJpy,
        productRefundJpy,
        status: autoCompleted ? "COMPLETED" : "PENDING",
        completedAt: autoCompleted ? new Date() : null,
        // 이 경로의 자동완료는 어드민이 등록 버튼을 눌러 일어났으므로
        // 상태 컬럼에도 완료자를 남긴다 (기존엔 공백이었다).
        completedById: autoCompleted ? actor.id : null,
        bankCountry: existing.influencer.bankAccount?.bankCountry ?? null,
        bankCode: existing.influencer.bankAccount?.bankCode ?? null,
        bankName: existing.influencer.bankAccount?.bankName ?? null,
        branchName: existing.influencer.bankAccount?.branchName ?? null,
        branchCode: existing.influencer.bankAccount?.branchCode ?? null,
        accountNumber: existing.influencer.bankAccount?.accountNumber ?? null,
        accountHolder:
          existing.influencer.bankAccount?.accountHolder ?? null,
        invoiceRegistrationNumber:
          existing.influencer.bankAccount?.invoiceRegistrationNumber ?? null,
      },
      update: {},
      select: { id: true },
    });
    // 어드민이 누른 액션은 '등록' 하나다. 0엔 즉시완료는 그 결과이므로
    // 별도 행으로 남기지 않고 metadata 로 표기한다.
    await this.audit.record({
      action: "SETTLEMENT_REGISTER",
      actor,
      applicationId,
      campaignId: existing.campaignId,
      settlementId: created.id,
      metadata: { amountJpy, autoCompleted },
    });
```

- [ ] **Step 8: `completeSettlements` 계측 (recordMany)**

시그니처를 다음으로:

```ts
  async completeSettlements(
    actor: AuditActor,
    ids?: string[],
  ): Promise<{ completedCount: number }> {
```

`completedById: completerId,` → `completedById: actor.id,`.

`updateMany` 직후, `for (const target of targets) {` 앞에 삽입:

```ts
    // 정산 건당 1행. applicationId 를 함께 넣어 응모 타임라인이 단일 인덱스
    // 쿼리로 정산 이력까지 커버하게 한다.
    await this.audit.recordMany(
      targets.map((target) => ({
        action: "SETTLEMENT_COMPLETE" as const,
        actor,
        applicationId: target.applicationId,
        campaignId: target.application.campaignId,
        settlementId: target.id,
        metadata: { batchSize: targets.length, amountJpy: target.amountJpy },
      })),
    );
```

- [ ] **Step 9: 컨트롤러 2곳 수정**

`apps/api/src/admin-applications/admin-applications.controller.ts`:

```ts
  @Post(":id/submission/settle")
  @HttpCode(200)
  settleSubmission(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<AdminSubmission> {
    return this.svc.settleSubmission(id, req.user);
  }
```

```ts
  @Post("settlements/complete")
  @HttpCode(200)
  completeSettlements(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: { ids?: string[] },
  ): Promise<{ completedCount: number }> {
    return this.svc.completeSettlements(req.user, body.ids);
  }
```

- [ ] **Step 10: `influencer-applications` 호출부 — SYSTEM 귀속**

`apps/api/src/influencer-applications/influencer-applications.service.ts`:

import 블록에 추가:

```ts
import { AuditService } from "../audit/audit.service";
```

생성자에 5번째 파라미터 추가:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly line: LineMessagingService,
    private readonly dispatcher: LineDispatcherService,
    private readonly audit: AuditService,
  ) {}
```

868~873행의 호출부를 다음으로 교체:

```ts
    // 제출물이 이미 승인된 상태라면 인사이트 제출 시점에 자동 정산.
    const { autoCompleted, createdSettlementId } =
      await ensureSettlementForApplication(this.prisma, applicationId);
    if (createdSettlementId) {
      // 인플루언서 행동이 유발한 자동 처리 — 과거의 승인자에게 귀속하지 않고
      // actorId 없이 SYSTEM 으로 남긴다.
      await this.audit.record({
        action: autoCompleted ? "SETTLEMENT_AUTO_COMPLETE" : "SETTLEMENT_CREATE",
        origin: "SYSTEM",
        applicationId,
        settlementId: createdSettlementId,
        metadata: { triggeredBy: "INSIGHT_SUBMITTED" },
      });
    }
```

- [ ] **Step 11: `influencer-applications.service.spec.ts` 에 audit mock 추가**

`makeService` 헬퍼(1~24행)에서 `new InfluencerApplicationsService(...)` 호출에 5번째 인자를 추가한다:

```ts
  const audit = overrides?.audit ?? {
    record: jest.fn(),
    recordMany: jest.fn(),
  };
  return new InfluencerApplicationsService(
    prisma as never,
    uploads as never,
    line as never,
    dispatcher as never,
    audit as never,
  );
```

`overrides` 타입에 `audit?: unknown;` 을 추가한다 (기존 `dispatcher?:` 항목 옆).

- [ ] **Step 12: 관련 spec 전부 실행**

Run: `pnpm --filter @jsure/api test -- src/settlements src/influencer-applications src/audit`
Expected: PASS

- [ ] **Step 13: 타입체크**

Run: `pnpm typecheck`
Expected: PASS. 실패 시 `grep -n "completerId" apps/api/src/admin-applications/admin-applications.service.ts` 가 비어야 한다.

- [ ] **Step 14: 커밋**

```bash
git add apps/api/src/settlements apps/api/src/admin-applications apps/api/src/influencer-applications
git commit -m "feat(api): 정산 액션 감사 로그 계측

ensureSettlementForApplication 반환을 createdSettlementId 로 확장하고
기록은 호출자가 한다 — 어드민 승인 연쇄는 CASCADE, 인사이트 제출 유발은
SYSTEM. settleSubmission 의 0엔 자동완료는 completedById 도 채운다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 계측 — 캠페인 (`campaigns`, `campaign-drafts`)

**Files:**
- Modify: `apps/api/src/campaigns/campaigns.service.ts`
- Modify: `apps/api/src/campaigns/campaigns.controller.ts`
- Modify: `apps/api/src/campaigns/campaign-drafts.controller.ts`
- Modify: `apps/api/src/campaigns/campaign-drafts.spec.ts`

**Interfaces:**
- Consumes: `AuditService`, `AuditActor` (Task 3)
- Produces:
  - `create(input: CreateCampaignRequest, actor: AuditActor)`
  - `update(id: string, input: UpdateCampaignRequest, actor: AuditActor)`
  - `close(id: string, actor: AuditActor)` / `hide(id, actor)` / `unhide(id, actor)` / `remove(id, actor)`
  - `createDraft(input: CampaignDraftRequest, actor: AuditActor)` / `updateDraft(id, input, actor)` / `publishDraft(id, input, actor)`
  - private `applyCampaignUpdate(id: string, input: UpdateCampaignRequest): Promise<{ changedFields: string[] }>`

핵심 함정: 현재 `publishDraft` 가 내부에서 `this.update(id, input)` 을 호출한다. 그대로 두면 발행 1회에 `CAMPAIGN_UPDATE` + `CAMPAIGN_DRAFT_PUBLISH` 2행이 남는다. 실제 DB 반영 로직을 `applyCampaignUpdate` 로 빼고, 기록은 `update` 와 `publishDraft` 가 각자 자기 액션으로 1행씩 남긴다.

`Campaign` 모델에 actor 컬럼은 **추가하지 않는다** (설계 문서 §4).

- [ ] **Step 1: AuditService 주입**

`apps/api/src/campaigns/campaigns.service.ts` import 블록에 추가:

```ts
import { AuditService } from "../audit/audit.service";
import type { AuditActor } from "../audit/audit.service";
```

생성자(507~510행)를 다음으로:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
  ) {}
```

- [ ] **Step 2: `create` 계측**

시그니처를 다음으로:

```ts
  async create(
    input: CreateCampaignRequest,
    actor: AuditActor,
  ): Promise<CampaignResponse> {
```

`const row = await this.prisma.campaign.create({...})` 직후, `return` 앞에 삽입:

```ts
    await this.audit.record({
      action: "CAMPAIGN_CREATE",
      actor,
      campaignId: row.id,
      metadata: { title: row.title, category: row.category },
    });
```

- [ ] **Step 3: `update` 를 `applyCampaignUpdate` + 기록으로 분리**

현재 `async update(id, input)` 의 **선언부만** `private async applyCampaignUpdate` 로 바꾸고 반환을 `changedFields` 로 바꾼 뒤, 그 위에 공개 `update` 를 새로 둔다.

`applyCampaignUpdate` 로 바꿀 부분: 기존 `update` 의 시그니처를 다음으로 교체하고,

```ts
  /**
   * 캠페인 필드 반영. 감사 로그를 남기지 않는다 — 발행(publishDraft)도 이 경로를
   * 재사용하는데, 그때 남길 액션은 CAMPAIGN_UPDATE 가 아니라 DRAFT_PUBLISH 다.
   */
  private async applyCampaignUpdate(
    id: string,
    input: UpdateCampaignRequest,
  ): Promise<{ response: CampaignResponse; changedFields: string[] }> {
```

본문 마지막의 다음 반환문을

```ts
    return this.withResolved(
      toResponse(row, await this.countsFor(id)),
    );
```

다음으로 바꾼다 (`data` 는 이 메서드가 위에서 조립한 지역 변수다):

```ts
    return {
      response: await this.withResolved(
        toResponse(row, await this.countsFor(id)),
      ),
      changedFields: Object.keys(data),
    };
```

주: `data` 는 이 메서드가 조립하는 `Record<string, unknown>` 이다. 그 키가 곧 "실제로 바뀐 필드" 다. 전체 before/after 스냅샷은 크기·민감정보 위험 대비 효용이 낮아 필드명만 남긴다 (설계 문서 §4).

그 다음, `applyCampaignUpdate` **바로 위**에 공개 `update` 를 추가:

```ts
  async update(
    id: string,
    input: UpdateCampaignRequest,
    actor: AuditActor,
  ): Promise<CampaignResponse> {
    const { response, changedFields } = await this.applyCampaignUpdate(id, input);
    await this.audit.record({
      action: "CAMPAIGN_UPDATE",
      actor,
      campaignId: id,
      metadata: { changedFields },
    });
    return response;
  }
```

- [ ] **Step 4: `createDraft` / `updateDraft` / `publishDraft` 계측**

`createDraft` 시그니처:

```ts
  async createDraft(
    input: CampaignDraftRequest,
    actor: AuditActor,
  ): Promise<CampaignResponse> {
```

`const row = await this.prisma.campaign.create({...})` 직후, `return` 앞에:

```ts
    await this.audit.record({
      action: "CAMPAIGN_DRAFT_CREATE",
      actor,
      campaignId: row.id,
      metadata: { title: row.title },
    });
```

`updateDraft` 시그니처:

```ts
  async updateDraft(
    id: string,
    input: CampaignDraftRequest,
    actor: AuditActor,
  ): Promise<CampaignResponse> {
```

`$transaction` 직후, `return` 앞에:

```ts
    await this.audit.record({
      action: "CAMPAIGN_DRAFT_UPDATE",
      actor,
      campaignId: id,
    });
```

`publishDraft` 전체를 다음으로 교체:

```ts
  async publishDraft(
    id: string,
    input: CreateCampaignRequest,
    actor: AuditActor,
  ): Promise<CampaignResponse> {
    await this.assertDraft(id);
    // CAMPAIGN_UPDATE 로그를 남기지 않는 내부 경로 — 발행은 DRAFT_PUBLISH 1행이다.
    await this.applyCampaignUpdate(id, input);
    const row = await this.prisma.campaign.update({
      where: { id },
      data: { publishState: "PUBLISHED" },
      include: RECRUITS_INCLUDE,
    });
    await this.audit.record({
      action: "CAMPAIGN_DRAFT_PUBLISH",
      actor,
      campaignId: id,
      metadata: { title: row.title, category: row.category },
    });
    return this.withResolved(toResponse(row, EMPTY_COUNTS));
  }
```

- [ ] **Step 5: `close` / `hide` / `unhide` / `remove` 계측**

`close` 시그니처를 `async close(id: string, actor: AuditActor): Promise<CampaignResponse> {` 로. `const row = await this.prisma.campaign.update({...})` 직후, `return` 앞에:

```ts
    await this.audit.record({
      action: "CAMPAIGN_CLOSE",
      actor,
      campaignId: id,
    });
```

`hide` 시그니처를 `async hide(id: string, actor: AuditActor): Promise<CampaignResponse> {` 로. 마지막 줄을 다음으로:

```ts
    const response = await this.setHiddenAt(id, new Date());
    await this.audit.record({
      action: "CAMPAIGN_HIDE",
      actor,
      campaignId: id,
    });
    return response;
```

`unhide` 시그니처를 `async unhide(id: string, actor: AuditActor): Promise<CampaignResponse> {` 로. 마지막 줄을 다음으로:

```ts
    const response = await this.setHiddenAt(id, null);
    await this.audit.record({
      action: "CAMPAIGN_UNHIDE",
      actor,
      campaignId: id,
    });
    return response;
```

`remove` 전체를 다음으로 교체 (물리 삭제 경로도 기록해야 하므로 두 분기 모두):

```ts
  async remove(id: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      select: { publishState: true, closedAt: true },
    });
    if (!existing) throw new NotFoundException("Campaign not found");
    if (existing.publishState === "DRAFT") {
      await this.prisma.campaign.delete({ where: { id } });
      // 임시저장은 물리 삭제라 row 가 사라진다 — 로그가 유일한 흔적이다.
      await this.audit.record({
        action: "CAMPAIGN_DELETE",
        actor,
        campaignId: id,
        metadata: { publishState: "DRAFT", hardDeleted: true },
      });
      return;
    }
    const now = new Date();
    await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: now, closedAt: existing.closedAt ?? now },
    });
    await this.audit.record({
      action: "CAMPAIGN_DELETE",
      actor,
      campaignId: id,
      metadata: { publishState: "PUBLISHED", hardDeleted: false },
    });
  }
```

- [ ] **Step 6: `campaigns.controller.ts` 전면 수정**

`@nestjs/common` import 에 `Req` 를 추가하고, `AuthenticatedUser` 타입 import 를 추가한다:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
```

`import { CampaignsService } from "./campaigns.service";` 위에:

```ts
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
```

mutation 핸들러 6개를 교체:

```ts
  @Post()
  create(
    @Req() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CreateCampaignRequestSchema))
    body: CreateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.create(body, req.user);
  }
```

```ts
  @Patch(":id")
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateCampaignRequestSchema))
    body: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.update(id, body, req.user);
  }

  @Post(":id/close")
  close(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.close(id, req.user);
  }

  /** 비공개 전환 — 모집이 종결된 캠페인만 가능하다. */
  @Post(":id/hide")
  hide(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.hide(id, req.user);
  }

  @Post(":id/unhide")
  unhide(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<CampaignResponse> {
    return this.campaigns.unhide(id, req.user);
  }

  /** 임시저장은 물리 삭제, 발행된 캠페인은 종료와 함께 논리 삭제. */
  @Delete(":id")
  remove(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<void> {
    return this.campaigns.remove(id, req.user);
  }
```

`list` / `findOne` (조회) 는 그대로 둔다.

- [ ] **Step 7: `campaign-drafts.controller.ts` 수정**

`@nestjs/common` import 에 `Req` 추가, `AuthenticatedUser` 타입 import 추가 (Step 6 과 동일 경로). 핸들러 3개를 교체:

```ts
  @Post()
  create(
    @Req() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CampaignDraftRequestSchema))
    body: CampaignDraftRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.createDraft(body, req.user);
  }

  @Patch(":id")
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CampaignDraftRequestSchema))
    body: CampaignDraftRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.updateDraft(id, body, req.user);
  }

  @Post(":id/publish")
  publish(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateCampaignRequestSchema))
    body: CreateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.publishDraft(id, body, req.user);
  }
```

- [ ] **Step 8: `campaign-drafts.spec.ts` 수정**

`makeService` 의 반환문을 다음으로 (75행 인근 `return new CampaignsService(prisma, uploads);`):

```ts
  const audit = {
    record: jest.fn(),
    recordMany: jest.fn(),
  } as never;
  return new CampaignsService(prisma, uploads, audit);
```

`prisma` mock 에 `adminActivityLog` delegate 는 필요 없다 — `audit` 를 통째로 목킹하므로 prisma 를 거치지 않는다.

호출부 8곳에 actor 인자를 추가한다. 테스트용 액터를 파일 상단(`type CampaignFindArgs` 선언 위)에 둔다:

```ts
const TEST_ACTOR = { id: "admin-1", name: "테스트 어드민" };
```

그리고 각 호출을 다음처럼 바꾼다:

| 현재 | 변경 후 |
|---|---|
| `service.createDraft({ title: "작성 중인 캠페인" })` | `service.createDraft({ title: "작성 중인 캠페인" }, TEST_ACTOR)` |
| `service.createDraft({ title: "작성 중", recruits: [...] })` | 두 번째 인자로 `TEST_ACTOR` 추가 |
| `service.updateDraft("c1", { title: "x" })` | `service.updateDraft("c1", { title: "x" }, TEST_ACTOR)` |
| `service.close("c1")` | `service.close("c1", TEST_ACTOR)` |
| `service.hide("c1")` (2곳) | `service.hide("c1", TEST_ACTOR)` |
| `service.remove("c1")` (2곳) | `service.remove("c1", TEST_ACTOR)` |

- [ ] **Step 9: 캠페인 spec 실행**

Run: `pnpm --filter @jsure/api test -- src/campaigns`
Expected: PASS (`campaigns.service.spec.ts` 는 순수 헬퍼만 테스트하므로 무변경으로 통과해야 한다)

- [ ] **Step 10: 타입체크**

Run: `pnpm typecheck`
Expected: PASS. admin-web 은 요청 body 가 불변이라 수정 없이 통과해야 한다 — 실패하면 컨트롤러 계약이 바뀐 것이므로 되돌린다.

- [ ] **Step 11: 커밋**

```bash
git add apps/api/src/campaigns
git commit -m "feat(api): 캠페인·드래프트 액션 감사 로그 계측

전면 사각지대였던 캠페인 생성/수정/종료/숨김/삭제·드래프트를 계측한다.
발행이 update 를 재사용하며 로그 2행을 남기지 않도록 반영 로직을
applyCampaignUpdate 로 분리했다. CAMPAIGN_UPDATE metadata 는 변경된
필드명 목록만 남긴다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 계측 — 인플루언서 (`influencers`)

**Files:**
- Modify: `apps/api/src/influencers/influencers.service.ts`
- Modify: `apps/api/src/influencers/influencers.controller.ts`

**Interfaces:**
- Consumes: `AuditService`, `AuditActor` (Task 3)
- Produces:
  - `createMemo(influencerId: string, actor: AuditActor, comment: string, campaignId: string | null)`
  - `setFlagged(influencerId: string, actor: AuditActor)`
  - `clearFlagged(influencerId: string, actor: AuditActor)`

메모 로그에 `comment` 본문은 넣지 않는다 — 원본은 `InfluencerMemo` 다. `{ memoId, campaignId }` 참조만 (설계 문서 §4).

- [ ] **Step 1: AuditService 주입**

`apps/api/src/influencers/influencers.service.ts` import 블록에 추가:

```ts
import { AuditService } from "../audit/audit.service";
import type { AuditActor } from "../audit/audit.service";
```

73행의 생성자를 다음으로:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
```

- [ ] **Step 2: `createMemo` 계측**

시그니처를 다음으로:

```ts
  async createMemo(
    influencerId: string,
    actor: AuditActor,
    comment: string,
    campaignId: string | null,
  ): Promise<InfluencerMemoEntry> {
```

본문의 `createdById: creatorId,` → `createdById: actor.id,`.

`const creator = await this.prisma.adminUser.findUnique({...})` 블록을 삭제하고, 그 자리에 다음을 넣는다 (액터 이름은 이미 `actor` 에 있으므로 추가 조회가 불필요하다):

```ts
    // 메모 본문은 InfluencerMemo 가 원본 — 로그에는 참조만 남긴다.
    await this.audit.record({
      action: "INFLUENCER_MEMO_CREATE",
      actor,
      influencerId,
      campaignId: created.campaign?.id ?? undefined,
      metadata: { memoId: created.id },
    });
```

이어지는 return 문의 `createdBy` 를 다음으로 바꾼다:

```ts
      createdBy: { id: actor.id, name: actor.name },
```

- [ ] **Step 3: `setFlagged` 계측**

시그니처를 다음으로:

```ts
  async setFlagged(
    influencerId: string,
    actor: AuditActor,
  ): Promise<{ flaggedAt: string }> {
```

`data: { flaggedAt: new Date(), flaggedById: actorId },` → `data: { flaggedAt: new Date(), flaggedById: actor.id },`.

`return` 앞에 삽입:

```ts
    await this.audit.record({
      action: "INFLUENCER_FLAG_SET",
      actor,
      influencerId,
    });
```

- [ ] **Step 4: `clearFlagged` 계측 — 이전 설정자 보존**

메서드 전체를 다음으로 교체:

```ts
  async clearFlagged(influencerId: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { flaggedById: true },
    });
    if (!existing) throw new NotFoundException("Influencer not found");
    await this.prisma.influencer.update({
      where: { id: influencerId },
      data: { flaggedAt: null, flaggedById: null },
    });
    // 해제는 flaggedById 를 소거하므로 이전 설정자를 로그에 보존한다.
    await this.audit.record({
      action: "INFLUENCER_FLAG_CLEAR",
      actor,
      influencerId,
      metadata: { previousFlaggedById: existing.flaggedById },
    });
  }
```

`NotFoundException` 이 이 파일에 이미 import 돼 있는지 확인한다 (`createMemo` 가 쓰고 있으므로 있을 것). 없으면 `@nestjs/common` import 에 추가한다.

- [ ] **Step 5: 컨트롤러 수정**

`apps/api/src/influencers/influencers.controller.ts` 의 핸들러 3개를 교체:

```ts
  @Post(":id/memos")
  @HttpCode(201)
  createMemo(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateInfluencerMemoRequestSchema))
    body: CreateInfluencerMemoRequest,
  ): Promise<InfluencerMemoEntry> {
    return this.svc.createMemo(
      id,
      req.user,
      body.comment.trim(),
      body.campaignId ?? null,
    );
  }

  @Post(":id/flag")
  @HttpCode(200)
  flag(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<{ flaggedAt: string }> {
    return this.svc.setFlagged(id, req.user);
  }

  @Delete(":id/flag")
  @HttpCode(204)
  async unflag(
    @Req() req: { user: AuthenticatedUser },
    @Param("id") id: string,
  ): Promise<void> {
    await this.svc.clearFlagged(id, req.user);
  }
```

- [ ] **Step 6: 타입체크**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add apps/api/src/influencers
git commit -m "feat(api): 인플루언서 메모·플래그 액션 감사 로그 계측

플래그 해제는 소거되는 flaggedById 를 metadata 로 보존한다. 메모 생성 시
액터 이름을 AdminUser 재조회 없이 req.user 에서 쓴다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 조회 API — 응모건 타임라인

**Files:**
- Create: `apps/api/src/audit/application-activity.ts`
- Test: `apps/api/src/audit/application-activity.spec.ts`
- Modify: `apps/api/src/admin-applications/admin-applications.service.ts`
- Modify: `apps/api/src/admin-applications/admin-applications.controller.ts`

**Interfaces:**
- Consumes: Task 2 의 `AdminActivityLog`/`ApplicationActivityResponse`, Task 1 의 테이블
- Produces:
  - `toActivityLog(row: ActivityLogRow): AdminActivityLog` (순수 함수)
  - `AdminApplicationsService.listActivity(applicationId: string): Promise<AdminActivityLog[]>`
  - `GET /api/campaign-applications/:id/activity` → `ApplicationActivityResponse`

- [ ] **Step 1: 매핑 함수의 실패하는 테스트 작성**

`apps/api/src/audit/application-activity.spec.ts`:

```ts
import { toActivityLog } from "./application-activity";

describe("toActivityLog", () => {
  it("actorId 가 있으면 actor 를 스냅샷 이름과 함께 만든다", () => {
    const result = toActivityLog({
      id: "log-1",
      action: "APPLICATION_APPROVE",
      origin: "ADMIN",
      actorId: "admin-1",
      actorName: "오피디",
      metadata: null,
      createdAt: new Date("2026-08-10T01:02:03.000Z"),
    });

    expect(result).toEqual({
      id: "log-1",
      action: "APPLICATION_APPROVE",
      origin: "ADMIN",
      actor: { id: "admin-1", name: "오피디" },
      metadata: null,
      createdAt: "2026-08-10T01:02:03.000Z",
    });
  });

  it("actorId 가 없으면 actor 는 null", () => {
    const result = toActivityLog({
      id: "log-2",
      action: "SETTLEMENT_AUTO_COMPLETE",
      origin: "SYSTEM",
      actorId: null,
      actorName: null,
      metadata: { triggeredBy: "INSIGHT_SUBMITTED" },
      createdAt: new Date("2026-08-10T01:02:03.000Z"),
    });

    expect(result.actor).toBeNull();
    expect(result.metadata).toEqual({ triggeredBy: "INSIGHT_SUBMITTED" });
  });

  it("객체가 아닌 metadata(JSON 스칼라/배열)는 null 로 떨군다", () => {
    expect(
      toActivityLog({
        id: "log-3",
        action: "APPLICATION_DELIVER",
        origin: "ADMIN",
        actorId: "admin-1",
        actorName: null,
        metadata: [1, 2],
        createdAt: new Date("2026-08-10T01:02:03.000Z"),
      }).metadata,
    ).toBeNull();
  });

  it("등록되지 않은 action 문자열은 파싱 실패로 걸러낸다", () => {
    expect(() =>
      toActivityLog({
        id: "log-4",
        action: "UNKNOWN_LEGACY_ACTION",
        origin: "ADMIN",
        actorId: null,
        actorName: null,
        metadata: null,
        createdAt: new Date("2026-08-10T01:02:03.000Z"),
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/api test -- src/audit/application-activity.spec.ts`
Expected: FAIL — `Cannot find module './application-activity'`

- [ ] **Step 3: 매핑 함수 작성**

`apps/api/src/audit/application-activity.ts`:

```ts
import {
  AdminActivityActionSchema,
  AdminActivityOriginSchema,
  type AdminActivityLog,
} from "@jsure/shared";

/** Prisma 가 돌려주는 로그 row 중 응답에 쓰는 필드만. */
export type ActivityLogRow = {
  id: string;
  action: string;
  origin: string;
  actorId: string | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: Date;
};

function toMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  if (Array.isArray(value)) return null;
  return { ...value };
}

/**
 * 로그 row → 응답 모양. action/origin 은 String 컬럼이므로 여기서 zod 로
 * 파싱해 유니온 타입을 확정한다 — 코드에서 액션을 제거하면 옛 row 를 읽을 때
 * 여기서 터지므로, 액션은 지우지 않고 라벨만 정리하는 것이 원칙이다.
 */
export function toActivityLog(row: ActivityLogRow): AdminActivityLog {
  return {
    id: row.id,
    action: AdminActivityActionSchema.parse(row.action),
    origin: AdminActivityOriginSchema.parse(row.origin),
    actor: row.actorId ? { id: row.actorId, name: row.actorName } : null,
    metadata: toMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/api test -- src/audit/application-activity.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 서비스에 `listActivity` 추가**

`apps/api/src/admin-applications/admin-applications.service.ts`:

import 블록에 추가:

```ts
import { toActivityLog } from "../audit/application-activity";
```

`@jsure/shared` type import 목록에 `type AdminActivityLog` 를 추가한다.

`getSubmission` 메서드 **바로 뒤**(`private async fetchSubmission` 앞)에 삽입:

```ts
  /**
   * 응모건 감사 로그 타임라인. (applicationId, createdAt) 인덱스 range scan 이라
   * 테이블 총량과 무관하다. 응모당 수십 건 수준이라 페이지네이션 없이 전량 반환.
   */
  async listActivity(applicationId: string): Promise<AdminActivityLog[]> {
    const existing = await this.prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("응모를 찾을 수 없습니다");
    const rows = await this.prisma.adminActivityLog.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        origin: true,
        actorId: true,
        actorName: true,
        metadata: true,
        createdAt: true,
      },
    });
    return rows.map(toActivityLog);
  }
```

- [ ] **Step 6: 컨트롤러 엔드포인트 추가**

`apps/api/src/admin-applications/admin-applications.controller.ts`:

`@jsure/shared` type import 목록에 `type ApplicationActivityResponse` 를 추가한다.

`@Get(":id/submission")` 핸들러 **바로 뒤**에 삽입:

```ts
  @Get(":id/activity")
  async activity(
    @Param("id") id: string,
  ): Promise<ApplicationActivityResponse> {
    const items = await this.svc.listActivity(id);
    return { items };
  }
```

- [ ] **Step 7: 전체 api 테스트 + 타입체크**

Run: `pnpm --filter @jsure/api test`
Expected: PASS (전부)

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/audit/application-activity.ts apps/api/src/audit/application-activity.spec.ts apps/api/src/admin-applications
git commit -m "feat(api): 응모건 감사 로그 타임라인 조회 API

GET /api/campaign-applications/:id/activity. actor.name 은 actorName
스냅샷을 그대로 쓰고 AdminUser 를 조인하지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: admin-web 타임라인 UI

**Files:**
- Create: `apps/admin-web/src/domains/application/activityApi.ts`
- Create: `apps/admin-web/src/domains/application/components/applicants/activityLabels.ts`
- Create: `apps/admin-web/src/domains/application/components/applicants/useApplicationActivity.ts`
- Create: `apps/admin-web/src/domains/application/components/applicants/ActivityTimeline.tsx`
- Create: `apps/admin-web/src/domains/application/components/applicants/ActivityTimeline.module.css`
- Modify: `apps/admin-web/src/domains/application/index.ts`
- Modify: `apps/admin-web/src/pages/Applicants/ApplicantDetailDialog.tsx`

**Interfaces:**
- Consumes: Task 8 의 `GET /campaign-applications/:id/activity`, Task 2 의 `ApplicationActivityResponseSchema`
- Produces:
  - `fetchApplicationActivity(applicationId: string): Promise<AdminActivityLog[]>`
  - `ACTIVITY_ACTION_LABEL: Record<AdminActivityAction, string>`
  - `useApplicationActivity(applicationId: string): { state: ActivityState }`
  - `<ActivityTimeline state={...} />`

CODE_RULES §7 대로 fetch hook / presentational / 순수 라벨 상수를 분리한다. admin-web 은 i18n 대상이 아니므로(`client-web` 전용 규칙) 한국어 리터럴을 그대로 쓴다. `// new` 주석은 붙이지 않는다.

- [ ] **Step 1: fetch 함수 작성**

`apps/admin-web/src/domains/application/activityApi.ts`:

```ts
import {
  ApplicationActivityResponseSchema,
  type AdminActivityLog,
} from "@jsure/shared";
import { api } from "@/lib/api";

export async function fetchApplicationActivity(
  applicationId: string,
): Promise<AdminActivityLog[]> {
  const res = await api.get(
    `/campaign-applications/${encodeURIComponent(applicationId)}/activity`,
  );
  return ApplicationActivityResponseSchema.parse(res.data).items;
}
```

- [ ] **Step 2: 액션 라벨 상수 작성**

`apps/admin-web/src/domains/application/components/applicants/activityLabels.ts`:

```ts
import type { AdminActivityAction, AdminActivityOrigin } from "@jsure/shared";

/**
 * 전체 키가 필수인 Record — 액션을 추가하면 여기 라벨 누락을 typecheck 가 잡는다.
 */
export const ACTIVITY_ACTION_LABEL: Record<AdminActivityAction, string> = {
  APPLICATION_APPROVE: "응모 승인",
  APPLICATION_REJECT: "응모 거절",
  APPLICATION_REVIEW_UNDO: "응모 검토 취소",
  APPLICATION_SHIP: "발송 처리",
  APPLICATION_DELIVER: "배송 완료",
  SUBMISSION_APPROVE: "제출물 승인",
  SUBMISSION_REJECT: "제출물 반려",
  SUBMISSION_REVIEW_UNDO: "제출물 검토 취소",
  SETTLEMENT_CREATE: "정산 생성",
  SETTLEMENT_REGISTER: "정산 등록",
  SETTLEMENT_COMPLETE: "정산 완료",
  SETTLEMENT_AUTO_COMPLETE: "정산 자동 완료",
  CAMPAIGN_CREATE: "캠페인 생성",
  CAMPAIGN_UPDATE: "캠페인 수정",
  CAMPAIGN_CLOSE: "캠페인 종료",
  CAMPAIGN_HIDE: "캠페인 비공개",
  CAMPAIGN_UNHIDE: "캠페인 공개",
  CAMPAIGN_DELETE: "캠페인 삭제",
  CAMPAIGN_DRAFT_CREATE: "임시저장 생성",
  CAMPAIGN_DRAFT_UPDATE: "임시저장 수정",
  CAMPAIGN_DRAFT_PUBLISH: "임시저장 발행",
  INFLUENCER_MEMO_CREATE: "인플루언서 메모 작성",
  INFLUENCER_FLAG_SET: "인플루언서 플래그 설정",
  INFLUENCER_FLAG_CLEAR: "인플루언서 플래그 해제",
};

/** ADMIN 은 기본값이라 배지를 달지 않는다. */
export const ACTIVITY_ORIGIN_BADGE: Record<AdminActivityOrigin, string | null> =
  {
    ADMIN: null,
    CASCADE: "연쇄",
    SYSTEM: "시스템",
  };
```

- [ ] **Step 3: fetch hook 작성**

`apps/admin-web/src/domains/application/components/applicants/useApplicationActivity.ts`:

```ts
import { useEffect, useState } from "react";
import type { AdminActivityLog } from "@jsure/shared";
import { fetchApplicationActivity } from "../../activityApi";

export type ActivityState =
  | { kind: "loading" }
  | { kind: "ready"; items: AdminActivityLog[] }
  | { kind: "error"; message: string };

export function useApplicationActivity(applicationId: string): {
  state: ActivityState;
} {
  const [state, setState] = useState<ActivityState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchApplicationActivity(applicationId)
      .then((items) => {
        if (!cancelled) setState({ kind: "ready", items });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "작업 이력을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return { state };
}
```

- [ ] **Step 4: presentational 컴포넌트 작성**

`apps/admin-web/src/domains/application/components/applicants/ActivityTimeline.tsx`:

```tsx
import type { AdminActivityLog } from "@jsure/shared";
import {
  ACTIVITY_ACTION_LABEL,
  ACTIVITY_ORIGIN_BADGE,
} from "./activityLabels";
import type { ActivityState } from "./useApplicationActivity";
import styles from "./ActivityTimeline.module.css";

type Props = {
  state: ActivityState;
};

export function ActivityTimeline({ state }: Props) {
  if (state.kind === "loading") {
    return <div className={styles.empty}>불러오는 중…</div>;
  }
  if (state.kind === "error") {
    return <div className={styles.empty}>{state.message}</div>;
  }
  if (state.items.length === 0) {
    return <div className={styles.empty}>기록된 작업 이력이 없습니다.</div>;
  }
  return (
    <ol className={styles.list}>
      {state.items.map((entry) => (
        <li key={entry.id} className={styles.item}>
          <div className={styles.head}>
            <span className={styles.action}>
              {ACTIVITY_ACTION_LABEL[entry.action]}
            </span>
            <OriginBadge log={entry} />
            <span className={styles.at}>{formatJst(entry.createdAt)}</span>
          </div>
          <div className={styles.actor}>{actorLabel(entry)}</div>
          <MetadataLine log={entry} />
        </li>
      ))}
    </ol>
  );
}

function OriginBadge({ log }: { log: AdminActivityLog }) {
  const badge = ACTIVITY_ORIGIN_BADGE[log.origin];
  if (!badge) return null;
  return <span className={styles.badge}>{badge}</span>;
}

function MetadataLine({ log }: { log: AdminActivityLog }) {
  const summary = metadataSummary(log.metadata);
  if (!summary) return null;
  return <div className={styles.meta}>{summary}</div>;
}

function actorLabel(log: AdminActivityLog): string {
  if (!log.actor) return "시스템";
  return log.actor.name ?? log.actor.id;
}

/** 사람이 읽을 값만 골라 한 줄로. 객체/중첩은 표시하지 않는다. */
function metadataSummary(
  metadata: Record<string, unknown> | null,
): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    const rendered = renderMetadataValue(value);
    if (rendered !== null) parts.push(`${key}: ${rendered}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function renderMetadataValue(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (Array.isArray(value)) {
    const items = value.filter((item) => typeof item === "string");
    return items.length > 0 ? items.join(", ") : null;
  }
  return null;
}

function formatJst(isoString: string): string {
  return new Date(isoString).toLocaleString("ko-KR", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

- [ ] **Step 5: CSS module 작성**

`apps/admin-web/src/domains/application/components/applicants/ActivityTimeline.module.css`:

```css
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  border-left: 2px solid #e5e7eb;
  padding: 0 0 0 12px;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
}

.at {
  font-size: 12px;
  color: #9ca3af;
  margin-left: auto;
}

.actor {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.meta {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
  word-break: break-all;
}

.empty {
  font-size: 13px;
  color: #9ca3af;
  padding: 8px 0;
}
```

- [ ] **Step 6: domain index export 추가**

`apps/admin-web/src/domains/application/index.ts`:

`export * from "./exportApi";` 다음 줄에:

```ts
export * from "./activityApi";
```

`export { ApplicantUndoDialog } from "./components/applicants/ApplicantUndoDialog";` 다음에:

```ts
export { ActivityTimeline } from "./components/applicants/ActivityTimeline";
export {
  ACTIVITY_ACTION_LABEL,
  ACTIVITY_ORIGIN_BADGE,
} from "./components/applicants/activityLabels";
export { useApplicationActivity } from "./components/applicants/useApplicationActivity";
export type { ActivityState } from "./components/applicants/useApplicationActivity";
```

- [ ] **Step 7: `ApplicantDetailDialog` 에 타임라인 섹션 추가**

`apps/admin-web/src/pages/Applicants/ApplicantDetailDialog.tsx`:

import 블록의 `@/domains/application` import 에 `ActivityTimeline`, `useApplicationActivity` 를 추가한다:

```tsx
import {
  ActivityTimeline,
  fetchApplicationAttachments,
  useApplicationActivity,
  type Applicant,
} from "@/domains/application";
```

컴포넌트 본문에서 `const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);` 다음 줄에:

```tsx
  const { state: activityState } = useApplicationActivity(applicant.id);
```

`isFakePurchase ? (...) : (...)` 블록 **닫는 `)}` 다음**, `</div>` 앞에 삽입 (카테고리와 무관하게 항상 보여준다):

```tsx
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>작업 이력</h3>
            <ActivityTimeline state={activityState} />
          </section>
```

- [ ] **Step 8: 타입체크 + 빌드**

Run: `pnpm typecheck`
Expected: PASS

Run: `pnpm --filter @jsure/admin-web build`
Expected: 빌드 성공 (CSS module 클래스 누락, import 경로 오류가 여기서 잡힌다)

- [ ] **Step 9: 커밋**

```bash
git add apps/admin-web/src/domains/application apps/admin-web/src/pages/Applicants/ApplicantDetailDialog.tsx
git commit -m "feat(admin-web): 응모 상세에 감사 로그 타임라인 추가

CODE_RULES 7절대로 fetch hook / presentational / 라벨 상수를 분리했다.
액션 라벨은 전체 키가 필수인 Record 라 액션 추가 시 누락을 typecheck 가
잡는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## 최종 검증

- [ ] `pnpm typecheck` — PASS
- [ ] `pnpm --filter @jsure/api test` — PASS
- [ ] `pnpm --filter @jsure/api lint` — PASS
- [ ] `pnpm --filter @jsure/admin-web build` — PASS
- [ ] `grep -rn "reviewerId\|completerId\|creatorId\|actorId:" apps/api/src/admin-applications apps/api/src/influencers` — 남은 옛 파라미터명 없음 확인
- [ ] 마이그레이션 SQL 을 눈으로 재확인 — `DROP`/`RENAME`/`ALTER` 가 한 줄도 없어야 한다 (CREATE 만)

## 배포

1. **api (Railway)** — 마이그레이션 포함. Task 1~8 배포 후 로그가 쌓이기 시작한다.
2. **admin-web (Vercel)** — Task 9. api 배포 후에 한다 (activity 엔드포인트 선행 필요).
3. `packages/shared` 변경이 있으므로 두 앱 모두 재빌드 대상이다.

각 태스크는 독립 배포 가능하다 — 로그가 부분적으로만 쌓여도 무해하고, API 계약(요청/응답 모양)이 바뀌는 곳은 Task 8 의 신규 엔드포인트뿐이다.

## 사이드이펙트

- 마이그레이션은 테이블·enum **추가만**. 기존 테이블 무변경 → 배포 순간 구버전 코드와 공존 가능.
- 컨트롤러 `@Req()` 추가는 클라이언트에 비가시적 — 요청 body 불변.
- `ensureSettlementForApplication` 반환 변경 → 호출부 2곳 + spec. `autoCompleted` 의미는 불변이라 캠페인 종료 메시지 발송 로직에 영향 없음.
- `settleSubmission` auto-complete 경로가 `completedById` 를 채우기 시작 → 기존 null 데이터와 혼재하나 조회 측이 nullable 전제라 무해.
- `createMemo` 가 `adminUser.findUnique` 재조회를 그만두고 `req.user` 를 쓴다 → 응답의 `createdBy.name` 값은 동일(같은 어드민의 현재 이름).
- 계측 누락은 컴파일 에러로 잡히지 않는다. **새 어드민 mutation 엔드포인트 추가 시 감사 로그 기록을 함께 넣는 것을 리뷰 체크 항목으로 삼는다.**
