# J-WIN 브랜드 계정 1급 엔티티 승격 · 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** X 브랜드 계정을 캠페인과 1:1로 묶인 `BrandXCredential`에서 독립·재사용 가능한 `BrandXAccount`(1:N)로 승격하고, 어드민에 계정 관리 페이지를 추가한다.

**Architecture:** 계정을 독립 엔티티로 두고 캠페인이 `brandAccountId`로 참조. 연동은 계정 단위 OAuth(브랜드가 링크 승인), 토큰 refresh도 계정 단위(공유 복구). 어드민 `/jwin/accounts`에서 계정 추가·재연동, 캠페인 연동 탭에서 계정 선택.

**Tech Stack:** Prisma(jwin-db) · Fastify(jwin-api) · zod(jwin-shared) · React+Vite(admin-web) · vitest(백엔드 유닛)

## Global Constraints

- 커밋 메시지는 **한글**. 대화도 한국어. (CLAUDE.md)
- 코드 규칙: `.claude/CODE_RULES.md` — 특히 §7(로직/UI 분리, 파일당 단일 책임), §8(도메인 시각표현은 composites/), §2(Prisma 모델 직접 반환 금지 — 매퍼 경유).
- admin-web import: 2단계 이상 상대경로(`../../`) 금지, `@/` alias 사용 (no-restricted-imports).
- 변수/파라미터 약어 금지(풀어쓰기). API 예외 message는 한국어.
- **admin-web에는 테스트 러너가 없다.** 프론트 태스크의 검증은 `pnpm --filter @jsure/admin-web typecheck` + `lint` + 라이브 확인. 러너 신설 금지(YAGNI).
- jwin-shared는 CJS 빌드 → 변경 후 `pnpm --filter @jsure/jwin-shared build` 필요(admin-web/jwin-api가 dist 소비).
- 각 태스크 종료 시 `pnpm --filter <touched> typecheck` + `lint` green.
- MVP 미배포 → dev Neon DB만 존재. 마이그레이션은 `prisma migrate reset` 허용(운영 데이터 없음).

---

### Task 1: Prisma 스키마 — BrandXAccount 승격 + 캠페인 참조

**Files:**
- Modify: `packages/jwin-db/prisma/schema.prisma`
- Create(자동): `packages/jwin-db/prisma/migrations/<ts>_brand_account/migration.sql`

**Interfaces:**
- Produces: 모델 `BrandXAccount { id, label, xUserId?(unique), xUsername?, encryptedAccessToken?, encryptedRefreshToken?, accessTokenExpiresAt?, scopes?, refreshFailedAt?, refreshFailCount, createdAt, updatedAt, campaigns[] }` · `BrandCampaign.brandAccountId?` + `brandAccount?` 관계. `BrandXCredential` 삭제, `BrandCampaign.xUserId/xUsername/credential` 삭제.

- [ ] **Step 1: `BrandXCredential` 모델을 `BrandXAccount`로 교체**

`packages/jwin-db/prisma/schema.prisma`에서 `model BrandXCredential { ... }` 전체를 아래로 교체:

```prisma
model BrandXAccount {
  id                    String    @id @default(cuid())
  label                 String    // 운영자 식별용 메모 (예: "코카콜라 재팬 공식")
  xUserId               String?   @unique // 브랜드 승인 후 채워짐 (계정 정체성)
  xUsername             String?
  encryptedAccessToken  String?
  encryptedRefreshToken String?
  accessTokenExpiresAt  DateTime?
  scopes                String?
  refreshFailedAt       DateTime?
  refreshFailCount      Int       @default(0)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  campaigns BrandCampaign[]
}
```

- [ ] **Step 2: `BrandCampaign`에서 연동 필드 제거 + 계정 참조 추가**

`model BrandCampaign`에서 `xUserId`, `xUsername`, `credential BrandXCredential?` 세 줄을 삭제하고 아래를 추가:

```prisma
  brandAccountId String?
  brandAccount   BrandXAccount? @relation(fields: [brandAccountId], references: [id])
```

- [ ] **Step 3: 스키마 검증**

Run: `cd packages/jwin-db && npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀"

- [ ] **Step 4: 마이그레이션 생성 + dev DB 리셋 적용**

Run: `cd packages/jwin-db && npx prisma migrate reset --force && npx prisma migrate dev --name brand_account`
Expected: 마이그레이션 생성·적용 성공(스모크 데이터 폐기). Prisma Client 재생성됨.

- [ ] **Step 5: 커밋**

```bash
git add packages/jwin-db/prisma/schema.prisma packages/jwin-db/prisma/migrations
git commit -m "feat(jwin-db): BrandXAccount 승격 — 캠페인 1:1 credential에서 독립 1:N 계정으로"
```

---

### Task 2: jwin-shared 계약 — 계정 스키마 + 캠페인 필드 변경

**Files:**
- Modify: `packages/jwin-shared/src/adminApi.ts`
- Test: `packages/jwin-shared/src/adminApi.test.ts`

**Interfaces:**
- Consumes: Task 1 모델 형태.
- Produces: `AdminBrandAccountStatusSchema = z.enum(['PENDING','CONNECTED','NEEDS_RECONNECT'])` · `AdminBrandAccountSchema` · `AdminBrandAccountListSchema` · `AdminBrandAccountCreateSchema` · 타입 `AdminBrandAccount`, `AdminBrandAccountList`, `AdminBrandAccountCreate`. `AdminCampaignDetailSchema`에서 `connectUrl` 제거, `brandAccountId: z.string().nullable()` + `brandAccount: AdminBrandAccountSchema.nullable()` 추가. `AdminCampaignCreateSchema`/`AdminCampaignPatchSchema`에 `brandAccountId: z.string().nullable().optional()` 추가.

- [ ] **Step 1: 실패 테스트 작성**

`packages/jwin-shared/src/adminApi.test.ts`에 추가:

```typescript
import { describe, it, expect } from 'vitest';
import {
  AdminBrandAccountSchema,
  AdminBrandAccountCreateSchema,
  AdminCampaignDetailSchema,
} from './adminApi';

describe('AdminBrandAccount 계약', () => {
  it('연동 완료 계정을 파싱한다', () => {
    const parsed = AdminBrandAccountSchema.parse({
      id: 'acc1',
      label: '코카콜라 재팬',
      xUserId: '123',
      xUsername: 'coke_jp',
      status: 'CONNECTED',
      refreshFailCount: 0,
      accessTokenExpiresAt: '2026-09-01T00:00:00.000Z',
      campaignCount: 3,
      connectUrl: 'http://localhost:8080/oauth/brand/start?accountId=acc1',
    });
    expect(parsed.status).toBe('CONNECTED');
  });

  it('대기 계정은 xUserId·토큰만료가 null이어도 파싱된다', () => {
    const parsed = AdminBrandAccountSchema.parse({
      id: 'acc2',
      label: '롯데(신규)',
      xUserId: null,
      xUsername: null,
      status: 'PENDING',
      refreshFailCount: 0,
      accessTokenExpiresAt: null,
      campaignCount: 0,
      connectUrl: 'http://localhost:8080/oauth/brand/start?accountId=acc2',
    });
    expect(parsed.status).toBe('PENDING');
  });

  it('계정 생성 요청은 label만 받는다', () => {
    expect(AdminBrandAccountCreateSchema.parse({ label: '롯데' }).label).toBe('롯데');
  });

  it('캠페인 상세에 brandAccountId가 포함되고 connectUrl은 없다', () => {
    const detail = AdminCampaignDetailSchema.parse({
      id: 'c1', brandName: 'b', slug: 's', status: 'SETUP',
      startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-10T00:00:00.000Z',
      dailyPostTime: '11:00', dailyWinCap: null, prUrl: null,
      winMediaUrl: null, loseMediaUrl: null, dmTemplate: null,
      brandAccountId: null, brandAccount: null,
    });
    expect(detail.brandAccountId).toBeNull();
    expect('connectUrl' in detail).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/jwin-shared test`
Expected: FAIL — `AdminBrandAccountSchema` 등 export 없음.

- [ ] **Step 3: 스키마 구현**

`packages/jwin-shared/src/adminApi.ts`에 추가(파일 상단 `CampaignStatusSchema` 부근):

```typescript
export const AdminBrandAccountStatusSchema = z.enum([
  'PENDING',         // xUserId 없음 (브랜드 승인 전)
  'CONNECTED',       // 연동됨, refresh 정상
  'NEEDS_RECONNECT', // refresh 실패 — 재연동 필요
]);

export const AdminBrandAccountSchema = z.object({
  id: z.string(),
  label: z.string(),
  xUserId: z.string().nullable(),
  xUsername: z.string().nullable(),
  status: AdminBrandAccountStatusSchema,
  refreshFailCount: z.number().int(),
  accessTokenExpiresAt: z.string().nullable(),
  /** 이 계정을 참조하는 캠페인 수 */
  campaignCount: z.number().int(),
  /** 브랜드에게 전달할(추가·재연동 공용) 연동 링크 */
  connectUrl: z.string(),
});
export type AdminBrandAccount = z.infer<typeof AdminBrandAccountSchema>;

export const AdminBrandAccountListSchema = z.object({
  accounts: z.array(AdminBrandAccountSchema),
});
export type AdminBrandAccountList = z.infer<typeof AdminBrandAccountListSchema>;

export const AdminBrandAccountCreateSchema = z.object({
  label: z.string().min(1),
});
export type AdminBrandAccountCreate = z.infer<typeof AdminBrandAccountCreateSchema>;
```

`AdminCampaignDetailSchema`에서 `connectUrl: z.string(),` 줄을 삭제하고 아래로 교체:

```typescript
  brandAccountId: z.string().nullable(),
  brandAccount: AdminBrandAccountSchema.nullable(),
```

`AdminCampaignCreateSchema` 객체에 추가:

```typescript
  brandAccountId: z.string().nullable().optional(),
```

`AdminCampaignPatchSchema`는 `AdminCampaignCreateSchema.partial()` 기반이라 자동 반영됨(별도 수정 불필요 — 확인만).

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/jwin-shared test`
Expected: PASS (기존 테스트 포함 전부).

- [ ] **Step 5: dist 빌드 + 커밋**

```bash
pnpm --filter @jsure/jwin-shared build
git add packages/jwin-shared/src/adminApi.ts packages/jwin-shared/src/adminApi.test.ts
git commit -m "feat(jwin-shared): 브랜드 계정 계약 추가 + 캠페인 상세에 brandAccount 반영"
```

---

### Task 3: jwin-api 매퍼 — toBrandAccount + 캠페인 매퍼를 계정 파생으로

**Files:**
- Modify: `apps/jwin-api/src/routes/adminMappers.ts`
- Test: `apps/jwin-api/src/routes/adminMappers.test.ts`

**Interfaces:**
- Consumes: Task 2 타입 `AdminBrandAccount`, `AdminBrandAccountStatusSchema`.
- Produces:
  - `brandAccountStatus(account): 'PENDING'|'CONNECTED'|'NEEDS_RECONNECT'` (순수 함수)
  - `toBrandAccount(account, campaignCount, connectUrl): AdminBrandAccount`
  - `toCampaignDetail(campaign, brandAccount)` — 시그니처 변경: 두 번째 인자가 `connectUrl: string` → `brandAccount: AdminBrandAccount | null`. campaign에서 xUserId/xUsername 제거, `brandAccountId` 사용.
  - `toCampaignListItem(campaign)` — `xUserId/xUsername/needsReconnect`를 `campaign.brandAccount`에서 파생.

- [ ] **Step 1: 실패 테스트 작성**

`apps/jwin-api/src/routes/adminMappers.test.ts`에 추가:

```typescript
import { brandAccountStatus, toBrandAccount } from './adminMappers';

describe('brandAccountStatus', () => {
  const base = {
    id: 'a', label: 'L', xUserId: null, xUsername: null,
    encryptedAccessToken: null, encryptedRefreshToken: null,
    accessTokenExpiresAt: null, scopes: null,
    refreshFailedAt: null, refreshFailCount: 0,
    createdAt: new Date(), updatedAt: new Date(),
  };
  it('xUserId 없으면 PENDING', () => {
    expect(brandAccountStatus(base)).toBe('PENDING');
  });
  it('연동됐고 refresh 정상이면 CONNECTED', () => {
    expect(brandAccountStatus({ ...base, xUserId: '1', encryptedAccessToken: 'x' })).toBe('CONNECTED');
  });
  it('refreshFailedAt 있으면 NEEDS_RECONNECT', () => {
    expect(brandAccountStatus({ ...base, xUserId: '1', encryptedAccessToken: 'x', refreshFailedAt: new Date() })).toBe('NEEDS_RECONNECT');
  });
  it('toBrandAccount는 토큰 암호문을 노출하지 않는다', () => {
    const dto = toBrandAccount({ ...base, xUserId: '1', xUsername: 'u', encryptedAccessToken: 'secret', accessTokenExpiresAt: new Date('2026-09-01') }, 2, 'http://x/start?accountId=a');
    expect(dto).not.toHaveProperty('encryptedAccessToken');
    expect(dto.campaignCount).toBe(2);
    expect(dto.status).toBe('CONNECTED');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/jwin-api test`
Expected: FAIL — `brandAccountStatus`, `toBrandAccount` 없음.

- [ ] **Step 3: 매퍼 구현**

`apps/jwin-api/src/routes/adminMappers.ts` 상단 import에 `AdminBrandAccount` 추가하고 함수 추가:

```typescript
type BrandAccountRow = {
  id: string;
  label: string;
  xUserId: string | null;
  xUsername: string | null;
  encryptedAccessToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshFailedAt: Date | null;
  refreshFailCount: number;
};

export function brandAccountStatus(
  account: Pick<BrandAccountRow, 'xUserId' | 'encryptedAccessToken' | 'refreshFailedAt'>,
): AdminBrandAccount['status'] {
  if (account.refreshFailedAt) return 'NEEDS_RECONNECT';
  if (account.xUserId && account.encryptedAccessToken) return 'CONNECTED';
  return 'PENDING';
}

export function toBrandAccount(
  account: BrandAccountRow,
  campaignCount: number,
  connectUrl: string,
): AdminBrandAccount {
  return {
    id: account.id,
    label: account.label,
    xUserId: account.xUserId,
    xUsername: account.xUsername,
    status: brandAccountStatus(account),
    refreshFailCount: account.refreshFailCount,
    accessTokenExpiresAt: account.accessTokenExpiresAt
      ? account.accessTokenExpiresAt.toISOString()
      : null,
    campaignCount,
    connectUrl,
  };
}
```

`toCampaignDetail` 시그니처·본문 교체 — 두 번째 인자를 `brandAccount: AdminBrandAccount | null`로 바꾸고, campaign 타입에서 `xUserId/xUsername/credential`을 `brandAccountId: string | null`로 교체. `connectUrl`·`needsReconnect`·`xUserId`·`xUsername` 반환 필드를 제거하고 아래로 교체:

```typescript
    brandAccountId: campaign.brandAccountId,
    brandAccount,
```

`toCampaignListItem` — campaign 타입에서 `xUserId/xUsername/credential`을 `brandAccount: { xUserId, xUsername, refreshFailedAt } | null`로 바꾸고 반환부 교체:

```typescript
    xUserId: campaign.brandAccount?.xUserId ?? null,
    xUsername: campaign.brandAccount?.xUsername ?? null,
    needsReconnect: !!campaign.brandAccount?.refreshFailedAt,
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/jwin-api test`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add apps/jwin-api/src/routes/adminMappers.ts apps/jwin-api/src/routes/adminMappers.test.ts
git commit -m "feat(jwin-api): 브랜드 계정 매퍼 + 캠페인 매퍼를 계정 파생으로 전환"
```

---

### Task 4: jwin-api 엔드포인트 — 계정 목록/생성 + 캠페인 계정 참조

**Files:**
- Modify: `apps/jwin-api/src/routes/admin.ts`

**Interfaces:**
- Consumes: Task 3 `toBrandAccount`, 변경된 `toCampaignDetail`/`toCampaignListItem`.
- Produces: `GET /admin/brand-accounts` → `{ accounts }` · `POST /admin/brand-accounts` `{label}` → `AdminBrandAccount`(connectUrl 포함). `POST`/`PATCH /admin/campaigns`가 `brandAccountId` 수용. 캠페인 목록/상세가 `brandAccount` include로 조회.

- [ ] **Step 1: connectUrl 헬퍼 + 계정 엔드포인트 추가**

`apps/jwin-api/src/routes/admin.ts`의 `adminRoutes` 안에 추가(캠페인 라우트 근처). import에 `toBrandAccount` 추가:

```typescript
  const accountConnectUrl = (accountId: string) =>
    `${config().API_BASE_URL}/oauth/brand/start?accountId=${accountId}`;

  app.get('/admin/brand-accounts', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const accounts = await prisma.brandXAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { campaigns: true } } },
    });
    return {
      accounts: accounts.map((account) =>
        toBrandAccount(account, account._count.campaigns, accountConnectUrl(account.id)),
      ),
    };
  });

  app.post('/admin/brand-accounts', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = z.object({ label: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const account = await prisma.brandXAccount.create({ data: { label: parsed.data.label } });
    await audit(admin, 'brandAccount.create', account.id, parsed.data);
    return toBrandAccount(account, 0, accountConnectUrl(account.id));
  });
```

- [ ] **Step 2: 캠페인 스키마에 brandAccountId 추가 + 조회 include 변경**

`campaignSchema`(POST 본문)에 `brandAccountId: z.string().nullable().optional(),` 추가.

`GET /admin/campaigns`(목록) findMany의 include를 교체:

```typescript
      include: {
        _count: { select: { entries: true } },
        brandAccount: { select: { xUserId: true, xUsername: true, refreshFailedAt: true } },
        posts: { where: { status: 'FAILED' }, select: { id: true } },
      },
```

`GET /admin/campaigns/:id`(상세): `credential` include를 `brandAccount: true`로 바꾸고, 반환을 아래로 교체:

```typescript
    const brandAccount = campaign.brandAccount
      ? toBrandAccount(
          campaign.brandAccount,
          await prisma.brandCampaign.count({ where: { brandAccountId: campaign.brandAccount.id } }),
          accountConnectUrl(campaign.brandAccount.id),
        )
      : null;
    return toCampaignDetail(campaign, brandAccount);
```

`POST /admin/campaigns` 반환도 `toCampaignDetail(campaign, null)`로 교체(신규 캠페인은 계정 미지정). `PATCH /admin/campaigns/:id`: update에 `include: { brandAccount: true }` 유지하고, 반환을 상세와 동일한 `brandAccount` 조립 후 `toCampaignDetail(campaign, brandAccount)`로 교체. `GET /admin/campaigns/:id/stats`의 `credential` include를 `brandAccount: { select: { refreshFailedAt: true } }`로, `needsReconnect: !!campaign.brandAccount?.refreshFailedAt`로 교체.

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @jsure/jwin-api typecheck`
Expected: Done (에러 없음).

- [ ] **Step 4: 라이브 스모크(포지드 토큰)**

Run(jwin-api 기동 상태에서):
```bash
TOKEN=$(cd apps/jwin-api && node -e "console.log(require('jsonwebtoken').sign({sub:'a',email:'info@aposapo.com',role:'OWNER',sid:'s'},process.env.JWT_SECRET||'replace-me-with-a-long-random-string',{expiresIn:'15m'}))")
curl -s -X POST localhost:8080/admin/brand-accounts -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"label":"테스트계정"}'
curl -s localhost:8080/admin/brand-accounts -H "Authorization: Bearer $TOKEN"
```
Expected: 생성 응답에 `status:"PENDING"`, `connectUrl:".../start?accountId=..."`. 목록에 그 계정 1건.

- [ ] **Step 5: 커밋**

```bash
git add apps/jwin-api/src/routes/admin.ts
git commit -m "feat(jwin-api): 브랜드 계정 목록·생성 엔드포인트 + 캠페인 brandAccountId 참조"
```

---

### Task 5: jwin-api OAuth — accountId 기반 연동 + 중복 방지

**Files:**
- Modify: `apps/jwin-api/src/routes/oauth.ts`

**Interfaces:**
- Consumes: Task 1 `BrandXAccount`.
- Produces: `GET /oauth/brand/start?accountId=…`(state에 accountId). `GET /oauth/brand/callback`이 accountId 계정에 토큰 채움, 동일 xUserId가 다른 계정에 있으면 `/connect/failed?reason=duplicate`.

- [ ] **Step 1: brand/start를 accountId 기반으로**

`apps/jwin-api/src/routes/oauth.ts`의 brand/start 핸들러에서 `campaignId` 대신 `accountId`를 querystring으로 받고 state에 저장. 저장 형태는 기존 state 저장 방식을 그대로 따르되 키를 `accountId`로.

- [ ] **Step 2: 콜백을 계정 upsert + 중복 방지로 교체**

brand/callback의 토큰 교환·`/me` 조회 이후 `prisma.brandXCredential.upsert(...)` + `prisma.brandCampaign.update(...)` 2건(Promise.all)을 아래로 교체:

```typescript
      // 동일 X 계정(xUserId)이 다른 계정 row에 이미 연동돼 있으면 중복
      const duplicate = await prisma.brandXAccount.findFirst({
        where: { xUserId: me.data.id, id: { not: saved.accountId } },
      });
      if (duplicate) {
        return reply.redirect(`${config().WEB_BASE_URL}/connect/failed?reason=duplicate`);
      }
      await prisma.brandXAccount.update({
        where: { id: saved.accountId },
        data: {
          xUserId: me.data.id,
          xUsername: me.data.username,
          encryptedAccessToken: encrypt(tokens.accessToken),
          encryptedRefreshToken: encrypt(tokens.refreshToken),
          accessTokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
          refreshFailedAt: null,
          refreshFailCount: 0,
        },
      });
      return reply.redirect(`${config().WEB_BASE_URL}/connect/done?account=${me.data.username}`);
```

(`saved`는 state 복원 결과. 기존 코드의 state 변수명을 따르고 `saved.campaignId` → `saved.accountId`로.)

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @jsure/jwin-api typecheck`
Expected: Done. (구 `brandXCredential` 참조가 남아 있으면 여기서 에러로 드러남 — 전부 제거.)

- [ ] **Step 4: 커밋**

```bash
git add apps/jwin-api/src/routes/oauth.ts
git commit -m "feat(jwin-api): 브랜드 연동을 accountId 기반으로 + 동일 계정 중복 방지"
```

---

### Task 6: jwin-api 소비자 전환 — credential → brandAccount

**Files:**
- Modify: `apps/jwin-api/src/lib/tokens.ts`, `apps/jwin-api/src/services/scheduler.ts`, `apps/jwin-api/src/services/fulfillment.ts`, `apps/jwin-api/src/services/verification.ts`, `apps/jwin-api/src/routes/public.ts`

**Interfaces:**
- Consumes: `BrandXAccount`.
- Produces: `getBrandAccessToken(account: BrandXAccount)` — refresh가 `prisma.brandXAccount.update`로. 게시/DM/검증/LP가 `campaign.brandAccount` 사용.

- [ ] **Step 1: tokens.ts를 계정 기반으로**

`import { getPrisma, BrandXCredential, User }` → `BrandXAccount`. `getBrandAccessToken(cred: BrandXCredential)` → `getBrandAccessToken(account: BrandXAccount)`. 본문에서 `cred` → `account`, `prisma.brandXCredential.update` → `prisma.brandXAccount.update`(2곳). 계정 토큰이 nullable이므로 함수 진입부 가드 추가:

```typescript
export async function getBrandAccessToken(account: BrandXAccount): Promise<string> {
  if (!account.encryptedAccessToken || !account.encryptedRefreshToken || !account.accessTokenExpiresAt) {
    throw new Error('브랜드 계정이 연동되지 않았습니다');
  }
  if (account.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return decrypt(account.encryptedAccessToken);
  }
  // ... 이하 기존 로직, brandXCredential → brandXAccount, cred → account
```

- [ ] **Step 2: scheduler.ts**

`include: { template: true, campaign: { include: { credential: true } } }` → `{ ...include: { brandAccount: true } }`. `const credential = campaign.credential;` → `const brandAccount = campaign.brandAccount;`. 미연동 판정을 `brandAccountStatus`가 아닌 토큰 존재로: `if (!brandAccount || !brandAccount.encryptedAccessToken || !post.template)`. `getBrandAccessToken(credential)` → `getBrandAccessToken(brandAccount)`. 실패 메시지 `'brand not connected'` 유지.

- [ ] **Step 3: fulfillment.ts**

`campaign: { include: { credential: true } }` → `{ include: { brandAccount: true } }`. `const credential = campaign.credential;` → `const brandAccount = campaign.brandAccount;` + 이후 `getBrandAccessToken(brandAccount)` 및 미연동 가드.

- [ ] **Step 4: verification.ts**

`campaign.xUserId` → `campaign.brandAccount?.xUserId`. 캠페인 조회에 `brandAccount: true` include가 없으면 추가. 토큰이 필요하면 `getBrandAccessToken(campaign.brandAccount)`.

- [ ] **Step 5: public.ts (LP)**

캠페인 조회에 `include: { brandAccount: { select: { xUsername: true } } }` 추가. `campaign.xUsername` (3곳: LP 데이터·오늘 포스트 URL) → `campaign.brandAccount?.xUsername`.

- [ ] **Step 6: typecheck + 기존 테스트**

Run: `pnpm --filter @jsure/jwin-api typecheck && pnpm --filter @jsure/jwin-api test`
Expected: Done + 기존 draw/adminMappers 테스트 PASS. (남은 `credential`/`xUserId` 참조가 있으면 typecheck가 잡음.)

- [ ] **Step 7: 커밋**

```bash
git add apps/jwin-api/src/lib/tokens.ts apps/jwin-api/src/services apps/jwin-api/src/routes/public.ts
git commit -m "feat(jwin-api): 게시·DM·검증·LP를 campaign.brandAccount 기반으로 전환"
```

---

### Task 7: admin-web 도메인 — 브랜드 계정 fetch/생성 + 캠페인 계정 지정

**Files:**
- Modify: `apps/admin-web/src/domains/jwin/api.ts`, `apps/admin-web/src/domains/jwin/types.ts`

**Interfaces:**
- Consumes: Task 2 계약(빌드된 dist).
- Produces: `fetchBrandAccounts(): Promise<AdminBrandAccountList>` · `createBrandAccount(label: string): Promise<AdminBrandAccount>`. 타입 재노출 `AdminBrandAccount`, `AdminBrandAccountList`. (`updateCampaign`은 기존 시그니처로 `{ brandAccountId }` 전달 가능 — Patch 타입이 이미 포함.)

- [ ] **Step 1: types.ts 재노출 추가**

`apps/admin-web/src/domains/jwin/types.ts`의 schema export에 `AdminBrandAccountSchema, AdminBrandAccountListSchema, AdminBrandAccountCreateSchema` 추가, type export에 `AdminBrandAccount, AdminBrandAccountList, AdminBrandAccountCreate` 추가.

- [ ] **Step 2: api.ts 함수 추가**

`apps/admin-web/src/domains/jwin/api.ts`에 추가(import에 `AdminBrandAccountListSchema, AdminBrandAccountSchema, type AdminBrandAccountList, type AdminBrandAccount` 추가):

```typescript
export async function fetchBrandAccounts(): Promise<AdminBrandAccountList> {
  const response = await jwinApi.get(`/admin/brand-accounts`);
  return AdminBrandAccountListSchema.parse(response.data);
}

export async function createBrandAccount(label: string): Promise<AdminBrandAccount> {
  const response = await jwinApi.post(`/admin/brand-accounts`, { label });
  return AdminBrandAccountSchema.parse(response.data);
}
```

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @jsure/jwin-shared build && pnpm --filter @jsure/admin-web typecheck`
Expected: Done.

- [ ] **Step 4: 커밋**

```bash
git add apps/admin-web/src/domains/jwin/api.ts apps/admin-web/src/domains/jwin/types.ts
git commit -m "feat(admin-web): J-WIN 브랜드 계정 도메인 fetch/생성 추가"
```

---

### Task 8: admin-web 계정 상태 배지 composite

**Files:**
- Create: `apps/admin-web/src/components/composites/JwinAccountStatusBadge/JwinAccountStatusBadge.tsx`, `.module.css`, `index.ts`
- Modify: `apps/admin-web/src/components/composites/index.ts`

**Interfaces:**
- Consumes: `AdminBrandAccount['status']`.
- Produces: `<JwinAccountStatusBadge status={...} />`.

- [ ] **Step 1: 컴포넌트 작성 (JwinStatusBadge 패턴 복제)**

`JwinAccountStatusBadge.tsx`:

```tsx
import type { AdminBrandAccount } from "@/domains/jwin";
import styles from "./JwinAccountStatusBadge.module.css";

type Status = AdminBrandAccount["status"];

const LABEL: Record<Status, string> = {
  PENDING: "대기",
  CONNECTED: "연동됨",
  NEEDS_RECONNECT: "재연동 필요",
};
const CLASS: Record<Status, string | undefined> = {
  PENDING: styles.pending,
  CONNECTED: styles.connected,
  NEEDS_RECONNECT: styles.reconnect,
};

export function JwinAccountStatusBadge({ status }: { status: Status }) {
  const label = LABEL[status];
  return (
    <span className={`${styles.badge} ${CLASS[status] ?? ""}`} title={label} aria-label={label}>
      {label}
    </span>
  );
}
```

`.module.css`(JwinStatusBadge.module.css 스타일 참고): `.badge`(공통), `.pending`(회색 `#eef2f7`/`#5b6b7c`), `.connected`(초록 그라데이션), `.reconnect`(주황 `#f59e0b`/#fff). `index.ts`: `export { JwinAccountStatusBadge } from "./JwinAccountStatusBadge";`. `composites/index.ts`에 재노출 1줄 추가.

- [ ] **Step 2: typecheck + lint**

Run: `pnpm --filter @jsure/admin-web typecheck && pnpm --filter @jsure/admin-web lint`
Expected: Done.

- [ ] **Step 3: 커밋**

```bash
git add apps/admin-web/src/components/composites/JwinAccountStatusBadge apps/admin-web/src/components/composites/index.ts
git commit -m "feat(admin-web): 브랜드 계정 상태 배지 composite"
```

---

### Task 9: admin-web 브랜드 계정 페이지 (S-accounts)

**Files:**
- Create: `apps/admin-web/src/components/JwinBrandAccounts/jwinBrandAccountTransform.ts`, `useJwinBrandAccountsData.ts`, `useJwinBrandAccountMutations.ts`, `JwinBrandAccountTable.tsx`, `JwinBrandAccountTable.module.css`, `AddBrandAccountDialog.tsx`, `index.ts`
- Create: `apps/admin-web/src/pages/Jwin/BrandAccounts.tsx`
- Modify: `apps/admin-web/src/lib/navigation.ts`, `apps/admin-web/src/App.tsx`

**Interfaces:**
- Consumes: Task 7 `fetchBrandAccounts`, `createBrandAccount`; Task 8 배지.
- Produces: 라우트 `/jwin/accounts` → `<JwinBrandAccounts />`.

- [ ] **Step 1: 데이터 훅 (Phase 3 useJwinCampaignsData 패턴 복제)**

`useJwinBrandAccountsData.ts` — `fetchBrandAccounts()`를 `useEffect`로 로드, `{ state, accounts, reload }` 반환. (기존 `apps/admin-web/src/components/JwinCampaigns/useJwinCampaignsData.ts`를 그대로 본떠 `fetchBrandAccounts` 사용, `state.items`를 `accounts`로.)

- [ ] **Step 2: mutation 훅**

`useJwinBrandAccountMutations.ts` — `createBrandAccount(label)` 호출, `{ creating, error, create }` 반환. 성공 시 생성된 `AdminBrandAccount`(connectUrl 포함) 반환 + `onMutated` 콜백으로 목록 reload 트리거.

```typescript
import { useState } from "react";
import { createBrandAccount, type AdminBrandAccount } from "@/domains/jwin";

export function useJwinBrandAccountMutations(onMutated: () => void) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (label: string): Promise<AdminBrandAccount | null> => {
    setCreating(true);
    setError(null);
    try {
      const account = await createBrandAccount(label);
      onMutated();
      return account;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "계정 생성에 실패했습니다.");
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { creating, error, create };
}
```

- [ ] **Step 3: 테이블 (presentational)**

`JwinBrandAccountTable.tsx` — 열: label / @handle(또는 "미승인") / 상태(JwinAccountStatusBadge) / 사용 캠페인 수 / 연동 링크 복사 버튼. `ScrollTable` + JwinCampaignTable.module.css 스타일 재사용(새 module.css 생성). props: `{ accounts, onCopyLink(url) }`. (복사 성공 표시는 행 내부 로컬 상태 — CODE_RULES §7: presentational이지만 복사 피드백은 자체 UI 상태 허용.)

- [ ] **Step 4: 계정 추가 다이얼로그 (입력 상태 내부 보관)**

`AddBrandAccountDialog.tsx` — `Dialog`(ui) 안에 label 입력(내부 `useState`) → 생성 버튼 → 성공 시 반환된 `connectUrl`을 다이얼로그 내에서 read-only Input + 복사로 표시. props: `{ open, onClose, onCreate(label): Promise<AdminBrandAccount|null> }`. 입력 상태는 절대 부모로 끌어올리지 않는다(§7).

- [ ] **Step 5: 페이지 조립 + index barrel**

`pages/Jwin/BrandAccounts.tsx` — `Campaigns.tsx` 패턴: 헤더(제목 "브랜드 계정", 계정 수, `계정 추가` 버튼) + 카드 안 테이블 + `AddBrandAccountDialog`. `Jwin.module.css` 재사용. `JwinBrandAccounts/index.ts`에서 훅·테이블·다이얼로그 재노출.

- [ ] **Step 6: 네비게이션 + 라우트 추가**

`apps/admin-web/src/lib/navigation.ts`의 J-WIN 메뉴에 `{ path: "/jwin/accounts", label: "브랜드 계정", ... }`를 `캠페인 관리`와 `당첨자 관리` 사이에 추가(기존 J-WIN 항목 형식을 그대로 따름). `App.tsx`에 `<Route path="/jwin/accounts" element={<JwinBrandAccounts />} />` 추가 + import.

- [ ] **Step 7: typecheck + lint**

Run: `pnpm --filter @jsure/admin-web typecheck && pnpm --filter @jsure/admin-web lint`
Expected: Done.

- [ ] **Step 8: 커밋**

```bash
git add apps/admin-web/src/components/JwinBrandAccounts apps/admin-web/src/pages/Jwin/BrandAccounts.tsx apps/admin-web/src/lib/navigation.ts apps/admin-web/src/App.tsx
git commit -m "feat(admin-web): 브랜드 계정 페이지(/jwin/accounts) — 목록·추가·재연동 링크"
```

---

### Task 10: admin-web 캠페인 연동 탭 → 계정 선택 드롭다운

**Files:**
- Modify: `apps/admin-web/src/components/JwinCampaignForm/ConnectTab.tsx`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/useJwinCampaignForm.ts` (계정 목록 로드 or 페이지에서 주입)

**Interfaces:**
- Consumes: Task 7 `fetchBrandAccounts`; `updateCampaign(id, { brandAccountId })`; `detail.brandAccountId`, `detail.brandAccount`.
- Produces: 연동 탭이 계정 선택 드롭다운 + 선택 계정 상태 표시.

- [ ] **Step 1: ConnectTab 교체**

기존 connectUrl 복사 UI를 제거하고: 연동된 계정(`status !== 'PENDING'`) 목록을 `Select`(ui, `options`)로 렌더 → 선택 시 `onSelectAccount(brandAccountId)` 호출(부모가 `updateCampaign` PATCH). 선택된 계정은 `JwinAccountStatusBadge`로 상태 표시. 하단에 "계정 추가·재연동은 브랜드 계정 페이지에서" 안내 + `/jwin/accounts` 링크(`react-router-dom` `Link`). props: `{ detail, accounts, onSelectAccount(id: string): void }`.

```tsx
import { Link } from "react-router-dom";
import { Select } from "@/components/ui";
import { JwinAccountStatusBadge } from "@/components/composites/JwinAccountStatusBadge";
import type { AdminCampaignDetail, AdminBrandAccount } from "@/domains/jwin";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  detail: AdminCampaignDetail;
  accounts: AdminBrandAccount[];
  onSelectAccount: (brandAccountId: string) => void;
};

export function ConnectTab({ detail, accounts, onSelectAccount }: Props) {
  const connectable = accounts.filter((account) => account.status !== "PENDING");
  return (
    <div className={styles.connect}>
      <div className={styles.field}>
        <span className={styles.label}>브랜드 계정</span>
        <Select
          value={detail.brandAccountId ?? ""}
          onChange={(value) => value && onSelectAccount(value)}
          placeholder="계정 선택"
          options={connectable.map((account) => ({
            value: account.id,
            label: account.xUsername ? `@${account.xUsername} (${account.label})` : account.label,
          }))}
        />
      </div>
      {detail.brandAccount && (
        <div className={styles.statusRow}>
          <span className={styles.label}>상태</span>
          <JwinAccountStatusBadge status={detail.brandAccount.status} />
          {detail.brandAccount.xUsername && <span>@{detail.brandAccount.xUsername}</span>}
        </div>
      )}
      <p className={styles.note}>
        계정 추가·재연동은 <Link to="/jwin/accounts">브랜드 계정</Link> 페이지에서 합니다.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 폼 훅에서 계정 목록 로드 + 계정 선택 mutation**

`useJwinCampaignForm.ts`에 `accounts` 상태 + `fetchBrandAccounts()` 로드(edit 모드), `selectAccount(brandAccountId)` = `updateCampaign(campaignId, { brandAccountId })` 후 detail 갱신 추가. 반환 객체에 `accounts`, `selectAccount` 노출. `CampaignEdit.tsx`에서 `<ConnectTab detail={form.detail} accounts={form.accounts} onSelectAccount={form.selectAccount} />`로 연결.

- [ ] **Step 3: typecheck + lint**

Run: `pnpm --filter @jsure/admin-web typecheck && pnpm --filter @jsure/admin-web lint`
Expected: Done.

- [ ] **Step 4: 커밋**

```bash
git add apps/admin-web/src/components/JwinCampaignForm apps/admin-web/src/pages/Jwin/CampaignEdit.tsx
git commit -m "feat(admin-web): 캠페인 연동 탭을 브랜드 계정 선택 드롭다운으로 전환"
```

---

### Task 11: 통합 검증 + DECISIONS 기록

**Files:**
- Modify: `docs/jwin/DECISIONS.md`

- [ ] **Step 1: 전체 typecheck + lint + 백엔드 테스트**

Run:
```bash
pnpm --filter @jsure/jwin-shared build
pnpm --filter @jsure/admin-web --filter @jsure/jwin-api typecheck
pnpm --filter @jsure/admin-web --filter @jsure/jwin-api lint
pnpm --filter @jsure/jwin-api --filter @jsure/jwin-shared test
```
Expected: 전부 green.

- [ ] **Step 2: 라이브 e2e 스모크**

jwin-api(:8080) + admin-web(:5173) 기동. 포지드 토큰으로:
1. `POST /admin/brand-accounts {label}` → 대기 계정 + connectUrl.
2. 실제 X 계정으로 연동 링크 승인 → 계정 `CONNECTED` 전이 확인(`GET /admin/brand-accounts`).
3. 캠페인 생성 후 `PATCH /admin/campaigns/:id {brandAccountId}` → 연결 확인(`GET /admin/campaigns/:id`의 `brandAccount.status==CONNECTED`).
4. 같은 계정을 두 번째 캠페인에도 연결 → 재사용 확인.
5. 브라우저: `/jwin/accounts` 목록·추가 다이얼로그, 캠페인 연동 탭 드롭다운 스크린샷 확인.

- [ ] **Step 3: DECISIONS.md에 D-13 기록**

`docs/jwin/DECISIONS.md`에 D-13 항목 추가: "브랜드 계정을 캠페인과 독립된 1급 엔티티(BrandXAccount, 계정 1:캠페인 N)로 승격. 연동은 계정 단위, 캠페인은 brandAccountId로 참조." + 근거(재사용·refresh 공유·계정 선행 운영순서) 요약.

- [ ] **Step 4: 커밋**

```bash
git add docs/jwin/DECISIONS.md
git commit -m "docs(jwin): D-13 브랜드 계정 1급 엔티티 승격 결정 기록"
```

---

## 자체 검토(작성자 체크)

- **스펙 커버리지**: §3 모델→T1 · §4 OAuth→T5 · §5 API→T2·T4 · §6 소비자→T6 · §7 화면(계정 페이지→T9, 연동 탭→T10, 배지→T8) · §8 마이그레이션→T1 · §9 검증→T11. 전 항목 태스크 존재. ✅
- **타입 일관성**: `brandAccountStatus`/`toBrandAccount`(T3) ↔ 사용처(T4·T8·T10) 이름 일치. `AdminBrandAccount.status` enum(T2) ↔ 배지·드롭다운(T8·T10) 일치. `getBrandAccessToken(account)` 시그니처(T6) ↔ scheduler/fulfillment 호출 일치. ✅
- **미결 참조**: `saved.accountId`(T5)는 state 저장 형태를 accountId로 바꾸는 것에 의존 — T5 Step1에서 명시. ✅
- **비고**: admin-web 테스트 러너 부재로 프론트(T7~T10)는 typecheck+lint+라이브로 검증(Global Constraints 명시).
