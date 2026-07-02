# LINE Message Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LINE 메시지 발송을 어드민이 활성화/문구/변수를 편집할 수 있는 데이터 기반 시스템으로 이관한다. 15개 라이프사이클 트리거 전부 커버.

**Architecture:** 트리거별 발송을 단일 진입점 `LineDispatcherService.dispatch(triggerKey, context)` 로 통합. 템플릿은 DB(`LineMessageTemplate`)에 저장, 트리거별 허용 변수는 코드 상수(`TRIGGER_META`) 로 강제. 어드민 UI에서 문구·활성 여부를 편집. 발송 결과는 `LineDispatchLog`로 감사.

**Tech Stack:** NestJS + Prisma (Postgres) + Zod (shared 계약) + React (Vite) + Jest. pnpm 모노레포. `@jsure/shared` 스키마 계약.

**Spec:** `docs/superpowers/specs/2026-07-02-line-message-templates-design.md`

---

## 실행 규칙

- 커밋 메시지는 **한글**로 작성 (CLAUDE.md 규칙)
- 각 Task 종료 시 `pnpm typecheck` 통과 후 커밋
- 백엔드 로직은 Jest `*.spec.ts` 로 TDD
- 파일 편집 시 기존 관례(들여쓰기, 세미콜론, import 순서) 준수
- `git add -A` 금지 — 항상 파일 명시 add (CLAUDE.md 규칙)

---

## Task 1: Prisma 스키마 확장

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: `AdminUser` 모델에 `testLineUserId` 필드 추가**

`apps/api/prisma/schema.prisma`, `model AdminUser { ... }` 블록 (라인 11-25) 안 `updatedAt` 뒤에 추가:

```prisma
  testLineUserId String?
```

- [ ] **Step 2: 새 enum 4개를 파일 하단에 추가**

`schema.prisma` 파일 맨 끝에 추가:

```prisma
enum CampaignCategory {
  SNS
  FAKE_PURCHASE
}

enum LineTriggerKey {
  SNS_APPLICATION_APPLIED
  SNS_APPLICATION_APPROVED
  SNS_APPLICATION_REJECTED
  SNS_APPLICATION_SHIPPED
  SNS_APPLICATION_DELIVERED
  SNS_APPLICATION_RECEIPT_CONFIRMED
  SNS_POST_SUBMITTED
  SNS_POST_DEADLINE_REMINDER
  SNS_POST_APPROVED
  SNS_POST_REJECTED
  SNS_POST_REJECTION_REMINDER
  SNS_INSIGHT_SUBMITTED
  SNS_INSIGHT_REMINDER
  SNS_SETTLEMENT_COMPLETED
  SNS_CAMPAIGN_COMPLETED
}

enum LineTriggerSubType {
  INSTAGRAM
  X
}

enum LineDispatchStatus {
  SUCCESS
  FAILED
  SKIPPED_DISABLED
  SKIPPED_NO_TEMPLATE
}
```

- [ ] **Step 3: `LineMessageTemplate` 모델 추가**

`schema.prisma` 파일 맨 끝에 추가:

```prisma
model LineMessageTemplate {
  id          String              @id @default(cuid())
  category    CampaignCategory
  subType     LineTriggerSubType?
  triggerKey  LineTriggerKey
  enabled     Boolean             @default(false)
  body        String
  updatedAt   DateTime            @updatedAt
  updatedById String?

  dispatchLogs LineDispatchLog[]

  @@unique([category, subType, triggerKey])
  @@map("line_message_templates")
}
```

- [ ] **Step 4: `LineDispatchLog` 모델 추가**

`schema.prisma` 파일 맨 끝에 추가:

```prisma
model LineDispatchLog {
  id            String                 @id @default(cuid())
  category      CampaignCategory
  subType       LineTriggerSubType?
  triggerKey    LineTriggerKey
  templateId    String?
  template      LineMessageTemplate?   @relation(fields: [templateId], references: [id], onDelete: SetNull)
  applicationId String?
  application   CampaignApplication?   @relation(fields: [applicationId], references: [id], onDelete: SetNull)
  toLineUserId  String
  renderedBody  String
  status        LineDispatchStatus
  errorMessage  String?
  createdAt     DateTime               @default(now())

  @@index([applicationId, triggerKey])
  @@index([createdAt])
  @@map("line_dispatch_logs")
}
```

- [ ] **Step 5: `CampaignApplication`에 역참조 추가**

`schema.prisma`, `model CampaignApplication { ... }` 안 `posts SubmittedPost[]` 뒤에 다음 라인 추가:

```prisma
  lineDispatchLogs LineDispatchLog[]
```

- [ ] **Step 6: 마이그레이션 생성**

Run: `pnpm --filter @jsure/api exec prisma migrate dev --name add_line_message_templates`

Expected: `apps/api/prisma/migrations/<timestamp>_add_line_message_templates/migration.sql` 생성, DB 반영.

- [ ] **Step 7: 클라이언트 재생성 및 typecheck**

Run: `pnpm --filter @jsure/api exec prisma generate && pnpm typecheck`
Expected: 통과 (아직 새 모델 사용부 없으므로).

- [ ] **Step 8: 커밋**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(db): LINE 메시지 템플릿/로그 테이블 및 AdminUser.testLineUserId 추가"
```

---

## Task 2: Shared Zod 스키마 정의

**Files:**
- Create: `packages/shared/src/types/lineTemplate.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Zod 스키마 파일 생성**

Create `packages/shared/src/types/lineTemplate.ts`:

```ts
import { z } from "zod";

export const CampaignCategorySchema = z.enum(["SNS", "FAKE_PURCHASE"]);
export type CampaignCategory = z.infer<typeof CampaignCategorySchema>;

export const LineTriggerSubTypeSchema = z.enum(["INSTAGRAM", "X"]);
export type LineTriggerSubType = z.infer<typeof LineTriggerSubTypeSchema>;

export const LineTriggerKeySchema = z.enum([
  "SNS_APPLICATION_APPLIED",
  "SNS_APPLICATION_APPROVED",
  "SNS_APPLICATION_REJECTED",
  "SNS_APPLICATION_SHIPPED",
  "SNS_APPLICATION_DELIVERED",
  "SNS_APPLICATION_RECEIPT_CONFIRMED",
  "SNS_POST_SUBMITTED",
  "SNS_POST_DEADLINE_REMINDER",
  "SNS_POST_APPROVED",
  "SNS_POST_REJECTED",
  "SNS_POST_REJECTION_REMINDER",
  "SNS_INSIGHT_SUBMITTED",
  "SNS_INSIGHT_REMINDER",
  "SNS_SETTLEMENT_COMPLETED",
  "SNS_CAMPAIGN_COMPLETED",
]);
export type LineTriggerKey = z.infer<typeof LineTriggerKeySchema>;

export const TriggerVariableSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  sample: z.string(),
});
export type TriggerVariable = z.infer<typeof TriggerVariableSchema>;

export const LineMessageTemplateResponseSchema = z.object({
  category: CampaignCategorySchema,
  subType: LineTriggerSubTypeSchema.nullable(),
  triggerKey: LineTriggerKeySchema,
  enabled: z.boolean(),
  body: z.string(),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
  updatedById: z.string().nullable(),
});
export type LineMessageTemplateResponse = z.infer<typeof LineMessageTemplateResponseSchema>;

export const LineMessageTemplateListItemSchema = z.object({
  triggerKey: LineTriggerKeySchema,
  enabled: z.boolean(),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
});
export type LineMessageTemplateListItem = z.infer<typeof LineMessageTemplateListItemSchema>;

export const LineMessageTemplateListResponseSchema = z.object({
  category: CampaignCategorySchema,
  subType: LineTriggerSubTypeSchema.nullable(),
  items: z.array(LineMessageTemplateListItemSchema),
});
export type LineMessageTemplateListResponse = z.infer<typeof LineMessageTemplateListResponseSchema>;

export const LineMessageTemplateDetailResponseSchema = z.object({
  template: LineMessageTemplateResponseSchema,
  variables: z.array(TriggerVariableSchema),
});
export type LineMessageTemplateDetailResponse = z.infer<typeof LineMessageTemplateDetailResponseSchema>;

export const UpdateLineMessageTemplateRequestSchema = z.object({
  enabled: z.boolean(),
  body: z.string().max(5000),
});
export type UpdateLineMessageTemplateRequest = z.infer<typeof UpdateLineMessageTemplateRequestSchema>;

export const PreviewLineMessageTemplateRequestSchema = z.object({
  body: z.string().max(5000),
});
export type PreviewLineMessageTemplateRequest = z.infer<typeof PreviewLineMessageTemplateRequestSchema>;

export const PreviewLineMessageTemplateResponseSchema = z.object({
  renderedBody: z.string(),
});
export type PreviewLineMessageTemplateResponse = z.infer<typeof PreviewLineMessageTemplateResponseSchema>;

export const TestSendLineMessageTemplateRequestSchema = z.object({
  body: z.string().max(5000),
});
export type TestSendLineMessageTemplateRequest = z.infer<typeof TestSendLineMessageTemplateRequestSchema>;

export const TestSendLineMessageTemplateResponseSchema = z.object({
  sent: z.boolean(),
});
export type TestSendLineMessageTemplateResponse = z.infer<typeof TestSendLineMessageTemplateResponseSchema>;

export const UpdateAdminTestLineUserIdRequestSchema = z.object({
  testLineUserId: z.string().min(1).nullable(),
});
export type UpdateAdminTestLineUserIdRequest = z.infer<typeof UpdateAdminTestLineUserIdRequestSchema>;
```

- [ ] **Step 2: `packages/shared/src/index.ts`에 export 추가**

`packages/shared/src/index.ts`에 다음 라인을 다른 export 라인들과 함께 추가:

```ts
export * from "./types/lineTemplate.js";
```

- [ ] **Step 3: shared 빌드 및 typecheck**

Run: `pnpm --filter @jsure/shared build && pnpm typecheck`
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add packages/shared/src/types/lineTemplate.ts packages/shared/src/index.ts
git commit -m "feat(shared): LINE 메시지 템플릿 Zod 스키마 및 타입 정의"
```

---

## Task 3: TRIGGER_META 및 COMMON_VARS 정의

**Files:**
- Create: `apps/api/src/line-templates/trigger-meta.ts`

- [ ] **Step 1: DispatchContext 및 헬퍼 타입 정의 파일 생성**

Create `apps/api/src/line-templates/trigger-meta.ts`:

```ts
import type { CampaignCategory, LineTriggerKey, TriggerVariable } from "@jsure/shared";
import type {
  CampaignApplication,
  Campaign,
  Influencer,
  Settlement,
  SubmittedPost,
  SubmittedPostRejection,
} from "@prisma/client";

export type ApplicationWithRels = CampaignApplication & {
  campaign: Pick<Campaign, "id" | "title" | "postingPeriodDays">;
  influencer: Pick<Influencer, "id" | "name" | "lineUserId">;
};

export type DispatchContext = {
  application: ApplicationWithRels;
  post?: SubmittedPost | null;
  rejection?: SubmittedPostRejection | null;
  settlement?: Settlement | null;
  extra?: {
    resubmitDeadlineAt?: Date;
    finalDeadlineAt?: Date;
    remainingDays?: number;
  };
};

export type TriggerVariableWithResolver = TriggerVariable & {
  resolver: (ctx: DispatchContext) => string | null;
};

export type TriggerMetaEntry = {
  category: CampaignCategory;
  requiresSubType: boolean;
  variables: TriggerVariableWithResolver[];
};

function formatJstMonthDay(d: Date): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${month}月${day}日`;
}

function formatJpy(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(n);
}

const COMMON_VARS = {
  influencerName: {
    key: "influencerName",
    label: "Influencer Name",
    description: "Name of the influencer who applied",
    sample: "Hanako Yamada",
    resolver: (ctx) => ctx.application.influencer.name ?? "",
  },
  campaignTitle: {
    key: "campaignTitle",
    label: "Campaign Title",
    description: "Title of the campaign the influencer applied to",
    sample: "Summer Cosmetics PR Campaign",
    resolver: (ctx) => ctx.application.campaign.title,
  },
} satisfies Record<string, TriggerVariableWithResolver>;

const trackingCarrier: TriggerVariableWithResolver = {
  key: "trackingCarrier",
  label: "Shipping Carrier",
  description: "Carrier registered at shipment",
  sample: "Yamato Transport",
  resolver: (ctx) => ctx.application.trackingCarrier ?? "",
};

const trackingNumber: TriggerVariableWithResolver = {
  key: "trackingNumber",
  label: "Tracking Number",
  description: "Tracking number provided by the carrier",
  sample: "1234-5678-9012",
  resolver: (ctx) => ctx.application.trackingNumber ?? "",
};

const rejectReason: TriggerVariableWithResolver = {
  key: "rejectReason",
  label: "Reject Reason",
  description: "Latest reject comment from the reviewer",
  sample: "Please add the required hashtag",
  resolver: (ctx) => ctx.rejection?.comment ?? "",
};

const resubmitDeadline: TriggerVariableWithResolver = {
  key: "resubmitDeadline",
  label: "Resubmission Deadline",
  description: "Deadline for resubmitting the post (JST month/day)",
  sample: "7月20日",
  resolver: (ctx) =>
    ctx.extra?.resubmitDeadlineAt ? formatJstMonthDay(ctx.extra.resubmitDeadlineAt) : "",
};

const finalDeadline: TriggerVariableWithResolver = {
  key: "finalDeadline",
  label: "Final Deadline",
  description: "Absolute last deadline shown in the rejection reminder",
  sample: "7月21日",
  resolver: (ctx) =>
    ctx.extra?.finalDeadlineAt ? formatJstMonthDay(ctx.extra.finalDeadlineAt) : "",
};

const remainingDays: TriggerVariableWithResolver = {
  key: "remainingDays",
  label: "Remaining Days",
  description: "Days remaining until the posting deadline",
  sample: "3",
  resolver: (ctx) => (ctx.extra?.remainingDays != null ? String(ctx.extra.remainingDays) : ""),
};

const rewardJpy: TriggerVariableWithResolver = {
  key: "rewardJpy",
  label: "Reward Amount (JPY)",
  description: "Settlement amount in JPY with thousands separator",
  sample: "15,000",
  resolver: (ctx) => (ctx.settlement ? formatJpy(ctx.settlement.amountJpy) : ""),
};

export const TRIGGER_META: Record<LineTriggerKey, TriggerMetaEntry> = {
  SNS_APPLICATION_APPLIED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_APPLICATION_APPROVED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_APPLICATION_REJECTED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_APPLICATION_SHIPPED: {
    category: "SNS",
    requiresSubType: true,
    variables: [
      COMMON_VARS.influencerName,
      COMMON_VARS.campaignTitle,
      trackingCarrier,
      trackingNumber,
    ],
  },
  SNS_APPLICATION_DELIVERED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_APPLICATION_RECEIPT_CONFIRMED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_POST_SUBMITTED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_POST_DEADLINE_REMINDER: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle, remainingDays],
  },
  SNS_POST_APPROVED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_POST_REJECTED: {
    category: "SNS",
    requiresSubType: true,
    variables: [
      COMMON_VARS.influencerName,
      COMMON_VARS.campaignTitle,
      rejectReason,
      resubmitDeadline,
    ],
  },
  SNS_POST_REJECTION_REMINDER: {
    category: "SNS",
    requiresSubType: true,
    variables: [
      COMMON_VARS.influencerName,
      COMMON_VARS.campaignTitle,
      rejectReason,
      finalDeadline,
    ],
  },
  SNS_INSIGHT_SUBMITTED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_INSIGHT_REMINDER: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
  SNS_SETTLEMENT_COMPLETED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle, rewardJpy],
  },
  SNS_CAMPAIGN_COMPLETED: {
    category: "SNS",
    requiresSubType: true,
    variables: [COMMON_VARS.influencerName, COMMON_VARS.campaignTitle],
  },
};

export function getMeta(triggerKey: LineTriggerKey): TriggerMetaEntry {
  return TRIGGER_META[triggerKey];
}

export function listTriggersForCategory(category: CampaignCategory): LineTriggerKey[] {
  return (Object.keys(TRIGGER_META) as LineTriggerKey[]).filter(
    (k) => TRIGGER_META[k].category === category,
  );
}

export function publicVariables(triggerKey: LineTriggerKey): TriggerVariable[] {
  return TRIGGER_META[triggerKey].variables.map(({ resolver: _resolver, ...rest }) => rest);
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm --filter @jsure/api exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/line-templates/trigger-meta.ts
git commit -m "feat(api): 트리거 메타 상수 및 변수 리졸버 정의"
```

---

## Task 4: TemplateRenderer (TDD)

**Files:**
- Create: `apps/api/src/line-templates/template-renderer.ts`
- Create: `apps/api/src/line-templates/template-renderer.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `apps/api/src/line-templates/template-renderer.spec.ts`:

```ts
import {
  extractVariableKeys,
  renderTemplate,
  validateBodyVariables,
} from "./template-renderer";
import type { TriggerVariableWithResolver } from "./trigger-meta";

const vars: TriggerVariableWithResolver[] = [
  {
    key: "name",
    label: "Name",
    description: "d",
    sample: "SAMPLE_NAME",
    resolver: () => "Alice",
  },
  {
    key: "title",
    label: "Title",
    description: "d",
    sample: "SAMPLE_TITLE",
    resolver: () => null,
  },
];

describe("extractVariableKeys", () => {
  it("본문 내 모든 {{key}} 를 추출", () => {
    expect(extractVariableKeys("Hi {{name}}, welcome to {{title}}!")).toEqual([
      "name",
      "title",
    ]);
  });

  it("중복 키는 한번만", () => {
    expect(extractVariableKeys("{{a}} {{a}} {{b}}")).toEqual(["a", "b"]);
  });

  it("공백 있는 문법도 매칭", () => {
    expect(extractVariableKeys("{{ name }}")).toEqual(["name"]);
  });

  it("빈 본문", () => {
    expect(extractVariableKeys("")).toEqual([]);
  });
});

describe("validateBodyVariables", () => {
  it("본문의 모든 변수가 허용 목록에 있으면 ok", () => {
    expect(validateBodyVariables("Hi {{name}} and {{title}}", vars)).toEqual({
      ok: true,
    });
  });

  it("허용 목록에 없는 변수 발견 시 unknown 배열 반환", () => {
    expect(validateBodyVariables("Hi {{name}} {{foo}}", vars)).toEqual({
      ok: false,
      unknown: ["foo"],
    });
  });

  it("여러 미지정 변수 모두 리턴", () => {
    expect(validateBodyVariables("{{foo}} {{bar}}", vars)).toEqual({
      ok: false,
      unknown: ["foo", "bar"],
    });
  });
});

describe("renderTemplate", () => {
  const ctx = {} as never;

  it("resolver 로 치환", () => {
    expect(renderTemplate("Hi {{name}}", vars, ctx)).toBe("Hi Alice");
  });

  it("resolver 가 null 을 반환하면 빈 문자열", () => {
    expect(renderTemplate("Hi {{title}}", vars, ctx)).toBe("Hi ");
  });

  it("허용 목록에 없는 변수는 원문 유지", () => {
    expect(renderTemplate("Hi {{unknown}}", vars, ctx)).toBe("Hi {{unknown}}");
  });

  it("샘플 모드에서는 sample 값을 사용", () => {
    expect(renderTemplate("Hi {{name}} {{title}}", vars, ctx, { useSample: true })).toBe(
      "Hi SAMPLE_NAME SAMPLE_TITLE",
    );
  });

  it("빈 본문은 그대로", () => {
    expect(renderTemplate("", vars, ctx)).toBe("");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/api exec jest src/line-templates/template-renderer.spec.ts`
Expected: FAIL (파일 없음).

- [ ] **Step 3: 최소 구현 작성**

Create `apps/api/src/line-templates/template-renderer.ts`:

```ts
import type { DispatchContext, TriggerVariableWithResolver } from "./trigger-meta";

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

export function extractVariableKeys(body: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of body.matchAll(VAR_PATTERN)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export type ValidationResult = { ok: true } | { ok: false; unknown: string[] };

export function validateBodyVariables(
  body: string,
  variables: TriggerVariableWithResolver[],
): ValidationResult {
  const allowed = new Set(variables.map((v) => v.key));
  const unknown = extractVariableKeys(body).filter((k) => !allowed.has(k));
  return unknown.length === 0 ? { ok: true } : { ok: false, unknown };
}

export function renderTemplate(
  body: string,
  variables: TriggerVariableWithResolver[],
  context: DispatchContext,
  opts: { useSample?: boolean } = {},
): string {
  const byKey = new Map(variables.map((v) => [v.key, v]));
  return body.replace(VAR_PATTERN, (match, key: string) => {
    const variable = byKey.get(key);
    if (!variable) return match; // 미지정 변수 → 원문 유지
    if (opts.useSample) return variable.sample;
    const value = variable.resolver(context);
    return value ?? "";
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/api exec jest src/line-templates/template-renderer.spec.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/line-templates/template-renderer.ts apps/api/src/line-templates/template-renderer.spec.ts
git commit -m "feat(api): LINE 템플릿 렌더러 및 변수 검증 유틸"
```

---

## Task 5: LineDispatcherService (TDD)

**Files:**
- Create: `apps/api/src/line-templates/line-dispatcher.service.ts`
- Create: `apps/api/src/line-templates/line-dispatcher.service.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `apps/api/src/line-templates/line-dispatcher.service.spec.ts`:

```ts
import { LineDispatcherService } from "./line-dispatcher.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { LineMessagingService } from "../influencer-auth/line-messaging.service";

function makePrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    lineMessageTemplate: {
      findUnique: jest.fn(),
    },
    lineDispatchLog: {
      create: jest.fn().mockResolvedValue({ id: "log1" }),
    },
    ...overrides,
  } as unknown as PrismaService;
}

function makeLineMock(pushTextImpl: (id: string, text: string) => Promise<void> = jest.fn()) {
  return { pushText: pushTextImpl } as unknown as LineMessagingService;
}

const application = {
  id: "app1",
  influencerId: "inf1",
  snsType: "INSTAGRAM",
  trackingCarrier: null,
  trackingNumber: null,
  campaign: { id: "c1", title: "Test Campaign", postingPeriodDays: 14 },
  influencer: { id: "inf1", name: "Alice", lineUserId: "U123" },
} as never;

describe("LineDispatcherService", () => {
  it("템플릿이 없으면 SKIPPED_NO_TEMPLATE 로그 후 발송 안 함", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue(null);
    const push = jest.fn();
    const line = makeLineMock(push);

    const svc = new LineDispatcherService(prisma, line);
    await svc.dispatch("SNS_APPLICATION_APPLIED", { application });

    expect(push).not.toHaveBeenCalled();
    expect(prisma.lineDispatchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SKIPPED_NO_TEMPLATE" }),
      }),
    );
  });

  it("템플릿이 disabled 면 SKIPPED_DISABLED 로그 후 발송 안 함", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      enabled: false,
      body: "hi {{influencerName}}",
    });
    const push = jest.fn();
    const line = makeLineMock(push);

    const svc = new LineDispatcherService(prisma, line);
    await svc.dispatch("SNS_APPLICATION_APPLIED", { application });

    expect(push).not.toHaveBeenCalled();
    expect(prisma.lineDispatchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SKIPPED_DISABLED" }),
      }),
    );
  });

  it("enabled 면 렌더 후 pushText + SUCCESS 로그", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      enabled: true,
      body: "hi {{influencerName}} / {{campaignTitle}}",
    });
    const push = jest.fn().mockResolvedValue(undefined);
    const line = makeLineMock(push);

    const svc = new LineDispatcherService(prisma, line);
    await svc.dispatch("SNS_APPLICATION_APPLIED", { application });

    expect(push).toHaveBeenCalledWith("inf1", "hi Alice / Test Campaign");
    expect(prisma.lineDispatchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUCCESS",
          renderedBody: "hi Alice / Test Campaign",
          templateId: "t1",
        }),
      }),
    );
  });

  it("pushText 가 throw 하면 FAILED 로그 (예외 삼킴)", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      enabled: true,
      body: "hi",
    });
    const push = jest.fn().mockRejectedValue(new Error("boom"));
    const line = makeLineMock(push);

    const svc = new LineDispatcherService(prisma, line);
    await expect(svc.dispatch("SNS_APPLICATION_APPLIED", { application })).resolves.toBeUndefined();

    expect(prisma.lineDispatchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "boom",
        }),
      }),
    );
  });

  it("subType 은 application.snsType 에서 도출 (INSTAGRAM/X)", async () => {
    const prisma = makePrismaMock();
    (prisma.lineMessageTemplate.findUnique as jest.Mock).mockResolvedValue(null);
    const svc = new LineDispatcherService(prisma, makeLineMock());
    await svc.dispatch("SNS_APPLICATION_APPLIED", {
      application: { ...application, snsType: "X" },
    });
    expect(prisma.lineMessageTemplate.findUnique).toHaveBeenCalledWith({
      where: {
        category_subType_triggerKey: {
          category: "SNS",
          subType: "X",
          triggerKey: "SNS_APPLICATION_APPLIED",
        },
      },
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/api exec jest src/line-templates/line-dispatcher.service.spec.ts`
Expected: FAIL (파일 없음).

- [ ] **Step 3: 최소 구현 작성**

Create `apps/api/src/line-templates/line-dispatcher.service.ts`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import type { LineTriggerKey, LineTriggerSubType } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { getMeta, type DispatchContext } from "./trigger-meta";
import { renderTemplate } from "./template-renderer";

function snsTypeToSubType(snsType: string): LineTriggerSubType | null {
  if (snsType === "INSTAGRAM") return "INSTAGRAM";
  if (snsType === "X") return "X";
  return null;
}

@Injectable()
export class LineDispatcherService {
  private readonly logger = new Logger(LineDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
  ) {}

  async dispatch(triggerKey: LineTriggerKey, context: DispatchContext): Promise<void> {
    const meta = getMeta(triggerKey);
    const subType = meta.requiresSubType ? snsTypeToSubType(context.application.snsType) : null;
    const category = meta.category;
    const toLineUserId = context.application.influencer.lineUserId ?? "";
    const applicationId = context.application.id;

    const template = await this.prisma.lineMessageTemplate.findUnique({
      where: {
        category_subType_triggerKey: {
          category,
          subType,
          triggerKey,
        },
      },
    });

    if (!template) {
      await this.logDispatch({
        category,
        subType,
        triggerKey,
        templateId: null,
        applicationId,
        toLineUserId,
        renderedBody: "",
        status: "SKIPPED_NO_TEMPLATE",
      });
      return;
    }

    if (!template.enabled) {
      await this.logDispatch({
        category,
        subType,
        triggerKey,
        templateId: template.id,
        applicationId,
        toLineUserId,
        renderedBody: "",
        status: "SKIPPED_DISABLED",
      });
      return;
    }

    const renderedBody = renderTemplate(template.body, meta.variables, context);

    try {
      await this.line.pushText(context.application.influencerId, renderedBody);
      await this.logDispatch({
        category,
        subType,
        triggerKey,
        templateId: template.id,
        applicationId,
        toLineUserId,
        renderedBody,
        status: "SUCCESS",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Dispatch failed: ${triggerKey}`, err as Error);
      await this.logDispatch({
        category,
        subType,
        triggerKey,
        templateId: template.id,
        applicationId,
        toLineUserId,
        renderedBody,
        status: "FAILED",
        errorMessage,
      });
    }
  }

  private async logDispatch(data: {
    category: "SNS" | "FAKE_PURCHASE";
    subType: LineTriggerSubType | null;
    triggerKey: LineTriggerKey;
    templateId: string | null;
    applicationId: string | null;
    toLineUserId: string;
    renderedBody: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED_DISABLED" | "SKIPPED_NO_TEMPLATE";
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.prisma.lineDispatchLog.create({ data });
    } catch (err) {
      this.logger.error("Failed to write dispatch log", err as Error);
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/api exec jest src/line-templates/line-dispatcher.service.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/line-templates/line-dispatcher.service.ts apps/api/src/line-templates/line-dispatcher.service.spec.ts
git commit -m "feat(api): LineDispatcherService 진입점 구현 (템플릿 조회→렌더→발송→로그)"
```

---

## Task 6: 시드 스크립트 (현재 하드코딩 문구 이관)

**Files:**
- Create: `apps/api/prisma/seeds/line-templates.seed.ts`
- Modify: `apps/api/package.json` (script 추가)

- [ ] **Step 1: 시드 스크립트 생성**

기존 하드코딩 문구 소스는 다음과 같음:
- `apps/api/src/influencer-auth/line-messaging.service.ts:205-437` (notifyApplied, notifyApproved, notifyShippedWithPlainText, notifyDelivered, notifyPostRejected, notifyPostRejectionReminder, notifySettlementComplete)
- `apps/api/src/influencer-auth/line-reminders.service.ts:74-88` (POST_DEADLINE_REMINDER 문구), :162-179 (INSIGHT_REMINDER 문구)

각 문구의 하드코딩된 변수 부분을 `{{...}}`로 치환.

Create `apps/api/prisma/seeds/line-templates.seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedRow = {
  triggerKey:
    | "SNS_APPLICATION_APPLIED"
    | "SNS_APPLICATION_APPROVED"
    | "SNS_APPLICATION_REJECTED"
    | "SNS_APPLICATION_SHIPPED"
    | "SNS_APPLICATION_DELIVERED"
    | "SNS_APPLICATION_RECEIPT_CONFIRMED"
    | "SNS_POST_SUBMITTED"
    | "SNS_POST_DEADLINE_REMINDER"
    | "SNS_POST_APPROVED"
    | "SNS_POST_REJECTED"
    | "SNS_POST_REJECTION_REMINDER"
    | "SNS_INSIGHT_SUBMITTED"
    | "SNS_INSIGHT_REMINDER"
    | "SNS_SETTLEMENT_COMPLETED"
    | "SNS_CAMPAIGN_COMPLETED";
  enabled: boolean;
  body: string;
};

const APPLIED = `✨【お知らせ】キャンペーン受付 ✨

ご応募ありがとうございます！
「{{campaignTitle}}」への受付が正常に完了いたしました。

💌 当選発表について

🔹 発表: 応募後1週間前後
🔹 方法: 当選者様へ個別にご連絡

※大変恐縮ですが、ご当選とならなかった方へのご連絡は省略させていただきます。ご了承ください。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複で届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const APPROVED = `🎉【当選おめでとうございます！】キャンペーンのご案内 🎉

お世話になっております。
「{{campaignTitle}}」の当選者に選出されました！👏✨

ご応募誠にありがとうございました。現在、心を込めて商品の発送準備を進めております。📦
発送が完了いたしましたら、改めてご案内メッセージをお送りいたします。

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`;

const SHIPPED = `📦【発送完了】キャンペーン商品発送のお知らせ 📦

お世話になっております！
お待ちかねの「{{campaignTitle}}」のキャンペーン商品が、本日無事に発送されました！🎉

配送状況は下記の情報よりご確認いただけます。

🚚 配送情報のご案内
- 配送業者:{{trackingCarrier}}
- 追跡番号:{{trackingNumber}}

💡 お届け期間および追跡に関するご案内
- 日本国内から発送の場合:発送後、約2日でお届け
- 韓国から発送の場合:発送後、約7日でお届け
※韓国からの発送の場合、通関等の事情により、システムへの追跡情報の反映に遅れが生じる場合がございます。何卒ご理解いただけますようお願いいたします。

✨ お願い:商品が到着いたしましたら、必ず【応募履歴 - 受取確認】ボタンを押してください！

それでは、商品の到着まで今しばらくお待ちください。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`;

const DELIVERED = `🎁【配達完了】商品は無事に届きましたでしょうか？ 🎁
お世話になっております！
ご応募いただいた「{{campaignTitle}}」のキャンペーン商品が、無事に配達完了となりました。

商品がお手元に届きましたら、下記の内容を必ずご確認いただけますようお願いいたします。

✨ 必須チェックリスト
1️⃣ 受取確認: 商品が到着いたしましたら、必ず【応募履歴 - 受取確認】ボタンを押してください！
2️⃣ レビュー投稿: 事前にご案内したガイドラインに沿って、素敵なご投稿をお願いいたします。📸
3️⃣ URL提出: 投稿完了後、必ず【応募履歴 - 投稿URL提出】をお願いいたします。

⚠️ 万が一、商品に問題がある場合
配送中の破損や商品に不具合などがございましたら、ご投稿前にこのメッセージへお気軽にご連絡ください。迅速に対応させていただきます。

商品がお気に召していただけますと幸いです。素敵なご投稿を心より楽しみにしております。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`;

const POST_REJECTED = `⚠️【要確認】キャンペーン投稿 修正・再提出のお願い ⚠️

お世話になっております。
「{{campaignTitle}}」の投稿URLをご提出いただき、誠にありがとうございます。

ご提出いただいたコンテンツを運営事務局にて確認いたしましたところ、誠に恐縮ではございますが、一部修正および補完が必要な箇所が見つかり、再審査処理とさせていただきました。

大変お手数ですが、下記の修正理由をご確認いただき、ご対応いただけますようお願いいたします。🙏

📝 修正ご依頼内容
- 修正の理由: {{rejectReason}}
- 再提出期限: {{resubmitDeadline}} までに修正の上、URLの再提出をお願いいたします。

※ガイドラインに沿って投稿を修正いただいた後、必ずURLの再提出をお願いいたします。再提出が完了した時点で、最終検収へと進みます。

お手数をおかけして大変申し訳ございませんが、ご協力のほどよろしくお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const POST_REJECTION_REMINDER = `🚨【再送】キャンペーン投稿修正のお願い 🚨

お世話になっております。
「{{campaignTitle}}」の修正ご依頼につきまして、まだ再提出が確認できていないため再度ご連絡いたしました。

🔹 修正の理由: {{rejectReason}}
🔹 最終期限: {{finalDeadline}} まで(期限厳守)

※ 期限内に修正およびURLの再提出が確認できない場合、報酬の支給制限やペナルティが科される場合がございます。必ずご確認の上、ご対応をお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const POST_DEADLINE_REMINDER = `⏰【期限間近】キャンペーン投稿期限まであと{{remainingDays}}日です！ ⏰
お世話になっております！
ご参加いただいている「{{campaignTitle}}」の投稿期限まで、あと{{remainingDays}}日となりました。

投稿期限に遅れのないよう、ご注意ください。

✨ 投稿完了後のお願い
SNSへご投稿いただいた後は、必ずシステムより【応募履歴 - 投稿URL提出】を完了していただけますようお願いいたします。

素敵なご投稿を心より楽しみにしております。よろしくお願いいたします！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const INSIGHT_REMINDER = `📊【インサイト提出のお願い】数値の登録をお願いいたします 📊
お世話になっております。
ご参加いただいている「{{campaignTitle}}」の投稿から7日が経過いたしました。素敵なご投稿をいただき、誠にありがとうございます。

キャンペーンの最終精算および成果測定のため、大変お手数ですが下記のご案内をお読みいただき、インサイト資料のご提出をお願いいたします。

📝 提出項目のご案内
- 対象インサイト: いいね数・コメント数・シェア数・リポスト数・保存数・閲覧数・リーチ数などの画面スクリーンショットおよび数値入力

※投稿の成果数値が確認できる画面をスクリーンショットし、サイト内の【応募履歴 - インサイト提出】よりご登録をお願いいたします。期限内にご提出いただくことで、報酬の精算手続きがスムーズに進行いたします。

ご協力のほどよろしくお願いいたします。

※自動送信のため返信不要ですが、ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複届いた場合はご容赦ください。
🕐 運営：平日 10:00〜20:00`;

const SETTLEMENT_COMPLETED = `💰【お振込完了】キャンペーン報酬支給のお知らせ 💰
お世話になっております！
ご参加いただいた「{{campaignTitle}}」のレポート確認が完了し、キャンペーン報酬のお振込手続きが完了いたしました。🎉

お振込情報は下記をご確認ください。
💳 お振込情報のご案内
- 振込名義: 株）ジェイシュア
- お振込金額: {{rewardJpy}} 円

💡 ご確認のお願い
- 複数のキャンペーンに同時にご参加いただいた場合、個別ではなく合算された金額で一括してお振込いたします。
- 本通知メッセージはシステム上、キャンペーンの案件ごとにそれぞれ自動送信されます。実際の口座には合算金額で入金されますので、あらかじめご了承いただけますようお願いいたします。

この度は、弊社のキャンペーンのために素敵なご投稿をいただき誠にありがとうございました。またのご参加を心よりお待ちしております！

※自動送信のため返信不要。ご不明な点はお気軽にお問い合わせください。
※システムの行き違いで重複して届いた場合はご容赦ください。
🕐 運営:平日 10:00〜20:00`;

const SEED_ROWS: SeedRow[] = [
  { triggerKey: "SNS_APPLICATION_APPLIED", enabled: true, body: APPLIED },
  { triggerKey: "SNS_APPLICATION_APPROVED", enabled: true, body: APPROVED },
  { triggerKey: "SNS_APPLICATION_REJECTED", enabled: false, body: "" },
  { triggerKey: "SNS_APPLICATION_SHIPPED", enabled: true, body: SHIPPED },
  { triggerKey: "SNS_APPLICATION_DELIVERED", enabled: true, body: DELIVERED },
  { triggerKey: "SNS_APPLICATION_RECEIPT_CONFIRMED", enabled: false, body: "" },
  { triggerKey: "SNS_POST_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "SNS_POST_DEADLINE_REMINDER", enabled: true, body: POST_DEADLINE_REMINDER },
  { triggerKey: "SNS_POST_APPROVED", enabled: false, body: "" },
  { triggerKey: "SNS_POST_REJECTED", enabled: true, body: POST_REJECTED },
  { triggerKey: "SNS_POST_REJECTION_REMINDER", enabled: true, body: POST_REJECTION_REMINDER },
  { triggerKey: "SNS_INSIGHT_SUBMITTED", enabled: false, body: "" },
  { triggerKey: "SNS_INSIGHT_REMINDER", enabled: true, body: INSIGHT_REMINDER },
  { triggerKey: "SNS_SETTLEMENT_COMPLETED", enabled: true, body: SETTLEMENT_COMPLETED },
  { triggerKey: "SNS_CAMPAIGN_COMPLETED", enabled: false, body: "" },
];

async function main(): Promise<void> {
  for (const row of SEED_ROWS) {
    for (const subType of ["INSTAGRAM", "X"] as const) {
      await prisma.lineMessageTemplate.upsert({
        where: {
          category_subType_triggerKey: {
            category: "SNS",
            subType,
            triggerKey: row.triggerKey,
          },
        },
        create: {
          category: "SNS",
          subType,
          triggerKey: row.triggerKey,
          enabled: row.enabled,
          body: row.body,
        },
        update: {},
      });
    }
  }
  const count = await prisma.lineMessageTemplate.count();
  console.log(`Seed complete. Total templates: ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: package.json에 seed 스크립트 추가**

`apps/api/package.json`의 `scripts` 섹션에 다음을 추가:

```json
"seed:line-templates": "ts-node -T prisma/seeds/line-templates.seed.ts"
```

- [ ] **Step 3: 시드 실행**

Run: `pnpm --filter @jsure/api seed:line-templates`
Expected: 콘솔에 `Seed complete. Total templates: 30` 표시.

- [ ] **Step 4: DB 확인**

Run: `pnpm --filter @jsure/api exec prisma studio` (선택) 또는 psql로 `SELECT category, "subType", "triggerKey", enabled FROM line_message_templates ORDER BY "triggerKey", "subType";` 실행하여 30 rows 확인.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/prisma/seeds/line-templates.seed.ts apps/api/package.json
git commit -m "feat(api): LINE 템플릿 시드 스크립트 (현재 9개 문구 + Instagram/X 이관)"
```

---

## Task 7: LineTemplatesModule 생성 및 등록

**Files:**
- Create: `apps/api/src/line-templates/line-templates.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 모듈 파일 생성**

Create `apps/api/src/line-templates/line-templates.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { LineDispatcherService } from "./line-dispatcher.service";

@Module({
  imports: [InfluencerAuthModule],
  providers: [LineDispatcherService],
  exports: [LineDispatcherService],
})
export class LineTemplatesModule {}
```

- [ ] **Step 2: app.module.ts에 등록**

`apps/api/src/app.module.ts`의 `imports` 배열에 `LineTemplatesModule` 추가:

```ts
import { LineTemplatesModule } from "./line-templates/line-templates.module";
// ...
imports: [
  // ...기존 모듈들
  LineTemplatesModule,
],
```

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @jsure/api exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/line-templates/line-templates.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): LineTemplatesModule 등록"
```

---

## Task 8: 호출부를 dispatcher 로 교체 (admin-applications)

**Files:**
- Modify: `apps/api/src/admin-applications/admin-applications.service.ts`
- Modify: `apps/api/src/admin-applications/admin-applications.module.ts`

- [ ] **Step 1: admin-applications.module.ts에 LineTemplatesModule import**

`apps/api/src/admin-applications/admin-applications.module.ts` 수정:

```ts
import { Module } from "@nestjs/common";
import { AdminApplicationsController } from "./admin-applications.controller";
import { AdminApplicationsService } from "./admin-applications.service";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { LineTemplatesModule } from "../line-templates/line-templates.module";

@Module({
  imports: [InfluencerAuthModule, LineTemplatesModule],
  controllers: [AdminApplicationsController],
  providers: [AdminApplicationsService],
})
export class AdminApplicationsModule {}
```

- [ ] **Step 2: 서비스에 dispatcher 주입 및 5개 호출 교체**

`apps/api/src/admin-applications/admin-applications.service.ts`에서:

1. import 추가:

```ts
import { LineDispatcherService } from "../line-templates/line-dispatcher.service";
```

2. constructor 파라미터에 추가 (라인 113 부근):

```ts
constructor(
  // ...기존 파라미터
  private readonly line: LineMessagingService,
  private readonly dispatcher: LineDispatcherService,
) {}
```

3. **라인 169 (approve)**: `notifyApproved` 호출 삭제 후 아래로 교체.

교체 전에 `approve()` 시작부의 `findUnique`가 이미 `campaign.title` 만 include 하고 있으므로, dispatcher 가 필요로 하는 필드를 위해 include 를 확장:

```ts
// approve() 내 findUnique 를 다음처럼 확장
const existing = await this.prisma.campaignApplication.findUnique({
  where: { id },
  include: {
    campaign: { select: { id: true, title: true, postingPeriodDays: true } },
    influencer: { select: { id: true, name: true, lineUserId: true } },
  },
});
```

그리고 발송 호출:

```ts
void this.dispatcher.dispatch("SNS_APPLICATION_APPROVED", { application: existing });
```

4. **라인 240 (ship)**: `ship()` 의 `findUnique` include 도 동일하게 확장 (`campaign + influencer`). 발송 호출:

```ts
void this.dispatcher.dispatch("SNS_APPLICATION_SHIPPED", {
  application: {
    ...existing,
    trackingCarrier,
    trackingNumber,
  },
});
```

5. **라인 267 (deliver)**: `deliver()` 의 `findUnique` include 확장. 발송:

```ts
void this.dispatcher.dispatch("SNS_APPLICATION_DELIVERED", { application: existing });
```

6. **라인 403 (rejectSubmittedPost)**: `rejectSubmittedPost()` 의 `findUnique` include 확장하여 `application.influencer` 및 `application.campaign` 포함 (postingPeriodDays 포함). 발송:

```ts
const resubmitDeadlineAt = new Date(rejectedAt.getTime() + POST_REJECTION_RESUBMIT_DAYS * DAY_MS);
void this.dispatcher.dispatch("SNS_POST_REJECTED", {
  application: existing.application,
  rejection: { comment } as never,
  extra: { resubmitDeadlineAt },
});
```

(`rejection` 은 새로 만든 row 대신 `comment` 만 있으면 되므로 최소 shape 로 전달)

7. **라인 582 (completeSettlements)**: 이미 목록 순회 안에서 발송. `findMany` include 를 확장:

```ts
const targets = await this.prisma.settlement.findMany({
  where,
  include: {
    post: {
      select: {
        application: {
          select: {
            id: true,
            influencerId: true,
            snsType: true,
            trackingCarrier: true,
            trackingNumber: true,
            campaign: { select: { id: true, title: true, postingPeriodDays: true } },
            influencer: { select: { id: true, name: true, lineUserId: true } },
          },
        },
      },
    },
  },
});
```

발송:

```ts
for (const target of targets) {
  void this.dispatcher.dispatch("SNS_SETTLEMENT_COMPLETED", {
    application: target.post.application as never,
    settlement: target,
  });
}
```

기존 `void this.line.notifySettlementComplete(...)` 5블록은 모두 삭제.

- [ ] **Step 3: 기존 `this.line.notify*` 5개 호출이 모두 삭제됐는지 확인**

Run: `grep -n "this.line.notify" apps/api/src/admin-applications/admin-applications.service.ts`
Expected: 결과 없음.

- [ ] **Step 4: typecheck + 관련 spec 실행**

Run: `pnpm --filter @jsure/api exec tsc --noEmit && pnpm --filter @jsure/api exec jest src/admin-applications`
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/admin-applications/admin-applications.service.ts apps/api/src/admin-applications/admin-applications.module.ts
git commit -m "refactor(api): admin-applications 서비스의 LINE 발송을 dispatcher 로 교체"
```

---

## Task 9: 호출부 교체 (influencer-applications)

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts`
- Modify: `apps/api/src/influencer-applications/influencer-applications.module.ts`

- [ ] **Step 1: 모듈에 LineTemplatesModule import 추가**

`apps/api/src/influencer-applications/influencer-applications.module.ts`의 `imports` 배열에 `LineTemplatesModule` 추가 (Task 8의 module 파일과 동일한 방식).

- [ ] **Step 2: 서비스에 dispatcher 주입 + notifyApplied 호출 교체**

`apps/api/src/influencer-applications/influencer-applications.service.ts` 라인 395의 `await this.line.notifyApplied(...)` 를 다음으로 교체:

먼저 `create()` 메서드에서 `findUnique/create` 이후, dispatcher 호출용으로 relations 를 포함한 application 을 재조회하거나 확보:

```ts
// create() 내 이미 생성/조회된 application 을 relations 포함으로 다시 조회
const applicationWithRels = await this.prisma.campaignApplication.findUniqueOrThrow({
  where: { id: application.id },
  include: {
    campaign: { select: { id: true, title: true, postingPeriodDays: true } },
    influencer: { select: { id: true, name: true, lineUserId: true } },
  },
});

void this.dispatcher.dispatch("SNS_APPLICATION_APPLIED", { application: applicationWithRels });
```

기존 `await this.line.notifyApplied(...)` 라인 삭제.

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @jsure/api exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/influencer-applications/influencer-applications.service.ts apps/api/src/influencer-applications/influencer-applications.module.ts
git commit -m "refactor(api): influencer-applications 의 LINE 발송을 dispatcher 로 교체"
```

---

## Task 10: 호출부 교체 (line-reminders)

**Files:**
- Modify: `apps/api/src/influencer-auth/line-reminders.service.ts`
- Modify: `apps/api/src/influencer-auth/influencer-auth.module.ts`

- [ ] **Step 1: 모듈에 LineTemplatesModule 관계 설정**

`InfluencerAuthModule` 은 `LineTemplatesModule` 이 이미 depend on 하므로 (Task 7), 반대 방향 import 는 순환을 만든다. 해결책: `LineDispatcherService` 를 `LineTemplatesModule` 의 export 로 유지하고, `LineRemindersService` 를 `LineTemplatesModule` 로 이동하지 않고, `LineTemplatesModule` 이 `LineRemindersService` 를 provider 로 포함하도록 재구성 — 대신 더 간단한 방법: `LineRemindersService` 파일을 `apps/api/src/line-templates/line-reminders.service.ts` 로 이동.

이 Task 에서는 **`LineRemindersService` 파일을 `apps/api/src/line-templates/` 로 이동** 하고, `LineTemplatesModule` 이 `ScheduleModule` 을 import 하도록 조정.

이동:

```bash
git mv apps/api/src/influencer-auth/line-reminders.service.ts apps/api/src/line-templates/line-reminders.service.ts
```

`apps/api/src/influencer-auth/influencer-auth.module.ts` 에서 `LineRemindersService` import 및 providers 등록 라인 삭제.

- [ ] **Step 2: LineTemplatesModule 에 LineRemindersService 등록**

`apps/api/src/line-templates/line-templates.module.ts` 수정:

```ts
import { Module } from "@nestjs/common";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { LineDispatcherService } from "./line-dispatcher.service";
import { LineRemindersService } from "./line-reminders.service";

@Module({
  imports: [InfluencerAuthModule],
  providers: [LineDispatcherService, LineRemindersService],
  exports: [LineDispatcherService],
})
export class LineTemplatesModule {}
```

- [ ] **Step 3: line-reminders.service.ts 내부의 발송부 교체**

`apps/api/src/line-templates/line-reminders.service.ts` 상단 import 를 조정하고 constructor 에 dispatcher 주입:

```ts
import { LineDispatcherService } from "./line-dispatcher.service";
// LineMessagingService import 삭제

constructor(
  private readonly prisma: PrismaService,
  private readonly dispatcher: LineDispatcherService,
) {}
```

`runPostingReminders()` 안 `this.line.pushText(...)` (라인 72-88 부근) 를 다음으로 교체:

```ts
// findMany include 를 확장:
const apps = await this.prisma.campaignApplication.findMany({
  where: {
    receivedAt: { not: null },
    status: { in: ["SHIPPED", "DELIVERED"] },
  },
  include: {
    campaign: { select: { id: true, title: true, postingPeriodDays: true } },
    influencer: { select: { id: true, name: true, lineUserId: true } },
    posts: { select: { id: true } },
  },
});

// ...루프 안에서 발송 부분:
await this.dispatcher.dispatch("SNS_POST_DEADLINE_REMINDER", {
  application: app,
  extra: { remainingDays },
});
```

`runPostRejectionReminders()` 안 `this.line.notifyPostRejectionReminder(...)` 를 교체:

```ts
// findMany include 를 확장:
const posts = await this.prisma.submittedPost.findMany({
  where: { reviewStatus: "REJECTED", reviewedAt: { not: null } },
  include: {
    application: {
      include: {
        campaign: { select: { id: true, title: true, postingPeriodDays: true } },
        influencer: { select: { id: true, name: true, lineUserId: true } },
      },
    },
  },
});

// ...루프 안:
await this.dispatcher.dispatch("SNS_POST_REJECTION_REMINDER", {
  application: post.application,
  rejection: latest,
  extra: { finalDeadlineAt },
});
```

`runInsightReminders()` 안 `this.line.pushText(...)` 교체:

```ts
// findMany include 를 확장 (application.campaign/influencer 포함):
const posts = await this.prisma.submittedPost.findMany({
  where: {
    insightSubmittedAt: null,
    reviewStatus: { in: ["PENDING", "APPROVED"] },
  },
  include: {
    application: {
      include: {
        campaign: { select: { id: true, title: true, postingPeriodDays: true } },
        influencer: { select: { id: true, name: true, lineUserId: true } },
      },
    },
  },
});

// ...루프 안:
await this.dispatcher.dispatch("SNS_INSIGHT_REMINDER", {
  application: post.application,
});
```

- [ ] **Step 4: typecheck + 기존 spec 실행**

Run: `pnpm --filter @jsure/api exec tsc --noEmit && pnpm --filter @jsure/api exec jest`
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/line-templates/line-reminders.service.ts apps/api/src/line-templates/line-templates.module.ts apps/api/src/influencer-auth/influencer-auth.module.ts
git commit -m "refactor(api): LineRemindersService 를 line-templates 로 이동 및 dispatcher 사용"
```

---

## Task 11: LineMessagingService 정리 (notify* 15개 삭제)

**Files:**
- Modify: `apps/api/src/influencer-auth/line-messaging.service.ts`

- [ ] **Step 1: `pushToInfluencer`, `pushText`, `pushFlex`, `multicast`, `applicationUrl`, `resolveToken`, `staticToken`, `channelCreds`, `appBaseUrl` 를 제외한 나머지 삭제**

`apps/api/src/influencer-auth/line-messaging.service.ts`에서 다음을 삭제:
- `notifyApplied` (라인 205-224)
- `notifyApproved` (라인 226-241)
- `notifyShipped` (라인 243-279)
- `notifyShippedWithPlainText` (라인 281-313)
- `notifyDelivered` (라인 315-343)
- `notifyPostRejected` (라인 345-379)
- `notifyPostRejectionReminder` (라인 381-408)
- `notifySettlementComplete` (라인 410-437)
- 파일 하단의 flex helper 함수들 `formatJstMonthDay`, `parseBoldSpans`, `buildBubble`, `FlexSpan` 타입 (라인 440-492): flex helper 는 이제 사용처 없음 → 삭제

또한 `pushFlex` 는 dispatcher 가 text 만 사용하므로 삭제해도 무방. `multicast` 는 broadcast 기능에서 별도 사용 중인지 확인 후 결정. (사용 중이면 유지, 미사용이면 삭제 — grep 필요)

Run: `grep -rn "pushFlex\|multicast\|LineMessagingService" apps/api/src`
사용처 확인 후 미사용 함수는 삭제, 사용처 있으면 유지.

**최종 파일에 남는 것**: `resolveToken`, `pushToInfluencer`, `pushText`, (선택) `pushFlex`, (선택) `multicast`, `applicationUrl` 및 헬퍼.

- [ ] **Step 2: 사용처 정리**

`applicationUrl` 은 dispatcher/템플릿에서 사용하지 않으면 삭제. 사용처 확인:

Run: `grep -rn "applicationUrl" apps/api/src`

- [ ] **Step 3: typecheck + 전체 테스트**

Run: `pnpm --filter @jsure/api exec tsc --noEmit && pnpm --filter @jsure/api test`
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/influencer-auth/line-messaging.service.ts
git commit -m "refactor(api): LineMessagingService 를 raw LINE API 어댑터로 축소 (notify* 삭제)"
```

---

## Task 12: Admin API — 컨트롤러 및 서비스

**Files:**
- Create: `apps/api/src/line-templates/admin-line-templates.service.ts`
- Create: `apps/api/src/line-templates/admin-line-templates.controller.ts`
- Modify: `apps/api/src/line-templates/line-templates.module.ts`

- [ ] **Step 1: 서비스 파일 생성**

Create `apps/api/src/line-templates/admin-line-templates.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  LineTriggerSubType,
  UpdateLineMessageTemplateRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { listTriggersForCategory, publicVariables, getMeta } from "./trigger-meta";
import { renderTemplate, validateBodyVariables } from "./template-renderer";

@Injectable()
export class AdminLineTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
  ) {}

  async list(
    category: CampaignCategory,
    subType: LineTriggerSubType | null,
  ): Promise<LineMessageTemplateListResponse> {
    const triggerKeys = listTriggersForCategory(category);
    const rows = await this.prisma.lineMessageTemplate.findMany({
      where: { category, subType },
      select: { triggerKey: true, enabled: true, updatedAt: true },
    });
    const byKey = new Map(rows.map((r) => [r.triggerKey, r]));
    return {
      category,
      subType,
      items: triggerKeys.map((k) => {
        const row = byKey.get(k);
        return {
          triggerKey: k,
          enabled: row?.enabled ?? false,
          updatedAt: row?.updatedAt?.toISOString() ?? null,
        };
      }),
    };
  }

  async detail(
    category: CampaignCategory,
    subType: LineTriggerSubType | null,
    triggerKey: LineTriggerKey,
  ): Promise<LineMessageTemplateDetailResponse> {
    const meta = getMeta(triggerKey);
    if (meta.category !== category) {
      throw new BadRequestException("Trigger does not belong to the given category");
    }
    const row = await this.prisma.lineMessageTemplate.findUnique({
      where: {
        category_subType_triggerKey: { category, subType, triggerKey },
      },
    });
    const template: LineMessageTemplateResponse = row
      ? {
          category: row.category,
          subType: row.subType,
          triggerKey: row.triggerKey,
          enabled: row.enabled,
          body: row.body,
          updatedAt: row.updatedAt.toISOString(),
          updatedById: row.updatedById,
        }
      : {
          category,
          subType,
          triggerKey,
          enabled: false,
          body: "",
          updatedAt: null,
          updatedById: null,
        };
    return {
      template,
      variables: publicVariables(triggerKey),
    };
  }

  async update(
    category: CampaignCategory,
    subType: LineTriggerSubType | null,
    triggerKey: LineTriggerKey,
    updatedById: string,
    input: UpdateLineMessageTemplateRequest,
  ): Promise<LineMessageTemplateResponse> {
    const meta = getMeta(triggerKey);
    if (meta.category !== category) {
      throw new BadRequestException("Trigger does not belong to the given category");
    }
    if (input.enabled && input.body.trim().length === 0) {
      throw new BadRequestException("Body cannot be empty when enabled");
    }
    const validation = validateBodyVariables(input.body, meta.variables);
    if (!validation.ok) {
      throw new BadRequestException(
        `Unknown variables in body: ${validation.unknown.map((k) => `{{${k}}}`).join(", ")}`,
      );
    }
    const row = await this.prisma.lineMessageTemplate.upsert({
      where: {
        category_subType_triggerKey: { category, subType, triggerKey },
      },
      create: {
        category,
        subType,
        triggerKey,
        enabled: input.enabled,
        body: input.body,
        updatedById,
      },
      update: {
        enabled: input.enabled,
        body: input.body,
        updatedById,
      },
    });
    return {
      category: row.category,
      subType: row.subType,
      triggerKey: row.triggerKey,
      enabled: row.enabled,
      body: row.body,
      updatedAt: row.updatedAt.toISOString(),
      updatedById: row.updatedById,
    };
  }

  async preview(triggerKey: LineTriggerKey, body: string): Promise<{ renderedBody: string }> {
    const meta = getMeta(triggerKey);
    const validation = validateBodyVariables(body, meta.variables);
    if (!validation.ok) {
      throw new BadRequestException(
        `Unknown variables in body: ${validation.unknown.map((k) => `{{${k}}}`).join(", ")}`,
      );
    }
    const renderedBody = renderTemplate(body, meta.variables, {} as never, { useSample: true });
    return { renderedBody };
  }

  async testSend(
    triggerKey: LineTriggerKey,
    body: string,
    adminUserId: string,
  ): Promise<{ sent: boolean }> {
    const meta = getMeta(triggerKey);
    const validation = validateBodyVariables(body, meta.variables);
    if (!validation.ok) {
      throw new BadRequestException(
        `Unknown variables in body: ${validation.unknown.map((k) => `{{${k}}}`).join(", ")}`,
      );
    }
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { testLineUserId: true },
    });
    if (!admin?.testLineUserId) {
      throw new BadRequestException(
        "Register your LINE user ID in your admin profile before sending a test",
      );
    }
    const rendered = renderTemplate(body, meta.variables, {} as never, { useSample: true });
    await this.line.pushToLineUserId(admin.testLineUserId, [{ type: "text", text: rendered }]);
    return { sent: true };
  }
}
```

- [ ] **Step 2: LineMessagingService에 pushToLineUserId 헬퍼 추가**

`apps/api/src/influencer-auth/line-messaging.service.ts` 에 새 메서드 추가 (기존 `pushToInfluencer` 참고하여 lineUserId 를 직접 받는 variant):

```ts
async pushToLineUserId(
  lineUserId: string,
  messages: LineMessage[],
): Promise<void> {
  const token = await this.resolveToken();
  if (!token) {
    this.logger.warn("LINE messaging token not configured; skipping push");
    return;
  }
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`LINE push failed (${res.status}) for lineUserId=${lineUserId}: ${body}`);
    }
  } catch (err) {
    this.logger.error(`LINE push error for lineUserId=${lineUserId}`, err as Error);
  }
}
```

- [ ] **Step 3: 컨트롤러 파일 생성**

Create `apps/api/src/line-templates/admin-line-templates.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import {
  CampaignCategorySchema,
  LineTriggerKeySchema,
  LineTriggerSubTypeSchema,
  PreviewLineMessageTemplateRequestSchema,
  TestSendLineMessageTemplateRequestSchema,
  UpdateLineMessageTemplateRequestSchema,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineMessageTemplateListResponse,
  type LineMessageTemplateResponse,
  type LineTriggerKey,
  type LineTriggerSubType,
  type PreviewLineMessageTemplateRequest,
  type PreviewLineMessageTemplateResponse,
  type TestSendLineMessageTemplateRequest,
  type TestSendLineMessageTemplateResponse,
  type UpdateLineMessageTemplateRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { AdminLineTemplatesService } from "./admin-line-templates.service";

function parseParams(
  category: string,
  subType: string,
  triggerKey: string,
): { category: CampaignCategory; subType: LineTriggerSubType | null; triggerKey: LineTriggerKey } {
  const parsedCategory = CampaignCategorySchema.parse(category);
  const parsedSubType = subType === "none" ? null : LineTriggerSubTypeSchema.parse(subType);
  const parsedTriggerKey = LineTriggerKeySchema.parse(triggerKey);
  return { category: parsedCategory, subType: parsedSubType, triggerKey: parsedTriggerKey };
}

@UseGuards(JwtAuthGuard)
@Controller("admin/line-templates")
export class AdminLineTemplatesController {
  constructor(private readonly svc: AdminLineTemplatesService) {}

  @Get()
  async list(
    @Query("category") category: string,
    @Query("subType") subType?: string,
  ): Promise<LineMessageTemplateListResponse> {
    const parsedCategory = CampaignCategorySchema.parse(category);
    const parsedSubType =
      !subType || subType === "none" ? null : LineTriggerSubTypeSchema.parse(subType);
    return this.svc.list(parsedCategory, parsedSubType);
  }

  @Get(":category/:subType/:triggerKey")
  async detail(
    @Param("category") category: string,
    @Param("subType") subType: string,
    @Param("triggerKey") triggerKey: string,
  ): Promise<LineMessageTemplateDetailResponse> {
    const p = parseParams(category, subType, triggerKey);
    return this.svc.detail(p.category, p.subType, p.triggerKey);
  }

  @Put(":category/:subType/:triggerKey")
  async update(
    @Param("category") category: string,
    @Param("subType") subType: string,
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(UpdateLineMessageTemplateRequestSchema))
    input: UpdateLineMessageTemplateRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<LineMessageTemplateResponse> {
    const p = parseParams(category, subType, triggerKey);
    return this.svc.update(p.category, p.subType, p.triggerKey, req.user.userId, input);
  }

  @Post(":category/:subType/:triggerKey/preview")
  async preview(
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(PreviewLineMessageTemplateRequestSchema))
    input: PreviewLineMessageTemplateRequest,
  ): Promise<PreviewLineMessageTemplateResponse> {
    const parsedTriggerKey = LineTriggerKeySchema.parse(triggerKey);
    return this.svc.preview(parsedTriggerKey, input.body);
  }

  @Post(":category/:subType/:triggerKey/test-send")
  async testSend(
    @Param("triggerKey") triggerKey: string,
    @Body(new ZodValidationPipe(TestSendLineMessageTemplateRequestSchema))
    input: TestSendLineMessageTemplateRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<TestSendLineMessageTemplateResponse> {
    const parsedTriggerKey = LineTriggerKeySchema.parse(triggerKey);
    return this.svc.testSend(parsedTriggerKey, input.body, req.user.userId);
  }
}
```

- [ ] **Step 4: LineTemplatesModule 업데이트**

`apps/api/src/line-templates/line-templates.module.ts` 수정:

```ts
import { Module } from "@nestjs/common";
import { InfluencerAuthModule } from "../influencer-auth/influencer-auth.module";
import { LineDispatcherService } from "./line-dispatcher.service";
import { LineRemindersService } from "./line-reminders.service";
import { AdminLineTemplatesService } from "./admin-line-templates.service";
import { AdminLineTemplatesController } from "./admin-line-templates.controller";

@Module({
  imports: [InfluencerAuthModule],
  controllers: [AdminLineTemplatesController],
  providers: [LineDispatcherService, LineRemindersService, AdminLineTemplatesService],
  exports: [LineDispatcherService],
})
export class LineTemplatesModule {}
```

- [ ] **Step 5: typecheck**

Run: `pnpm --filter @jsure/api exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/line-templates/admin-line-templates.service.ts apps/api/src/line-templates/admin-line-templates.controller.ts apps/api/src/line-templates/line-templates.module.ts apps/api/src/influencer-auth/line-messaging.service.ts
git commit -m "feat(api): 어드민 LINE 템플릿 CRUD/preview/test-send API"
```

---

## Task 13: AdminUser testLineUserId 업데이트 엔드포인트

**Files:**
- Modify or Create: 기존 admin-me 또는 team 컨트롤러 (프로젝트에 있는 admin 프로필 컨트롤러)

- [ ] **Step 1: 기존 프로필 엔드포인트 확인**

Run: `grep -rn "@Controller.*admin/me\|@Controller.*me\|updateProfile" apps/api/src`

기존에 `admin/me` 엔드포인트가 있으면 그것에 `testLineUserId` 필드를 추가. 없으면 새 컨트롤러 생성.

- [ ] **Step 2: 없다면 새 컨트롤러 생성**

Create `apps/api/src/admin-me/admin-me.controller.ts`:

```ts
import { Body, Controller, Patch, Req, UseGuards } from "@nestjs/common";
import {
  UpdateAdminTestLineUserIdRequestSchema,
  type UpdateAdminTestLineUserIdRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/me")
export class AdminMeController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch("test-line-user-id")
  async updateTestLineUserId(
    @Body(new ZodValidationPipe(UpdateAdminTestLineUserIdRequestSchema))
    input: UpdateAdminTestLineUserIdRequest,
    @Req() req: { user: AuthenticatedUser },
  ): Promise<{ testLineUserId: string | null }> {
    const updated = await this.prisma.adminUser.update({
      where: { id: req.user.userId },
      data: { testLineUserId: input.testLineUserId },
      select: { testLineUserId: true },
    });
    return updated;
  }
}
```

Create `apps/api/src/admin-me/admin-me.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AdminMeController } from "./admin-me.controller";

@Module({
  controllers: [AdminMeController],
})
export class AdminMeModule {}
```

`apps/api/src/app.module.ts`의 imports 에 `AdminMeModule` 추가.

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @jsure/api exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/admin-me apps/api/src/app.module.ts
git commit -m "feat(api): 어드민 프로필의 testLineUserId 수정 엔드포인트"
```

---

## Task 14: 프론트 — 네비 메뉴 및 라우트 추가

**Files:**
- Modify: `apps/admin-web/src/lib/navigation.ts`
- Modify: `apps/admin-web/src/App.tsx`

- [ ] **Step 1: navigation.ts 에 메뉴 추가**

`apps/admin-web/src/lib/navigation.ts` 의 "시스템" 그룹 items 에 다음 항목을 `/team` 앞에 추가:

```ts
{ to: "/message-templates", label: "메시지 템플릿", icon: "✎" },
```

- [ ] **Step 2: App.tsx 에 라우트 3개 추가**

`apps/admin-web/src/App.tsx` 의 라우트 그룹에 (`/notices/:id/edit` 다음 라인 부근) 다음 추가:

```tsx
<Route path="/message-templates" element={<MessageTemplates />} />
<Route path="/message-templates/:category/:subType/:triggerKey" element={<MessageTemplateEdit />} />
```

파일 상단 imports 에:

```tsx
import { MessageTemplates } from "./pages/MessageTemplates";
import { MessageTemplateEdit } from "./pages/MessageTemplates/Edit";
```

(파일이 아직 없으므로 다음 Task 에서 만듬 — 이번 단계는 컴파일 실패 상태로 커밋 X)

- [ ] **Step 3: (커밋 X)** — 다음 Task 완료 후 함께 커밋.

---

## Task 15: 프론트 — API 클라이언트 및 타입

**Files:**
- Create: `apps/admin-web/src/domains/messageTemplate/api.ts`
- Create: `apps/admin-web/src/domains/messageTemplate/types.ts`
- Create: `apps/admin-web/src/domains/messageTemplate/index.ts`

- [ ] **Step 1: types.ts 생성**

Create `apps/admin-web/src/domains/messageTemplate/types.ts`:

```ts
import type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  LineTriggerSubType,
  TriggerVariable,
} from "@jsure/shared";

export const TRIGGER_LABELS: Record<LineTriggerKey, string> = {
  SNS_APPLICATION_APPLIED: "1. Application Applied",
  SNS_APPLICATION_APPROVED: "2-a. Application Approved",
  SNS_APPLICATION_REJECTED: "2-b. Application Rejected",
  SNS_APPLICATION_SHIPPED: "3. Shipped",
  SNS_APPLICATION_DELIVERED: "4. Delivered",
  SNS_APPLICATION_RECEIPT_CONFIRMED: "5. Receipt Confirmed",
  SNS_POST_SUBMITTED: "6. Post Submitted",
  SNS_POST_DEADLINE_REMINDER: "6-R. Post Deadline Reminder",
  SNS_POST_APPROVED: "7-a. Post Approved",
  SNS_POST_REJECTED: "7-b. Post Rejected",
  SNS_POST_REJECTION_REMINDER: "7-R. Post Rejection Reminder",
  SNS_INSIGHT_SUBMITTED: "8. Insight Submitted",
  SNS_INSIGHT_REMINDER: "8-R. Insight Reminder",
  SNS_SETTLEMENT_COMPLETED: "9. Settlement Completed",
  SNS_CAMPAIGN_COMPLETED: "10. Campaign Completed",
};

export type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  LineTriggerSubType,
  TriggerVariable,
};
```

- [ ] **Step 2: api.ts 생성**

Create `apps/admin-web/src/domains/messageTemplate/api.ts`:

```ts
import {
  LineMessageTemplateDetailResponseSchema,
  LineMessageTemplateListResponseSchema,
  LineMessageTemplateResponseSchema,
  PreviewLineMessageTemplateResponseSchema,
  TestSendLineMessageTemplateResponseSchema,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineMessageTemplateListResponse,
  type LineMessageTemplateResponse,
  type LineTriggerKey,
  type LineTriggerSubType,
  type PreviewLineMessageTemplateResponse,
  type TestSendLineMessageTemplateResponse,
  type UpdateLineMessageTemplateRequest,
} from "@jsure/shared";
import { api } from "@/lib/api";

function pathOf(
  category: CampaignCategory,
  subType: LineTriggerSubType | null,
  triggerKey: LineTriggerKey,
): string {
  const subSegment = subType ?? "none";
  return `/admin/line-templates/${category}/${subSegment}/${triggerKey}`;
}

export async function listTemplates(
  category: CampaignCategory,
  subType: LineTriggerSubType | null,
): Promise<LineMessageTemplateListResponse> {
  const res = await api.get("/admin/line-templates", {
    params: { category, subType: subType ?? "none" },
  });
  return LineMessageTemplateListResponseSchema.parse(res.data);
}

export async function getTemplate(
  category: CampaignCategory,
  subType: LineTriggerSubType | null,
  triggerKey: LineTriggerKey,
): Promise<LineMessageTemplateDetailResponse> {
  const res = await api.get(pathOf(category, subType, triggerKey));
  return LineMessageTemplateDetailResponseSchema.parse(res.data);
}

export async function updateTemplate(
  category: CampaignCategory,
  subType: LineTriggerSubType | null,
  triggerKey: LineTriggerKey,
  input: UpdateLineMessageTemplateRequest,
): Promise<LineMessageTemplateResponse> {
  const res = await api.put(pathOf(category, subType, triggerKey), input);
  return LineMessageTemplateResponseSchema.parse(res.data);
}

export async function previewTemplate(
  category: CampaignCategory,
  subType: LineTriggerSubType | null,
  triggerKey: LineTriggerKey,
  body: string,
): Promise<PreviewLineMessageTemplateResponse> {
  const res = await api.post(`${pathOf(category, subType, triggerKey)}/preview`, { body });
  return PreviewLineMessageTemplateResponseSchema.parse(res.data);
}

export async function testSendTemplate(
  category: CampaignCategory,
  subType: LineTriggerSubType | null,
  triggerKey: LineTriggerKey,
  body: string,
): Promise<TestSendLineMessageTemplateResponse> {
  const res = await api.post(`${pathOf(category, subType, triggerKey)}/test-send`, { body });
  return TestSendLineMessageTemplateResponseSchema.parse(res.data);
}

export async function updateAdminTestLineUserId(
  testLineUserId: string | null,
): Promise<{ testLineUserId: string | null }> {
  const res = await api.patch("/admin/me/test-line-user-id", { testLineUserId });
  return res.data as { testLineUserId: string | null };
}
```

- [ ] **Step 3: index.ts 생성**

Create `apps/admin-web/src/domains/messageTemplate/index.ts`:

```ts
export * from "./types";
export * from "./api";
```

- [ ] **Step 4: (커밋 X)** — 다음 Task 완료 후 함께.

---

## Task 16: 프론트 — 목록 페이지

**Files:**
- Create: `apps/admin-web/src/pages/MessageTemplates/index.tsx`
- Create: `apps/admin-web/src/pages/MessageTemplates/MessageTemplates.module.css`

- [ ] **Step 1: 목록 페이지 컴포넌트 생성**

Create `apps/admin-web/src/pages/MessageTemplates/index.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listTemplates,
  TRIGGER_LABELS,
  type CampaignCategory,
  type LineMessageTemplateListItem,
  type LineTriggerSubType,
} from "@/domains/messageTemplate";
import styles from "./MessageTemplates.module.css";

const CATEGORIES: { key: CampaignCategory; label: string; disabled?: boolean }[] = [
  { key: "SNS", label: "SNS 캠페인" },
  { key: "FAKE_PURCHASE", label: "가구매 (준비중)", disabled: true },
];

const SUB_TYPES: LineTriggerSubType[] = ["INSTAGRAM", "X"];

export function MessageTemplates(): JSX.Element {
  const [category, setCategory] = useState<CampaignCategory>("SNS");
  const [subType, setSubType] = useState<LineTriggerSubType>("INSTAGRAM");
  const [items, setItems] = useState<LineMessageTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listTemplates(category, subType)
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, [category, subType]);

  return (
    <div className={styles.container}>
      <h1>메시지 템플릿</h1>

      <div className={styles.tabs}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={category === c.key ? styles.tabActive : styles.tab}
            disabled={c.disabled}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === "SNS" && (
        <div className={styles.filter}>
          <span>Sub-type:</span>
          {SUB_TYPES.map((s) => (
            <label key={s}>
              <input
                type="radio"
                checked={subType === s}
                onChange={() => setSubType(s)}
              />
              {s}
            </label>
          ))}
        </div>
      )}

      {loading ? (
        <p>로딩중...</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Trigger</th>
              <th>Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.triggerKey}>
                <td>
                  <Link to={`/message-templates/${category}/${subType}/${it.triggerKey}`}>
                    {TRIGGER_LABELS[it.triggerKey]}
                  </Link>
                </td>
                <td>{it.enabled ? "✅ ON" : "⚪ OFF"}</td>
                <td>{it.updatedAt ? new Date(it.updatedAt).toLocaleString("ja-JP") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: CSS 생성**

Create `apps/admin-web/src/pages/MessageTemplates/MessageTemplates.module.css`:

```css
.container { padding: 24px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab, .tabActive { padding: 8px 16px; border: 1px solid #ccc; background: white; cursor: pointer; }
.tabActive { background: #2563eb; color: white; border-color: #2563eb; }
.tab:disabled { opacity: 0.5; cursor: not-allowed; }
.filter { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.filter label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 12px; border-bottom: 1px solid #eee; }
.table th { background: #f9fafb; font-weight: 600; }
.table a { color: #2563eb; text-decoration: none; }
.table a:hover { text-decoration: underline; }
```

- [ ] **Step 3: (커밋 X)** — 편집 페이지 완성 후 함께.

---

## Task 17: 프론트 — 편집 페이지

**Files:**
- Create: `apps/admin-web/src/pages/MessageTemplates/Edit.tsx`
- Create: `apps/admin-web/src/domains/messageTemplate/components/VariablesPanel.tsx`
- Create: `apps/admin-web/src/domains/messageTemplate/components/PreviewModal.tsx`
- Modify: `apps/admin-web/src/pages/MessageTemplates/MessageTemplates.module.css` (기존 파일 확장)

- [ ] **Step 1: VariablesPanel 컴포넌트**

Create `apps/admin-web/src/domains/messageTemplate/components/VariablesPanel.tsx`:

```tsx
import type { TriggerVariable } from "@jsure/shared";

type Props = {
  variables: TriggerVariable[];
  onInsert: (key: string) => void;
};

export function VariablesPanel({ variables, onInsert }: Props): JSX.Element {
  return (
    <div>
      <h3>Available Variables</h3>
      {variables.map((v) => (
        <div key={v.key} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>{v.label}</div>
          <div style={{ color: "#666", fontSize: 13 }}>{v.description}</div>
          <button onClick={() => onInsert(v.key)}>Insert</button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: PreviewModal 컴포넌트**

Create `apps/admin-web/src/domains/messageTemplate/components/PreviewModal.tsx`:

```tsx
type Props = {
  renderedBody: string;
  onClose: () => void;
};

export function PreviewModal({ renderedBody, onClose }: Props): JSX.Element {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", padding: 24, minWidth: 400, maxWidth: 600, maxHeight: "80vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Preview</h3>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f9fafb", padding: 12, borderRadius: 4 }}>
          {renderedBody}
        </pre>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 편집 페이지 컴포넌트**

Create `apps/admin-web/src/pages/MessageTemplates/Edit.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTemplate,
  previewTemplate,
  testSendTemplate,
  updateTemplate,
  TRIGGER_LABELS,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineTriggerKey,
  type LineTriggerSubType,
} from "@/domains/messageTemplate";
import { VariablesPanel } from "@/domains/messageTemplate/components/VariablesPanel";
import { PreviewModal } from "@/domains/messageTemplate/components/PreviewModal";
import styles from "./MessageTemplates.module.css";

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

function findUnknownVariables(body: string, allowed: string[]): string[] {
  const set = new Set(allowed);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of body.matchAll(VAR_PATTERN)) {
    const key = m[1];
    if (!set.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export function MessageTemplateEdit(): JSX.Element {
  const params = useParams<{
    category: CampaignCategory;
    subType: LineTriggerSubType | "none";
    triggerKey: LineTriggerKey;
  }>();
  const navigate = useNavigate();
  const category = params.category!;
  const subType = params.subType === "none" ? null : (params.subType as LineTriggerSubType);
  const triggerKey = params.triggerKey!;

  const [detail, setDetail] = useState<LineMessageTemplateDetailResponse | null>(null);
  const [body, setBody] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getTemplate(category, subType, triggerKey).then((res) => {
      setDetail(res);
      setBody(res.template.body);
      setEnabled(res.template.enabled);
    });
  }, [category, subType, triggerKey]);

  if (!detail) return <p>로딩중...</p>;

  const unknownVars = findUnknownVariables(body, detail.variables.map((v) => v.key));
  const validationError =
    body.length > 5000 ? "본문이 5000자를 초과했습니다"
    : unknownVars.length > 0 ? `알 수 없는 변수: ${unknownVars.map((k) => `{{${k}}}`).join(", ")}`
    : enabled && body.trim().length === 0 ? "활성화 상태에서 본문은 비어있을 수 없습니다"
    : null;

  const insertVariable = (key: string): void => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = `${body.substring(0, start)}{{${key}}}${body.substring(end)}`;
    setBody(next);
    setTimeout(() => {
      const pos = start + `{{${key}}}`.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const doSave = async (): Promise<void> => {
    if (validationError) return;
    setSaving(true);
    setError(null);
    try {
      await updateTemplate(category, subType, triggerKey, { enabled, body });
      navigate("/message-templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const doPreview = async (): Promise<void> => {
    if (validationError) return;
    try {
      const res = await previewTemplate(category, subType, triggerKey, body);
      setPreview(res.renderedBody);
    } catch (err) {
      setError(err instanceof Error ? err.message : "미리보기 실패");
    }
  };

  const doTestSend = async (): Promise<void> => {
    if (validationError) return;
    try {
      await testSendTemplate(category, subType, triggerKey, body);
      alert("테스트 발송 완료");
    } catch (err) {
      setError(err instanceof Error ? err.message : "테스트 발송 실패");
    }
  };

  return (
    <div className={styles.container}>
      <h1>
        {TRIGGER_LABELS[triggerKey]} {subType ? `(${subType})` : ""}
      </h1>

      <label className={styles.toggle}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        enabled
      </label>

      <div className={styles.editor}>
        <div className={styles.editorLeft}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={20}
          />
          <div className={styles.counter}>{body.length} / 5000 chars</div>
          {validationError && <div className={styles.error}>{validationError}</div>}
          {error && <div className={styles.error}>{error}</div>}
        </div>
        <div className={styles.editorRight}>
          <VariablesPanel variables={detail.variables} onInsert={insertVariable} />
        </div>
      </div>

      <div className={styles.actions}>
        <button onClick={doPreview} disabled={!!validationError}>Preview</button>
        <button onClick={doTestSend} disabled={!!validationError}>Send Test to My LINE</button>
        <button onClick={() => navigate("/message-templates")}>Cancel</button>
        <button onClick={doSave} disabled={!!validationError || saving}>
          {saving ? "저장중..." : "Save"}
        </button>
      </div>

      {preview !== null && <PreviewModal renderedBody={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
```

- [ ] **Step 4: CSS 확장**

`apps/admin-web/src/pages/MessageTemplates/MessageTemplates.module.css` 에 추가:

```css
.toggle { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.editor { display: grid; grid-template-columns: 1fr 300px; gap: 16px; }
.editorLeft, .editorRight { display: flex; flex-direction: column; gap: 8px; }
.textarea { width: 100%; font-family: monospace; font-size: 14px; padding: 8px; }
.counter { color: #666; font-size: 12px; }
.error { color: #dc2626; padding: 8px; background: #fee2e2; border-radius: 4px; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
```

- [ ] **Step 5: 빌드 및 lint 통과 확인**

Run: `pnpm --filter @jsure/admin-web build && pnpm --filter @jsure/admin-web lint`
Expected: 통과.

- [ ] **Step 6: 커밋 (Task 14-17 일괄)**

```bash
git add apps/admin-web/src/lib/navigation.ts apps/admin-web/src/App.tsx apps/admin-web/src/pages/MessageTemplates apps/admin-web/src/domains/messageTemplate
git commit -m "feat(admin-web): 메시지 템플릿 목록/편집 화면 및 API 클라이언트"
```

---

## Task 18: 스테이징 검증 체크리스트

**Files:** (변경 없음, 문서만)

- [ ] **Step 1: 로컬 통합 확인**

Run: `pnpm dev` 로 API + admin-web 기동. `/message-templates` 접속하여:
- 목록에 15개 트리거 표시
- Instagram/X 필터 전환
- SNS 이외 카테고리 disabled
- 편집 페이지: enabled 토글, 변수 insert, preview 모달, save

- [ ] **Step 2: 스테이징 시나리오 리스트**

수동 검증:
- 신청 생성 → LINE 수신 확인 (SNS_APPLICATION_APPLIED)
- 관리자 승인 → LINE 수신 확인 (SNS_APPLICATION_APPROVED)
- ship → 수신 확인 (SNS_APPLICATION_SHIPPED, trackingCarrier/trackingNumber 반영)
- deliver → 수신 확인
- 게시물 반려 → 수신 확인 (rejectReason/resubmitDeadline 반영)
- 정산 완료 → 수신 확인 (rewardJpy 반영)
- 어드민에서 SNS_APPLICATION_APPROVED 를 disable → 다시 승인 시 발송 없음 + `LineDispatchLog.status = SKIPPED_DISABLED`
- 어드민에서 문구 수정 → 다음 트리거에서 새 문구로 발송

각 시나리오 결과를 `docs/superpowers/plans/2026-07-02-line-message-templates.md` 하단에 체크리스트로 기록.

---

## Task 19: 최종 정리 커밋

- [ ] **Step 1: 전체 typecheck + test + lint**

Run: `pnpm typecheck && pnpm --filter @jsure/api test && pnpm --filter @jsure/admin-web lint`
Expected: 통과.

- [ ] **Step 2: 문서에 완료 마킹**

`docs/superpowers/specs/2026-07-02-line-message-templates-design.md` 문서 상단의 상태를 `Draft` → `Implemented` 로 변경.

- [ ] **Step 3: 최종 커밋**

```bash
git add docs/superpowers/specs/2026-07-02-line-message-templates-design.md
git commit -m "docs: LINE 메시지 템플릿 스펙 상태 Implemented 로 갱신"
```

---

## Rollout & Rollback 노트

- **롤아웃 순서**: 위 Task 1~19 순차 진행. Task 7 이후 dev 서버 시작 가능. Task 11 완료 전까지는 기존 하드코딩 코드와 새 dispatcher 가 공존 상태 — 하나의 push 이벤트에서 중복 발송이 발생하지 않도록 **각 Task 8~10 는 원자적으로 통째로 커밋 후 다음 Task 진행**.
- **부분 롤백**: 어드민 UI 에서 특정 트리거만 disable → 즉시 발송 중단.
- **전체 롤백**: 관련 커밋을 revert. `LineMessageTemplate` / `LineDispatchLog` 테이블은 그대로 두어도 무해.

## 오픈 이슈 (스펙에서 위임)

- 어드민이 자신의 `testLineUserId` 를 획득하는 방법은 별도 안내 필요 (LINE OA 친구 추가 후 관리자 확인 등). 프로필 페이지 UI 는 이번 스코프 밖 — Task 13 은 백엔드 엔드포인트만 추가.
- 라벨/설명 i18n 은 별도 프로젝트.
- 가구매(FAKE_PURCHASE) 트리거 정의는 별도 스펙에서.
