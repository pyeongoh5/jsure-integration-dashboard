# J-WIN 어드민 MVP — Phase 0+1+2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** J-WIN 어드민 화면을 붙이기 직전까지 — 환경을 정상화하고, 어드민 API를 zod 계약으로 정리·보강하고, 어드민 셸을 캠페인/당첨자 2메뉴 구조로 정리한다.

**Architecture:** (1) `packages/jwin-shared`에 zod 응답/요청 스키마를 단일 소스로 추가(D-11). (2) `apps/jwin-api`는 Prisma 모델을 그 스키마 모양으로 매핑하는 순수 함수(`adminMappers.ts`)를 거쳐 반환하고, `admin.ts`는 라우팅·검증·감사 로그만 담당한다. (3) 미디어 업로드는 대시보드 R2를 재사용(D-12)해 `apps/api`에 presign 엔드포인트 1개를 추가한다. (4) `apps/admin-web`은 `src/domains/jwin/`에 fetch 계층을 신설하고 셸(네비게이션·라우트)을 정리한다.

**Tech Stack:** TypeScript 모노레포(pnpm workspace, turbo) · Fastify + Prisma(driverAdapters) · zod · vitest(jwin-api) / jest(api) · React + Vite + @tanstack/react-query + axios(admin-web)

## Global Constraints

- 커밋 메시지·주석·문서·UI 문자열은 **한국어**. (CLAUDE.md)
- 변수/파라미터에 약어 금지 — `a`, `e`, `req`, `mut` 등 풀어서. (`req`/`reply`는 Fastify 관례라 기존 코드 유지, 신규 로컬 변수만 적용)
- `git add -A` 금지 — 항상 의도한 파일만 명시 경로로 add.
- API 예외 `message`/`error` 필드는 **한국어** 문장. (code 상수·enum 값은 영문 유지)
- **Prisma 모델을 그대로 응답으로 반환 금지** — jwin-shared 스키마 모양으로 매핑 후 반환. (CODE_RULES §2)
- `winners` 관련 응답에 **복호화 배송지 평문·`encryptedShipping` 암호문을 절대 노출하지 않는다.** 배송지는 전용 엔드포인트 `GET /admin/winners/:id/shipping`로만, 열람을 AuditLog에 남긴다.
- 차별 함의 식별자(`blacklist` 등) 금지 — 중립어 사용.
- 각 Phase 종료 시 `pnpm typecheck` + `pnpm lint` 통과. (MVP_PLAN §5)
- 날짜는 API 경계에서 ISO 문자열(`Date.toISOString()`). JST 입력 → UTC 저장은 기존 규칙 유지.
- admin-web presentational 컴포넌트에서 `api.*`·`useNavigate` 호출 금지, fetch는 hook/도메인 계층에. (CODE_RULES §7 — 이 계획은 화면 전까지라 주로 도메인 계층만 신설)

---

## File Structure

**packages/jwin-shared/**
- Create `src/adminApi.ts` — 어드민 API 응답/요청 zod 스키마 + `z.infer` 타입 (단일 계약 소스)
- Modify `src/index.ts` — `export * from './adminApi'`
- Modify `package.json` — `zod` 의존 추가

**apps/jwin-api/src/routes/**
- Create `adminMappers.ts` — Prisma row → jwin-shared 응답 모양 순수 매퍼 + `canTransitionFulfillment` 전이 가드
- Create `adminMappers.test.ts` — 매퍼·전이가드 유닛 테스트 (vitest, DB 불필요)
- Modify `admin.ts` — ①~⑦ 엔드포인트 추가/수정, 매퍼 경유 반환

**apps/api/** (D-12 — 대시보드 R2 재사용)
- Modify `packages/shared/src/types/uploads.ts` — `JwinMediaUploadPresignRequest/Response` 스키마 + 콘텐츠 타입/용량 상수
- Modify `src/uploads/uploads.service.ts` — `presignJwinMediaUpload`
- Modify `src/uploads/admin-uploads.controller.ts` — `POST /uploads/admin/jwin-media/presign`
- Create `src/uploads/uploads.jwin.spec.ts` — presign 서비스 유닛 테스트 (jest, R2 mock)

**apps/admin-web/src/**
- Create `domains/jwin/types.ts` — jwin-shared 어드민 스키마 재노출
- Create `domains/jwin/api.ts` — `jwinApi` 기반 타입 세이프 fetcher
- Create `pages/Jwin/CampaignEdit.tsx` — 편집/생성 겸용 화면 플레이스홀더 (Phase 3에서 채움)
- Modify `lib/navigation.ts` — J-WIN 사이드바를 `운영`(캠페인/당첨자) 1그룹으로 축소
- Modify `App.tsx` — `/jwin/prizes`·`/jwin/stats` 라우트 제거, `/jwin/campaigns/new`·`/jwin/campaigns/:id` 추가
- Delete `pages/Jwin/Prizes.tsx`, `pages/Jwin/Stats.tsx`
- Modify `package.json` — `@jsure/jwin-shared` 의존 추가

**docs/**
- Modify `docs/jwin/DECISIONS.md` — D-11, D-12 기록

---

## Task 0: 환경 정상화 (Phase 0)

코드 변경이 아니라 **환경 검증**이다. 이후 모든 화면 작업의 전제. `/jwin-api/admin/me`가 200이 아니면 이후 전부 401이 된다.

**Files:**
- Modify: `pnpm-lock.yaml` (bcryptjs 제거분 갱신)

- [ ] **Step 1: 의존성 설치 + 락파일 갱신**

Run:
```bash
cd /Users/pyoh/Desktop/project/jsure-integration-dashboard
pnpm install
git status --short pnpm-lock.yaml
```
Expected: `pnpm-lock.yaml`이 변경됨으로 뜨거나(갱신 필요), 변경 없음(이미 최신).

- [ ] **Step 2: 락파일 변경분만 커밋 (변경 있을 때만)**

```bash
git add pnpm-lock.yaml
git commit -m "chore: bcryptjs 제거분 pnpm-lock 갱신"
```
변경이 없으면 이 스텝은 건너뛴다.

- [ ] **Step 3: JWT_SECRET 동일성 확인 (D-10)**

Run:
```bash
grep JWT_SECRET apps/api/.env apps/jwin-api/.env
```
Expected: 두 파일의 `JWT_SECRET` 값이 **글자까지 동일**. 다르면 같은 값으로 맞춘다(로컬 개발용 임의의 32자 이상 문자열도 무방하되 양쪽 동일해야 함). 플레이스홀더 `replace-me-with-a-long-random-string`가 양쪽에 같으면 로컬 검증엔 충분.

- [ ] **Step 4: 두 서버 기동**

두 개의 터미널에서:
```bash
pnpm dev:admin      # 터미널 A — admin-web + 대시보드 api
pnpm dev:jwin-api   # 터미널 B — jwin-api (:8080)
```
Expected: 둘 다 에러 없이 기동. jwin-api는 `listening on :8080` 류 로그.

- [ ] **Step 5: 인증 관통 확인**

대시보드(admin-web)에 로그인한 뒤, 브라우저 콘솔에서:
```js
fetch('/jwin-api/admin/me', { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } }).then(r => r.status)
```
(토큰 키 이름이 다르면 `localStorage` 확인 — `lib/api.ts`의 `TOKEN_KEY` 참조)
Expected: **200**. 200이 아니면 여기서 멈추고 원인(프록시·JWT_SECRET 불일치)을 먼저 해결한다.

---

## Task 1: D-11 · D-12 결정 기록 (Phase 1)

**Files:**
- Modify: `docs/jwin/DECISIONS.md`

- [ ] **Step 1: 결정 로그 표에 D-11, D-12 두 행 추가**

`docs/jwin/DECISIONS.md`의 결정 로그 표(마지막 D-10 행 다음)에 추가:

```markdown
| D-11 | 어드민 API 계약 | **jwin-shared 공유 zod.** `packages/jwin-shared`에 어드민 응답/요청 zod 스키마를 두고 jwin-api가 그 모양으로 매핑 반환, admin-web은 `.parse()`. `winners` 응답에서 `encryptedShipping` 제거, 배송지는 전용 엔드포인트로 분리(열람 감사) | 대시보드 `@jsure/shared` 관례·CODE_RULES §2와 일치. 서버·프론트 단일 계약 소스로 드리프트 차단. jwin-api는 이미 zod 사용 중이라 도입 부담 낮음 | 2026-07-26 |
| D-12 | 미디어 업로드 | **대시보드 R2 재사용.** `apps/api`에 J-WIN용 presign 엔드포인트 1개 추가, `R2_PUBLIC_BASE_URL`로 만료 없는 공개 URL 발급. admin-web이 업로드 후 최종 공개 URL만 `mediaUrl`로 저장 → jwin-api는 R2 미접촉 | 대시보드 R2 presign/publicUrl 인프라 기존재. jwin-api가 게시 시각마다 fetch하므로 만료 URL이면 후반 게시가 조용히 실패 — 공개 URL 필수. 새 스토리지 운영 회피 | 2026-07-26 |
```

- [ ] **Step 2: 커밋**

```bash
git add docs/jwin/DECISIONS.md
git commit -m "docs(jwin): D-11(API 계약)·D-12(미디어 업로드) 결정 기록"
```

---

## Task 2: jwin-shared 어드민 계약 스키마 (Phase 1)

**Files:**
- Create: `packages/jwin-shared/src/adminApi.ts`
- Modify: `packages/jwin-shared/src/index.ts`
- Modify: `packages/jwin-shared/package.json`
- Test: `packages/jwin-shared/src/adminApi.test.ts`

**Interfaces:**
- Produces: `AdminCampaignDetailSchema`/`AdminCampaignDetail`, `AdminPrizeSchema`/`AdminPrizeListSchema`, `AdminPrizePatchSchema`, `AdminPostTemplateSchema`/`AdminPostTemplateListSchema`, `AdminWinnerSchema`/`AdminWinnerListSchema`, `AdminShippingSchema`, `AdminFulfillmentPatchSchema` 및 각 `z.infer` 타입. enum 스키마 `CampaignStatusSchema`, `PrizeTypeSchema`, `FulfillmentStatusSchema`, `VerificationStatusSchema`.

- [ ] **Step 1: zod 의존 추가**

`packages/jwin-shared/package.json`의 최상위에 `dependencies` 블록 추가 (없으면 신설):
```json
  "dependencies": {
    "zod": "^3.23.8"
  },
```
그리고 설치:
```bash
cd /Users/pyoh/Desktop/project/jsure-integration-dashboard
pnpm install
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `packages/jwin-shared/src/adminApi.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  AdminWinnerSchema,
  AdminCampaignDetailSchema,
  AdminFulfillmentPatchSchema,
} from './adminApi';

describe('어드민 응답 스키마', () => {
  it('당첨자 응답에 배송지 평문·암호문 필드가 없다', () => {
    const shape = Object.keys(AdminWinnerSchema.shape);
    expect(shape).not.toContain('encryptedShipping');
    expect(shape).not.toContain('shipping');
    expect(shape).toContain('hasShipping');
  });

  it('캠페인 상세는 connectUrl·needsReconnect를 포함한다', () => {
    const shape = Object.keys(AdminCampaignDetailSchema.shape);
    expect(shape).toContain('connectUrl');
    expect(shape).toContain('needsReconnect');
  });

  it('이행 상태 PATCH는 유효한 enum만 받는다', () => {
    expect(AdminFulfillmentPatchSchema.safeParse({ fulfillment: 'SHIPPED' }).success).toBe(true);
    expect(AdminFulfillmentPatchSchema.safeParse({ fulfillment: 'BOGUS' }).success).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter @jsure/jwin-shared exec vitest run src/adminApi.test.ts`
Expected: FAIL — `Cannot find module './adminApi'`.
(주: jwin-shared에 vitest 스크립트가 없으면 `pnpm --filter @jsure/jwin-shared exec vitest run` 형태로 직접 실행. vitest 미설치면 Step 5 이후 jwin-api 쪽에서만 검증하고 이 테스트는 생략 가능 — 단 그 경우 Step 2·3을 건너뛴다.)

- [ ] **Step 4: 스키마 구현**

Create `packages/jwin-shared/src/adminApi.ts`:
```ts
import { z } from 'zod';

/**
 * 어드민 API 계약 (D-11) — 요청/응답의 단일 소스.
 * jwin-api는 Prisma 모델을 이 모양으로 매핑해 반환하고, admin-web은 `.parse()`로 받는다.
 * 날짜는 경계에서 ISO 문자열로 주고받는다.
 */

export const CampaignStatusSchema = z.enum(['SETUP', 'ACTIVE', 'PAUSED', 'ENDED']);
export const PrizeTypeSchema = z.enum(['PHYSICAL', 'CODE']);
export const VerificationStatusSchema = z.enum([
  'PENDING',
  'FOLLOW_FAILED',
  'REPOST_FAILED',
  'PASSED',
]);
export const FulfillmentStatusSchema = z.enum([
  'NOT_READY',
  'AWAITING_INFO',
  'READY',
  'DM_SENT',
  'SHIPPED',
  'FAILED',
]);

/** ① GET /admin/campaigns/:id */
export const AdminCampaignDetailSchema = z.object({
  id: z.string(),
  brandName: z.string(),
  slug: z.string(),
  status: CampaignStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  dailyPostTime: z.string(),
  dailyWinCap: z.number().int().nullable(),
  prUrl: z.string().nullable(),
  winMediaUrl: z.string().nullable(),
  loseMediaUrl: z.string().nullable(),
  dmTemplate: z.string().nullable(),
  xUserId: z.string().nullable(),
  xUsername: z.string().nullable(),
  /** 브랜드가 앱 연동을 끊어 재연동이 필요한 상태 */
  needsReconnect: z.boolean(),
  /** 브랜드에게 전달할 X 연동 링크 */
  connectUrl: z.string(),
});
export type AdminCampaignDetail = z.infer<typeof AdminCampaignDetailSchema>;

/** ② GET /admin/campaigns/:id/prizes */
export const AdminPrizeSchema = z.object({
  id: z.string(),
  type: PrizeTypeSchema,
  name: z.string(),
  tier: z.number().int(),
  totalQty: z.number().int(),
  remainingQty: z.number().int(),
  winProbability: z.number(),
  /** CODE 경품의 사용 가능한 코드 재고 수 (PHYSICAL은 0) */
  availableCodeCount: z.number().int(),
});
export type AdminPrize = z.infer<typeof AdminPrizeSchema>;

export const AdminPrizeListSchema = z.object({ prizes: z.array(AdminPrizeSchema) });
export type AdminPrizeList = z.infer<typeof AdminPrizeListSchema>;

/** ③ PATCH /admin/prizes/:id (요청) — 확률·수량 정정 */
export const AdminPrizePatchSchema = z.object({
  name: z.string().min(1).optional(),
  tier: z.number().int().min(1).optional(),
  totalQty: z.number().int().positive().optional(),
  winProbability: z.number().gt(0).lt(1).optional(),
});
export type AdminPrizePatch = z.infer<typeof AdminPrizePatchSchema>;

/** ④ GET /admin/campaigns/:id/post-templates */
export const AdminPostTemplateSchema = z.object({
  id: z.string(),
  label: z.string(),
  bodyText: z.string(),
  mediaUrl: z.string().nullable(),
  activeFrom: z.string(),
  activeTo: z.string(),
  /** 이미 게시에 사용됨 → 삭제 불가 */
  used: z.boolean(),
});
export type AdminPostTemplate = z.infer<typeof AdminPostTemplateSchema>;

export const AdminPostTemplateListSchema = z.object({
  postTemplates: z.array(AdminPostTemplateSchema),
});
export type AdminPostTemplateList = z.infer<typeof AdminPostTemplateListSchema>;

/** 당첨자 목록 항목 — 배송지 평문/암호문 없이 유무(hasShipping)만 노출 */
export const AdminWinnerSchema = z.object({
  id: z.string(),
  dateJst: z.string(),
  xUsername: z.string().nullable(),
  prizeName: z.string(),
  prizeType: PrizeTypeSchema,
  verification: VerificationStatusSchema,
  fulfillment: FulfillmentStatusSchema,
  hasShipping: z.boolean(),
  dmSentAt: z.string().nullable(),
  dmError: z.string().nullable(),
});
export type AdminWinner = z.infer<typeof AdminWinnerSchema>;

export const AdminWinnerListSchema = z.object({ winners: z.array(AdminWinnerSchema) });
export type AdminWinnerList = z.infer<typeof AdminWinnerListSchema>;

/** ⑥ GET /admin/winners/:id/shipping — 복호화 배송지 (열람 감사 대상) */
export const AdminShippingSchema = z.object({
  winnerId: z.string(),
  shipping: z.record(z.string(), z.unknown()).nullable(),
  shippingEnteredAt: z.string().nullable(),
});
export type AdminShipping = z.infer<typeof AdminShippingSchema>;

/** ⑦ PATCH /admin/winners/:id/fulfillment (요청) */
export const AdminFulfillmentPatchSchema = z.object({
  fulfillment: FulfillmentStatusSchema,
});
export type AdminFulfillmentPatch = z.infer<typeof AdminFulfillmentPatchSchema>;
```

- [ ] **Step 5: index.ts에서 재노출**

`packages/jwin-shared/src/index.ts` 최상단(기존 export들 위 또는 아래)에 추가:
```ts
export * from './adminApi';
```

- [ ] **Step 6: 빌드 + 테스트 통과 확인**

Run:
```bash
pnpm --filter @jsure/jwin-shared build
pnpm --filter @jsure/jwin-shared exec vitest run src/adminApi.test.ts
```
Expected: 빌드 성공, 테스트 PASS. (vitest 미설치로 Step 3을 건너뛰었다면 빌드 성공만 확인.)

- [ ] **Step 7: 커밋**

```bash
git add packages/jwin-shared/src/adminApi.ts packages/jwin-shared/src/index.ts packages/jwin-shared/package.json packages/jwin-shared/src/adminApi.test.ts pnpm-lock.yaml
git commit -m "feat(jwin-shared): 어드민 API 응답·요청 zod 계약 스키마 추가 (D-11)"
```

---

## Task 3: jwin-api 순수 매퍼 + 이행 전이 가드 (Phase 1) — 핵심 TDD

Prisma row → jwin-shared 응답 모양 변환과 이행 상태 전이 판정을 순수 함수로 분리한다. 라우트 핸들러는 DB에 의존하지만 이 로직은 순수하므로 여기서 집중 테스트한다.

**Files:**
- Create: `apps/jwin-api/src/routes/adminMappers.ts`
- Test: `apps/jwin-api/src/routes/adminMappers.test.ts`

**Interfaces:**
- Consumes: `@jsure/jwin-shared`의 스키마·타입 (Task 2).
- Produces:
  - `toCampaignDetail(campaign, connectUrl: string): AdminCampaignDetail`
  - `toPrize(prize, availableCodeCount: number): AdminPrize`
  - `toPostTemplate(template, used: boolean): AdminPostTemplate`
  - `toWinner(winner): AdminWinner`
  - `canTransitionFulfillment(from: FulfillmentStatus, to: FulfillmentStatus): boolean`
  - `decryptShipping(encrypted: string | null): Record<string, unknown> | null`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `apps/jwin-api/src/routes/adminMappers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SESSION_SECRET = 'test-secret-test-secret';
process.env.JWT_SECRET = 'test-jwt-secret-test-jwt';
process.env.X_CLIENT_ID = 'x';
process.env.X_CLIENT_SECRET = 'x';

describe('toWinner', () => {
  it('암호문을 노출하지 않고 hasShipping 불리언만 준다', async () => {
    const { toWinner } = await import('./adminMappers');
    const row = {
      id: 'w1',
      verification: 'PASSED',
      fulfillment: 'READY',
      encryptedShipping: 'ENCRYPTED_BLOB',
      dmSentAt: null,
      dmError: null,
      prize: { name: '아마존 1만엔', type: 'CODE' },
      entry: { dateJst: '2026-08-01', user: { xUsername: 'tester' } },
    };
    const mapped = toWinner(row as never);
    expect(mapped.hasShipping).toBe(true);
    expect(mapped.xUsername).toBe('tester');
    expect(mapped.prizeName).toBe('아마존 1만엔');
    expect(JSON.stringify(mapped)).not.toContain('ENCRYPTED_BLOB');
  });

  it('배송지가 없으면 hasShipping=false', async () => {
    const { toWinner } = await import('./adminMappers');
    const row = {
      id: 'w2',
      verification: 'PENDING',
      fulfillment: 'AWAITING_INFO',
      encryptedShipping: null,
      dmSentAt: null,
      dmError: null,
      prize: { name: '텀블러', type: 'PHYSICAL' },
      entry: { dateJst: '2026-08-01', user: { xUsername: null } },
    };
    expect(toWinner(row as never).hasShipping).toBe(false);
  });
});

describe('canTransitionFulfillment', () => {
  it('허용 전이만 통과한다', async () => {
    const { canTransitionFulfillment } = await import('./adminMappers');
    expect(canTransitionFulfillment('READY', 'SHIPPED')).toBe(true);
    expect(canTransitionFulfillment('AWAITING_INFO', 'READY')).toBe(true);
  });

  it('허용되지 않은 전이는 막는다', async () => {
    const { canTransitionFulfillment } = await import('./adminMappers');
    expect(canTransitionFulfillment('NOT_READY', 'SHIPPED')).toBe(false);
    expect(canTransitionFulfillment('SHIPPED', 'READY')).toBe(false);
    expect(canTransitionFulfillment('READY', 'DM_SENT')).toBe(false);
  });
});

describe('toCampaignDetail', () => {
  it('needsReconnect를 credential.refreshFailedAt로 판정하고 connectUrl을 담는다', async () => {
    const { toCampaignDetail } = await import('./adminMappers');
    const campaign = {
      id: 'c1',
      brandName: 'B',
      slug: 'b-slug',
      status: 'ACTIVE',
      startsAt: new Date('2026-08-01T00:00:00Z'),
      endsAt: new Date('2026-08-10T00:00:00Z'),
      dailyPostTime: '11:00',
      dailyWinCap: null,
      prUrl: null,
      winMediaUrl: null,
      loseMediaUrl: null,
      dmTemplate: null,
      xUserId: 'x123',
      xUsername: 'brandx',
      credential: { refreshFailedAt: new Date() },
    };
    const mapped = toCampaignDetail(campaign as never, 'https://api/oauth/brand/start?campaignId=c1');
    expect(mapped.needsReconnect).toBe(true);
    expect(mapped.connectUrl).toContain('campaignId=c1');
    expect(mapped.startsAt).toBe('2026-08-01T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @jsure/jwin-api exec vitest run src/routes/adminMappers.test.ts`
Expected: FAIL — `Cannot find module './adminMappers'`.

- [ ] **Step 3: 매퍼 구현**

Create `apps/jwin-api/src/routes/adminMappers.ts`:
```ts
import type {
  AdminCampaignDetail,
  AdminPrize,
  AdminPostTemplate,
  AdminWinner,
  FulfillmentStatusSchema,
} from '@jsure/jwin-shared';
import type { z } from 'zod';
import { decrypt } from '../lib/crypto';

type FulfillmentStatus = z.infer<typeof FulfillmentStatusSchema>;

/** 이행 상태의 허용 전이 (D-2·§4-⑦). 그 외 전이는 전부 거부. */
const ALLOWED_FULFILLMENT_TRANSITIONS: Record<string, FulfillmentStatus[]> = {
  AWAITING_INFO: ['READY'],
  READY: ['SHIPPED'],
};

export function canTransitionFulfillment(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean {
  return ALLOWED_FULFILLMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function toCampaignDetail(
  campaign: {
    id: string;
    brandName: string;
    slug: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
    dailyPostTime: string;
    dailyWinCap: number | null;
    prUrl: string | null;
    winMediaUrl: string | null;
    loseMediaUrl: string | null;
    dmTemplate: string | null;
    xUserId: string | null;
    xUsername: string | null;
    credential?: { refreshFailedAt: Date | null } | null;
  },
  connectUrl: string,
): AdminCampaignDetail {
  return {
    id: campaign.id,
    brandName: campaign.brandName,
    slug: campaign.slug,
    status: campaign.status as AdminCampaignDetail['status'],
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    dailyPostTime: campaign.dailyPostTime,
    dailyWinCap: campaign.dailyWinCap,
    prUrl: campaign.prUrl,
    winMediaUrl: campaign.winMediaUrl,
    loseMediaUrl: campaign.loseMediaUrl,
    dmTemplate: campaign.dmTemplate,
    xUserId: campaign.xUserId,
    xUsername: campaign.xUsername,
    needsReconnect: !!campaign.credential?.refreshFailedAt,
    connectUrl,
  };
}

export function toPrize(
  prize: {
    id: string;
    type: string;
    name: string;
    tier: number;
    totalQty: number;
    remainingQty: number;
    winProbability: number;
  },
  availableCodeCount: number,
): AdminPrize {
  return {
    id: prize.id,
    type: prize.type as AdminPrize['type'],
    name: prize.name,
    tier: prize.tier,
    totalQty: prize.totalQty,
    remainingQty: prize.remainingQty,
    winProbability: prize.winProbability,
    availableCodeCount,
  };
}

export function toPostTemplate(
  template: {
    id: string;
    label: string;
    bodyText: string;
    mediaUrl: string | null;
    activeFrom: Date;
    activeTo: Date;
  },
  used: boolean,
): AdminPostTemplate {
  return {
    id: template.id,
    label: template.label,
    bodyText: template.bodyText,
    mediaUrl: template.mediaUrl,
    activeFrom: template.activeFrom.toISOString(),
    activeTo: template.activeTo.toISOString(),
    used,
  };
}

export function toWinner(winner: {
  id: string;
  verification: string;
  fulfillment: string;
  encryptedShipping: string | null;
  dmSentAt: Date | null;
  dmError: string | null;
  prize: { name: string; type: string };
  entry: { dateJst: string; user: { xUsername: string | null } };
}): AdminWinner {
  return {
    id: winner.id,
    dateJst: winner.entry.dateJst,
    xUsername: winner.entry.user.xUsername,
    prizeName: winner.prize.name,
    prizeType: winner.prize.type as AdminWinner['prizeType'],
    verification: winner.verification as AdminWinner['verification'],
    fulfillment: winner.fulfillment as AdminWinner['fulfillment'],
    hasShipping: !!winner.encryptedShipping,
    dmSentAt: winner.dmSentAt ? winner.dmSentAt.toISOString() : null,
    dmError: winner.dmError,
  };
}

/** 배송지 복호화. 저장 형식은 암호화된 JSON 문자열. */
export function decryptShipping(encrypted: string | null): Record<string, unknown> | null {
  if (!encrypted) return null;
  return JSON.parse(decrypt(encrypted)) as Record<string, unknown>;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/jwin-api exec vitest run src/routes/adminMappers.test.ts`
Expected: PASS (전 케이스).

- [ ] **Step 5: 커밋**

```bash
git add apps/jwin-api/src/routes/adminMappers.ts apps/jwin-api/src/routes/adminMappers.test.ts
git commit -m "feat(jwin-api): 어드민 응답 순수 매퍼·이행 전이 가드 추가"
```

---

## Task 4: 조회 엔드포인트 ①②④ + 목록 매핑 (Phase 1)

캠페인 상세·경품 목록·소재 목록을 매퍼 경유로 반환한다.

**Files:**
- Modify: `apps/jwin-api/src/routes/admin.ts`

**Interfaces:**
- Consumes: `adminMappers`의 `toCampaignDetail`/`toPrize`/`toPostTemplate` (Task 3), `@jsure/jwin-shared` 스키마.
- Produces:
  - `GET /admin/campaigns/:id` → `AdminCampaignDetail`
  - `GET /admin/campaigns/:id/prizes` → `AdminPrizeList`
  - `GET /admin/campaigns/:id/post-templates` → `AdminPostTemplateList`

- [ ] **Step 1: import 추가**

`apps/jwin-api/src/routes/admin.ts` 상단 import 블록에 추가:
```ts
import { toCampaignDetail, toPrize, toPostTemplate } from './adminMappers';
```

- [ ] **Step 2: ① 캠페인 상세 엔드포인트 추가**

`app.get('/admin/campaigns', ...)` 블록 **다음**에 삽입:
```ts
  // ① 편집 폼 초기값 — 연동 상태·connectUrl 포함
  app.get<{ Params: { id: string } }>('/admin/campaigns/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const campaign = await prisma.brandCampaign.findUnique({
      where: { id: req.params.id },
      include: { credential: { select: { refreshFailedAt: true } } },
    });
    if (!campaign) return reply.code(404).send({ error: '캠페인을 찾을 수 없습니다' });
    const connectUrl = `${config().API_BASE_URL}/oauth/brand/start?campaignId=${campaign.id}`;
    return toCampaignDetail(campaign, connectUrl);
  });
```

- [ ] **Step 3: ② 경품 목록 엔드포인트 추가**

Step 2 블록 다음에 삽입:
```ts
  // ② 경품 목록 — id·확률·유형·코드 재고 포함
  app.get<{ Params: { id: string } }>('/admin/campaigns/:id/prizes', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const prizes = await prisma.prize.findMany({
      where: { campaignId: req.params.id },
      orderBy: { tier: 'asc' },
    });
    const withCounts = await Promise.all(
      prizes.map(async (prize) => {
        const availableCodeCount =
          prize.type === 'CODE'
            ? await prisma.prizeCode.count({ where: { prizeId: prize.id, status: 'AVAILABLE' } })
            : 0;
        return toPrize(prize, availableCodeCount);
      }),
    );
    return { prizes: withCounts };
  });
```

- [ ] **Step 4: ④ 소재 목록 엔드포인트 추가**

Step 3 블록 다음에 삽입:
```ts
  // ④ 포스트 소재 목록 — 커버리지 검사·삭제 가능 여부(used)용
  app.get<{ Params: { id: string } }>(
    '/admin/campaigns/:id/post-templates',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const templates = await prisma.postTemplate.findMany({
        where: { campaignId: req.params.id },
        orderBy: { activeFrom: 'asc' },
        include: { _count: { select: { posts: true } } },
      });
      return {
        postTemplates: templates.map((template) =>
          toPostTemplate(template, template._count.posts > 0),
        ),
      };
    },
  );
```

- [ ] **Step 5: 타입체크 + 무인증 401 확인**

Run:
```bash
pnpm --filter @jsure/jwin-api typecheck
```
Expected: 통과.

서버 기동 상태에서:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/admin/campaigns/anyid
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/admin/campaigns/anyid/prizes
```
Expected: 각각 **401** (인증 없음).

- [ ] **Step 6: 커밋**

```bash
git add apps/jwin-api/src/routes/admin.ts
git commit -m "feat(jwin-api): 캠페인 상세·경품·소재 조회 엔드포인트 (①②④)"
```

---

## Task 5: 당첨자 목록 정리 + 배송지 열람 ⑥ + 이행 처리 ⑦ (Phase 1)

**필수 보안 작업**: 당첨자 목록에서 `encryptedShipping` 노출 제거, 배송지는 전용 엔드포인트로만.

**Files:**
- Modify: `apps/jwin-api/src/routes/admin.ts`

**Interfaces:**
- Consumes: `toWinner`, `decryptShipping`, `canTransitionFulfillment` (Task 3).
- Produces:
  - `GET /admin/campaigns/:id/winners` → `AdminWinnerList` (encryptedShipping 미노출)
  - `GET /admin/winners/:id/shipping` → `AdminShipping` (열람 감사)
  - `PATCH /admin/winners/:id/fulfillment` → `AdminWinner`

- [ ] **Step 1: import 확장**

Task 4에서 추가한 import 줄을 확장:
```ts
import {
  toCampaignDetail,
  toPrize,
  toPostTemplate,
  toWinner,
  decryptShipping,
  canTransitionFulfillment,
} from './adminMappers';
import { decrypt } from '../lib/crypto';
```
(주: `encrypt`는 이미 import돼 있다. `decrypt`만 추가. 이미 있으면 중복 제거.)

- [ ] **Step 2: 기존 winners 엔드포인트를 매핑 방식으로 교체**

`app.get<{ Params: { id: string } }>('/admin/campaigns/:id/winners', ...)` 블록 전체를 아래로 교체:
```ts
  // 당첨자 목록 (이행 처리용) — 배송지 평문/암호문 미노출 (D-11)
  app.get<{ Params: { id: string } }>('/admin/campaigns/:id/winners', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const winners = await prisma.winner.findMany({
      where: { entry: { campaignId: req.params.id } },
      select: {
        id: true,
        verification: true,
        fulfillment: true,
        encryptedShipping: true,
        dmSentAt: true,
        dmError: true,
        prize: { select: { name: true, type: true } },
        entry: { select: { dateJst: true, user: { select: { xUsername: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { winners: winners.map(toWinner) };
  });
```
(주: `encryptedShipping`은 `hasShipping` 판정에만 쓰이고 `toWinner`가 응답에서 제거한다.)

- [ ] **Step 3: ⑥ 배송지 열람 엔드포인트 추가 (감사 로그)**

Step 2 블록 다음에 삽입:
```ts
  // ⑥ 배송지 복호화 열람 — 개인정보이므로 열람 자체를 감사 로그에 남긴다
  app.get<{ Params: { id: string } }>('/admin/winners/:id/shipping', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const winner = await prisma.winner.findUnique({
      where: { id: req.params.id },
      select: { id: true, encryptedShipping: true, shippingEnteredAt: true },
    });
    if (!winner) return reply.code(404).send({ error: '당첨자를 찾을 수 없습니다' });
    await audit(admin, 'winner.shipping_view', winner.id);
    return {
      winnerId: winner.id,
      shipping: decryptShipping(winner.encryptedShipping),
      shippingEnteredAt: winner.shippingEnteredAt
        ? winner.shippingEnteredAt.toISOString()
        : null,
    };
  });
```

- [ ] **Step 4: ⑦ 이행 상태 처리 엔드포인트 추가**

Step 3 블록 다음에 삽입:
```ts
  // ⑦ 이행 처리 — 허용 전이만: AWAITING_INFO→READY, READY→SHIPPED
  app.patch<{ Params: { id: string } }>(
    '/admin/winners/:id/fulfillment',
    async (req, reply) => {
      const admin = requireAdmin(req, reply);
      if (!admin) return;
      const parsed = z
        .object({ fulfillment: z.enum(['NOT_READY', 'AWAITING_INFO', 'READY', 'DM_SENT', 'SHIPPED', 'FAILED']) })
        .safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const winner = await prisma.winner.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          verification: true,
          fulfillment: true,
          encryptedShipping: true,
          dmSentAt: true,
          dmError: true,
          prize: { select: { name: true, type: true } },
          entry: { select: { dateJst: true, user: { select: { xUsername: true } } } },
        },
      });
      if (!winner) return reply.code(404).send({ error: '당첨자를 찾을 수 없습니다' });
      if (!canTransitionFulfillment(winner.fulfillment, parsed.data.fulfillment)) {
        return reply
          .code(409)
          .send({ error: `이행 상태를 ${winner.fulfillment}에서 ${parsed.data.fulfillment}(으)로 바꿀 수 없습니다` });
      }
      const updated = await prisma.winner.update({
        where: { id: winner.id },
        data: { fulfillment: parsed.data.fulfillment },
        select: {
          id: true,
          verification: true,
          fulfillment: true,
          encryptedShipping: true,
          dmSentAt: true,
          dmError: true,
          prize: { select: { name: true, type: true } },
          entry: { select: { dateJst: true, user: { select: { xUsername: true } } } },
        },
      });
      await audit(admin, 'winner.fulfillment', winner.id, { fulfillment: parsed.data.fulfillment });
      return toWinner(updated);
    },
  );
```

- [ ] **Step 5: 타입체크 + 401 확인**

Run: `pnpm --filter @jsure/jwin-api typecheck`
Expected: 통과.

서버 기동 상태에서:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/admin/winners/anyid/shipping
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:8080/admin/winners/anyid/fulfillment
```
Expected: 각각 **401**.

- [ ] **Step 6: 커밋**

```bash
git add apps/jwin-api/src/routes/admin.ts
git commit -m "feat(jwin-api): 당첨자 목록 배송지 비노출화 + 배송지 열람·이행 처리 (⑥⑦)"
```

---

## Task 6: 경품 수정 ③ + 소재 삭제 ⑤ (Phase 1)

**Files:**
- Modify: `apps/jwin-api/src/routes/admin.ts`

**Interfaces:**
- Produces:
  - `PATCH /admin/prizes/:id` → 수정된 `AdminPrize`
  - `DELETE /admin/post-templates/:id` → `{ deleted: true }`

- [ ] **Step 1: ③ 경품 수정 엔드포인트 추가**

기존 `app.post<{ Params: { id: string } }>('/admin/prizes/:id/codes', ...)` 블록 다음에 삽입:
```ts
  // ③ 경품 정정 (확률·수량·이름·티어). 수량을 줄일 때 잔여 재고가 음수가 되지 않도록 검증.
  app.patch<{ Params: { id: string } }>('/admin/prizes/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        tier: z.number().int().min(1).optional(),
        totalQty: z.number().int().positive().optional(),
        winProbability: z.number().gt(0).lt(1).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const prize = await prisma.prize.findUnique({ where: { id: req.params.id } });
    if (!prize) return reply.code(404).send({ error: '경품을 찾을 수 없습니다' });

    // 수량 정정 시 이미 소진된 양(totalQty - remainingQty)보다 작게 줄일 수 없다.
    let remainingQty = prize.remainingQty;
    if (parsed.data.totalQty !== undefined) {
      const consumed = prize.totalQty - prize.remainingQty;
      if (parsed.data.totalQty < consumed) {
        return reply
          .code(400)
          .send({ error: `이미 배정된 수량(${consumed})보다 적게 줄일 수 없습니다` });
      }
      remainingQty = parsed.data.totalQty - consumed;
    }

    const updated = await prisma.prize.update({
      where: { id: prize.id },
      data: { ...parsed.data, remainingQty },
    });
    await audit(admin, 'prize.update', prize.id, parsed.data);

    const availableCodeCount =
      updated.type === 'CODE'
        ? await prisma.prizeCode.count({ where: { prizeId: updated.id, status: 'AVAILABLE' } })
        : 0;
    return toPrize(updated, availableCodeCount);
  });
```

- [ ] **Step 2: ⑤ 소재 삭제 엔드포인트 추가**

Step 1 블록 다음에 삽입:
```ts
  // ⑤ 소재 삭제 — 이미 게시에 사용된 소재는 거부 (CampaignPost.templateId 참조)
  app.delete<{ Params: { id: string } }>('/admin/post-templates/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const usedCount = await prisma.campaignPost.count({ where: { templateId: req.params.id } });
    if (usedCount > 0) {
      return reply.code(409).send({ error: '이미 게시에 사용된 소재는 삭제할 수 없습니다' });
    }
    await prisma.postTemplate.delete({ where: { id: req.params.id } });
    await audit(admin, 'template.delete', req.params.id);
    return { deleted: true };
  });
```

- [ ] **Step 3: 타입체크 + 401 확인 + 전체 테스트**

Run:
```bash
pnpm --filter @jsure/jwin-api typecheck
pnpm --filter @jsure/jwin-api test
```
Expected: 타입체크 통과, 기존 `draw.test.ts` + `adminMappers.test.ts` 전부 PASS.

서버 기동 상태:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:8080/admin/prizes/anyid
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/admin/post-templates/anyid
```
Expected: 각각 **401**.

- [ ] **Step 4: 커밋**

```bash
git add apps/jwin-api/src/routes/admin.ts
git commit -m "feat(jwin-api): 경품 정정·소재 삭제 엔드포인트 (③⑤)"
```

---

## Task 7: 대시보드 R2 J-WIN 미디어 presign (Phase 1, D-12)

대시보드 R2를 재사용해 J-WIN 미디어(이미지·동영상) presign 엔드포인트를 추가한다. `publicUrl`이 null이면 **즉시 실패**시켜, 만료되는 URL로 캠페인 후반 게시가 조용히 깨지는 사고를 원천 차단한다.

**Files:**
- Modify: `packages/shared/src/types/uploads.ts`
- Modify: `apps/api/src/uploads/uploads.service.ts`
- Modify: `apps/api/src/uploads/admin-uploads.controller.ts`
- Test: `apps/api/src/uploads/uploads.jwin.spec.ts`

**Interfaces:**
- Produces: `JwinMediaUploadPresignRequestSchema`/`Response`, `UploadsService.presignJwinMediaUpload`, `POST /uploads/admin/jwin-media/presign`.

- [ ] **Step 1: shared 스키마 추가**

`packages/shared/src/types/uploads.ts` 끝에 추가:
```ts
/** J-WIN 캠페인 포스트 미디어 — 이미지 + 동영상(mp4). X 게시 시각에 jwin-api가 fetch. */
export const JWIN_MEDIA_MAX_BYTES = 100 * 1024 * 1024; // 100MB
export const JWIN_MEDIA_ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
] as const;
export const JwinMediaContentTypeSchema = z.enum(JWIN_MEDIA_ALLOWED_CONTENT_TYPES);
export type JwinMediaContentType = z.infer<typeof JwinMediaContentTypeSchema>;

export const JwinMediaUploadPresignRequestSchema = z.object({
  contentType: JwinMediaContentTypeSchema,
  sizeBytes: z.number().int().positive().max(JWIN_MEDIA_MAX_BYTES),
});
export type JwinMediaUploadPresignRequest = z.infer<
  typeof JwinMediaUploadPresignRequestSchema
>;

export const JwinMediaUploadPresignResponseSchema = z.object({
  objectKey: z.string(),
  uploadUrl: z.string().url(),
  /** 만료 없는 공개 URL (R2_PUBLIC_BASE_URL 필수) */
  viewUrl: z.string().url(),
  expiresInSec: z.number().int().positive(),
});
export type JwinMediaUploadPresignResponse = z.infer<
  typeof JwinMediaUploadPresignResponseSchema
>;
```

- [ ] **Step 2: shared 빌드**

Run: `pnpm --filter @jsure/shared build`
Expected: 성공.

- [ ] **Step 3: 실패하는 서비스 테스트 작성**

Create `apps/api/src/uploads/uploads.jwin.spec.ts`:
```ts
import { InternalServerErrorException } from "@nestjs/common";
import { UploadsService } from "./uploads.service";

function makeService(publicUrl: string | null) {
  const r2 = {
    presignPut: jest.fn().mockResolvedValue("https://r2/put?sig=1"),
    publicUrl: jest.fn().mockReturnValue(publicUrl),
  };
  const prisma = {} as never;
  return { service: new UploadsService(prisma, r2 as never), r2 };
}

describe("presignJwinMediaUpload", () => {
  it("공개 URL이 있으면 viewUrl로 반환한다", async () => {
    const { service } = makeService("https://cdn.example.com/jwin/media/x.mp4");
    const result = await service.presignJwinMediaUpload({
      contentType: "video/mp4",
      sizeBytes: 1024,
    });
    expect(result.viewUrl).toBe("https://cdn.example.com/jwin/media/x.mp4");
    expect(result.uploadUrl).toContain("https://r2/put");
  });

  it("R2_PUBLIC_BASE_URL 미설정(publicUrl=null)이면 실패시킨다", async () => {
    const { service } = makeService(null);
    await expect(
      service.presignJwinMediaUpload({ contentType: "image/png", sizeBytes: 1024 }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `pnpm --filter @jsure/api exec jest src/uploads/uploads.jwin.spec.ts`
Expected: FAIL — `presignJwinMediaUpload is not a function`.

- [ ] **Step 5: 서비스 구현**

`apps/api/src/uploads/uploads.service.ts`:

(a) import에 `InternalServerErrorException` 추가 (기존 `@nestjs/common` import 블록):
```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
```

(b) shared import 블록에 타입 추가:
```ts
  JWIN_MEDIA_MAX_BYTES,
  type JwinMediaUploadPresignRequest,
  type JwinMediaUploadPresignResponse,
```

(c) `extOf`의 switch에 mp4 케이스 추가:
```ts
    case "video/mp4":
      return "mp4";
```

(d) `presignCampaignImageUpload` 메서드 **다음**에 추가:
```ts
  async presignJwinMediaUpload(
    body: JwinMediaUploadPresignRequest,
  ): Promise<JwinMediaUploadPresignResponse> {
    if (body.sizeBytes > JWIN_MEDIA_MAX_BYTES) {
      throw new BadRequestException("파일 크기 한도를 초과했습니다");
    }
    const objectKey = `jwin/media/${randomUUID()}.${extOf(body.contentType)}`;
    const uploadUrl = await this.r2.presignPut(
      { objectKey, contentType: body.contentType, contentLength: body.sizeBytes },
      PRESIGN_EXPIRES_SEC,
    );
    // J-WIN 미디어는 jwin-api가 게시 시각마다 fetch하므로 만료 URL을 쓰면 후반 게시가 실패한다.
    // 만료 없는 공개 URL이 아니면 발급 자체를 막는다 (R2_PUBLIC_BASE_URL 필수).
    const viewUrl = this.r2.publicUrl(objectKey);
    if (!viewUrl) {
      throw new InternalServerErrorException(
        "R2_PUBLIC_BASE_URL이 설정되지 않아 J-WIN 미디어용 공개 URL을 발급할 수 없습니다",
      );
    }
    return { objectKey, uploadUrl, viewUrl, expiresInSec: PRESIGN_EXPIRES_SEC };
  }
```

- [ ] **Step 6: 컨트롤러 라우트 추가**

`apps/api/src/uploads/admin-uploads.controller.ts`:

(a) shared import에 추가:
```ts
  JwinMediaUploadPresignRequestSchema,
  type JwinMediaUploadPresignRequest,
  type JwinMediaUploadPresignResponse,
```

(b) 컨트롤러 클래스 안, `presignCampaignImage` 메서드 다음에 추가:
```ts
  @Post("jwin-media/presign")
  presignJwinMedia(
    @Body(new ZodValidationPipe(JwinMediaUploadPresignRequestSchema))
    body: JwinMediaUploadPresignRequest,
  ): Promise<JwinMediaUploadPresignResponse> {
    return this.svc.presignJwinMediaUpload(body);
  }
```

- [ ] **Step 7: 테스트 통과 + 타입체크**

Run:
```bash
pnpm --filter @jsure/api exec jest src/uploads/uploads.jwin.spec.ts
pnpm --filter @jsure/api typecheck
```
Expected: PASS, 타입체크 통과.

- [ ] **Step 8: 커밋**

```bash
git add packages/shared/src/types/uploads.ts apps/api/src/uploads/uploads.service.ts apps/api/src/uploads/admin-uploads.controller.ts apps/api/src/uploads/uploads.jwin.spec.ts
git commit -m "feat(api): J-WIN 미디어 presign 엔드포인트 (D-12, 공개 URL 필수)"
```

---

## Task 8: admin-web 도메인 계층 신설 (Phase 2)

`src/domains/jwin/`에 타입 세이프 fetch 계층을 만든다. Phase 3~5 화면이 이 계층을 소비한다.

**Files:**
- Modify: `apps/admin-web/package.json`
- Create: `apps/admin-web/src/domains/jwin/types.ts`
- Create: `apps/admin-web/src/domains/jwin/api.ts`

**Interfaces:**
- Consumes: `@jsure/jwin-shared` 스키마 (Task 2), `lib/api.ts`의 `jwinApi`.
- Produces: `fetchCampaign`, `fetchPrizes`, `fetchPostTemplates`, `fetchWinners`, `fetchShipping`, `updateFulfillment`, `updatePrize`, `deletePostTemplate` 및 재노출 타입.

- [ ] **Step 1: 의존 추가**

`apps/admin-web/package.json`의 `dependencies`에 추가:
```json
    "@jsure/jwin-shared": "workspace:*",
```
설치 + jwin-shared 빌드(admin-web이 dist를 소비):
```bash
cd /Users/pyoh/Desktop/project/jsure-integration-dashboard
pnpm install
pnpm --filter @jsure/jwin-shared build
```

- [ ] **Step 2: 타입 재노출**

Create `apps/admin-web/src/domains/jwin/types.ts`:
```ts
/** J-WIN 어드민 계약 타입 재노출 — 화면·hook은 이 파일에서만 가져온다. */
export {
  AdminCampaignDetailSchema,
  AdminPrizeSchema,
  AdminPrizeListSchema,
  AdminPrizePatchSchema,
  AdminPostTemplateSchema,
  AdminPostTemplateListSchema,
  AdminWinnerSchema,
  AdminWinnerListSchema,
  AdminShippingSchema,
  AdminFulfillmentPatchSchema,
} from "@jsure/jwin-shared";
export type {
  AdminCampaignDetail,
  AdminPrize,
  AdminPrizeList,
  AdminPrizePatch,
  AdminPostTemplate,
  AdminPostTemplateList,
  AdminWinner,
  AdminWinnerList,
  AdminShipping,
  AdminFulfillmentPatch,
} from "@jsure/jwin-shared";
```

- [ ] **Step 3: fetcher 구현**

Create `apps/admin-web/src/domains/jwin/api.ts`:
```ts
import { jwinApi } from "../../lib/api";
import {
  AdminCampaignDetailSchema,
  AdminPrizeListSchema,
  AdminPostTemplateListSchema,
  AdminWinnerListSchema,
  AdminShippingSchema,
  AdminPrizeSchema,
  AdminWinnerSchema,
  type AdminCampaignDetail,
  type AdminPrizeList,
  type AdminPostTemplateList,
  type AdminWinnerList,
  type AdminShipping,
  type AdminPrize,
  type AdminPrizePatch,
  type AdminWinner,
  type AdminFulfillmentPatch,
} from "./types";

export async function fetchCampaign(campaignId: string): Promise<AdminCampaignDetail> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}`);
  return AdminCampaignDetailSchema.parse(response.data);
}

export async function fetchPrizes(campaignId: string): Promise<AdminPrizeList> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}/prizes`);
  return AdminPrizeListSchema.parse(response.data);
}

export async function fetchPostTemplates(campaignId: string): Promise<AdminPostTemplateList> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}/post-templates`);
  return AdminPostTemplateListSchema.parse(response.data);
}

export async function fetchWinners(campaignId: string): Promise<AdminWinnerList> {
  const response = await jwinApi.get(`/admin/campaigns/${campaignId}/winners`);
  return AdminWinnerListSchema.parse(response.data);
}

export async function fetchShipping(winnerId: string): Promise<AdminShipping> {
  const response = await jwinApi.get(`/admin/winners/${winnerId}/shipping`);
  return AdminShippingSchema.parse(response.data);
}

export async function updateFulfillment(
  winnerId: string,
  body: AdminFulfillmentPatch,
): Promise<AdminWinner> {
  const response = await jwinApi.patch(`/admin/winners/${winnerId}/fulfillment`, body);
  return AdminWinnerSchema.parse(response.data);
}

export async function updatePrize(prizeId: string, body: AdminPrizePatch): Promise<AdminPrize> {
  const response = await jwinApi.patch(`/admin/prizes/${prizeId}`, body);
  return AdminPrizeSchema.parse(response.data);
}

export async function deletePostTemplate(templateId: string): Promise<void> {
  await jwinApi.delete(`/admin/post-templates/${templateId}`);
}
```

- [ ] **Step 4: 타입체크**

Run: `pnpm --filter @jsure/admin-web typecheck`
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
git add apps/admin-web/package.json apps/admin-web/src/domains/jwin/types.ts apps/admin-web/src/domains/jwin/api.ts pnpm-lock.yaml
git commit -m "feat(admin-web): J-WIN 도메인 fetch 계층 신설 (domains/jwin)"
```

---

## Task 9: 어드민 셸 정리 (Phase 2)

`/jwin/prizes`·`/jwin/stats`를 제거하고(캠페인 종속 개념 → Phase 3+에서 S2 탭으로 흡수), 편집/생성 라우트를 추가한다.

**Files:**
- Modify: `apps/admin-web/src/lib/navigation.ts`
- Modify: `apps/admin-web/src/App.tsx`
- Create: `apps/admin-web/src/pages/Jwin/CampaignEdit.tsx`
- Delete: `apps/admin-web/src/pages/Jwin/Prizes.tsx`, `apps/admin-web/src/pages/Jwin/Stats.tsx`

- [ ] **Step 1: 네비게이션 축소**

`apps/admin-web/src/lib/navigation.ts`의 `JWIN_PRODUCT.groups`에서 `경품`·`분석` 두 그룹을 제거해 `운영` 한 그룹만 남긴다:
```ts
  groups: [
    {
      title: "운영",
      items: [
        { to: "/jwin/campaigns", label: "캠페인 관리", icon: "fa-solid fa-bullhorn" },
        { to: "/jwin/winners", label: "당첨자 관리", icon: "fa-solid fa-trophy" },
      ],
    },
  ],
```

- [ ] **Step 2: 편집/생성 겸용 플레이스홀더 페이지 생성**

Create `apps/admin-web/src/pages/Jwin/CampaignEdit.tsx`:
```tsx
import { useParams } from "react-router-dom";

/**
 * S2 캠페인 생성·편집 (생성/편집 겸용). Phase 3~4에서 탭 UI로 채운다.
 * id가 없으면 생성, 있으면 편집 모드.
 */
export function JwinCampaignEdit() {
  const { id } = useParams();
  return (
    <section>
      <h1>{id ? "캠페인 편집" : "캠페인 생성"}</h1>
      <p>준비 중입니다.</p>
    </section>
  );
}
```

- [ ] **Step 3: App.tsx 라우트 교체**

(a) import 교체 — `JwinPrizes`·`JwinStats` 줄을 삭제하고 `JwinCampaignEdit` 추가:
```tsx
import { JwinCampaigns } from "./pages/Jwin/Campaigns";
import { JwinCampaignEdit } from "./pages/Jwin/CampaignEdit";
import { JwinWinners } from "./pages/Jwin/Winners";
```

(b) J-WIN 라우트 블록 교체:
```tsx
        {/* J-WIN (X 인스턴트윈). 기존 인플루언서 경로와 섞이지 않도록 /jwin 아래에 둔다. */}
        <Route path="/jwin" element={<Navigate to="/jwin/campaigns" replace />} />
        <Route path="/jwin/campaigns" element={<JwinCampaigns />} />
        <Route path="/jwin/campaigns/new" element={<JwinCampaignEdit />} />
        <Route path="/jwin/campaigns/:id" element={<JwinCampaignEdit />} />
        <Route path="/jwin/winners" element={<JwinWinners />} />
```

- [ ] **Step 4: 죽은 페이지 삭제**

```bash
git rm apps/admin-web/src/pages/Jwin/Prizes.tsx apps/admin-web/src/pages/Jwin/Stats.tsx
```

- [ ] **Step 5: 타입체크 + 린트**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
```
Expected: 통과. `Prizes`/`Stats` 참조 잔존 시 여기서 에러로 잡힌다.

- [ ] **Step 6: 화면 육안 확인**

`pnpm dev:admin` 상태에서 브라우저로:
- 제품 스위처에서 J-WIN 선택 → 사이드바에 `캠페인 관리`·`당첨자 관리` 2개만.
- `/jwin/campaigns/new`, `/jwin/campaigns/abc` 접속 → "캠페인 생성"/"캠페인 편집" 플레이스홀더 노출.
- `/jwin/prizes`, `/jwin/stats` 접속 → NotFound.

- [ ] **Step 7: 커밋**

```bash
git add apps/admin-web/src/lib/navigation.ts apps/admin-web/src/App.tsx apps/admin-web/src/pages/Jwin/CampaignEdit.tsx
git commit -m "feat(admin-web): J-WIN 셸 정리 — 경품·통계 메뉴 제거, 편집 라우트 추가"
```

---

## 최종 검증 (Phase 0+1+2 완료 기준)

- [ ] **전체 타입체크 + 린트 + 테스트**

```bash
cd /Users/pyoh/Desktop/project/jsure-integration-dashboard
pnpm typecheck
pnpm lint
pnpm --filter @jsure/jwin-api test
pnpm --filter @jsure/api exec jest src/uploads/uploads.jwin.spec.ts
```
Expected: 전부 통과.

- [ ] **7개 어드민 엔드포인트 200/401 확인 (수동)**

서버 기동 + 유효한 대시보드 토큰(`TOKEN=<accessToken>`)으로:
```bash
BASE=http://localhost:8080
# 무인증 → 401
for path in \
  "/admin/campaigns/ID" "/admin/campaigns/ID/prizes" "/admin/campaigns/ID/post-templates" \
  "/admin/campaigns/ID/winners" "/admin/winners/WID/shipping"; do
  echo -n "$path (no auth): "; curl -s -o /dev/null -w "%{http_code}\n" "$BASE$path"
done
# 인증 → 200/404 (인증은 통과, 존재하지 않는 id면 404)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" "$BASE/admin/campaigns/REAL_ID"
```
Expected: 무인증은 전부 401. 인증 헤더가 있으면 401이 아님(존재하는 id면 200, 없으면 404).

- [ ] **winners 응답에 배송지 미노출 확인**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/admin/campaigns/REAL_ID/winners" | grep -c encryptedShipping
```
Expected: **0** (`encryptedShipping` 문자열이 응답에 없음).

---

## Self-Review (작성자 체크 결과)

- **Spec 커버리지**: D-11 기록(T1)·jwin-shared zod(T2)·encryptedShipping 제거(T5)·§4 ①(T4) ②(T4) ③(T6) ④(T4) ⑤(T6) ⑥(T5) ⑦(T5) ⑧/D-12(T7)·환경 정상화(T0)·navigation·라우트·domains/jwin 신설(T8·T9) 모두 태스크로 매핑됨.
- **범위**: 화면(Phase 3~5)·배포(Phase 6)는 의도적으로 제외 — 별도 사이클.
- **테스트 현실성**: DB 없이 검증 가능한 순수 로직(매퍼·전이가드·스키마·presign 서비스)은 자동 테스트. 엔드포인트 200 경로는 spec대로 curl 수동 검증(401은 인증 가드로 자동 확인).
- **타입 일관성**: `AdminWinner`/`toWinner`, `canTransitionFulfillment`, `presignJwinMediaUpload`, fetcher 이름이 정의 태스크와 소비 태스크에서 일치.
- **알려진 제약**: jwin-shared·shared는 `main: dist`라 소비 전 빌드 필요 → 관련 태스크에 빌드 스텝 포함. GUEST 권한 분리는 MVP 제외(MVP_PLAN §6).
