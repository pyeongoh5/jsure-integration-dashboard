# Campaign Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캠페인 생성/수정 폼 페이지를 추가한다. 단일 `CampaignForm` 컴포넌트를 `/campaigns/new`, `/campaigns/:id/edit` 두 라우트가 공유하며, shared zod 스키마가 API 계약의 단일 소스이고, apps/api에 최소 CRUD 엔드포인트를 함께 구축한다.

**Architecture:** packages/shared에 `CampaignFormSchema`를 정의하고 admin-web/api 양쪽에서 import. 시간대는 폼은 `YYYY-MM-DD`만 받고, 서버 변환 레이어가 JST(Asia/Tokyo) 자정/23:59:59로 환산하여 UTC `DateTime`으로 저장한다. NestJS `ZodValidationPipe`로 입력 검증, axios + `Schema.parse()`로 응답 검증.

**Tech Stack:** TypeScript 5.6, zod 3.23, NestJS 10, Prisma 5 (PostgreSQL), React 18, Vite 5, react-router-dom 6, axios 1.7.

스펙: `docs/superpowers/specs/2026-05-19-campaign-form-design.md`

---

## File Structure

**Create:**
- `packages/shared/src/types/campaign.ts` — zod 스키마/타입
- `apps/api/src/campaigns/campaigns.module.ts`
- `apps/api/src/campaigns/campaigns.controller.ts`
- `apps/api/src/campaigns/campaigns.service.ts`
- `apps/api/src/campaigns/campaigns.service.spec.ts` — 날짜 변환 단위 테스트
- `apps/admin-web/src/lib/campaigns.ts` — API 클라이언트
- `apps/admin-web/src/components/Campaign/CampaignForm.tsx`
- `apps/admin-web/src/components/Campaign/CampaignForm.css`
- `apps/admin-web/src/components/Campaign/SnsTypeChips.tsx`
- `apps/admin-web/src/components/Campaign/ReferenceMediaUrlList.tsx`
- `apps/admin-web/src/pages/Campaigns/New.tsx`
- `apps/admin-web/src/pages/Campaigns/Edit.tsx`

**Modify:**
- `packages/shared/src/index.ts` — export campaign types
- `apps/api/prisma/schema.prisma` — `Campaign` 모델 추가
- `apps/api/src/app.module.ts` — `CampaignsModule` 등록
- `apps/admin-web/src/App.tsx` — `/campaigns/new`, `/campaigns/:id/edit` 라우트 추가
- `apps/admin-web/src/pages/Campaigns/index.tsx` — "캠페인 만들기" 버튼

---

## Task 1: Shared — Campaign zod schema

**Files:**
- Create: `packages/shared/src/types/campaign.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the schema file**

Create `packages/shared/src/types/campaign.ts`:

```ts
import { z } from "zod";

export const SnsTypeSchema = z.enum(["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"]);
export type SnsType = z.infer<typeof SnsTypeSchema>;

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

export const CampaignFormSchema = z
  .object({
    title: z.string().min(1, "필수 입력").max(100),
    rewardJpy: z.number().int("정수만 입력").nonnegative(),
    snsTypes: z.array(SnsTypeSchema).min(1, "1개 이상 선택"),
    condition: z.string().max(500),
    recruitCount: z.number().int().positive("1 이상"),
    recruitStartDate: DateOnly,
    recruitEndDate: DateOnly,
    productSummary: z.string().max(1000),
    productDetailUrl: z.string().url("URL 형식이어야 합니다"),
    guideline: z.string().max(2000),
    referenceMediaUrls: z.array(z.string().url()).max(10),
    ngItems: z.string().max(2000),
    cautions: z.string().max(2000),
  })
  .refine((d) => d.recruitStartDate <= d.recruitEndDate, {
    path: ["recruitEndDate"],
    message: "종료일은 시작일 이후여야 합니다",
  });
export type CampaignForm = z.infer<typeof CampaignFormSchema>;

export const CreateCampaignRequestSchema = CampaignFormSchema;
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

export const UpdateCampaignRequestSchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    rewardJpy: z.number().int().nonnegative().optional(),
    snsTypes: z.array(SnsTypeSchema).min(1).optional(),
    condition: z.string().max(500).optional(),
    recruitCount: z.number().int().positive().optional(),
    recruitStartDate: DateOnly.optional(),
    recruitEndDate: DateOnly.optional(),
    productSummary: z.string().max(1000).optional(),
    productDetailUrl: z.string().url().optional(),
    guideline: z.string().max(2000).optional(),
    referenceMediaUrls: z.array(z.string().url()).max(10).optional(),
    ngItems: z.string().max(2000).optional(),
    cautions: z.string().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.recruitStartDate === undefined ||
      d.recruitEndDate === undefined ||
      d.recruitStartDate <= d.recruitEndDate,
    { path: ["recruitEndDate"], message: "종료일은 시작일 이후여야 합니다" },
  );
export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequestSchema>;

export const CampaignResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  rewardJpy: z.number().int().nonnegative(),
  snsTypes: z.array(SnsTypeSchema),
  condition: z.string(),
  recruitCount: z.number().int().positive(),
  recruitStartDate: DateOnly,
  recruitEndDate: DateOnly,
  recruitStartAt: z.string().datetime(),
  recruitEndAt: z.string().datetime(),
  productSummary: z.string(),
  productDetailUrl: z.string().url(),
  guideline: z.string(),
  referenceMediaUrls: z.array(z.string().url()),
  ngItems: z.string(),
  cautions: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;
```

- [ ] **Step 2: Re-export from index**

Modify `packages/shared/src/index.ts` — append a new line:

```ts
export * from "./types/campaign.js";
```

Final file content:

```ts
export * from "./types/health.js";
export * from "./types/auth.js";
export * from "./types/campaign.js";
```

- [ ] **Step 3: Build shared and typecheck**

Run: `pnpm --filter @jsure/shared build && pnpm typecheck`
Expected: 두 명령 모두 exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/campaign.ts packages/shared/src/index.ts
git commit -m "feat(shared): add Campaign zod schemas"
```

---

## Task 2: API — Prisma `Campaign` model + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<auto-timestamped>_add_campaign/migration.sql` (prisma가 생성)

- [ ] **Step 1: Add the model**

Append to `apps/api/prisma/schema.prisma` (after `enum UserStatus { ... }`):

```prisma
model Campaign {
  id                 String   @id @default(cuid())
  title              String
  rewardJpy          Int
  snsTypes           String[]
  condition          String
  recruitCount       Int
  recruitStartAt     DateTime
  recruitEndAt       DateTime
  productSummary     String
  productDetailUrl   String
  guideline          String
  referenceMediaUrls String[]
  ngItems            String
  cautions           String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([recruitStartAt])
  @@map("campaigns")
}
```

- [ ] **Step 2: Create migration**

Run (개발 DB가 떠 있다고 가정):

```bash
pnpm --filter @jsure/api exec prisma migrate dev --name add_campaign
```

Expected: `apps/api/prisma/migrations/<timestamp>_add_campaign/migration.sql` 생성, Prisma Client 재생성, exit 0.

만약 DB 미기동 환경이면 대신:

```bash
pnpm --filter @jsure/api exec prisma migrate dev --create-only --name add_campaign
pnpm --filter @jsure/api exec prisma generate
```

Expected: migration SQL은 생성되고 apply는 사용자가 별도 실행. 이 경우 사용자에게 보고.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @jsure/api typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add Campaign Prisma model and migration"
```

---

## Task 3: API — date conversion helpers + service spec (TDD)

**Files:**
- Create: `apps/api/src/campaigns/campaigns.service.ts` (헬퍼만 우선)
- Create: `apps/api/src/campaigns/campaigns.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/campaigns/campaigns.service.spec.ts`:

```ts
import { jstDayStartUtc, jstDayEndUtc, utcToJstDateStr } from "./campaigns.service";

describe("JST date conversion helpers", () => {
  it("jstDayStartUtc converts YYYY-MM-DD to JST 00:00:00 in UTC", () => {
    // 2026-05-19 00:00:00 JST === 2026-05-18 15:00:00 UTC
    expect(jstDayStartUtc("2026-05-19").toISOString()).toBe(
      "2026-05-18T15:00:00.000Z",
    );
  });

  it("jstDayEndUtc converts YYYY-MM-DD to JST 23:59:59 in UTC", () => {
    // 2026-05-19 23:59:59 JST === 2026-05-19 14:59:59 UTC
    expect(jstDayEndUtc("2026-05-19").toISOString()).toBe(
      "2026-05-19T14:59:59.000Z",
    );
  });

  it("utcToJstDateStr returns the JST calendar date for a UTC Date", () => {
    // 2026-05-18 15:00:00 UTC === 2026-05-19 00:00:00 JST → "2026-05-19"
    expect(utcToJstDateStr(new Date("2026-05-18T15:00:00Z"))).toBe(
      "2026-05-19",
    );
    // 2026-05-19 14:59:59 UTC === 2026-05-19 23:59:59 JST → "2026-05-19"
    expect(utcToJstDateStr(new Date("2026-05-19T14:59:59Z"))).toBe(
      "2026-05-19",
    );
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm --filter @jsure/api test -- campaigns.service`
Expected: FAIL — `Cannot find module './campaigns.service'`.

- [ ] **Step 3: Create the helpers (minimal service file)**

Create `apps/api/src/campaigns/campaigns.service.ts`:

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CampaignResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

export function jstDayStartUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}

export function jstDayEndUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59+09:00`);
}

export function utcToJstDateStr(d: Date): string {
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

type CampaignRow = {
  id: string;
  title: string;
  rewardJpy: number;
  snsTypes: string[];
  condition: string;
  recruitCount: number;
  recruitStartAt: Date;
  recruitEndAt: Date;
  productSummary: string;
  productDetailUrl: string;
  guideline: string;
  referenceMediaUrls: string[];
  ngItems: string;
  cautions: string;
  createdAt: Date;
  updatedAt: Date;
};

function toResponse(row: CampaignRow): CampaignResponse {
  return {
    id: row.id,
    title: row.title,
    rewardJpy: row.rewardJpy,
    snsTypes: row.snsTypes as CampaignResponse["snsTypes"],
    condition: row.condition,
    recruitCount: row.recruitCount,
    recruitStartDate: utcToJstDateStr(row.recruitStartAt),
    recruitEndDate: utcToJstDateStr(row.recruitEndAt),
    recruitStartAt: row.recruitStartAt.toISOString(),
    recruitEndAt: row.recruitEndAt.toISOString(),
    productSummary: row.productSummary,
    productDetailUrl: row.productDetailUrl,
    guideline: row.guideline,
    referenceMediaUrls: row.referenceMediaUrls,
    ngItems: row.ngItems,
    cautions: row.cautions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCampaignRequest): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.create({
      data: {
        title: input.title,
        rewardJpy: input.rewardJpy,
        snsTypes: input.snsTypes,
        condition: input.condition,
        recruitCount: input.recruitCount,
        recruitStartAt: jstDayStartUtc(input.recruitStartDate),
        recruitEndAt: jstDayEndUtc(input.recruitEndDate),
        productSummary: input.productSummary,
        productDetailUrl: input.productDetailUrl,
        guideline: input.guideline,
        referenceMediaUrls: input.referenceMediaUrls,
        ngItems: input.ngItems,
        cautions: input.cautions,
      },
    });
    return toResponse(row);
  }

  async findById(id: string): Promise<CampaignResponse> {
    const row = await this.prisma.campaign.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Campaign not found");
    return toResponse(row);
  }

  async update(
    id: string,
    input: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Campaign not found");

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.rewardJpy !== undefined) data.rewardJpy = input.rewardJpy;
    if (input.snsTypes !== undefined) data.snsTypes = input.snsTypes;
    if (input.condition !== undefined) data.condition = input.condition;
    if (input.recruitCount !== undefined) data.recruitCount = input.recruitCount;
    if (input.recruitStartDate !== undefined) {
      data.recruitStartAt = jstDayStartUtc(input.recruitStartDate);
    }
    if (input.recruitEndDate !== undefined) {
      data.recruitEndAt = jstDayEndUtc(input.recruitEndDate);
    }
    if (input.productSummary !== undefined) data.productSummary = input.productSummary;
    if (input.productDetailUrl !== undefined) data.productDetailUrl = input.productDetailUrl;
    if (input.guideline !== undefined) data.guideline = input.guideline;
    if (input.referenceMediaUrls !== undefined) data.referenceMediaUrls = input.referenceMediaUrls;
    if (input.ngItems !== undefined) data.ngItems = input.ngItems;
    if (input.cautions !== undefined) data.cautions = input.cautions;

    const row = await this.prisma.campaign.update({ where: { id }, data });
    return toResponse(row);
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm --filter @jsure/api test -- campaigns.service`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/campaigns/campaigns.service.ts apps/api/src/campaigns/campaigns.service.spec.ts
git commit -m "feat(api): add CampaignsService with JST date conversion"
```

---

## Task 4: API — controller + module + AppModule wiring

**Files:**
- Create: `apps/api/src/campaigns/campaigns.controller.ts`
- Create: `apps/api/src/campaigns/campaigns.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create controller**

Create `apps/api/src/campaigns/campaigns.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import {
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  type CampaignResponse,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CampaignsService } from "./campaigns.service";

@UseGuards(JwtAuthGuard)
@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateCampaignRequestSchema))
  create(@Body() body: CreateCampaignRequest): Promise<CampaignResponse> {
    return this.campaigns.create(body);
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<CampaignResponse> {
    return this.campaigns.findById(id);
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(UpdateCampaignRequestSchema))
  update(
    @Param("id") id: string,
    @Body() body: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    return this.campaigns.update(id, body);
  }
}
```

- [ ] **Step 2: Create module**

Create `apps/api/src/campaigns/campaigns.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
```

- [ ] **Step 3: Register module in AppModule**

Modify `apps/api/src/app.module.ts`. Add the import and include in `imports`:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { HealthModule } from "@/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    CampaignsModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Build/typecheck**

Run: `pnpm --filter @jsure/api typecheck && pnpm --filter @jsure/api build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/campaigns/campaigns.controller.ts apps/api/src/campaigns/campaigns.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): expose campaigns CRUD endpoints"
```

---

## Task 5: admin-web — API client

**Files:**
- Create: `apps/admin-web/src/lib/campaigns.ts`

- [ ] **Step 1: Create the API client**

Create `apps/admin-web/src/lib/campaigns.ts`:

```ts
import {
  CampaignResponseSchema,
  type CampaignResponse,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@jsure/shared";
import { api } from "./api";

export async function getCampaign(id: string): Promise<CampaignResponse> {
  const res = await api.get(`/campaigns/${encodeURIComponent(id)}`);
  return CampaignResponseSchema.parse(res.data);
}

export async function createCampaign(
  input: CreateCampaignRequest,
): Promise<CampaignResponse> {
  const res = await api.post("/campaigns", input);
  return CampaignResponseSchema.parse(res.data);
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignRequest,
): Promise<CampaignResponse> {
  const res = await api.patch(
    `/campaigns/${encodeURIComponent(id)}`,
    input,
  );
  return CampaignResponseSchema.parse(res.data);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @jsure/admin-web typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web/src/lib/campaigns.ts
git commit -m "feat(admin-web): add campaigns API client"
```

---

## Task 6: admin-web — SnsTypeChips component

**Files:**
- Create: `apps/admin-web/src/components/Campaign/SnsTypeChips.tsx`

- [ ] **Step 1: Create the component**

Create `apps/admin-web/src/components/Campaign/SnsTypeChips.tsx`:

```tsx
import type { SnsType } from "@jsure/shared";

const OPTIONS: readonly { value: SnsType; label: string }[] = [
  { value: "INSTAGRAM", label: "인스타그램" },
  { value: "TIKTOK", label: "틱톡" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "유튜브" },
];

type Props = {
  value: SnsType[];
  onChange: (next: SnsType[]) => void;
  disabled?: boolean;
};

export function SnsTypeChips({ value, onChange, disabled }: Props) {
  const toggle = (v: SnsType) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="cf__chips" role="group" aria-label="SNS 종류">
      {OPTIONS.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={`cf__chip${selected ? " cf__chip--on" : ""}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @jsure/admin-web typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web/src/components/Campaign/SnsTypeChips.tsx
git commit -m "feat(admin-web): add SnsTypeChips multi-select"
```

---

## Task 7: admin-web — ReferenceMediaUrlList component

**Files:**
- Create: `apps/admin-web/src/components/Campaign/ReferenceMediaUrlList.tsx`

- [ ] **Step 1: Create the component**

Create `apps/admin-web/src/components/Campaign/ReferenceMediaUrlList.tsx`:

```tsx
type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  disabled?: boolean;
  errorByIndex?: Record<number, string | undefined>;
};

export function ReferenceMediaUrlList({
  value,
  onChange,
  max = 10,
  disabled,
  errorByIndex,
}: Props) {
  const setAt = (i: number, v: string) => {
    const next = value.slice();
    next[i] = v;
    onChange(next);
  };
  const removeAt = (i: number) => {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  };
  const add = () => {
    if (value.length >= max) return;
    onChange([...value, ""]);
  };
  return (
    <div className="cf__urls">
      {value.map((url, i) => (
        <div key={i} className="cf__url-row">
          <input
            type="url"
            className="cf__input"
            placeholder="https://..."
            value={url}
            disabled={disabled}
            onChange={(e) => setAt(i, e.target.value)}
          />
          <button
            type="button"
            className="cf__btn cf__btn--ghost"
            onClick={() => removeAt(i)}
            disabled={disabled}
            aria-label={`항목 ${i + 1} 삭제`}
          >
            삭제
          </button>
          {errorByIndex?.[i] && (
            <div className="cf__error">{errorByIndex[i]}</div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="cf__btn cf__btn--ghost"
        onClick={add}
        disabled={disabled || value.length >= max}
      >
        URL 추가 ({value.length}/{max})
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @jsure/admin-web typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web/src/components/Campaign/ReferenceMediaUrlList.tsx
git commit -m "feat(admin-web): add ReferenceMediaUrlList editor"
```

---

## Task 8: admin-web — CampaignForm + CSS

**Files:**
- Create: `apps/admin-web/src/components/Campaign/CampaignForm.tsx`
- Create: `apps/admin-web/src/components/Campaign/CampaignForm.css`

- [ ] **Step 1: Create the CSS**

Create `apps/admin-web/src/components/Campaign/CampaignForm.css`:

```css
.cf {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 720px;
}
.cf__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}
.cf__section-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}
.cf__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cf__label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}
.cf__input,
.cf__textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font: inherit;
}
.cf__textarea {
  min-height: 96px;
  resize: vertical;
}
.cf__error {
  color: #dc2626;
  font-size: 12px;
}
.cf__banner {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
  font-size: 13px;
}
.cf__currency {
  position: relative;
  display: flex;
  align-items: center;
}
.cf__currency .cf__input {
  padding-left: 24px;
  padding-right: 32px;
}
.cf__currency-prefix,
.cf__currency-suffix {
  position: absolute;
  color: #6b7280;
  font-size: 14px;
  pointer-events: none;
}
.cf__currency-prefix { left: 10px; }
.cf__currency-suffix { right: 10px; }
.cf__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cf__chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
}
.cf__chip--on {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.cf__chip:disabled { opacity: 0.5; cursor: not-allowed; }
.cf__row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.cf__urls { display: flex; flex-direction: column; gap: 8px; }
.cf__url-row { display: flex; gap: 8px; align-items: center; }
.cf__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.cf__btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.cf__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cf__btn--ghost {
  background: #fff;
  color: #2563eb;
}
```

- [ ] **Step 2: Create the form component**

Create `apps/admin-web/src/components/Campaign/CampaignForm.tsx`:

```tsx
import { useState } from "react";
import { CampaignFormSchema, type CampaignForm as Values, type SnsType } from "@jsure/shared";
import { SnsTypeChips } from "./SnsTypeChips";
import { ReferenceMediaUrlList } from "./ReferenceMediaUrlList";
import "./CampaignForm.css";

export const EMPTY_CAMPAIGN_FORM: Values = {
  title: "",
  rewardJpy: 0,
  snsTypes: [],
  condition: "",
  recruitCount: 1,
  recruitStartDate: "",
  recruitEndDate: "",
  productSummary: "",
  productDetailUrl: "",
  guideline: "",
  referenceMediaUrls: [],
  ngItems: "",
  cautions: "",
};

type FieldErrors = Partial<Record<keyof Values, string>> & {
  referenceMediaUrls_items?: Record<number, string>;
};

type Props = {
  initialValue: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  onCancel: () => void;
};

function parseIntegerInput(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const n = Number(raw);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function CampaignForm({ initialValue, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<Values>(initialValue);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const update = <K extends keyof Values>(key: K, v: Values[K]) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const result = CampaignFormSchema.safeParse(values);
    if (!result.success) {
      const next: FieldErrors = {};
      const urlItems: Record<number, string> = {};
      for (const issue of result.error.issues) {
        const [first, second] = issue.path;
        if (first === "referenceMediaUrls" && typeof second === "number") {
          urlItems[second] = issue.message;
        } else if (typeof first === "string") {
          next[first as keyof Values] = issue.message;
        }
      }
      if (Object.keys(urlItems).length > 0) next.referenceMediaUrls_items = urlItems;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (err) {
      setBanner(
        err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const setSns = (next: SnsType[]) => update("snsTypes", next);

  return (
    <form className="cf" onSubmit={handleSubmit} noValidate>
      {banner && <div className="cf__banner">{banner}</div>}

      <section className="cf__section">
        <h2 className="cf__section-title">기본 정보</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-title">캠페인 제목</label>
          <input
            id="cf-title"
            className="cf__input"
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            disabled={submitting}
          />
          {errors.title && <div className="cf__error">{errors.title}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-reward">보수 금액</label>
          <div className="cf__currency">
            <span className="cf__currency-prefix">¥</span>
            <input
              id="cf-reward"
              className="cf__input"
              inputMode="numeric"
              value={Number.isFinite(values.rewardJpy) ? String(values.rewardJpy) : ""}
              onChange={(e) => update("rewardJpy", parseIntegerInput(e.target.value))}
              disabled={submitting}
            />
            <span className="cf__currency-suffix">円</span>
          </div>
          {errors.rewardJpy && <div className="cf__error">{errors.rewardJpy}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label">SNS 종류</label>
          <SnsTypeChips value={values.snsTypes} onChange={setSns} disabled={submitting} />
          {errors.snsTypes && <div className="cf__error">{errors.snsTypes}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-condition">조건</label>
          <input
            id="cf-condition"
            className="cf__input"
            placeholder="예: 팔로워수 1,000명 이상"
            value={values.condition}
            onChange={(e) => update("condition", e.target.value)}
            disabled={submitting}
          />
          {errors.condition && <div className="cf__error">{errors.condition}</div>}
        </div>
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">모집</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-count">모집 인원</label>
          <input
            id="cf-count"
            className="cf__input"
            inputMode="numeric"
            value={Number.isFinite(values.recruitCount) ? String(values.recruitCount) : ""}
            onChange={(e) => update("recruitCount", parseIntegerInput(e.target.value))}
            disabled={submitting}
          />
          {errors.recruitCount && <div className="cf__error">{errors.recruitCount}</div>}
        </div>

        <div className="cf__row-2">
          <div className="cf__field">
            <label className="cf__label" htmlFor="cf-start">모집 시작일</label>
            <input
              id="cf-start"
              type="date"
              className="cf__input"
              value={values.recruitStartDate}
              onChange={(e) => update("recruitStartDate", e.target.value)}
              disabled={submitting}
            />
            {errors.recruitStartDate && (
              <div className="cf__error">{errors.recruitStartDate}</div>
            )}
          </div>
          <div className="cf__field">
            <label className="cf__label" htmlFor="cf-end">모집 종료일</label>
            <input
              id="cf-end"
              type="date"
              className="cf__input"
              value={values.recruitEndDate}
              onChange={(e) => update("recruitEndDate", e.target.value)}
              disabled={submitting}
            />
            {errors.recruitEndDate && (
              <div className="cf__error">{errors.recruitEndDate}</div>
            )}
          </div>
        </div>
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">상품</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-product-summary">상품 개요</label>
          <textarea
            id="cf-product-summary"
            className="cf__textarea"
            value={values.productSummary}
            onChange={(e) => update("productSummary", e.target.value)}
            disabled={submitting}
          />
          {errors.productSummary && (
            <div className="cf__error">{errors.productSummary}</div>
          )}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-product-url">상품 상세 URL (qoo10)</label>
          <input
            id="cf-product-url"
            type="url"
            className="cf__input"
            placeholder="https://www.qoo10.jp/..."
            value={values.productDetailUrl}
            onChange={(e) => update("productDetailUrl", e.target.value)}
            disabled={submitting}
          />
          {errors.productDetailUrl && (
            <div className="cf__error">{errors.productDetailUrl}</div>
          )}
        </div>
      </section>

      <section className="cf__section">
        <h2 className="cf__section-title">가이드라인</h2>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-guideline">안건 개요 (투고 가이드라인)</label>
          <textarea
            id="cf-guideline"
            className="cf__textarea"
            value={values.guideline}
            onChange={(e) => update("guideline", e.target.value)}
            disabled={submitting}
          />
          {errors.guideline && <div className="cf__error">{errors.guideline}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label">투고 참고 영상/사진 URL</label>
          <ReferenceMediaUrlList
            value={values.referenceMediaUrls}
            onChange={(next) => update("referenceMediaUrls", next)}
            disabled={submitting}
            errorByIndex={errors.referenceMediaUrls_items}
          />
          {errors.referenceMediaUrls && (
            <div className="cf__error">{errors.referenceMediaUrls}</div>
          )}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-ng">NG 사항</label>
          <textarea
            id="cf-ng"
            className="cf__textarea"
            value={values.ngItems}
            onChange={(e) => update("ngItems", e.target.value)}
            disabled={submitting}
          />
          {errors.ngItems && <div className="cf__error">{errors.ngItems}</div>}
        </div>

        <div className="cf__field">
          <label className="cf__label" htmlFor="cf-cautions">주의 사항</label>
          <textarea
            id="cf-cautions"
            className="cf__textarea"
            value={values.cautions}
            onChange={(e) => update("cautions", e.target.value)}
            disabled={submitting}
          />
          {errors.cautions && <div className="cf__error">{errors.cautions}</div>}
        </div>
      </section>

      <div className="cf__actions">
        <button
          type="button"
          className="cf__btn cf__btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          취소
        </button>
        <button type="submit" className="cf__btn" disabled={submitting}>
          {submitting ? "저장 중…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @jsure/admin-web typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-web/src/components/Campaign/CampaignForm.tsx apps/admin-web/src/components/Campaign/CampaignForm.css
git commit -m "feat(admin-web): add CampaignForm component"
```

---

## Task 9: admin-web — New page

**Files:**
- Create: `apps/admin-web/src/pages/Campaigns/New.tsx`

- [ ] **Step 1: Create the page**

Create `apps/admin-web/src/pages/Campaigns/New.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import type { CampaignForm as Values } from "@jsure/shared";
import { CampaignForm, EMPTY_CAMPAIGN_FORM } from "../../components/Campaign/CampaignForm";
import { createCampaign } from "../../lib/campaigns";

export function CampaignNew() {
  const navigate = useNavigate();

  const handleSubmit = async (values: Values) => {
    await createCampaign(values);
    navigate("/campaigns");
  };

  return (
    <div className="cmp">
      <div className="cmp__header">
        <h1 className="cmp__title">캠페인 만들기</h1>
        <p className="cmp__subtitle">새 캠페인 정보를 입력하세요.</p>
      </div>
      <CampaignForm
        initialValue={EMPTY_CAMPAIGN_FORM}
        submitLabel="생성"
        onSubmit={handleSubmit}
        onCancel={() => navigate("/campaigns")}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @jsure/admin-web typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web/src/pages/Campaigns/New.tsx
git commit -m "feat(admin-web): add campaign create page"
```

---

## Task 10: admin-web — Edit page

**Files:**
- Create: `apps/admin-web/src/pages/Campaigns/Edit.tsx`

- [ ] **Step 1: Create the page**

Create `apps/admin-web/src/pages/Campaigns/Edit.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CampaignForm as Values } from "@jsure/shared";
import { CampaignForm } from "../../components/Campaign/CampaignForm";
import { getCampaign, updateCampaign } from "../../lib/campaigns";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; initial: Values }
  | { kind: "error"; message: string };

export function CampaignEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ kind: "error", message: "잘못된 경로입니다." });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    getCampaign(id)
      .then((res) => {
        if (cancelled) return;
        const initial: Values = {
          title: res.title,
          rewardJpy: res.rewardJpy,
          snsTypes: res.snsTypes,
          condition: res.condition,
          recruitCount: res.recruitCount,
          recruitStartDate: res.recruitStartDate,
          recruitEndDate: res.recruitEndDate,
          productSummary: res.productSummary,
          productDetailUrl: res.productDetailUrl,
          guideline: res.guideline,
          referenceMediaUrls: res.referenceMediaUrls,
          ngItems: res.ngItems,
          cautions: res.cautions,
        };
        setState({ kind: "ready", initial });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : "캠페인을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const handleSubmit = async (values: Values) => {
    if (!id) return;
    await updateCampaign(id, values);
    navigate("/campaigns");
  };

  if (state.kind === "loading") {
    return <div className="cmp"><div className="cmp__empty">불러오는 중…</div></div>;
  }
  if (state.kind === "error") {
    return (
      <div className="cmp">
        <div className="cmp__empty">
          {state.message}{" "}
          <button
            type="button"
            className="cf__btn cf__btn--ghost"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cmp">
      <div className="cmp__header">
        <h1 className="cmp__title">캠페인 수정</h1>
        <p className="cmp__subtitle">캠페인 정보를 수정하세요.</p>
      </div>
      <CampaignForm
        initialValue={state.initial}
        submitLabel="수정 저장"
        onSubmit={handleSubmit}
        onCancel={() => navigate("/campaigns")}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @jsure/admin-web typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-web/src/pages/Campaigns/Edit.tsx
git commit -m "feat(admin-web): add campaign edit page"
```

---

## Task 11: admin-web — Routes + list page "캠페인 만들기" 버튼

**Files:**
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/pages/Campaigns/index.tsx`

- [ ] **Step 1: Add routes**

Modify `apps/admin-web/src/App.tsx`. Add the imports near existing page imports and add two routes inside the protected route group. The final file:

```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { RequireAuth } from "./components/RequireAuth";
import { Overview } from "./pages/Overview";
import { Campaigns } from "./pages/Campaigns";
import { CampaignNew } from "./pages/Campaigns/New";
import { CampaignEdit } from "./pages/Campaigns/Edit";
import { Applicants } from "./pages/Applicants";
import { Drafts } from "./pages/Drafts";
import { Monitoring } from "./pages/Monitoring";
import { Influencers } from "./pages/Influencers";
import { Brands } from "./pages/Brands";
import { Payouts } from "./pages/Payouts";
import { Reports } from "./pages/Reports";
import { Team } from "./pages/Team";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route path="/overview" element={<Overview />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<CampaignNew />} />
        <Route path="/campaigns/:id/edit" element={<CampaignEdit />} />
        <Route path="/applicants" element={<Applicants />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/influencers" element={<Influencers />} />
        <Route path="/brands" element={<Brands />} />
        <Route path="/payouts" element={<Payouts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/team" element={<Team />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Add "캠페인 만들기" button to list page**

Modify `apps/admin-web/src/pages/Campaigns/index.tsx`. Add `useNavigate` import and a button in the header area.

Add to existing imports:

```ts
import { useNavigate } from "react-router-dom";
```

Inside `Campaigns()` component, near the top of the function body:

```ts
const navigate = useNavigate();
```

Replace the existing `<div className="cmp__header">…</div>` block with:

```tsx
<div className="cmp__header">
  <div>
    <h1 className="cmp__title">캠페인 관리</h1>
    <p className="cmp__subtitle">전체 캠페인의 상태와 진행 현황을 한눈에 확인하세요.</p>
  </div>
  <button
    type="button"
    className="cf__btn"
    onClick={() => navigate("/campaigns/new")}
  >
    캠페인 만들기
  </button>
</div>
```

Then in `apps/admin-web/src/pages/Campaigns/Campaigns.css`, ensure `.cmp__header` becomes a flex row (append if not already):

```css
.cmp__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
```

(만약 `.cmp__header` 규칙이 이미 존재한다면, 위 세 속성만 병합. 다른 속성은 유지.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @jsure/admin-web typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-web/src/App.tsx apps/admin-web/src/pages/Campaigns/index.tsx apps/admin-web/src/pages/Campaigns/Campaigns.css
git commit -m "feat(admin-web): wire campaign create/edit routes"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: 모든 워크스페이스 exit 0.

- [ ] **Step 2: API test suite**

Run: `pnpm --filter @jsure/api test`
Expected: 모든 기존 + 신규 캠페인 테스트 통과.

- [ ] **Step 3: Build admin-web**

Run: `pnpm --filter @jsure/admin-web build`
Expected: exit 0, `dist/` 생성.

- [ ] **Step 4: Manual smoke test (UI)**

Dev 서버 기동:

```bash
pnpm --filter @jsure/api dev &
pnpm --filter @jsure/admin-web dev
```

브라우저에서:
1. 로그인 후 `/campaigns` 진입 → "캠페인 만들기" 버튼 클릭 → `/campaigns/new` 진입.
2. 모든 필드 입력 후 "생성" → `/campaigns` 로 리다이렉트되고 (DB에 row 생성). DB row 확인:
   ```bash
   pnpm --filter @jsure/api exec prisma studio
   ```
3. DB에서 ID 확인 후 `/campaigns/<id>/edit` 직접 진입 → 초기값이 채워지는지 확인 → 임의 필드 수정 → "수정 저장" → 정상 동작 확인.
4. 잘못된 입력(빈 제목, 종료일 < 시작일, 잘못된 URL)으로 시도 → 필드별 에러 메시지 표시 확인.

테스트 결과를 사용자에게 보고. (자동화 인프라 부재로 수동 검수.)

---

## Self-review notes

스펙 §1~§9 전 항목이 위 12개 태스크로 커버됨:
- §2 라우트 → Task 11
- §3.1 shared 스키마 → Task 1
- §3.2 JST 변환 → Task 3 (테스트 포함)
- §3.3 Prisma 모델 → Task 2
- §4 API 엔드포인트 → Task 4
- §5 UI 컴포넌트 → Task 6, 7, 8, 9, 10, 11
- §6 API 클라이언트 → Task 5
- §7 테스트 → Task 3 (shared 단위 테스트는 인프라 부재로 생략 — 스펙 §7과 일치하게 본 plan에서도 제외)
- §8 YAGNI → 본 plan에서 제외 유지

미해결 항목(스펙 §9)은 본 plan 범위 외로 유지.
