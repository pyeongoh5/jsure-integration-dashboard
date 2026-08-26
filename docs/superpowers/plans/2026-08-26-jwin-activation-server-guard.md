# J-WIN 발행 전 검증 서버 이관 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SETUP → ACTIVE` 전환을 서버가 최종 검증하게 만들고, 그 판정 로직을 클라이언트·서버 단일 소스로 합친다.

**Architecture:** 지금 발행 전 체크리스트 3게이트는 `admin-web`에만 있고 `PATCH /admin/campaigns/:id` 는 `status` 를 그대로 DB에 쓴다. 화면을 거치지 않는 호출이나 클라이언트 버그면 미비된 캠페인이 `ACTIVE` 가 되고, 그 뒤로는 매일 게시가 조용히 실패한다. 판정 순수 함수를 `packages/jwin-shared` 로 올려 서버가 같은 함수로 재검증한다. 부수 효과로 화면과 스케줄러가 각자 구현하던 규칙이 하나가 된다(D-11 드리프트 차단).

**Tech Stack:** TypeScript · zod · Fastify(jwin-api) · vitest · pnpm workspace(`@jsure/jwin-shared` 는 CJS 빌드)

**배경 문서:** `docs/superpowers/plans/2026-08-23-jwin-phase4-campaign-tabs.md` (Phase 4), 최종 리뷰 findings

## Global Constraints

- **커밋 메시지·코드 주석·API 예외 메시지는 한국어.**
- **`git add -A` 금지** — 항상 의도한 파일만 명시 경로로 add.
- 변수·파라미터 **약어 금지**(`tpl`·`acc`·`req` → `template`·`account`·`request`). **중첩 삼항연산자 금지.**
- `packages/jwin-shared` 를 고치면 **`pnpm --filter @jsure/jwin-shared build` 를 먼저 돌려야** 소비자(jwin-api·admin-web)의 typecheck 가 새 export 를 본다.
- **동작을 바꾸지 않는 이동은 정말로 바꾸지 않는다.** 이동 대상 함수의 로직·시그니처·주석 의도를 그대로 옮긴다. "개선"하지 않는다.
- 순수 함수는 계속 **순수**해야 한다 — i18n·React·Prisma 를 import 하지 않는다.
- 각 태스크 종료 시 `pnpm --filter @jsure/jwin-shared build && pnpm typecheck && pnpm test` 가 green.

## 이 플랜이 하지 않는 것

- **`renderDmText` / `DEFAULT_DM_TEMPLATE` 통합.** `apps/jwin-api/src/services/fulfillment.ts` 와 `admin-web` 의 `dmTemplatePreview.ts` 에 같은 내용이 중복돼 있지만, DM 발송 경로라 위험 대비 이득이 낮다. 이번 게이트가 필요로 하지 않는다. 후속 과제로 남긴다.
- 클라이언트 체크리스트 제거. 화면 UX(무엇이 부족한지 즉시 표시)는 그대로 두고, 서버는 **2차 방어선**으로 더한다.
- `PAUSED → ACTIVE` 재개 시 재검증. 재개는 이미 한 번 통과한 캠페인이고, 이번 범위는 `SETUP → ACTIVE` 다.

---

## 파일 구조

| 경로 | 변경 |
|---|---|
| `packages/jwin-shared/src/campaignReadiness.ts` | **신규** — 판정 순수 함수 3종 |
| `packages/jwin-shared/src/campaignReadiness.test.ts` | **신규** — 위 테스트 |
| `packages/jwin-shared/src/index.ts` | 재노출 추가 |
| `packages/jwin-shared/src/adminApi.ts` | `AdminPostTemplateCreateSchema` 에 `.refine()` |
| `apps/jwin-api/src/routes/admin.ts` | 로컬 `parseCodesInput` 제거→import · `templateSchema` refine · **ACTIVE 전환 검증** |
| `apps/jwin-api/src/routes/campaignActivation.ts` | **신규** — 전환 검증 로직 분리 |
| `apps/jwin-api/src/routes/campaignActivation.test.ts` | **신규** |
| `apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts` | shared 재노출 + `formatCoverageGaps` 만 로컬 유지 |
| `apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.test.ts` | 이동한 케이스 제거, 포맷 테스트만 유지 |
| `apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.ts` | `parseCodesInput` 을 shared 에서 가져옴 |
| `apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts` | `dmTemplateMissingCode` 를 shared 에서 가져옴 |

---

### Task 1: jwin-shared 에 판정 순수 함수 이관

**Files:**
- Create: `packages/jwin-shared/src/campaignReadiness.ts` (+ `.test.ts`)
- Modify: `packages/jwin-shared/src/index.ts`

**Interfaces:**
- Produces:
  - `type CoverageGap = { fromDateJst: string; toDateJst: string }`
  - `type PostTemplateCoverage = { postingDates: string[]; gaps: CoverageGap[] }`
  - `postTemplateCoverage(campaign: { startsAt: string; endsAt: string }, templates: { activeFrom: string; activeTo: string }[]): PostTemplateCoverage`
  - `parseCodesInput(raw: string): string[]`
  - `dmTemplateMissingCode(template: string | null): boolean`

**출처 — 그대로 옮긴다:**

| 함수 | 원본 |
|---|---|
| `postTemplateCoverage` + 두 타입 | `apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts` |
| `parseCodesInput` | `apps/jwin-api/src/routes/admin.ts` (약 30행) |
| `dmTemplateMissingCode` | `apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts` |

`formatCoverageGaps` 와 `shortDate` 는 **옮기지 않는다** — 화면 표시용이고 서버가 쓰지 않는다. admin-web 에 남는다.

- [ ] **Step 1: 원본 3개 파일을 읽는다**

`apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts`, `apps/jwin-api/src/routes/admin.ts` 의 `parseCodesInput`, `apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts` 의 `dmTemplateMissingCode` 를 읽는다. 로직·주석을 그대로 가져올 것이므로 정확히 파악한다.

- [ ] **Step 2: 새 파일 작성**

`packages/jwin-shared/src/campaignReadiness.ts` 를 만든다. 위 3개 함수와 `postTemplateCoverage` 가 쓰는 내부 헬퍼(`toDateJst`, `materializeMoment`, `nextDateJst`)와 상수(`MATERIALIZE_AT_JST`, `JST_OFFSET_MS`, `DAY_MS`)를 원본 그대로 옮긴다. 파일 상단에 이 파일의 존재 이유를 한국어 주석으로 남긴다:

```ts
/**
 * 캠페인 발행 준비 판정 — 화면과 서버가 **같은 함수**로 판정한다.
 *
 * 각자 구현하면 한쪽만 고쳤을 때 조용히 어긋난다. 특히 소재 커버리지는
 * 어긋나면 "화면은 괜찮다는데 그날 게시가 안 나가는" 사고가 되고,
 * 에러도 로그도 남지 않아 브랜드가 항의할 때까지 아무도 모른다.
 *
 * 여기 있는 것은 전부 순수 함수다. i18n·React·Prisma 를 import 하지 않는다.
 */
```

`postTemplateCoverage` 의 스케줄러 00:05 JST 판정 근거 주석은 반드시 함께 옮긴다 — 이 함수의 가장 중요한 계약이다.

- [ ] **Step 3: 테스트 작성**

`packages/jwin-shared/src/campaignReadiness.test.ts` 를 만든다. `apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.test.ts` 의 `describe("postTemplateCoverage")` 블록 8건을 **그대로** 옮긴다(`jst()` 헬퍼와 `CAMPAIGN` 상수 포함). `describe("formatCoverageGaps")` 3건은 옮기지 않는다 — 그 함수는 admin-web 에 남는다.

이어서 이관한 나머지 두 함수의 테스트를 더한다:

```ts
describe('parseCodesInput', () => {
  it('개행·탭·쉼표로 구분하고 공백을 제거한다', () => {
    expect(parseCodesInput('AAA\r\nBBB\tCCC, DDD ')).toEqual(['AAA', 'BBB', 'CCC', 'DDD']);
  });

  it('빈 줄은 세지 않는다', () => {
    expect(parseCodesInput('AAA\n\n\nBBB\n')).toEqual(['AAA', 'BBB']);
  });

  it('빈 입력은 빈 배열', () => {
    expect(parseCodesInput('   \n  ')).toEqual([]);
  });
});

describe('dmTemplateMissingCode', () => {
  it('빈 문구는 서버 기본 문구가 쓰이므로 누락이 아니다', () => {
    expect(dmTemplateMissingCode(null)).toBe(false);
    expect(dmTemplateMissingCode('   ')).toBe(false);
  });

  it('코드 자리가 있으면 누락이 아니다', () => {
    expect(dmTemplateMissingCode('ギフトコード: {{CODE}}')).toBe(false);
  });

  it('직접 쓴 문구에 코드 자리가 없으면 누락이다', () => {
    expect(dmTemplateMissingCode('おめでとうございます！')).toBe(true);
  });
});
```

- [ ] **Step 4: index 재노출**

`packages/jwin-shared/src/index.ts` 맨 위 `export * from './adminApi';` 다음 줄에 추가:

```ts
export * from './campaignReadiness';
```

- [ ] **Step 5: 검증**

Run:
```bash
pnpm --filter @jsure/jwin-shared build
pnpm --filter @jsure/jwin-shared test
```
Expected: 빌드 통과, 테스트 7건(기존) + 14건(신규) = 21건 통과

- [ ] **Step 6: 커밋**

```bash
git add packages/jwin-shared/src/campaignReadiness.ts \
  packages/jwin-shared/src/campaignReadiness.test.ts \
  packages/jwin-shared/src/index.ts
git commit -m "feat(jwin-shared): 캠페인 발행 준비 판정 순수 함수 이관 (화면·서버 단일 소스)"
```

---

### Task 2: 서버·클라이언트가 shared 판정 함수를 쓰도록 교체

**Files:**
- Modify: `apps/jwin-api/src/routes/admin.ts`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts` (+ `.test.ts`)
- Modify: `apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.ts`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts`

**Interfaces:**
- Consumes: Task 1의 `postTemplateCoverage`, `parseCodesInput`, `dmTemplateMissingCode`
- Produces: 동작 변화 없음. 중복 구현만 사라진다.

**주의 — 이 태스크는 순수 리팩터다.** 어떤 동작도 바뀌면 안 된다. 기존 테스트가 전부 그대로 통과해야 한다.

- [ ] **Step 1: jwin-api 의 중복 제거**

`apps/jwin-api/src/routes/admin.ts` 에서:
- 파일 상단의 `export function parseCodesInput(...)` 정의(약 29~35행)와 그 위 주석을 삭제한다.
- 기존 `@jsure/jwin-shared` import 에 `parseCodesInput` 을 추가한다(없으면 import 문을 새로 만든다).

`parseCodesInput` 이 다른 파일에서 import 되고 있는지 확인한다:

```bash
grep -rn "parseCodesInput" apps/jwin-api/src
```

`admin.ts` 안에서만 쓰이면 그대로 두고, 외부에서 import 하는 곳이 있으면 그쪽도 `@jsure/jwin-shared` 에서 가져오도록 바꾼다.

- [ ] **Step 2: admin-web 의 커버리지 파일 정리**

`apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts` 를 아래로 교체한다. 계산은 shared 것을 재노출하고, 화면 표시용 포맷만 남긴다:

```ts
/**
 * 소재 커버리지 — 계산은 `@jsure/jwin-shared` 의 것을 쓴다(서버와 같은 함수).
 * 이 파일에는 화면 표시용 포맷만 남긴다.
 */
export {
  postTemplateCoverage,
  type CoverageGap,
  type PostTemplateCoverage,
} from "@jsure/jwin-shared";
import type { CoverageGap } from "@jsure/jwin-shared";

/** "2026-09-08" → "9/8" */
function shortDate(dateJst: string): string {
  const [, month, day] = dateJst.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** 날짜 나열만 만든다(언어 중립). 예: "9/1 ~ 9/2, 9/10" */
export function formatCoverageGaps(gaps: CoverageGap[]): string {
  return gaps
    .map((gap) => {
      if (gap.fromDateJst === gap.toDateJst) return shortDate(gap.fromDateJst);
      return `${shortDate(gap.fromDateJst)} ~ ${shortDate(gap.toDateJst)}`;
    })
    .join(", ");
}
```

> `shortDate` 의 `[, month, day]` 구조분해는 이 저장소의 `noUncheckedIndexedAccess: true` 에 걸릴 수 있다. 걸리면 기본값(`= ""`)을 주되 동작은 바꾸지 않는다.

`postTemplateCoverage.test.ts` 에서 `describe("postTemplateCoverage")` 블록 전체와 `CAMPAIGN` 상수·`jst()` 헬퍼를 삭제한다(Task 1 에서 jwin-shared 로 옮겼다). `describe("formatCoverageGaps")` 3건만 남긴다. import 도 `formatCoverageGaps` 만 남기도록 정리한다.

- [ ] **Step 3: admin-web 의 코드 파싱·DM 판정 교체**

`jwinCodeInput.ts` 에서 로컬 `parseCodesInput` 정의를 지우고 shared 것을 재노출한다. `summarizeCodeInput` 은 그대로 두되 shared 의 `parseCodesInput` 을 쓴다:

```ts
import { parseCodesInput } from "@jsure/jwin-shared";

export { parseCodesInput };
```

파일 상단 주석에서 "서버 admin.ts 의 parseCodesInput 과 같은 규칙이어야 한다"는 문장은, 이제 **같은 함수를 쓰므로** 그 사실을 반영해 고쳐 쓴다.

`dmTemplatePreview.ts` 에서 로컬 `dmTemplateMissingCode` 정의를 지우고 shared 것을 재노출한다. `DEFAULT_DM_TEMPLATE`·`DM_PREVIEW_SAMPLE`·`renderDmPreview` 는 **그대로 둔다**(이번 범위 밖).

```ts
import { dmTemplateMissingCode } from "@jsure/jwin-shared";

export { dmTemplateMissingCode };
```

- [ ] **Step 4: 소비자가 안 깨졌는지 확인**

`postTemplateCoverage`·`parseCodesInput`·`dmTemplateMissingCode` 를 import 하는 모든 곳이 여전히 같은 이름으로 가져올 수 있어야 한다. 확인:

```bash
grep -rn "postTemplateCoverage\|parseCodesInput\|dmTemplateMissingCode" apps/admin-web/src apps/jwin-api/src
```

- [ ] **Step 5: 검증**

Run:
```bash
pnpm --filter @jsure/jwin-shared build
pnpm typecheck
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/admin-web test
pnpm --filter @jsure/jwin-api test
pnpm --filter @jsure/admin-web build
```
Expected: 전부 green. admin-web 테스트는 커버리지 8건이 jwin-shared 로 옮겨갔으므로 **43 → 35건**이 된다(포맷 3건은 남는다).

- [ ] **Step 6: 커밋**

```bash
git add apps/jwin-api/src/routes/admin.ts \
  apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts \
  apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.test.ts \
  apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.ts \
  apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts
git commit -m "refactor: 판정 함수 중복 제거 — 화면·서버가 jwin-shared 의 같은 구현을 쓴다"
```

---

### Task 3: 서버가 `SETUP → ACTIVE` 전환을 검증한다

**Files:**
- Create: `apps/jwin-api/src/routes/campaignActivation.ts` (+ `.test.ts`)
- Modify: `apps/jwin-api/src/routes/admin.ts`

**Interfaces:**
- Consumes: `postTemplateCoverage`, `dmTemplateMissingCode` (`@jsure/jwin-shared`)
- Produces: `activationBlockers(input: ActivationInput): string[]` — 미충족 사유(한국어) 배열. 빈 배열이면 전환 가능.

**검증할 4게이트** — 화면 체크리스트(`activationChecklist.ts`)와 같은 규칙이다:

| # | 조건 |
|---|---|
| ① | `brandAccountId` 가 있고, 그 계정이 연동 완료(`xUserId` 와 `encryptedAccessToken` 이 있고 `refreshFailedAt` 이 없음) |
| ② | 경품 1건 이상 |
| ③ | `postTemplateCoverage` 의 `postingDates` 가 1일 이상이고 `gaps` 가 0 |
| ④ | CODE 경품이 있으면 `dmTemplateMissingCode(dmTemplate)` 가 false |

**계정 상태 판정은 이미 있다.** `apps/jwin-api/src/routes/adminMappers.ts` 의 `brandAccountStatus(account)` 가 `'PENDING' | 'CONNECTED' | 'NEEDS_RECONNECT'` 를 돌려준다. 새로 만들지 말고 그것을 쓴다 — `'CONNECTED'` 만 통과.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/jwin-api/src/routes/campaignActivation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { activationBlockers } from './campaignActivation';

/** 2026-09-01 00:00 JST ~ 2026-09-05 23:59 JST */
const CAMPAIGN = {
  startsAt: new Date('2026-08-31T15:00:00.000Z'),
  endsAt: new Date('2026-09-05T14:59:00.000Z'),
  dmTemplate: null as string | null,
};

const CONNECTED_ACCOUNT = {
  xUserId: '1234',
  encryptedAccessToken: 'enc',
  refreshFailedAt: null as Date | null,
};

/** 전 기간을 덮는 소재 */
const FULL_TEMPLATE = {
  activeFrom: new Date('2026-08-31T15:00:00.000Z'),
  activeTo: new Date('2026-09-05T14:59:00.000Z'),
};

const PHYSICAL_PRIZE = { type: 'PHYSICAL' as const };
const CODE_PRIZE = { type: 'CODE' as const };

describe('activationBlockers', () => {
  it('모두 충족하면 빈 배열', () => {
    expect(
      activationBlockers({
        campaign: CAMPAIGN,
        brandAccount: CONNECTED_ACCOUNT,
        prizes: [PHYSICAL_PRIZE],
        postTemplates: [FULL_TEMPLATE],
      }),
    ).toEqual([]);
  });

  it('계정 미연결이면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: null,
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('계정');
  });

  it('연동이 끝나지 않은 계정이면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: { xUserId: null, encryptedAccessToken: null, refreshFailedAt: null },
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers).toHaveLength(1);
  });

  it('재연동이 필요한 계정이면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: { ...CONNECTED_ACCOUNT, refreshFailedAt: new Date() },
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers).toHaveLength(1);
  });

  it('경품이 없으면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: CONNECTED_ACCOUNT,
      prizes: [],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers.some((blocker) => blocker.includes('경품'))).toBe(true);
  });

  it('소재 빈틈이 있으면 어느 날인지 사유에 담는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: CONNECTED_ACCOUNT,
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [
        {
          activeFrom: new Date('2026-08-31T15:00:00.000Z'),
          activeTo: new Date('2026-09-02T14:59:00.000Z'),
        },
      ],
    });
    expect(blockers.some((blocker) => blocker.includes('2026-09-03'))).toBe(true);
  });

  it('소재가 하나도 없으면 막는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: CONNECTED_ACCOUNT,
      prizes: [PHYSICAL_PRIZE],
      postTemplates: [],
    });
    expect(blockers.some((blocker) => blocker.includes('소재'))).toBe(true);
  });

  it('CODE 경품이 있는데 DM 문구에 코드 자리가 없으면 막는다', () => {
    const blockers = activationBlockers({
      campaign: { ...CAMPAIGN, dmTemplate: 'おめでとうございます！' },
      brandAccount: CONNECTED_ACCOUNT,
      prizes: [CODE_PRIZE],
      postTemplates: [FULL_TEMPLATE],
    });
    expect(blockers.some((blocker) => blocker.includes('{{CODE}}'))).toBe(true);
  });

  it('CODE 경품이 있어도 DM 문구가 비어 있으면 기본 문구가 쓰이므로 통과', () => {
    expect(
      activationBlockers({
        campaign: { ...CAMPAIGN, dmTemplate: null },
        brandAccount: CONNECTED_ACCOUNT,
        prizes: [CODE_PRIZE],
        postTemplates: [FULL_TEMPLATE],
      }),
    ).toEqual([]);
  });

  it('PHYSICAL 경품만 있으면 DM 문구를 검사하지 않는다', () => {
    expect(
      activationBlockers({
        campaign: { ...CAMPAIGN, dmTemplate: '코드 없는 문구' },
        brandAccount: CONNECTED_ACCOUNT,
        prizes: [PHYSICAL_PRIZE],
        postTemplates: [FULL_TEMPLATE],
      }),
    ).toEqual([]);
  });

  it('여러 항목이 미충족이면 전부 담는다', () => {
    const blockers = activationBlockers({
      campaign: CAMPAIGN,
      brandAccount: null,
      prizes: [],
      postTemplates: [],
    });
    expect(blockers.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/jwin-api test`
Expected: FAIL — `Failed to resolve import "./campaignActivation"`

- [ ] **Step 3: 검증 로직 구현**

`apps/jwin-api/src/routes/campaignActivation.ts`:

```ts
import { postTemplateCoverage, dmTemplateMissingCode } from '@jsure/jwin-shared';
import { brandAccountStatus } from './adminMappers';

/**
 * `SETUP → ACTIVE` 전환 서버 검증.
 *
 * 화면(admin-web `activationChecklist.ts`)이 같은 4게이트를 미리 보여주지만,
 * 그건 UX 이고 이쪽이 최종 방어선이다. 화면을 거치지 않는 호출이나 화면 버그로
 * 미비된 캠페인이 ACTIVE 가 되면, 그 뒤로는 매일 게시가 조용히 실패한다.
 *
 * 커버리지·DM 코드 판정은 화면과 **같은 함수**(@jsure/jwin-shared)를 쓴다.
 */

type ActivationAccount = {
  xUserId: string | null;
  encryptedAccessToken: string | null;
  refreshFailedAt: Date | null;
};

export type ActivationInput = {
  campaign: { startsAt: Date; endsAt: Date; dmTemplate: string | null };
  brandAccount: ActivationAccount | null;
  prizes: { type: 'PHYSICAL' | 'CODE' }[];
  postTemplates: { activeFrom: Date; activeTo: Date }[];
};

/** 미충족 사유(한국어). 빈 배열이면 전환 가능. */
export function activationBlockers(input: ActivationInput): string[] {
  const blockers: string[] = [];

  if (!input.brandAccount) {
    blockers.push('브랜드 계정이 연결되지 않았습니다');
  } else if (brandAccountStatus(input.brandAccount) !== 'CONNECTED') {
    blockers.push('브랜드 계정 연동이 완료되지 않았습니다');
  }

  if (input.prizes.length === 0) {
    blockers.push('경품이 1건도 등록되지 않았습니다');
  }

  const coverage = postTemplateCoverage(
    {
      startsAt: input.campaign.startsAt.toISOString(),
      endsAt: input.campaign.endsAt.toISOString(),
    },
    input.postTemplates.map((template) => ({
      activeFrom: template.activeFrom.toISOString(),
      activeTo: template.activeTo.toISOString(),
    })),
  );
  if (coverage.postingDates.length === 0) {
    blockers.push('게시 예정일이 없습니다. 캠페인 기간을 확인하세요');
  } else if (coverage.gaps.length > 0) {
    const days = coverage.gaps
      .map((gap) =>
        gap.fromDateJst === gap.toDateJst
          ? gap.fromDateJst
          : `${gap.fromDateJst}~${gap.toDateJst}`,
      )
      .join(', ');
    blockers.push(`소재가 없는 날이 있습니다: ${days}`);
  }

  const hasCodePrize = input.prizes.some((prize) => prize.type === 'CODE');
  if (hasCodePrize && dmTemplateMissingCode(input.campaign.dmTemplate)) {
    blockers.push('CODE 경품이 있으면 당첨 DM 문구에 {{CODE}}가 있어야 합니다');
  }

  return blockers;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/jwin-api test`
Expected: PASS (기존 17건 + 신규 11건)

- [ ] **Step 5: PATCH 라우트에 연결**

`apps/jwin-api/src/routes/admin.ts` 의 `app.patch('/admin/campaigns/:id', ...)` 를 고친다. `ensureBrandAccountExists` 통과 직후, `prisma.brandCampaign.update` **앞**에 넣는다:

```ts
    // SETUP → ACTIVE 는 서버가 최종 검증한다. 미비된 채로 올라가면 매일 게시가 조용히 실패한다.
    if (parsed.data.status === 'ACTIVE') {
      const current = await prisma.brandCampaign.findUnique({
        where: { id: req.params.id },
        include: { brandAccount: true, prizes: true, postTemplates: true },
      });
      if (!current) return reply.code(404).send({ error: '캠페인을 찾을 수 없습니다' });

      if (current.status === 'SETUP') {
        const blockers = activationBlockers({
          campaign: {
            // 같은 요청에서 기간·DM 문구를 함께 바꾸는 경우가 있으므로 새 값을 우선한다
            startsAt: parsed.data.startsAt ?? current.startsAt,
            endsAt: parsed.data.endsAt ?? current.endsAt,
            dmTemplate:
              parsed.data.dmTemplate === undefined
                ? current.dmTemplate
                : parsed.data.dmTemplate,
          },
          brandAccount: current.brandAccount,
          prizes: current.prizes,
          postTemplates: current.postTemplates,
        });
        if (blockers.length > 0) {
          return reply
            .code(400)
            .send({ error: `캠페인을 시작할 수 없습니다 — ${blockers.join(' / ')}` });
        }
      }
    }
```

`import { activationBlockers } from './campaignActivation';` 를 파일 상단 import 에 추가한다.

> `current.status === 'SETUP'` 조건에 주의한다. 이미 `ACTIVE` 인 캠페인을 다른 필드만 바꾸려고 PATCH 하거나, `PAUSED → ACTIVE` 로 재개하는 경우까지 막으면 운영이 막힌다. 재개 재검증은 이 플랜의 비목표다.

> `parsed.data.startsAt`/`endsAt` 의 타입을 확인한다. `campaignSchema` 가 `z.coerce.date()` 라면 `Date` 이므로 그대로 쓰고, 문자열이면 `new Date(...)` 로 맞춘다.

- [ ] **Step 6: 라이브 확인**

jwin-api 를 띄우고, 아무것도 등록하지 않은 `SETUP` 캠페인을 직접 PATCH 해서 400 과 한국어 사유가 오는지 본다:

```bash
curl -s -X PATCH -H "Authorization: Bearer $(cat /tmp/jwin_token.txt)" \
  -H 'Content-Type: application/json' -d '{"status":"ACTIVE"}' \
  http://localhost:8080/admin/campaigns/<SETUP 캠페인 id>
```
Expected: `{"error":"캠페인을 시작할 수 없습니다 — 브랜드 계정이 연결되지 않았습니다 / 경품이 1건도 등록되지 않았습니다 / 소재가 없는 날이 있습니다: ..."}`

토큰이 없거나 만료됐으면 이 단계는 건너뛰고 보고서에 그렇게 적는다. 유닛 테스트가 로직을 덮는다.

- [ ] **Step 7: 검증**

Run:
```bash
pnpm --filter @jsure/jwin-api test
pnpm typecheck
pnpm --filter @jsure/jwin-api lint
```
Expected: green

- [ ] **Step 8: 커밋**

```bash
git add apps/jwin-api/src/routes/campaignActivation.ts \
  apps/jwin-api/src/routes/campaignActivation.test.ts \
  apps/jwin-api/src/routes/admin.ts
git commit -m "feat(jwin-api): SETUP→ACTIVE 전환 서버 검증 — 발행 전 4게이트 재확인"
```

---

### Task 4: 소재 유효기간 역전을 스키마에서 막는다

**Files:**
- Modify: `packages/jwin-shared/src/adminApi.ts`
- Modify: `apps/jwin-api/src/routes/admin.ts`
- Modify: `packages/jwin-shared/src/adminApi.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `AdminPostTemplateCreateSchema` 와 서버 `templateSchema` 가 `activeTo > activeFrom` 을 강제한다

**배경**: 지금은 `PostTemplateAddDialog.tsx` 만 검증한다. 역전 구간(`activeTo < activeFrom`)이 들어가면 그 소재는 **어떤 날에도 선택되지 않아** 조용히 게시가 빠진다 — 스케줄러가 `activeFrom <= now && now <= activeTo` 로 고르기 때문이다.

- [ ] **Step 1: jwin-shared 스키마에 refine 추가**

`packages/jwin-shared/src/adminApi.ts` 의 `AdminPostTemplateCreateSchema` 를 고친다:

```ts
export const AdminPostTemplateCreateSchema = z
  .object({
    campaignId: z.string(),
    label: z.string().min(1),
    bodyText: z.string().min(1).max(500),
    mediaUrl: z.string().url().optional(),
    activeFrom: z.string(),
    activeTo: z.string(),
  })
  // 역전 구간은 어떤 날에도 선택되지 않아 조용히 게시가 빠진다
  .refine((value) => new Date(value.activeTo) > new Date(value.activeFrom), {
    message: '유효 종료는 유효 시작 이후여야 합니다',
    path: ['activeTo'],
  });
export type AdminPostTemplateCreate = z.infer<typeof AdminPostTemplateCreateSchema>;
```

- [ ] **Step 2: 서버 스키마에 refine 추가**

`apps/jwin-api/src/routes/admin.ts` 의 `templateSchema` 를 고친다. 서버는 `z.coerce.date()` 라 값이 `Date` 다:

```ts
  const templateSchema = z
    .object({
      campaignId: z.string(),
      label: z.string().min(1),
      bodyText: z.string().min(1).max(500),
      mediaUrl: z.string().url().optional(),
      activeFrom: z.coerce.date(),
      activeTo: z.coerce.date(),
    })
    // 역전 구간은 어떤 날에도 선택되지 않아 조용히 게시가 빠진다
    .refine((value) => value.activeTo > value.activeFrom, {
      message: '유효 종료는 유효 시작 이후여야 합니다',
      path: ['activeTo'],
    });
```

> `templateSchema` 에 `.partial()` 이나 `.extend()` 를 쓰는 곳이 있으면 `.refine()` 이후에는 그 메서드를 못 쓴다(ZodEffects). `grep -n "templateSchema" apps/jwin-api/src/routes/admin.ts` 로 확인하고, 필요하면 `.refine()` 을 붙이기 전 객체를 별도 상수로 두고 파생시킨다.

- [ ] **Step 3: 테스트 추가**

`packages/jwin-shared/src/adminApi.test.ts` 의 마지막 `describe` 뒤에 추가:

```ts
describe('소재 유효기간', () => {
  const base = {
    campaignId: 'camp-1',
    label: '1주차',
    bodyText: '본문 {{LP_URL}}',
  };

  it('종료가 시작 이후면 통과한다', () => {
    const result = AdminPostTemplateCreateSchema.safeParse({
      ...base,
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeTo: '2026-09-05T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('종료가 시작보다 앞서면 거부한다 — 역전 구간은 어떤 날에도 선택되지 않는다', () => {
    const result = AdminPostTemplateCreateSchema.safeParse({
      ...base,
      activeFrom: '2026-09-05T00:00:00.000Z',
      activeTo: '2026-09-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('종료와 시작이 같아도 거부한다', () => {
    const result = AdminPostTemplateCreateSchema.safeParse({
      ...base,
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeTo: '2026-09-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
```

`AdminPostTemplateCreateSchema` 를 이 테스트 파일의 import 에 추가한다.

- [ ] **Step 4: 검증**

Run:
```bash
pnpm --filter @jsure/jwin-shared build
pnpm --filter @jsure/jwin-shared test
pnpm --filter @jsure/jwin-api test
pnpm typecheck
pnpm --filter @jsure/admin-web build
```
Expected: 전부 green

- [ ] **Step 5: 커밋**

```bash
git add packages/jwin-shared/src/adminApi.ts \
  packages/jwin-shared/src/adminApi.test.ts \
  apps/jwin-api/src/routes/admin.ts
git commit -m "fix(jwin): 소재 유효기간 역전을 서버·계약 스키마에서 차단"
```

---

### Task 5: 문서 갱신

**Files:**
- Modify: `docs/jwin/DECISIONS.md`
- Modify: `docs/jwin/MVP_PLAN.md`

- [ ] **Step 1: 결정 로그에 D-14 추가**

`docs/jwin/DECISIONS.md` 의 표 마지막(D-13 다음)에 한 줄 추가한다. 기존 행들의 형식(번호 · 항목 · 결정 · 근거 · 일자)을 그대로 따른다.

- 항목: **발행 전 검증 위치**
- 결정: **판정 순수 함수를 `jwin-shared` 로 올리고 서버가 `SETUP → ACTIVE` 를 최종 검증.** 화면 체크리스트는 UX 로 유지
- 근거: 체크리스트가 화면에만 있으면 화면 버그·직접 호출로 미비된 캠페인이 ACTIVE 가 되고, 그 뒤로는 매일 게시가 조용히 실패한다(에러도 로그도 없다). 커버리지 규칙을 화면과 스케줄러가 각자 구현하던 상태라 한쪽만 고치면 어긋나는 문제도 함께 해소. **트레이드오프**: `jwin-shared` 가 CJS 라 소비자 빌드 순서에 의존이 하나 늘고, 판정 규칙을 바꿀 때 shared 를 먼저 빌드해야 한다
- 일자: 2026-08-26

- [ ] **Step 2: MVP_PLAN 갱신**

`docs/jwin/MVP_PLAN.md` 의 Phase 4 절에 있는 "배포 전 필요한 환경 설정" 바로 앞이나 뒤에, 이번 작업을 한 단락으로 적는다: 발행 전 4게이트가 서버에서도 재검증된다는 것, 판정 함수가 `jwin-shared` 단일 소스가 됐다는 것, 그리고 **아직 통합되지 않은 중복**(`renderDmText`/`DEFAULT_DM_TEMPLATE` 가 `fulfillment.ts` 와 `dmTemplatePreview.ts` 에 각각 있음)을 후속 과제로 명시한다.

- [ ] **Step 3: 커밋**

```bash
git add docs/jwin/DECISIONS.md docs/jwin/MVP_PLAN.md
git commit -m "docs(jwin): D-14 발행 전 검증 서버 이관 기록"
```

---

## 완료 기준

- `SETUP` 캠페인을 화면 없이 직접 PATCH 로 `ACTIVE` 로 올리려 하면 **400 과 한국어 미충족 사유**가 돌아온다
- 소재 커버리지·`{{CODE}}` 판정이 화면과 서버에서 **같은 함수**로 계산된다
- 역전된 유효기간은 서버가 거부한다
- `pnpm typecheck` · `pnpm test` · `pnpm --filter @jsure/admin-web build` green
