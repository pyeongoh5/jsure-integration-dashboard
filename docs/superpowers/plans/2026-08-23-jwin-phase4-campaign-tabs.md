# J-WIN Phase 4 — 경품·소재·결과화면 탭 + 상태 전환 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민 화면만으로 J-WIN 캠페인을 `SETUP`에서 `ACTIVE`까지 올릴 수 있게 한다(= 실제 자동 포스팅 시작 가능).

**Architecture:** 순수 프론트 작업이다. 백엔드 API는 전부 존재한다. `apps/admin-web/src/components/JwinCampaignForm/`에 탭 3개(경품·소재·결과화면)와 상태 전환 UI를 이어붙인다. 운영 사고를 저장 전에 잡는 판정 로직은 전부 **순수 함수 파일로 분리하고 vitest로 테스트**한다(admin-web에 vitest 신설). 데이터 훅 / 순수 변환 / presentational 컴포넌트 / 다이얼로그를 파일 단위로 분리한다(CODE_RULES §7).

**Tech Stack:** React 18 + TypeScript + Vite 5 + vitest 2 · axios · zod(`@jsure/jwin-shared` 계약) · CSS Modules

**설계 문서:** `docs/superpowers/specs/2026-08-23-jwin-phase4-campaign-tabs-design.md`

## Global Constraints

이 플랜의 **모든 태스크에 적용된다.** 태스크별 요구사항에 암묵적으로 포함된 것으로 본다.

- **언어**: 커밋 메시지·코드 주석·화면 문자열·에러 메시지는 전부 **한국어**. (예외: `dmTemplate`의 기본 문구는 일본 최종 사용자용이라 일본어 원문 유지)
- **i18n**: J-WIN 모듈은 Phase 3 관례를 따라 **한국어 하드코딩**한다. `useT()`/`@i18n/admin` 키를 새로 만들지 않는다. (J-WIN 어드민은 J-sure 운영자 전용 단일 언어 화면 — 기존 `BasicTab.tsx`·`ConnectTab.tsx`·`JwinBrandAccountTable.tsx`가 전부 이 방식)
- **import**: admin-web 안에서는 `../../` 상대경로 금지. `@/` alias를 쓴다. 같은 디렉터리(`./`)는 허용.
- **변수·파라미터 약어 금지**: `e`, `req`, `mut`, `acc`, `tpl` 같은 축약 금지. `event`, `request`, `account`, `template`로 풀어 쓴다.
- **중첩 삼항연산자 금지** (CODE_RULES §10): early return 함수 / `Record` 상수 / `switch`로 대체한다.
- **액션마다 독립 다이얼로그 컴포넌트**: `type` prop으로 한 다이얼로그를 분기 재사용하지 않는다. 일시중지·재개·종료는 각각 별도 파일.
- **차별 함의 식별자 금지**: `blacklist` 등 사용 금지.
- **`git add -A` 금지**: 항상 의도한 파일만 명시 경로로 add 한다.
- **UI 컴포넌트는 기존 것만 쓴다**: `@/components/ui`의 `Button` `Input` `Textarea` `Dialog` `Badge` `Spinner`, `@/components/composites`의 `ScrollTable` `SegmentedTabs` `JwinStatusBadge` `JwinAccountStatusBadge`. `Input`/`Textarea`의 `onChange`는 `(value: string) => void` 시그니처다(이벤트 객체가 아님).
- **드롭다운은 native `<select>`**: admin-web에 `Select` 컴포넌트가 없다(커밋 `9011c38`에서 제거됨). `ConnectTab.tsx`처럼 native `<select>` + CSS Module로 만든다.
- **테스트는 순수 함수 전용**: jsdom·testing-library를 도입하지 않는다. UI 컴포넌트 테스트를 만들지 않는다(YAGNI).
- **각 태스크 종료 시**: `pnpm --filter @jsure/admin-web typecheck` 와 `pnpm --filter @jsure/admin-web lint` 가 green 이어야 한다.
- **`viewUrl`만 저장한다**: 미디어 업로드 후 DB에 넣는 값은 presign 응답의 `viewUrl`(만료 없는 공개 URL). `uploadUrl`(presigned PUT, 단기 만료)을 저장하면 캠페인 후반 게시가 조용히 실패한다(D-12).

---

## 파일 구조

**신규 생성**

| 경로 | 책임 |
|---|---|
| `apps/admin-web/vitest.config.ts` | vitest 설정 (순수 함수 전용, node 환경) |
| `apps/admin-web/src/lib/jwinUploads.ts` | J-WIN 미디어 presign + R2 PUT (대시보드 API) |
| `apps/admin-web/src/domains/jwin/errorMessage.ts` | jwin-api의 `{error}` 한국어 메시지 추출 |
| `.../JwinCampaignForm/jwinCodeInput.ts` | 코드 붙여넣기 파싱 (순수) |
| `.../JwinCampaignForm/jwinCodeInput.test.ts` | 〃 테스트 |
| `.../JwinCampaignForm/prizeProbability.ts` | 확률 합계 판정 (순수) |
| `.../JwinCampaignForm/prizeProbability.test.ts` | 〃 테스트 |
| `.../JwinCampaignForm/postTemplateCoverage.ts` | 소재 기간 빈틈 계산 (순수) ★ |
| `.../JwinCampaignForm/postTemplateCoverage.test.ts` | 〃 테스트 |
| `.../JwinCampaignForm/dmTemplatePreview.ts` | DM 플레이스홀더 치환 (순수) |
| `.../JwinCampaignForm/activationChecklist.ts` | ACTIVE 전환 가능 판정 (순수) ★ |
| `.../JwinCampaignForm/activationChecklist.test.ts` | 〃 테스트 |
| `.../JwinCampaignForm/useJwinMediaUpload.ts` | 업로드 상태(진행·에러) 훅 |
| `.../JwinCampaignForm/JwinMediaUpload.tsx` | 파일 선택·진행·에러 UI (소재/결과화면 공용) |
| `.../JwinCampaignForm/useJwinPrizes.ts` | 경품 목록 fetch + 추가/수정/코드추가 |
| `.../JwinCampaignForm/PrizeTab.tsx` | 경품 탭 presentational |
| `.../JwinCampaignForm/PrizeAddDialog.tsx` | 경품 추가 다이얼로그 |
| `.../JwinCampaignForm/PrizeEditDialog.tsx` | 경품 정정 다이얼로그 |
| `.../JwinCampaignForm/PrizeCodeAppendDialog.tsx` | CODE 재고 보충 다이얼로그 |
| `.../JwinCampaignForm/useJwinPostTemplates.ts` | 소재 목록 fetch + 추가/삭제 |
| `.../JwinCampaignForm/PostTemplateTab.tsx` | 소재 탭 presentational |
| `.../JwinCampaignForm/PostTemplateAddDialog.tsx` | 소재 추가 다이얼로그 |
| `.../JwinCampaignForm/useJwinResultForm.ts` | 결과화면 폼 상태 + 저장 |
| `.../JwinCampaignForm/ResultTab.tsx` | 결과화면 탭 presentational |
| `.../JwinCampaignForm/useJwinStatusTransition.ts` | 상태 전환 mutation |
| `.../JwinCampaignForm/StatusTransition.tsx` | 배지 + 전환 버튼 + 체크리스트 |
| `.../JwinCampaignForm/PauseCampaignDialog.tsx` | 일시중지 확인 |
| `.../JwinCampaignForm/ResumeCampaignDialog.tsx` | 재개 확인 |
| `.../JwinCampaignForm/EndCampaignDialog.tsx` | 종료 확인 (되돌릴 수 없음) |
| `.../JwinCampaignForm/JwinCampaignTabs.module.css` | 신규 탭 3종 + 상태 전환 공용 스타일 |

**수정**

| 경로 | 변경 |
|---|---|
| `apps/admin-web/package.json` | `vitest` devDependency + `test` 스크립트 |
| `packages/jwin-shared/src/adminApi.ts` | `AdminPrizeCreateSchema`·`AdminPostTemplateCreateSchema` 추가 |
| `apps/admin-web/src/domains/jwin/types.ts` | 위 두 스키마·타입 재노출 |
| `apps/admin-web/src/domains/jwin/api.ts` | `createPrize`·`appendPrizeCodes`·`createPostTemplate` 추가 |
| `apps/admin-web/src/components/JwinCampaignForm/index.ts` | 신규 export |
| `apps/admin-web/src/pages/Jwin/CampaignEdit.tsx` | 탭 5개 + 상태 전환 조립 |
| `apps/admin-web/src/pages/Jwin/Jwin.module.css` | 헤더 우측 상태 전환 영역 |

**기존 파일은 건드리지 않는다**: `BasicTab.tsx`, `ConnectTab.tsx`, `useJwinCampaignForm.ts`, `jwinDateTime.ts`, `JwinCampaignForm.module.css`.

---

### Task 1: admin-web vitest 신설 + 경품 순수 함수 2개

**Files:**
- Create: `apps/admin-web/vitest.config.ts`
- Modify: `apps/admin-web/package.json`
- Create: `apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.test.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/prizeProbability.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/prizeProbability.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `parseCodesInput(raw: string): string[]`
  - `summarizeCodeInput(raw: string): { count: number; duplicates: string[] }`
  - `probabilitySum(prizes: { winProbability: number }[]): number`
  - `isProbabilityOverflow(prizes: { winProbability: number }[]): boolean`

**배경**: `jwinCodeInput`은 서버 `apps/jwin-api/src/routes/admin.ts:30` 의 `parseCodesInput`과 **완전히 같은 규칙**이어야 한다. 서버는 코드 개수가 `totalQty`와 다르면 400으로 거부하는데, 화면이 다른 규칙으로 세면 운영자에게 "12건 입력했는데 왜 거부되지"가 된다.

- [ ] **Step 1: vitest 의존성 추가**

`apps/admin-web/package.json` 의 `devDependencies` 에 `"vitest": "^2.1.4"` 를 추가하고(알파벳 순서상 `typescript-eslint` 다음, `vite` 앞), `scripts` 에 `"test": "vitest run"` 을 추가한다(`"lint"` 다음 줄).

```json
  "scripts": {
    "dev": "vite",
    "build": "tsx ../../i18n/scripts/validate-i18n.ts && tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --max-warnings=0",
    "test": "vitest run",
    "typecheck": "tsc -b --noEmit",
    "clean": "rm -rf dist .turbo"
  },
```

그리고 워크스페이스 루트에서 설치:

```bash
pnpm install
```

- [ ] **Step 2: vitest 설정 파일 생성**

`apps/admin-web/vite.config.ts` 에는 sentry 플러그인과 dev 프록시가 들어 있어 테스트에 불필요하다. 별도 설정 파일을 둔다.

`apps/admin-web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 순수 함수 전용 러너. jsdom·testing-library 는 도입하지 않는다(설계 §6).
 * vite.config.ts 를 재사용하지 않는 이유: sentry 플러그인과 dev 프록시가 테스트에 불필요하다.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: 실패하는 테스트 작성 — 코드 입력 파싱**

`apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCodesInput, summarizeCodeInput } from "./jwinCodeInput";

describe("parseCodesInput", () => {
  it("개행으로 구분된 코드를 나눈다", () => {
    expect(parseCodesInput("AAA\nBBB\nCCC")).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("엑셀 열 붙여넣기(탭·CRLF)를 나눈다", () => {
    expect(parseCodesInput("AAA\r\nBBB\tCCC")).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("쉼표 구분과 앞뒤 공백을 처리한다", () => {
    expect(parseCodesInput(" AAA , BBB ")).toEqual(["AAA", "BBB"]);
  });

  it("빈 줄은 세지 않는다", () => {
    expect(parseCodesInput("AAA\n\n\nBBB\n")).toEqual(["AAA", "BBB"]);
  });

  it("빈 입력은 빈 배열", () => {
    expect(parseCodesInput("")).toEqual([]);
    expect(parseCodesInput("   \n  ")).toEqual([]);
  });
});

describe("summarizeCodeInput", () => {
  it("개수를 센다", () => {
    expect(summarizeCodeInput("AAA\nBBB\nCCC").count).toBe(3);
  });

  it("중복 코드를 잡아낸다(서버가 400으로 거부하는 조건)", () => {
    const summary = summarizeCodeInput("AAA\nBBB\nAAA\nAAA");
    expect(summary.count).toBe(4);
    expect(summary.duplicates).toEqual(["AAA"]);
  });

  it("중복이 없으면 빈 배열", () => {
    expect(summarizeCodeInput("AAA\nBBB").duplicates).toEqual([]);
  });
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/admin-web test`
Expected: FAIL — `Failed to resolve import "./jwinCodeInput"`

- [ ] **Step 5: 코드 입력 파싱 구현**

`apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.ts`:

```ts
/**
 * 기프트코드 붙여넣기 파싱.
 *
 * 서버 `apps/jwin-api/src/routes/admin.ts` 의 `parseCodesInput` 과 **같은 규칙**이어야 한다.
 * 서버는 코드 개수가 totalQty 와 다르면 400 으로 거부하므로, 규칙이 어긋나면
 * 운영자는 "12건 입력했는데 왜 거부되지"를 겪는다. (F-7.3 엑셀 열 붙여넣기 전제)
 */
export function parseCodesInput(raw: string): string[] {
  return raw
    .split(/[\r\n\t,]+/)
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}

export type CodeInputSummary = {
  count: number;
  /** 중복 등장한 코드 (서버가 400 으로 거부하는 조건) */
  duplicates: string[];
};

export function summarizeCodeInput(raw: string): CodeInputSummary {
  const codes = parseCodesInput(raw);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const code of codes) {
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);
  }
  return { count: codes.length, duplicates: [...duplicates] };
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --filter @jsure/admin-web test`
Expected: PASS (jwinCodeInput 8건)

- [ ] **Step 7: 실패하는 테스트 작성 — 확률 합계**

`apps/admin-web/src/components/JwinCampaignForm/prizeProbability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { probabilitySum, isProbabilityOverflow } from "./prizeProbability";

describe("prizeProbability", () => {
  it("경품이 없으면 합은 0", () => {
    expect(probabilitySum([])).toBe(0);
    expect(isProbabilityOverflow([])).toBe(false);
  });

  it("합이 1을 넘으면 경고 대상", () => {
    expect(isProbabilityOverflow([{ winProbability: 0.6 }, { winProbability: 0.5 }])).toBe(true);
  });

  it("합이 정확히 1이면 경고 대상이 아니다", () => {
    expect(isProbabilityOverflow([{ winProbability: 0.5 }, { winProbability: 0.5 }])).toBe(false);
  });

  it("부동소수 누적 오차로 잘못 경고하지 않는다", () => {
    const prizes = Array.from({ length: 10 }, () => ({ winProbability: 0.1 }));
    expect(isProbabilityOverflow(prizes)).toBe(false);
  });

  it("합이 1보다 작으면 경고 대상이 아니다", () => {
    expect(isProbabilityOverflow([{ winProbability: 0.01 }])).toBe(false);
  });
});
```

- [ ] **Step 8: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/admin-web test`
Expected: FAIL — `Failed to resolve import "./prizeProbability"`

- [ ] **Step 9: 확률 합계 구현**

`apps/admin-web/src/components/JwinCampaignForm/prizeProbability.ts`:

```ts
/**
 * 등록된 경품 확률의 합계 판정.
 *
 * 합이 1을 넘어도 **막지 않는다** — 추첨은 티어 순차 판정이라 동작 자체는 한다.
 * 다만 운영자가 의도한 확률과 실제가 어긋나므로 목록 위에 경고만 띄운다(설계 §3 탭3).
 */

/** 0.1 을 10번 더하면 0.9999999999999999 다. 이 오차로 잘못 경고하지 않도록 여유를 둔다. */
const OVERFLOW_EPSILON = 1e-9;

export function probabilitySum(prizes: { winProbability: number }[]): number {
  return prizes.reduce((sum, prize) => sum + prize.winProbability, 0);
}

export function isProbabilityOverflow(prizes: { winProbability: number }[]): boolean {
  return probabilitySum(prizes) > 1 + OVERFLOW_EPSILON;
}
```

- [ ] **Step 10: 전체 검증**

Run:
```bash
pnpm --filter @jsure/admin-web test
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
```
Expected: 전부 PASS (테스트 13건)

- [ ] **Step 11: 커밋**

```bash
git add apps/admin-web/package.json apps/admin-web/vitest.config.ts \
  apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.ts \
  apps/admin-web/src/components/JwinCampaignForm/jwinCodeInput.test.ts \
  apps/admin-web/src/components/JwinCampaignForm/prizeProbability.ts \
  apps/admin-web/src/components/JwinCampaignForm/prizeProbability.test.ts \
  pnpm-lock.yaml
git commit -m "test(admin-web): vitest 신설 + 경품 코드 파싱·확률 합계 순수 함수"
```

---

### Task 2: 소재 커버리지 계산 (★ 핵심 안전장치)

**Files:**
- Create: `apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.test.ts`

**Interfaces:**
- Consumes: Task 1의 vitest 설정
- Produces:
  - `type CoverageGap = { fromDateJst: string; toDateJst: string }`
  - `type PostTemplateCoverage = { postingDates: string[]; gaps: CoverageGap[] }`
  - `postTemplateCoverage(campaign: { startsAt: string; endsAt: string }, templates: { activeFrom: string; activeTo: string }[]): PostTemplateCoverage`
  - `formatCoverageGaps(gaps: CoverageGap[]): string`

**배경 — 반드시 읽을 것.** 스케줄러(`apps/jwin-api/src/services/scheduler.ts` `materializeTodayPosts`)는 **매일 JST 00:05** 에 한 번 돌면서 이 조건으로 소재를 고른다:

```ts
campaign.postTemplates.find(
  (candidate) => candidate.activeFrom <= now && now <= candidate.activeTo,
)
```

즉 어떤 날 D 에 게시가 나가려면 **D 의 00:05 JST 시점**에 유효한 소재가 있어야 한다. `activeFrom` 이 D 12:00 이면 그날 00:05 에는 아직 유효하지 않아 **그날 게시는 통째로 건너뛰어진다**. 에러도 안 나고 아무 데도 안 보인다. 그래서 커버리지 판정 시각을 **"그날 00:05 JST"** 로 맞춘다. 달력 날짜만 비교하면 이 사고를 놓친다.

캠페인 자체도 `startsAt <= now <= endsAt` 조건 안에 있어야 하므로, 00:05 시점이 캠페인 기간 밖인 날(첫날·마지막날의 일부)은 애초에 게시 대상이 아니다 — 빈틈으로 세지 않고 `postingDates` 에서도 제외한다.

**입력 날짜 형식**: 모두 UTC ISO 문자열(`AdminCampaignDetail.startsAt`, `AdminPostTemplate.activeFrom` 등 서버 응답 그대로).

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { postTemplateCoverage, formatCoverageGaps } from "./postTemplateCoverage";

/** 2026-09-01 00:00 JST ~ 2026-09-05 23:59 JST (5일) */
const CAMPAIGN = {
  startsAt: "2026-08-31T15:00:00.000Z",
  endsAt: "2026-09-05T14:59:00.000Z",
};

/** JST 날짜·시각 → UTC ISO */
function jst(dateTime: string): string {
  return new Date(`${dateTime}+09:00`).toISOString();
}

describe("postTemplateCoverage", () => {
  it("소재가 하나도 없으면 기간 전체가 빈틈", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, []);
    expect(coverage.postingDates).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-01", toDateJst: "2026-09-05" }]);
  });

  it("소재 1개가 전 기간을 덮으면 빈틈이 없다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([]);
  });

  it("중간이 비면 그 구간만 빈틈으로 잡는다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-02T23:59:00") },
      { activeFrom: jst("2026-09-05T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-03", toDateJst: "2026-09-04" }]);
  });

  it("앞뒤가 모두 비면 빈틈 구간이 두 개", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-03T00:00:00"), activeTo: jst("2026-09-03T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([
      { fromDateJst: "2026-09-01", toDateJst: "2026-09-02" },
      { fromDateJst: "2026-09-04", toDateJst: "2026-09-05" },
    ]);
  });

  it("소재 기간이 겹쳐도 빈틈으로 세지 않는다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-04T23:59:00") },
      { activeFrom: jst("2026-09-03T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([]);
  });

  it("소재가 그날 낮부터 시작하면 그날은 빈틈이다 (스케줄러가 00:05 JST에 판정)", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-03T12:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-01", toDateJst: "2026-09-03" }]);
  });

  it("00:05 JST 시점이 하나도 없는 짧은 캠페인은 게시 예정일이 없다", () => {
    const coverage = postTemplateCoverage(
      { startsAt: jst("2026-09-01T10:00:00"), endsAt: jst("2026-09-01T20:00:00") },
      [],
    );
    expect(coverage.postingDates).toEqual([]);
    expect(coverage.gaps).toEqual([]);
  });

  it("종료가 시작보다 앞서면 빈 결과를 돌려준다", () => {
    const coverage = postTemplateCoverage(
      { startsAt: jst("2026-09-05T00:00:00"), endsAt: jst("2026-09-01T00:00:00") },
      [],
    );
    expect(coverage.postingDates).toEqual([]);
    expect(coverage.gaps).toEqual([]);
  });
});

describe("formatCoverageGaps", () => {
  it("하루짜리 빈틈은 날짜 하나로 쓴다", () => {
    expect(formatCoverageGaps([{ fromDateJst: "2026-09-08", toDateJst: "2026-09-08" }])).toBe("9/8");
  });

  it("여러 날 빈틈은 물결로 잇는다", () => {
    expect(formatCoverageGaps([{ fromDateJst: "2026-09-08", toDateJst: "2026-09-10" }])).toBe(
      "9/8 ~ 9/10",
    );
  });

  it("구간이 여러 개면 쉼표로 잇는다", () => {
    expect(
      formatCoverageGaps([
        { fromDateJst: "2026-09-01", toDateJst: "2026-09-02" },
        { fromDateJst: "2026-09-10", toDateJst: "2026-09-10" },
      ]),
    ).toBe("9/1 ~ 9/2, 9/10");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/admin-web test`
Expected: FAIL — `Failed to resolve import "./postTemplateCoverage"`

- [ ] **Step 3: 커버리지 계산 구현**

`apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts`:

```ts
/**
 * 소재 커버리지 — 캠페인 기간 중 "게시가 통째로 건너뛰어지는 날"을 찾는다.
 *
 * 스케줄러(apps/jwin-api/src/services/scheduler.ts materializeTodayPosts)는
 * 매일 JST 00:05 에 한 번 돌면서 `activeFrom <= now && now <= activeTo` 인 소재를 고른다.
 * 즉 어떤 날 D 에 게시가 나가려면 **D 의 00:05 JST 시점**에 유효한 소재가 있어야 한다.
 * activeFrom 이 D 낮이면 그날은 건너뛴다 — 에러도 안 나고 아무 데도 안 보인다.
 * 그래서 달력 날짜가 아니라 이 판정 시각으로 커버 여부를 본다.
 *
 * 입력 날짜는 전부 UTC ISO 문자열(서버 응답 그대로).
 */

/** 스케줄러가 그날 소재를 고르는 시각 */
const MATERIALIZE_AT_JST = "T00:05:00+09:00";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CoverageGap = {
  /** "YYYY-MM-DD" (JST) */
  fromDateJst: string;
  toDateJst: string;
};

export type PostTemplateCoverage = {
  /** 실제로 게시가 예정되는 JST 날짜들 */
  postingDates: string[];
  /** 소재가 없어 건너뛰는 날들의 연속 구간 */
  gaps: CoverageGap[];
};

/** UTC ISO → JST 달력 날짜 "YYYY-MM-DD" */
function toDateJst(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" (JST) → 그날 스케줄러가 도는 시각의 epoch ms */
function materializeMoment(dateJst: string): number {
  return new Date(`${dateJst}${MATERIALIZE_AT_JST}`).getTime();
}

/** "YYYY-MM-DD" → 다음 날 "YYYY-MM-DD" */
function nextDateJst(dateJst: string): string {
  return new Date(new Date(`${dateJst}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

export function postTemplateCoverage(
  campaign: { startsAt: string; endsAt: string },
  templates: { activeFrom: string; activeTo: string }[],
): PostTemplateCoverage {
  const startsAt = new Date(campaign.startsAt).getTime();
  const endsAt = new Date(campaign.endsAt).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt < startsAt) {
    return { postingDates: [], gaps: [] };
  }

  const ranges = templates.map((template) => ({
    from: new Date(template.activeFrom).getTime(),
    to: new Date(template.activeTo).getTime(),
  }));

  const postingDates: string[] = [];
  const gaps: CoverageGap[] = [];
  // 열린 빈틈 구간. gaps 에 넣어둔 객체와 같은 참조라 toDateJst 만 늘려가면 된다.
  let openGap: CoverageGap | null = null;

  const lastDate = toDateJst(campaign.endsAt);
  for (let date = toDateJst(campaign.startsAt); date <= lastDate; date = nextDateJst(date)) {
    const moment = materializeMoment(date);

    // 스케줄러가 도는 시각에 캠페인이 아직 시작 전이거나 이미 끝났다 → 게시 대상이 아니다
    if (moment < startsAt || moment > endsAt) {
      openGap = null;
      continue;
    }
    postingDates.push(date);

    const covered = ranges.some((range) => range.from <= moment && moment <= range.to);
    if (covered) {
      openGap = null;
      continue;
    }
    if (openGap) {
      openGap.toDateJst = date;
      continue;
    }
    openGap = { fromDateJst: date, toDateJst: date };
    gaps.push(openGap);
  }

  return { postingDates, gaps };
}

/** "2026-09-08" → "9/8" */
function shortDate(dateJst: string): string {
  const [, month, day] = dateJst.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** 운영자에게 보여줄 문장 조각. 예: "9/1 ~ 9/2, 9/10" */
export function formatCoverageGaps(gaps: CoverageGap[]): string {
  return gaps
    .map((gap) => {
      if (gap.fromDateJst === gap.toDateJst) return shortDate(gap.fromDateJst);
      return `${shortDate(gap.fromDateJst)} ~ ${shortDate(gap.toDateJst)}`;
    })
    .join(", ");
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @jsure/admin-web test`
Expected: PASS (커버리지 11건 포함, 총 24건)

- [ ] **Step 5: 정적 검사**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
```
Expected: green

- [ ] **Step 6: 커밋**

```bash
git add apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.ts \
  apps/admin-web/src/components/JwinCampaignForm/postTemplateCoverage.test.ts
git commit -m "feat(admin-web): 소재 기간 빈틈 계산 — 스케줄러 00:05 JST 판정 기준"
```

---

### Task 3: DM 미리보기 + 발행 전 체크리스트 (★ 핵심 안전장치)

**Files:**
- Create: `apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/activationChecklist.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/activationChecklist.test.ts`

**Interfaces:**
- Consumes:
  - `type PostTemplateCoverage = { postingDates: string[]; gaps: CoverageGap[] }` (Task 2)
  - `formatCoverageGaps(gaps: CoverageGap[]): string` (Task 2)
  - `AdminCampaignDetail` · `AdminPrize` (`@/domains/jwin`)
- Produces:
  - `DEFAULT_DM_TEMPLATE: string`
  - `DM_PREVIEW_SAMPLE: DmPreviewValues`
  - `renderDmPreview(template: string, values: DmPreviewValues): string`
  - `dmTemplateMissingCode(template: string | null): boolean`
  - `type ActivationCheck = { key: ActivationCheckKey; label: string; ok: boolean; reason: string | null }`
  - `activationChecklist(input: { detail: AdminCampaignDetail; prizes: AdminPrize[]; coverage: PostTemplateCoverage }): ActivationCheck[]`
  - `canActivate(checks: ActivationCheck[]): boolean`

**배경**: `dmTemplate` 은 당첨자에게 X DM 으로 자동 발송되는 문구다. `{{CODE}}` 는 발송 직전 서버(`apps/jwin-api/src/services/fulfillment.ts` `renderDmText`)가 실제 기프트코드로 치환하는 자리표시자다. CODE 경품이 있는데 문구에 `{{CODE}}` 가 없으면 당첨자는 "축하합니다"만 받고 경품을 못 받는다. **단, 문구를 비워두면** 서버의 `DEFAULT_DM_TEMPLATE`(`{{CODE}}` 포함)이 쓰이므로 누락이 아니다.

**참고 — 기존 타입** (`@/domains/jwin` 에서 가져옴):

```ts
type AdminCampaignDetail = {
  id: string; brandName: string; slug: string;
  status: "SETUP" | "ACTIVE" | "PAUSED" | "ENDED";
  startsAt: string; endsAt: string; dailyPostTime: string; dailyWinCap: number | null;
  prUrl: string | null; winMediaUrl: string | null; loseMediaUrl: string | null;
  dmTemplate: string | null;
  brandAccountId: string | null;
  brandAccount: AdminBrandAccount | null;   // status: "PENDING" | "CONNECTED" | "NEEDS_RECONNECT"
};

type AdminPrize = {
  id: string; type: "PHYSICAL" | "CODE"; name: string; tier: number;
  totalQty: number; remainingQty: number; winProbability: number; availableCodeCount: number;
};
```

- [ ] **Step 1: DM 미리보기 순수 함수 구현**

`apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts`:

```ts
/**
 * 당첨 DM 문구의 플레이스홀더 치환 — 서버 `apps/jwin-api/src/services/fulfillment.ts`
 * 의 `renderDmText` / `DEFAULT_DM_TEMPLATE` 과 같은 규칙을 화면에서 미리 보여준다.
 *
 * 기본 문구가 일본어인 것은 최종 수신자가 일본 유저이기 때문이다(서버 원문 그대로).
 */
export const DEFAULT_DM_TEMPLATE = [
  "【{{BRAND_NAME}}】ご当選おめでとうございます！",
  "賞品: {{PRIZE_NAME}}",
  "ギフトコード: {{CODE}}",
  "※このDMは自動送信です。",
].join("\n");

export type DmPreviewValues = {
  code: string;
  prizeName: string;
  username: string;
  brandName: string;
};

/** 미리보기용 예시 값. brandName 은 호출부에서 실제 캠페인 브랜드명으로 덮어쓴다. */
export const DM_PREVIEW_SAMPLE: DmPreviewValues = {
  code: "ABCD-1234-EFGH",
  prizeName: "スターバックスカード",
  username: "taro_jp",
  brandName: "ブランド",
};

export function renderDmPreview(template: string, values: DmPreviewValues): string {
  const source = template.trim().length > 0 ? template : DEFAULT_DM_TEMPLATE;
  return source
    .replaceAll("{{CODE}}", values.code)
    .replaceAll("{{PRIZE_NAME}}", values.prizeName)
    .replaceAll("{{USERNAME}}", values.username)
    .replaceAll("{{BRAND_NAME}}", values.brandName);
}

/**
 * 코드 자리가 빠졌는지 판정.
 * 빈 문구는 서버 기본 문구(= {{CODE}} 포함)가 쓰이므로 누락이 아니다.
 */
export function dmTemplateMissingCode(template: string | null): boolean {
  if (template === null || template.trim().length === 0) return false;
  return !template.includes("{{CODE}}");
}
```

- [ ] **Step 2: 실패하는 테스트 작성 — 체크리스트**

`apps/admin-web/src/components/JwinCampaignForm/activationChecklist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activationChecklist, canActivate } from "./activationChecklist";
import type { PostTemplateCoverage } from "./postTemplateCoverage";
import type { AdminBrandAccount, AdminCampaignDetail, AdminPrize } from "@/domains/jwin";

const CONNECTED_ACCOUNT: AdminBrandAccount = {
  id: "acct-1",
  label: "브랜드 공식",
  xUserId: "1234",
  xUsername: "devsure5",
  status: "CONNECTED",
  refreshFailCount: 0,
  accessTokenExpiresAt: null,
  campaignCount: 1,
  connectUrl: "https://example.test/connect?accountId=acct-1",
};

const BASE_DETAIL: AdminCampaignDetail = {
  id: "camp-1",
  brandName: "브랜드",
  slug: "brand-2026",
  status: "SETUP",
  startsAt: "2026-08-31T15:00:00.000Z",
  endsAt: "2026-09-05T14:59:00.000Z",
  dailyPostTime: "11:00",
  dailyWinCap: null,
  prUrl: null,
  winMediaUrl: null,
  loseMediaUrl: null,
  dmTemplate: null,
  brandAccountId: "acct-1",
  brandAccount: CONNECTED_ACCOUNT,
};

const CODE_PRIZE: AdminPrize = {
  id: "prize-1",
  type: "CODE",
  name: "기프트카드",
  tier: 1,
  totalQty: 10,
  remainingQty: 10,
  winProbability: 0.1,
  availableCodeCount: 10,
};

const PHYSICAL_PRIZE: AdminPrize = { ...CODE_PRIZE, id: "prize-2", type: "PHYSICAL", availableCodeCount: 0 };

const FULL_COVERAGE: PostTemplateCoverage = {
  postingDates: ["2026-09-01", "2026-09-02"],
  gaps: [],
};

function checkOf(checks: ReturnType<typeof activationChecklist>, key: string) {
  const found = checks.find((check) => check.key === key);
  if (!found) throw new Error(`체크 항목 없음: ${key}`);
  return found;
}

describe("activationChecklist", () => {
  it("모두 충족하면 4항목 전부 ok", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checks).toHaveLength(4);
    expect(canActivate(checks)).toBe(true);
    expect(checks.every((check) => check.reason === null)).toBe(true);
  });

  it("계정 미선택은 사유를 알려준다", () => {
    const checks = activationChecklist({
      detail: { ...BASE_DETAIL, brandAccountId: null, brandAccount: null },
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "account").ok).toBe(false);
    expect(checkOf(checks, "account").reason).toContain("계정을 선택");
    expect(canActivate(checks)).toBe(false);
  });

  it("계정이 재연동 필요 상태면 통과하지 못한다", () => {
    const checks = activationChecklist({
      detail: {
        ...BASE_DETAIL,
        brandAccount: { ...CONNECTED_ACCOUNT, status: "NEEDS_RECONNECT" },
      },
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "account").ok).toBe(false);
  });

  it("경품이 없으면 통과하지 못한다", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "prize").ok).toBe(false);
    expect(canActivate(checks)).toBe(false);
  });

  it("소재 빈틈이 있으면 어느 날인지 사유에 적는다", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [PHYSICAL_PRIZE],
      coverage: {
        postingDates: ["2026-09-01", "2026-09-02", "2026-09-03"],
        gaps: [{ fromDateJst: "2026-09-02", toDateJst: "2026-09-03" }],
      },
    });
    expect(checkOf(checks, "coverage").ok).toBe(false);
    expect(checkOf(checks, "coverage").reason).toContain("9/2 ~ 9/3");
  });

  it("게시 예정일이 아예 없으면 통과하지 못한다", () => {
    const checks = activationChecklist({
      detail: BASE_DETAIL,
      prizes: [PHYSICAL_PRIZE],
      coverage: { postingDates: [], gaps: [] },
    });
    expect(checkOf(checks, "coverage").ok).toBe(false);
  });

  it("CODE 경품이 있는데 DM 문구에 {{CODE}}가 없으면 통과하지 못한다", () => {
    const checks = activationChecklist({
      detail: { ...BASE_DETAIL, dmTemplate: "おめでとうございます！" },
      prizes: [CODE_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "dmCode").ok).toBe(false);
    expect(canActivate(checks)).toBe(false);
  });

  it("CODE 경품이 있어도 DM 문구가 비어 있으면 서버 기본 문구가 쓰이므로 통과한다", () => {
    const checks = activationChecklist({
      detail: { ...BASE_DETAIL, dmTemplate: null },
      prizes: [CODE_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "dmCode").ok).toBe(true);
  });

  it("PHYSICAL 경품만 있으면 DM 문구를 검사하지 않는다", () => {
    const checks = activationChecklist({
      detail: { ...BASE_DETAIL, dmTemplate: "코드 없는 문구" },
      prizes: [PHYSICAL_PRIZE],
      coverage: FULL_COVERAGE,
    });
    expect(checkOf(checks, "dmCode").ok).toBe(true);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `pnpm --filter @jsure/admin-web test`
Expected: FAIL — `Failed to resolve import "./activationChecklist"`

- [ ] **Step 4: 체크리스트 구현**

`apps/admin-web/src/components/JwinCampaignForm/activationChecklist.ts`:

```ts
import type { AdminCampaignDetail, AdminPrize } from "@/domains/jwin";
import { dmTemplateMissingCode } from "./dmTemplatePreview";
import { formatCoverageGaps, type PostTemplateCoverage } from "./postTemplateCoverage";

/**
 * SETUP → ACTIVE 발행 전 체크리스트 (설계 §3 상태 전환).
 * 4항목을 전부 충족해야 전환 버튼이 열린다. 미충족 항목은 무엇이 부족한지 함께 보여준다.
 * 여기서 놓치면 미비된 캠페인이 ACTIVE 로 올라가 게시가 매일 조용히 실패한다.
 */

export type ActivationCheckKey = "account" | "prize" | "coverage" | "dmCode";

export type ActivationCheck = {
  key: ActivationCheckKey;
  label: string;
  ok: boolean;
  /** 미충족 사유. 충족이면 null */
  reason: string | null;
};

function accountCheck(detail: AdminCampaignDetail): ActivationCheck {
  const label = "X 계정 연동";
  if (!detail.brandAccountId || !detail.brandAccount) {
    return { key: "account", label, ok: false, reason: "연동 탭에서 브랜드 계정을 선택하세요." };
  }
  if (detail.brandAccount.status !== "CONNECTED") {
    return {
      key: "account",
      label,
      ok: false,
      reason: "선택한 계정이 연동 완료 상태가 아닙니다. 브랜드 계정 페이지에서 연동을 마치세요.",
    };
  }
  return { key: "account", label, ok: true, reason: null };
}

function prizeCheck(prizes: AdminPrize[]): ActivationCheck {
  const label = "경품 1건 이상";
  if (prizes.length === 0) {
    return { key: "prize", label, ok: false, reason: "경품 탭에서 경품을 1건 이상 등록하세요." };
  }
  return { key: "prize", label, ok: true, reason: null };
}

function coverageCheck(coverage: PostTemplateCoverage): ActivationCheck {
  const label = "기간 전체를 덮는 소재";
  if (coverage.postingDates.length === 0) {
    return {
      key: "coverage",
      label,
      ok: false,
      reason: "게시 예정일이 없습니다. 기본 탭에서 캠페인 기간을 하루 이상으로 잡으세요.",
    };
  }
  if (coverage.gaps.length > 0) {
    return {
      key: "coverage",
      label,
      ok: false,
      reason: `소재가 없는 날: ${formatCoverageGaps(coverage.gaps)}`,
    };
  }
  return { key: "coverage", label, ok: true, reason: null };
}

function dmCodeCheck(prizes: AdminPrize[], dmTemplate: string | null): ActivationCheck {
  const label = "당첨 DM에 {{CODE}}";
  const hasCodePrize = prizes.some((prize) => prize.type === "CODE");
  if (!hasCodePrize || !dmTemplateMissingCode(dmTemplate)) {
    return { key: "dmCode", label, ok: true, reason: null };
  }
  return {
    key: "dmCode",
    label,
    ok: false,
    reason: "CODE 경품이 있으면 DM 문구에 {{CODE}}가 있어야 합니다. 없으면 당첨자가 코드를 못 받습니다.",
  };
}

export function activationChecklist(input: {
  detail: AdminCampaignDetail;
  prizes: AdminPrize[];
  coverage: PostTemplateCoverage;
}): ActivationCheck[] {
  return [
    accountCheck(input.detail),
    prizeCheck(input.prizes),
    coverageCheck(input.coverage),
    dmCodeCheck(input.prizes, input.detail.dmTemplate),
  ];
}

export function canActivate(checks: ActivationCheck[]): boolean {
  return checks.every((check) => check.ok);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @jsure/admin-web test`
Expected: PASS (체크리스트 9건 포함, 총 33건)

- [ ] **Step 6: 정적 검사**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
```
Expected: green

- [ ] **Step 7: 커밋**

```bash
git add apps/admin-web/src/components/JwinCampaignForm/dmTemplatePreview.ts \
  apps/admin-web/src/components/JwinCampaignForm/activationChecklist.ts \
  apps/admin-web/src/components/JwinCampaignForm/activationChecklist.test.ts
git commit -m "feat(admin-web): DM 플레이스홀더 미리보기 + 발행 전 체크리스트 판정"
```

---

### Task 4: API 계약 확장 — 경품·소재 생성 + 서버 에러 메시지 노출

**Files:**
- Modify: `packages/jwin-shared/src/adminApi.ts` (파일 끝 `AdminPostTemplateListSchema` 정의 뒤)
- Modify: `apps/admin-web/src/domains/jwin/types.ts`
- Modify: `apps/admin-web/src/domains/jwin/api.ts`
- Create: `apps/admin-web/src/domains/jwin/errorMessage.ts`
- Modify: `apps/admin-web/src/domains/jwin/index.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `AdminPrizeCreate` = `{ campaignId: string; type: "PHYSICAL" | "CODE"; name: string; tier: number; totalQty: number; winProbability: number; codesText?: string }`
  - `AdminPostTemplateCreate` = `{ campaignId: string; label: string; bodyText: string; mediaUrl?: string; activeFrom: string; activeTo: string }`
  - `createPrize(body: AdminPrizeCreate): Promise<void>`
  - `appendPrizeCodes(prizeId: string, codesText: string): Promise<void>`
  - `createPostTemplate(body: AdminPostTemplateCreate): Promise<void>`
  - `jwinErrorMessage(error: unknown, fallback: string): string`

**배경 두 가지.**

1. jwin-api 의 `POST /admin/prizes` 와 `POST /admin/post-templates` 는 Prisma 모델을 그대로 돌려준다(`AdminPrizeSchema` 모양이 아니다). 그래서 **응답을 파싱하지 않고 `void` 로 두고, 호출부는 목록을 다시 불러온다.** 서버 응답 모양을 바꾸는 것은 이 Phase 범위 밖이다.
2. jwin-api 는 실패를 `{ error: "한국어 메시지" }` 로 돌려주는데, axios 의 기본 `Error.message` 는 `"Request failed with status code 400"` 이라 운영자에게 아무 정보도 못 준다. 이 Phase 에서 특히 중요한 메시지들이 전부 여기 실린다:
   - `코드 수(11)가 수량(12)과 일치하지 않습니다`
   - `중복된 코드가 있습니다`
   - `CODE 경품의 수량은 코드 등록(POST /admin/prizes/:id/codes)으로만 변경됩니다`
   - `이미 게시에 사용된 소재는 삭제할 수 없습니다`

   서버 메시지를 꺼내는 헬퍼를 두고, 이 Phase 의 모든 mutation 이 그것을 쓴다.

- [ ] **Step 1: jwin-shared 에 요청 스키마 2개 추가**

`packages/jwin-shared/src/adminApi.ts` 의 `AdminPostTemplateListSchema` / `AdminPostTemplateList` 정의 **바로 뒤**에 추가한다:

```ts
/** POST /admin/prizes (요청) — 서버 admin.ts prizeSchema 와 같은 모양 (F-1.3, F-7.3) */
export const AdminPrizeCreateSchema = z.object({
  campaignId: z.string(),
  type: PrizeTypeSchema,
  name: z.string().min(1),
  tier: z.number().int().min(1),
  totalQty: z.number().int().positive(),
  winProbability: z.number().gt(0).lt(1),
  /** CODE 경품: 엑셀 붙여넣기 원문(개행/탭/쉼표 구분). 코드 개수는 totalQty 와 같아야 한다 */
  codesText: z.string().optional(),
});
export type AdminPrizeCreate = z.infer<typeof AdminPrizeCreateSchema>;

/** POST /admin/post-templates (요청) — 날짜는 ISO 문자열 (F-1.2) */
export const AdminPostTemplateCreateSchema = z.object({
  campaignId: z.string(),
  label: z.string().min(1),
  bodyText: z.string().min(1).max(500),
  mediaUrl: z.string().url().optional(),
  activeFrom: z.string(),
  activeTo: z.string(),
});
export type AdminPostTemplateCreate = z.infer<typeof AdminPostTemplateCreateSchema>;
```

- [ ] **Step 2: jwin-shared 빌드 + 스키마 검증**

Run:
```bash
pnpm --filter @jsure/jwin-shared build
pnpm --filter @jsure/jwin-shared test
```
Expected: green (기존 테스트 7건 유지)

- [ ] **Step 3: admin-web 도메인 타입 재노출**

`apps/admin-web/src/domains/jwin/types.ts` 의 값 export 목록에 `AdminPrizeCreateSchema`, `AdminPostTemplateCreateSchema` 를 추가하고(각각 `AdminPrizePatchSchema` 다음, `AdminPostTemplateListSchema` 다음), 타입 export 목록에 `AdminPrizeCreate`, `AdminPostTemplateCreate` 를 같은 위치에 추가한다.

```ts
export {
  // …기존 유지…
  AdminPrizeSchema,
  AdminPrizeListSchema,
  AdminPrizePatchSchema,
  AdminPrizeCreateSchema,
  AdminPostTemplateSchema,
  AdminPostTemplateListSchema,
  AdminPostTemplateCreateSchema,
  // …기존 유지…
} from "@jsure/jwin-shared";
export type {
  // …기존 유지…
  AdminPrize,
  AdminPrizeList,
  AdminPrizePatch,
  AdminPrizeCreate,
  AdminPostTemplate,
  AdminPostTemplateList,
  AdminPostTemplateCreate,
  // …기존 유지…
} from "@jsure/jwin-shared";
```

- [ ] **Step 4: 서버 에러 메시지 추출 헬퍼 작성**

`apps/admin-web/src/domains/jwin/errorMessage.ts`:

```ts
import axios from "axios";

/**
 * jwin-api 는 실패를 `{ error: "한국어 메시지" }` 로 돌려준다.
 * axios 의 기본 Error.message 는 "Request failed with status code 400" 이라
 * 운영자에게 아무 정보도 주지 못한다 — 서버가 준 메시지를 우선 꺼낸다.
 *
 * zod 검증 실패는 `{ error: <flatten 객체> }` 라 문자열이 아니다. 그때는 fallback 을 쓴다.
 */
export function jwinErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: unknown } | undefined;
    if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}
```

`apps/admin-web/src/domains/jwin/index.ts` 에 재노출을 추가한다:

```ts
export * from "./api";
export * from "./types";
export * from "./errorMessage";
```

- [ ] **Step 5: 생성 API 3개 추가**

`apps/admin-web/src/domains/jwin/api.ts` 의 import 블록에 타입 3개를 더한다 — `type AdminPrizeCreate`, `type AdminPostTemplateCreate` (`type AdminPrizePatch` 근처).

그리고 파일 끝(`createBrandAccount` 뒤)에 추가한다:

```ts
/**
 * 경품 등록 (코드 동시 등록 — F-1.3, F-7.3).
 * 서버가 Prisma 모델을 그대로 돌려주므로(AdminPrizeSchema 모양이 아님) 응답을 파싱하지 않는다.
 * 호출부는 성공 후 `fetchPrizes` 로 목록을 다시 불러온다.
 */
export async function createPrize(body: AdminPrizeCreate): Promise<void> {
  await jwinApi.post(`/admin/prizes`, body);
}

/** CODE 재고 보충. 본문은 붙여넣기 원문 그대로(jwin-api 가 text/plain 파서를 등록해 둔다). */
export async function appendPrizeCodes(prizeId: string, codesText: string): Promise<void> {
  await jwinApi.post(`/admin/prizes/${prizeId}/codes`, codesText, {
    headers: { "Content-Type": "text/plain" },
  });
}

/** 소재 등록. 서버 응답이 Prisma 모델이라 파싱하지 않는다 — 호출부가 목록을 다시 불러온다. */
export async function createPostTemplate(body: AdminPostTemplateCreate): Promise<void> {
  await jwinApi.post(`/admin/post-templates`, body);
}
```

- [ ] **Step 6: 정적 검사**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/admin-web test
```
Expected: green

- [ ] **Step 7: 커밋**

```bash
git add packages/jwin-shared/src/adminApi.ts \
  apps/admin-web/src/domains/jwin/types.ts \
  apps/admin-web/src/domains/jwin/api.ts \
  apps/admin-web/src/domains/jwin/errorMessage.ts \
  apps/admin-web/src/domains/jwin/index.ts
git commit -m "feat(admin-web): 경품·소재 생성 API + jwin-api 한국어 에러 메시지 노출"
```

---

### Task 5: 미디어 업로드 (소재·결과화면 공용)

**Files:**
- Create: `apps/admin-web/src/lib/jwinUploads.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/useJwinMediaUpload.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/JwinMediaUpload.tsx`
- Create: `apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `uploadJwinMedia(file: File): Promise<string>` — 만료 없는 공개 URL(`viewUrl`) 반환
  - `class JwinUploadError extends Error`
  - `useJwinMediaUpload(): { uploading: boolean; error: string | null; upload: (file: File) => Promise<string | null>; clearError: () => void }`
  - `<JwinMediaUpload label={string} value={string | null} onChange={(url: string | null) => void} disabled?={boolean} />`

**배경**: D-12 에 따라 대시보드 R2 를 재사용한다. 엔드포인트는 `POST /uploads/admin/jwin-media/presign` (대시보드 API — `api` 인스턴스, jwin-api 가 아니다). 계약은 `@jsure/shared` 의 `JwinMediaUploadPresignRequestSchema` / `JwinMediaUploadPresignResponseSchema`. **응답의 `viewUrl` 이 만료 없는 공개 URL이고, 이것만 저장한다** — jwin-api 가 게시 시각마다 이 URL 을 fetch 하므로 만료되는 `uploadUrl` 을 저장하면 캠페인 후반 게시가 조용히 실패한다.

기존 `apps/admin-web/src/lib/uploads.ts` 의 `uploadCampaignThumbnail` 이 같은 흐름(presign → `fetch` PUT)이니 그 형태를 따른다. 단 J-WIN 은 i18n 을 쓰지 않으므로 에러 메시지는 한국어 하드코딩이다.

`@jsure/shared` 에 이미 있는 상수: `JWIN_MEDIA_MAX_BYTES` (100MB), `JWIN_MEDIA_ALLOWED_CONTENT_TYPES` (`["image/png","image/jpeg","image/webp","video/mp4"]`), `type JwinMediaContentType`.

- [ ] **Step 1: 업로드 함수 작성**

`apps/admin-web/src/lib/jwinUploads.ts`:

```ts
import {
  JwinMediaUploadPresignResponseSchema,
  JWIN_MEDIA_ALLOWED_CONTENT_TYPES,
  JWIN_MEDIA_MAX_BYTES,
  type JwinMediaContentType,
} from "@jsure/shared";
import { api } from "./api";

export class JwinUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwinUploadError";
  }
}

function assertAllowed(file: File): JwinMediaContentType {
  if (!JWIN_MEDIA_ALLOWED_CONTENT_TYPES.includes(file.type as JwinMediaContentType)) {
    throw new JwinUploadError("PNG·JPEG·WebP 이미지 또는 MP4 동영상만 올릴 수 있습니다.");
  }
  if (file.size > JWIN_MEDIA_MAX_BYTES) {
    const maxMb = (JWIN_MEDIA_MAX_BYTES / 1024 / 1024).toFixed(0);
    throw new JwinUploadError(`파일이 너무 큽니다. ${maxMb}MB 이하만 올릴 수 있습니다.`);
  }
  return file.type as JwinMediaContentType;
}

/**
 * J-WIN 포스트 미디어 업로드 (D-12: 대시보드 R2 재사용).
 *
 * presign → R2 로 직접 PUT → **만료 없는 공개 URL(viewUrl)** 반환.
 * jwin-api 가 게시 시각마다 이 URL 을 fetch 하므로 만료되는 uploadUrl 을 저장하면
 * 캠페인 후반 게시가 조용히 실패한다. 반드시 viewUrl 만 저장한다.
 */
export async function uploadJwinMedia(file: File): Promise<string> {
  const contentType = assertAllowed(file);

  const presignResponse = await api.post("/uploads/admin/jwin-media/presign", {
    contentType,
    sizeBytes: file.size,
  });
  const presign = JwinMediaUploadPresignResponseSchema.parse(presignResponse.data);

  const putResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new JwinUploadError(`업로드에 실패했습니다 (HTTP ${putResponse.status}).`);
  }

  return presign.viewUrl;
}
```

- [ ] **Step 2: 업로드 상태 훅 작성**

`apps/admin-web/src/components/JwinCampaignForm/useJwinMediaUpload.ts`:

```ts
import { useState } from "react";
import { JwinUploadError, uploadJwinMedia } from "@/lib/jwinUploads";

/**
 * 파일 하나를 올리는 동안의 진행·에러 상태만 들고 있는다.
 * 올라간 URL 을 어디에 넣을지는 호출부(소재 폼 / 결과화면 폼)가 정한다.
 */
export function useJwinMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 성공하면 공개 URL, 실패하면 null (에러 메시지는 error 에 담긴다) */
  const upload = async (file: File): Promise<string | null> => {
    setUploading(true);
    setError(null);
    try {
      return await uploadJwinMedia(file);
    } catch (caught: unknown) {
      if (caught instanceof JwinUploadError) setError(caught.message);
      else setError("업로드에 실패했습니다. 잠시 후 다시 시도하세요.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, error, upload, clearError: () => setError(null) };
}
```

- [ ] **Step 3: 공용 CSS Module 작성**

`apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css` — 이 파일은 Task 5~9 가 함께 쓴다. 여기서는 업로드 관련 클래스만 먼저 넣고, 이후 태스크가 자기 클래스를 이어붙인다.

```css
/* ── 미디어 업로드 (소재·결과화면 공용) ── */
.upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.uploadRow {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.uploadLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #4b5563);
}

.uploadHint {
  font-size: 12px;
  color: var(--text-tertiary, #6b7280);
}

.uploadError {
  font-size: 12px;
  color: var(--danger, #dc2626);
}

.preview {
  max-width: 240px;
  max-height: 160px;
  border-radius: 6px;
  border: 1px solid var(--border, #e5e7eb);
  object-fit: contain;
}

.fileInput {
  display: none;
}
```

- [ ] **Step 4: 업로드 UI 컴포넌트 작성**

`apps/admin-web/src/components/JwinCampaignForm/JwinMediaUpload.tsx`:

```tsx
import { useRef } from "react";
import { Button } from "@/components/ui";
import { useJwinMediaUpload } from "./useJwinMediaUpload";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  label: string;
  /** 저장된 공개 URL. 없으면 null */
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

/** URL 확장자로 동영상 여부를 본다. R2 공개 URL 은 확장자를 유지한다. */
function isVideo(url: string): boolean {
  return url.toLowerCase().endsWith(".mp4");
}

/**
 * 파일 선택 → presign → R2 PUT → 만료 없는 공개 URL 을 onChange 로 올려보낸다 (D-12).
 * 소재 탭과 결과화면 탭이 함께 쓴다.
 */
export function JwinMediaUpload({ label, value, onChange, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, error, upload, clearError } = useJwinMediaUpload();

  const handleSelect = async (file: File | undefined) => {
    if (!file) return;
    const url = await upload(file);
    if (url) onChange(url);
    // 같은 파일을 다시 고를 수 있도록 입력값을 비운다
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = () => {
    clearError();
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={styles.upload}>
      <span className={styles.uploadLabel}>{label}</span>
      <input
        ref={inputRef}
        type="file"
        className={styles.fileInput}
        accept="image/png,image/jpeg,image/webp,video/mp4"
        onChange={(event) => void handleSelect(event.target.files?.[0])}
      />
      <div className={styles.uploadRow}>
        <Button
          variant="secondary"
          size="md"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? "업로드 중…" : "파일 선택"}
        </Button>
        {value && !uploading && (
          <Button variant="secondary" size="md" onClick={handleRemove} disabled={disabled}>
            제거
          </Button>
        )}
        {!value && !uploading && (
          <span className={styles.uploadHint}>PNG·JPEG·WebP·MP4 / 100MB 이하</span>
        )}
      </div>
      {value && isVideo(value) && (
        <video className={styles.preview} src={value} controls preload="metadata" />
      )}
      {value && !isVideo(value) && <img className={styles.preview} src={value} alt={label} />}
      {error && <span className={styles.uploadError}>{error}</span>}
    </div>
  );
}
```

- [ ] **Step 5: index 재노출**

`apps/admin-web/src/components/JwinCampaignForm/index.ts` 에 추가:

```ts
export { JwinMediaUpload } from "./JwinMediaUpload";
```

- [ ] **Step 6: 정적 검사**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/admin-web test
```
Expected: green

- [ ] **Step 7: 커밋**

```bash
git add apps/admin-web/src/lib/jwinUploads.ts \
  apps/admin-web/src/components/JwinCampaignForm/useJwinMediaUpload.ts \
  apps/admin-web/src/components/JwinCampaignForm/JwinMediaUpload.tsx \
  apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css \
  apps/admin-web/src/components/JwinCampaignForm/index.ts
git commit -m "feat(admin-web): J-WIN 미디어 업로드 — presign 후 만료 없는 공개 URL 저장"
```

---

### Task 6: 경품 탭

**Files:**
- Create: `apps/admin-web/src/components/JwinCampaignForm/useJwinPrizes.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/PrizeTab.tsx`
- Create: `apps/admin-web/src/components/JwinCampaignForm/PrizeAddDialog.tsx`
- Create: `apps/admin-web/src/components/JwinCampaignForm/PrizeEditDialog.tsx`
- Create: `apps/admin-web/src/components/JwinCampaignForm/PrizeCodeAppendDialog.tsx`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css` (클래스 추가)
- Modify: `apps/admin-web/src/components/JwinCampaignForm/index.ts`

**Interfaces:**
- Consumes:
  - `summarizeCodeInput(raw: string): { count: number; duplicates: string[] }` (Task 1)
  - `isProbabilityOverflow(prizes: { winProbability: number }[]): boolean`, `probabilitySum(...)` (Task 1)
  - `createPrize(body: AdminPrizeCreate): Promise<void>`, `appendPrizeCodes(prizeId, codesText): Promise<void>`, `updatePrize(prizeId, body: AdminPrizePatch): Promise<AdminPrize>`, `fetchPrizes(campaignId): Promise<AdminPrizeList>`, `jwinErrorMessage(error, fallback)` (Task 4 / 기존)
- Produces:
  - `useJwinPrizes(campaignId: string): UseJwinPrizesResult` — 아래 타입 정의 참조
  - `<PrizeTab prizes={AdminPrize[]} state={…} onAdd={…} onEdit={…} onAppendCodes={…} />`

**규칙 3가지 (서버가 강제하므로 화면도 맞춘다)**

1. `type=CODE` 이면 붙여넣은 코드 개수가 `totalQty` 와 **정확히 같아야** 서버가 받는다. 다르면 400.
2. 중복 코드가 있으면 400.
3. **CODE 경품의 `totalQty` 는 PATCH 로 못 바꾼다**(커밋 `d1bed06` — 유령 재고 방지). 수량 변경은 코드 추가 등록으로만. 그래서 정정 다이얼로그에서 CODE 경품의 수량 입력은 비활성화한다.

확률 합계가 1을 넘으면 목록 위에 경고만 띄우고 **막지는 않는다**(티어 순차 판정이라 동작 자체는 한다).

- [ ] **Step 1: 데이터 훅 작성**

`apps/admin-web/src/components/JwinCampaignForm/useJwinPrizes.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import {
  appendPrizeCodes,
  createPrize,
  fetchPrizes,
  jwinErrorMessage,
  updatePrize,
  type AdminPrize,
  type AdminPrizeCreate,
  type AdminPrizePatch,
} from "@/domains/jwin";

export type JwinPrizesLoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export type UseJwinPrizesResult = {
  state: JwinPrizesLoadState;
  prizes: AdminPrize[];
  reload: () => void;
  /** 성공하면 true. 실패 사유는 반환값이 아니라 각 다이얼로그가 받는 문자열로 전달된다. */
  add: (body: Omit<AdminPrizeCreate, "campaignId">) => Promise<string | null>;
  edit: (prizeId: string, body: AdminPrizePatch) => Promise<string | null>;
  appendCodes: (prizeId: string, codesText: string) => Promise<string | null>;
};

/**
 * 경품 목록 + 등록/정정/코드보충.
 * 등록·보충 API 는 Prisma 모델을 그대로 돌려주므로 응답을 쓰지 않고 목록을 다시 불러온다.
 * 각 mutation 은 성공 시 null, 실패 시 **서버가 준 한국어 메시지**를 돌려준다.
 */
export function useJwinPrizes(campaignId: string): UseJwinPrizesResult {
  const [state, setState] = useState<JwinPrizesLoadState>({ kind: "loading" });
  const [prizes, setPrizes] = useState<AdminPrize[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchPrizes(campaignId)
      .then((result) => {
        if (cancelled) return;
        setPrizes(result.prizes);
        setState({ kind: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ kind: "error", message: jwinErrorMessage(error, "경품 목록을 불러올 수 없습니다.") });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadKey]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  const add = useCallback(
    async (body: Omit<AdminPrizeCreate, "campaignId">): Promise<string | null> => {
      try {
        await createPrize({ ...body, campaignId });
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, "경품 등록에 실패했습니다.");
      }
    },
    [campaignId, reload],
  );

  const edit = useCallback(
    async (prizeId: string, body: AdminPrizePatch): Promise<string | null> => {
      try {
        await updatePrize(prizeId, body);
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, "경품 정정에 실패했습니다.");
      }
    },
    [reload],
  );

  const appendCodes = useCallback(
    async (prizeId: string, codesText: string): Promise<string | null> => {
      try {
        await appendPrizeCodes(prizeId, codesText);
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, "코드 등록에 실패했습니다.");
      }
    },
    [reload],
  );

  return { state, prizes, reload, add, edit, appendCodes };
}
```

- [ ] **Step 2: CSS 클래스 추가**

`apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css` **끝에** 이어붙인다:

```css
/* ── 탭 공용 ── */
.tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tabHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tabTitle {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.empty {
  padding: 32px;
  text-align: center;
  color: var(--text-tertiary, #6b7280);
  font-size: 13px;
}

.warning {
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--warning-bg, #fef3c7);
  color: var(--warning-text, #92400e);
  font-size: 13px;
  line-height: 1.5;
}

.errorText {
  font-size: 12px;
  color: var(--danger, #dc2626);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th,
.table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  text-align: left;
  white-space: nowrap;
}

.table th {
  font-weight: 600;
  color: var(--text-secondary, #4b5563);
}

.num {
  text-align: right;
}

.rowActions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

/* ── 다이얼로그 폼 ── */
.dialogBody {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 420px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fieldLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #4b5563);
}

.fieldHint {
  font-size: 12px;
  color: var(--text-tertiary, #6b7280);
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.typeChoice {
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 13px;
}
```

- [ ] **Step 3: 경품 추가 다이얼로그 작성**

`apps/admin-web/src/components/JwinCampaignForm/PrizeAddDialog.tsx`:

```tsx
import { useState } from "react";
import { Button, Dialog, Input, Textarea } from "@/components/ui";
import type { AdminPrizeCreate } from "@/domains/jwin";
import { summarizeCodeInput } from "./jwinCodeInput";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 성공하면 null, 실패하면 서버 메시지 */
  onAdd: (body: Omit<AdminPrizeCreate, "campaignId">) => Promise<string | null>;
};

type PrizeType = "PHYSICAL" | "CODE";

/** 경품 추가. 입력 상태는 여기서만 보관한다(CODE_RULES §7 — 부모로 끌어올리지 않음). */
export function PrizeAddDialog({ open, onClose, onAdd }: Props) {
  const [type, setType] = useState<PrizeType>("PHYSICAL");
  const [name, setName] = useState("");
  const [tier, setTier] = useState("1");
  const [totalQty, setTotalQty] = useState("");
  const [winProbability, setWinProbability] = useState("");
  const [codesText, setCodesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantity = Number(totalQty);
  const probability = Number(winProbability);
  const codeSummary = summarizeCodeInput(codesText);

  const reset = () => {
    setType("PHYSICAL");
    setName("");
    setTier("1");
    setTotalQty("");
    setWinProbability("");
    setCodesText("");
    setSaving(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validationError = (): string | null => {
    if (!name.trim()) return "경품 이름을 입력하세요.";
    if (!Number.isInteger(quantity) || quantity <= 0) return "수량은 1 이상의 정수여야 합니다.";
    if (!Number.isInteger(Number(tier)) || Number(tier) < 1) return "티어는 1 이상의 정수여야 합니다.";
    if (!(probability > 0 && probability < 1)) return "확률은 0보다 크고 1보다 작아야 합니다.";
    if (type !== "CODE") return null;
    if (codeSummary.duplicates.length > 0) {
      return `중복된 코드가 있습니다: ${codeSummary.duplicates.slice(0, 3).join(", ")}`;
    }
    if (codeSummary.count !== quantity) {
      return `코드 수(${codeSummary.count})가 수량(${quantity})과 일치하지 않습니다.`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onAdd({
      type,
      name: name.trim(),
      tier: Number(tier),
      totalQty: quantity,
      winProbability: probability,
      codesText: type === "CODE" ? codesText : undefined,
    });
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="경품 추가"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={handleClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? "등록 중…" : "등록"}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>유형</span>
          <div className={styles.typeChoice}>
            <label>
              <input
                type="radio"
                name="prize-type"
                checked={type === "PHYSICAL"}
                onChange={() => setType("PHYSICAL")}
              />{" "}
              현물 (배송지 수집)
            </label>
            <label>
              <input
                type="radio"
                name="prize-type"
                checked={type === "CODE"}
                onChange={() => setType("CODE")}
              />{" "}
              기프트코드 (DM 자동 발송)
            </label>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>이름</span>
          <Input value={name} onChange={setName} placeholder="예: スターバックスカード 500円" />
        </div>

        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>티어</span>
            <Input type="number" min={1} value={tier} onChange={setTier} />
            <span className={styles.fieldHint}>숫자가 작을수록 먼저 판정합니다.</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>수량</span>
            <Input type="number" min={1} value={totalQty} onChange={setTotalQty} placeholder="10" />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>당첨 확률</span>
          <Input
            type="number"
            step="0.001"
            min={0}
            max={1}
            value={winProbability}
            onChange={setWinProbability}
            placeholder="0.05"
          />
          <span className={styles.fieldHint}>0 초과 1 미만. 0.05 = 5%</span>
        </div>

        {type === "CODE" && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>기프트코드</span>
            <Textarea
              value={codesText}
              onChange={setCodesText}
              rows={8}
              placeholder={"엑셀에서 코드 열을 그대로 복사해 붙여넣으세요.\nABCD-1234\nEFGH-5678"}
            />
            <span className={styles.fieldHint}>
              입력 {codeSummary.count}건 / 수량 {Number.isFinite(quantity) ? quantity : 0} — 개수가
              같아야 등록됩니다.
            </span>
            {codeSummary.duplicates.length > 0 && (
              <span className={styles.errorText}>
                중복 {codeSummary.duplicates.length}건: {codeSummary.duplicates.slice(0, 3).join(", ")}
              </span>
            )}
          </div>
        )}

        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: 경품 정정 다이얼로그 작성**

`apps/admin-web/src/components/JwinCampaignForm/PrizeEditDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Button, Dialog, Input } from "@/components/ui";
import type { AdminPrize, AdminPrizePatch } from "@/domains/jwin";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  /** null 이면 닫힘 */
  prize: AdminPrize | null;
  onClose: () => void;
  onEdit: (prizeId: string, body: AdminPrizePatch) => Promise<string | null>;
};

/**
 * 경품 정정 (이름·티어·수량·확률).
 * CODE 경품의 수량은 서버가 PATCH 를 거부한다(유령 재고 방지) — 입력을 잠그고 안내한다.
 */
export function PrizeEditDialog({ prize, onClose, onEdit }: Props) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState("1");
  const [totalQty, setTotalQty] = useState("");
  const [winProbability, setWinProbability] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prize) return;
    setName(prize.name);
    setTier(String(prize.tier));
    setTotalQty(String(prize.totalQty));
    setWinProbability(String(prize.winProbability));
    setError(null);
  }, [prize]);

  const handleSubmit = async () => {
    if (!prize) return;
    const quantity = Number(totalQty);
    const probability = Number(winProbability);
    if (!name.trim()) {
      setError("경품 이름을 입력하세요.");
      return;
    }
    if (!(probability > 0 && probability < 1)) {
      setError("확률은 0보다 크고 1보다 작아야 합니다.");
      return;
    }
    const body: AdminPrizePatch = {
      name: name.trim(),
      tier: Number(tier),
      winProbability: probability,
    };
    // CODE 경품은 수량을 보내지 않는다 — 서버가 거부한다
    if (prize.type !== "CODE") body.totalQty = quantity;

    setSaving(true);
    setError(null);
    const failure = await onEdit(prize.id, body);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={prize !== null}
      onClose={onClose}
      title="경품 정정"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>이름</span>
          <Input value={name} onChange={setName} />
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>티어</span>
            <Input type="number" min={1} value={tier} onChange={setTier} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>수량</span>
            <Input
              type="number"
              min={1}
              value={totalQty}
              onChange={setTotalQty}
              disabled={prize?.type === "CODE"}
            />
            {prize?.type === "CODE" && (
              <span className={styles.fieldHint}>
                기프트코드 경품의 수량은 코드를 추가 등록해야 늘어납니다.
              </span>
            )}
          </div>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>당첨 확률</span>
          <Input
            type="number"
            step="0.001"
            min={0}
            max={1}
            value={winProbability}
            onChange={setWinProbability}
          />
        </div>
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 5: 코드 보충 다이얼로그 작성**

`apps/admin-web/src/components/JwinCampaignForm/PrizeCodeAppendDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Button, Dialog, Textarea } from "@/components/ui";
import type { AdminPrize } from "@/domains/jwin";
import { summarizeCodeInput } from "./jwinCodeInput";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  /** null 이면 닫힘 */
  prize: AdminPrize | null;
  onClose: () => void;
  onAppendCodes: (prizeId: string, codesText: string) => Promise<string | null>;
};

/** 기프트코드 재고 보충. 등록한 개수만큼 수량과 잔여가 함께 늘어난다. */
export function PrizeCodeAppendDialog({ prize, onClose, onAppendCodes }: Props) {
  const [codesText, setCodesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCodesText("");
    setError(null);
  }, [prize]);

  const summary = summarizeCodeInput(codesText);

  const handleSubmit = async () => {
    if (!prize) return;
    if (summary.count === 0) {
      setError("코드를 입력하세요.");
      return;
    }
    if (summary.duplicates.length > 0) {
      setError(`중복된 코드가 있습니다: ${summary.duplicates.slice(0, 3).join(", ")}`);
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onAppendCodes(prize.id, codesText);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={prize !== null}
      onClose={onClose}
      title={prize ? `코드 추가 — ${prize.name}` : "코드 추가"}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? "등록 중…" : `${summary.count}건 등록`}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>추가할 기프트코드</span>
          <Textarea
            value={codesText}
            onChange={setCodesText}
            rows={8}
            placeholder={"엑셀에서 코드 열을 그대로 붙여넣으세요."}
          />
          <span className={styles.fieldHint}>
            입력 {summary.count}건 — 등록한 만큼 수량과 잔여가 함께 늘어납니다.
          </span>
        </div>
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 6: 경품 탭 presentational 작성**

`apps/admin-web/src/components/JwinCampaignForm/PrizeTab.tsx`:

```tsx
import { useState } from "react";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import type { AdminPrize, AdminPrizeCreate, AdminPrizePatch } from "@/domains/jwin";
import { isProbabilityOverflow, probabilitySum } from "./prizeProbability";
import { PrizeAddDialog } from "./PrizeAddDialog";
import { PrizeEditDialog } from "./PrizeEditDialog";
import { PrizeCodeAppendDialog } from "./PrizeCodeAppendDialog";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  prizes: AdminPrize[];
  loading: boolean;
  loadError: string | null;
  onAdd: (body: Omit<AdminPrizeCreate, "campaignId">) => Promise<string | null>;
  onEdit: (prizeId: string, body: AdminPrizePatch) => Promise<string | null>;
  onAppendCodes: (prizeId: string, codesText: string) => Promise<string | null>;
};

const TYPE_LABEL: Record<AdminPrize["type"], string> = {
  PHYSICAL: "현물",
  CODE: "기프트코드",
};

export function PrizeTab({ prizes, loading, loadError, onAdd, onEdit, onAppendCodes }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPrize | null>(null);
  const [appending, setAppending] = useState<AdminPrize | null>(null);

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>경품</h2>
        <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
          경품 추가
        </Button>
      </div>

      {isProbabilityOverflow(prizes) && (
        <div className={styles.warning}>
          확률 합계가 {probabilitySum(prizes).toFixed(3)}로 1을 넘습니다. 티어 순서대로 판정하므로
          동작은 하지만, 뒤쪽 티어 경품은 의도한 확률보다 적게 나갑니다.
        </div>
      )}

      {loadError && <div className={styles.errorText}>{loadError}</div>}
      {loading && <div className={styles.empty}>불러오는 중…</div>}

      {!loading && prizes.length === 0 && (
        <div className={styles.empty}>등록된 경품이 없습니다. 경품을 1건 이상 등록해야 캠페인을 시작할 수 있습니다.</div>
      )}

      {!loading && prizes.length > 0 && (
        <ScrollTable minWidth={760}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>유형</th>
                <th className={styles.num}>티어</th>
                <th className={styles.num}>수량 (잔여/전체)</th>
                <th className={styles.num}>확률</th>
                <th className={styles.num}>코드 재고</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {prizes.map((prize) => (
                <tr key={prize.id}>
                  <td>{prize.name}</td>
                  <td>{TYPE_LABEL[prize.type]}</td>
                  <td className={styles.num}>{prize.tier}</td>
                  <td className={styles.num}>
                    {prize.remainingQty} / {prize.totalQty}
                  </td>
                  <td className={styles.num}>{prize.winProbability}</td>
                  <td className={styles.num}>
                    {prize.type === "CODE" ? prize.availableCodeCount : "—"}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button variant="secondary" size="sm" onClick={() => setEditing(prize)}>
                        정정
                      </Button>
                      {prize.type === "CODE" && (
                        <Button variant="secondary" size="sm" onClick={() => setAppending(prize)}>
                          코드 추가
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}

      <PrizeAddDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={onAdd} />
      <PrizeEditDialog prize={editing} onClose={() => setEditing(null)} onEdit={onEdit} />
      <PrizeCodeAppendDialog
        prize={appending}
        onClose={() => setAppending(null)}
        onAppendCodes={onAppendCodes}
      />
    </div>
  );
}
```

- [ ] **Step 7: index 재노출**

`apps/admin-web/src/components/JwinCampaignForm/index.ts` 에 추가:

```ts
export { useJwinPrizes } from "./useJwinPrizes";
export type { UseJwinPrizesResult } from "./useJwinPrizes";
export { PrizeTab } from "./PrizeTab";
```

- [ ] **Step 8: 정적 검사**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/admin-web test
```
Expected: green

- [ ] **Step 9: 커밋**

```bash
git add apps/admin-web/src/components/JwinCampaignForm/useJwinPrizes.ts \
  apps/admin-web/src/components/JwinCampaignForm/PrizeTab.tsx \
  apps/admin-web/src/components/JwinCampaignForm/PrizeAddDialog.tsx \
  apps/admin-web/src/components/JwinCampaignForm/PrizeEditDialog.tsx \
  apps/admin-web/src/components/JwinCampaignForm/PrizeCodeAppendDialog.tsx \
  apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css \
  apps/admin-web/src/components/JwinCampaignForm/index.ts
git commit -m "feat(admin-web): J-WIN 경품 탭 — 목록·등록·정정·코드 보충"
```

---

### Task 7: 소재 탭 (커버리지 경고 포함)

**Files:**
- Create: `apps/admin-web/src/components/JwinCampaignForm/useJwinPostTemplates.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/PostTemplateTab.tsx`
- Create: `apps/admin-web/src/components/JwinCampaignForm/PostTemplateAddDialog.tsx`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/index.ts`

**Interfaces:**
- Consumes:
  - `postTemplateCoverage(campaign, templates): PostTemplateCoverage`, `formatCoverageGaps(gaps): string` (Task 2)
  - `utcIsoToJstLocal(iso: string): string`, `jstLocalToUtcIso(local: string): string` (기존 `./jwinDateTime`)
  - `<JwinMediaUpload label value onChange disabled? />` (Task 5)
  - `createPostTemplate`, `deletePostTemplate`, `fetchPostTemplates`, `jwinErrorMessage` (Task 4 / 기존)
- Produces:
  - `useJwinPostTemplates(campaignId: string): UseJwinPostTemplatesResult`
  - `<PostTemplateTab detail templates loading loadError onAdd onDelete />`

**커버리지 경고가 이 탭의 핵심이다.** 캠페인 기간 중 어떤 소재의 유효기간에도 안 걸리는 날은 그날 게시가 통째로 건너뛰어지고, 에러도 안 나고 아무 데도 안 보인다. 목록 위에 문장으로 명시한다. 빈틈이 없으면 아무것도 표시하지 않는다.

`{{LP_URL}}` 이 본문에 없어도 저장은 된다 — 스케줄러가 본문 끝에 LP 링크를 붙인다(`scheduler.ts:102-104`). 경고만 띄운다.

- [ ] **Step 1: 데이터 훅 작성**

`apps/admin-web/src/components/JwinCampaignForm/useJwinPostTemplates.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import {
  createPostTemplate,
  deletePostTemplate,
  fetchPostTemplates,
  jwinErrorMessage,
  type AdminPostTemplate,
  type AdminPostTemplateCreate,
} from "@/domains/jwin";

export type UseJwinPostTemplatesResult = {
  loading: boolean;
  loadError: string | null;
  templates: AdminPostTemplate[];
  reload: () => void;
  /** 성공하면 null, 실패하면 서버 메시지 */
  add: (body: Omit<AdminPostTemplateCreate, "campaignId">) => Promise<string | null>;
  remove: (templateId: string) => Promise<string | null>;
};

/** 소재 목록 + 등록/삭제. 목록은 activeFrom 오름차순으로 정렬해 돌려준다. */
export function useJwinPostTemplates(campaignId: string): UseJwinPostTemplatesResult {
  const [templates, setTemplates] = useState<AdminPostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchPostTemplates(campaignId)
      .then((result) => {
        if (cancelled) return;
        const sorted = [...result.postTemplates].sort((left, right) =>
          left.activeFrom.localeCompare(right.activeFrom),
        );
        setTemplates(sorted);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(jwinErrorMessage(error, "소재 목록을 불러올 수 없습니다."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadKey]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  const add = useCallback(
    async (body: Omit<AdminPostTemplateCreate, "campaignId">): Promise<string | null> => {
      try {
        await createPostTemplate({ ...body, campaignId });
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, "소재 등록에 실패했습니다.");
      }
    },
    [campaignId, reload],
  );

  const remove = useCallback(
    async (templateId: string): Promise<string | null> => {
      try {
        await deletePostTemplate(templateId);
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, "소재 삭제에 실패했습니다.");
      }
    },
    [reload],
  );

  return { loading, loadError, templates, reload, add, remove };
}
```

- [ ] **Step 2: CSS 클래스 추가**

`JwinCampaignTabs.module.css` **끝에** 이어붙인다:

```css
/* ── 소재 탭 ── */
.bodyPreview {
  max-width: 320px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary, #4b5563);
}

.counter {
  font-size: 12px;
  color: var(--text-tertiary, #6b7280);
  text-align: right;
}

.counterOver {
  color: var(--danger, #dc2626);
}
```

- [ ] **Step 3: 소재 추가 다이얼로그 작성**

`apps/admin-web/src/components/JwinCampaignForm/PostTemplateAddDialog.tsx`:

```tsx
import { useState } from "react";
import { Button, Dialog, Input, Textarea } from "@/components/ui";
import type { AdminPostTemplateCreate } from "@/domains/jwin";
import { JwinMediaUpload } from "./JwinMediaUpload";
import { jstLocalToUtcIso } from "./jwinDateTime";
import styles from "./JwinCampaignTabs.module.css";

const BODY_MAX_LENGTH = 500;

type Props = {
  open: boolean;
  onClose: () => void;
  /** 다이얼로그를 열 때 기본값으로 채울 JST datetime-local 문자열 */
  defaultActiveFrom: string;
  defaultActiveTo: string;
  onAdd: (body: Omit<AdminPostTemplateCreate, "campaignId">) => Promise<string | null>;
};

export function PostTemplateAddDialog({
  open,
  onClose,
  defaultActiveFrom,
  defaultActiveTo,
  onAdd,
}: Props) {
  const [label, setLabel] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [activeFrom, setActiveFrom] = useState(defaultActiveFrom);
  const [activeTo, setActiveTo] = useState(defaultActiveTo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setLabel("");
    setBodyText("");
    setMediaUrl(null);
    setActiveFrom(defaultActiveFrom);
    setActiveTo(defaultActiveTo);
    setSaving(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!label.trim()) {
      setError("소재 이름을 입력하세요.");
      return;
    }
    if (!bodyText.trim()) {
      setError("본문을 입력하세요.");
      return;
    }
    if (bodyText.length > BODY_MAX_LENGTH) {
      setError(`본문은 ${BODY_MAX_LENGTH}자 이하여야 합니다.`);
      return;
    }
    if (!activeFrom || !activeTo) {
      setError("유효 기간을 입력하세요.");
      return;
    }
    if (activeTo <= activeFrom) {
      setError("종료일시는 시작일시 이후여야 합니다.");
      return;
    }

    setSaving(true);
    setError(null);
    const failure = await onAdd({
      label: label.trim(),
      bodyText,
      mediaUrl: mediaUrl ?? undefined,
      activeFrom: jstLocalToUtcIso(activeFrom),
      activeTo: jstLocalToUtcIso(activeTo),
    });
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    handleClose();
  };

  const remaining = BODY_MAX_LENGTH - bodyText.length;
  const counterClassName = [styles.counter, remaining < 0 ? styles.counterOver : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="소재 추가"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={handleClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? "등록 중…" : "등록"}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>소재 이름</span>
          <Input value={label} onChange={setLabel} placeholder="예: 1주차" />
          <span className={styles.fieldHint}>운영자 식별용입니다. 트윗에는 나가지 않습니다.</span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>본문</span>
          <Textarea
            value={bodyText}
            onChange={setBodyText}
            rows={6}
            placeholder={"매일 게시될 트윗 본문입니다.\n{{LP_URL}} 자리에 응모 링크가 들어갑니다."}
          />
          <span className={counterClassName}>
            {bodyText.length} / {BODY_MAX_LENGTH}
          </span>
          {bodyText.trim().length > 0 && !bodyText.includes("{{LP_URL}}") && (
            <span className={styles.fieldHint}>
              본문에 {"{{LP_URL}}"}이 없습니다. 응모 링크가 본문 끝에 자동으로 붙습니다.
            </span>
          )}
        </div>

        <JwinMediaUpload
          label="미디어 (선택)"
          value={mediaUrl}
          onChange={setMediaUrl}
          disabled={saving}
        />

        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>유효 시작 (JST)</span>
            <Input type="datetime-local" value={activeFrom} onChange={setActiveFrom} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>유효 종료 (JST)</span>
            <Input type="datetime-local" value={activeTo} onChange={setActiveTo} />
          </div>
        </div>
        <span className={styles.fieldHint}>
          게시 여부는 매일 00:05 JST 시점에 판정합니다. 시작을 그날 낮으로 잡으면 그날은 게시되지
          않습니다.
        </span>

        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: 소재 탭 presentational 작성**

`apps/admin-web/src/components/JwinCampaignForm/PostTemplateTab.tsx`:

```tsx
import { useMemo, useState } from "react";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import type { AdminCampaignDetail, AdminPostTemplate, AdminPostTemplateCreate } from "@/domains/jwin";
import { formatCoverageGaps, postTemplateCoverage } from "./postTemplateCoverage";
import { utcIsoToJstLocal } from "./jwinDateTime";
import { PostTemplateAddDialog } from "./PostTemplateAddDialog";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  detail: AdminCampaignDetail;
  templates: AdminPostTemplate[];
  loading: boolean;
  loadError: string | null;
  onAdd: (body: Omit<AdminPostTemplateCreate, "campaignId">) => Promise<string | null>;
  onDelete: (templateId: string) => Promise<string | null>;
};

/** "2026-09-01T00:00" → "9/1 00:00" */
function shortJst(iso: string): string {
  const local = utcIsoToJstLocal(iso);
  const [date, time] = local.split("T");
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)} ${time}`;
}

export function PostTemplateTab({ detail, templates, loading, loadError, onAdd, onDelete }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const coverage = useMemo(
    () => postTemplateCoverage(detail, templates),
    [detail, templates],
  );

  const handleDelete = async (templateId: string) => {
    setDeletingId(templateId);
    setDeleteError(null);
    const failure = await onDelete(templateId);
    setDeletingId(null);
    if (failure) setDeleteError(failure);
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>소재</h2>
        <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
          소재 추가
        </Button>
      </div>

      {!loading && coverage.gaps.length > 0 && (
        <div className={styles.warning}>
          ⚠ 소재가 없는 날: {formatCoverageGaps(coverage.gaps)} (이 날은 게시가 건너뜁니다)
        </div>
      )}

      {loadError && <div className={styles.errorText}>{loadError}</div>}
      {deleteError && <div className={styles.errorText}>{deleteError}</div>}
      {loading && <div className={styles.empty}>불러오는 중…</div>}

      {!loading && templates.length === 0 && (
        <div className={styles.empty}>
          등록된 소재가 없습니다. 소재가 없으면 매일 게시가 통째로 건너뜁니다.
        </div>
      )}

      {!loading && templates.length > 0 && (
        <ScrollTable minWidth={860}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>본문</th>
                <th>유효 기간 (JST)</th>
                <th>미디어</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.label}</td>
                  <td>
                    <div className={styles.bodyPreview}>{template.bodyText}</div>
                  </td>
                  <td>
                    {shortJst(template.activeFrom)} ~ {shortJst(template.activeTo)}
                  </td>
                  <td>{template.mediaUrl ? "있음" : "—"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => void handleDelete(template.id)}
                        disabled={template.used || deletingId === template.id}
                        title={template.used ? "이미 게시에 사용된 소재는 삭제할 수 없습니다" : undefined}
                      >
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}

      <PostTemplateAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultActiveFrom={utcIsoToJstLocal(detail.startsAt)}
        defaultActiveTo={utcIsoToJstLocal(detail.endsAt)}
        onAdd={onAdd}
      />
    </div>
  );
}
```

- [ ] **Step 5: index 재노출**

```ts
export { useJwinPostTemplates } from "./useJwinPostTemplates";
export type { UseJwinPostTemplatesResult } from "./useJwinPostTemplates";
export { PostTemplateTab } from "./PostTemplateTab";
export { postTemplateCoverage, formatCoverageGaps } from "./postTemplateCoverage";
export type { PostTemplateCoverage, CoverageGap } from "./postTemplateCoverage";
```

- [ ] **Step 6: 정적 검사**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/admin-web test
```
Expected: green

- [ ] **Step 7: 커밋**

```bash
git add apps/admin-web/src/components/JwinCampaignForm/useJwinPostTemplates.ts \
  apps/admin-web/src/components/JwinCampaignForm/PostTemplateTab.tsx \
  apps/admin-web/src/components/JwinCampaignForm/PostTemplateAddDialog.tsx \
  apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css \
  apps/admin-web/src/components/JwinCampaignForm/index.ts
git commit -m "feat(admin-web): J-WIN 소재 탭 — 목록·등록·삭제 + 기간 빈틈 경고"
```

---

### Task 8: 결과화면 / DM 탭

**Files:**
- Create: `apps/admin-web/src/components/JwinCampaignForm/useJwinResultForm.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/ResultTab.tsx`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/index.ts`

**Interfaces:**
- Consumes:
  - `renderDmPreview(template, values): string`, `dmTemplateMissingCode(template): boolean`, `DM_PREVIEW_SAMPLE` (Task 3)
  - `<JwinMediaUpload label value onChange disabled? />` (Task 5)
  - `updateCampaign(campaignId, body: AdminCampaignPatch): Promise<AdminCampaignDetail>`, `jwinErrorMessage` (기존 / Task 4)
- Produces:
  - `useJwinResultForm(detail: AdminCampaignDetail, hasCodePrize: boolean, onSaved: (detail: AdminCampaignDetail) => void): UseJwinResultFormResult`
  - `<ResultTab detail hasCodePrize onSaved />`

**저장 차단 규칙**: CODE 경품이 하나라도 있는데 `dmTemplate` 에 `{{CODE}}` 가 없으면 저장 버튼을 막는다. **문구가 비어 있으면 막지 않는다** — 서버 기본 문구(`{{CODE}}` 포함)가 쓰인다.

`prUrl` 은 서버 스키마가 `z.string().url().nullable()` 이므로 빈 문자열을 보내면 400 이다. 비었으면 `null` 로 보낸다.

- [ ] **Step 1: 결과화면 폼 훅 작성**

`apps/admin-web/src/components/JwinCampaignForm/useJwinResultForm.ts`:

```ts
import { useEffect, useState } from "react";
import {
  jwinErrorMessage,
  updateCampaign,
  type AdminCampaignDetail,
  type AdminCampaignPatch,
} from "@/domains/jwin";
import { dmTemplateMissingCode } from "./dmTemplatePreview";

export const DM_TEMPLATE_MAX_LENGTH = 1000;

export type JwinResultFormValues = {
  winMediaUrl: string | null;
  loseMediaUrl: string | null;
  prUrl: string;
  dmTemplate: string;
};

export type UseJwinResultFormResult = {
  values: JwinResultFormValues;
  setField: <Field extends keyof JwinResultFormValues>(
    field: Field,
    value: JwinResultFormValues[Field],
  ) => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  /** 저장을 막는 사유. null 이면 저장 가능 */
  blockedReason: string | null;
  save: () => Promise<void>;
};

function toValues(detail: AdminCampaignDetail): JwinResultFormValues {
  return {
    winMediaUrl: detail.winMediaUrl,
    loseMediaUrl: detail.loseMediaUrl,
    prUrl: detail.prUrl ?? "",
    dmTemplate: detail.dmTemplate ?? "",
  };
}

/**
 * 결과화면·DM 필드는 캠페인 PATCH 로 저장한다.
 *
 * CODE 경품이 있는데 DM 문구에 {{CODE}} 가 없으면 **저장 자체를 막는다** — 코드 없는 DM 이
 * 나가면 당첨자는 "축하합니다"만 받고 경품을 못 받는다. 자동 발송이라 되돌릴 수도 없다.
 * 문구가 비어 있으면 서버 기본 문구({{CODE}} 포함)가 쓰이므로 막지 않는다.
 */
export function useJwinResultForm(
  detail: AdminCampaignDetail,
  hasCodePrize: boolean,
  onSaved: (updated: AdminCampaignDetail) => void,
): UseJwinResultFormResult {
  const [values, setValues] = useState<JwinResultFormValues>(() => toValues(detail));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(toValues(detail));
  }, [detail]);

  const setField = <Field extends keyof JwinResultFormValues>(
    field: Field,
    value: JwinResultFormValues[Field],
  ) => {
    setSaved(false);
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const blockedReason = (): string | null => {
    if (values.dmTemplate.length > DM_TEMPLATE_MAX_LENGTH) {
      return `DM 문구는 ${DM_TEMPLATE_MAX_LENGTH}자 이하여야 합니다.`;
    }
    if (hasCodePrize && dmTemplateMissingCode(values.dmTemplate)) {
      return "기프트코드 경품이 있으면 DM 문구에 {{CODE}}가 있어야 합니다. 없으면 당첨자가 코드를 받지 못합니다.";
    }
    return null;
  };

  const save = async () => {
    if (blockedReason()) return;
    const body: AdminCampaignPatch = {
      winMediaUrl: values.winMediaUrl,
      loseMediaUrl: values.loseMediaUrl,
      // 빈 문자열은 서버 z.string().url() 을 통과하지 못한다
      prUrl: values.prUrl.trim() === "" ? null : values.prUrl.trim(),
      dmTemplate: values.dmTemplate.trim() === "" ? null : values.dmTemplate,
    };
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCampaign(detail.id, body);
      onSaved(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, "저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return { values, setField, saving, saved, error, blockedReason: blockedReason(), save };
}
```

- [ ] **Step 2: CSS 클래스 추가**

`JwinCampaignTabs.module.css` **끝에** 이어붙인다:

```css
/* ── 결과화면 탭 ── */
.resultForm {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 640px;
}

.mediaRow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.dmPreview {
  white-space: pre-wrap;
  word-break: break-word;
  padding: 12px;
  border-radius: 6px;
  background: var(--surface-muted, #f9fafb);
  border: 1px solid var(--border, #e5e7eb);
  font-size: 13px;
  line-height: 1.6;
}

.placeholderList {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-tertiary, #6b7280);
}

.saveRow {
  display: flex;
  align-items: center;
  gap: 12px;
}

.savedText {
  font-size: 13px;
  color: var(--success, #16a34a);
}
```

- [ ] **Step 3: 결과화면 탭 presentational 작성**

`apps/admin-web/src/components/JwinCampaignForm/ResultTab.tsx`:

```tsx
import { Button, Input, Textarea } from "@/components/ui";
import type { AdminCampaignDetail } from "@/domains/jwin";
import { DM_PREVIEW_SAMPLE, renderDmPreview } from "./dmTemplatePreview";
import { JwinMediaUpload } from "./JwinMediaUpload";
import { DM_TEMPLATE_MAX_LENGTH, useJwinResultForm } from "./useJwinResultForm";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  detail: AdminCampaignDetail;
  /** CODE 경품이 하나라도 있으면 DM 문구에 {{CODE}} 를 강제한다 */
  hasCodePrize: boolean;
  onSaved: (updated: AdminCampaignDetail) => void;
};

export function ResultTab({ detail, hasCodePrize, onSaved }: Props) {
  const form = useJwinResultForm(detail, hasCodePrize, onSaved);

  const preview = renderDmPreview(form.values.dmTemplate, {
    ...DM_PREVIEW_SAMPLE,
    brandName: detail.brandName,
  });

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>결과화면 / DM</h2>
      </div>

      <div className={styles.resultForm}>
        <div className={styles.mediaRow}>
          <JwinMediaUpload
            label="당첨 화면"
            value={form.values.winMediaUrl}
            onChange={(url) => form.setField("winMediaUrl", url)}
            disabled={form.saving}
          />
          <JwinMediaUpload
            label="낙첨 화면"
            value={form.values.loseMediaUrl}
            onChange={(url) => form.setField("loseMediaUrl", url)}
            disabled={form.saving}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>브랜드 사이트 URL</span>
          <Input
            value={form.values.prUrl}
            onChange={(value) => form.setField("prUrl", value)}
            placeholder="https://example.com"
          />
          <span className={styles.fieldHint}>
            결과 화면의 유도 버튼에 씁니다. 비우면 버튼이 나오지 않습니다.
          </span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>당첨 DM 문구</span>
          <Textarea
            value={form.values.dmTemplate}
            onChange={(value) => form.setField("dmTemplate", value)}
            rows={8}
            placeholder="비워두면 기본 문구(일본어)가 발송됩니다."
          />
          <span className={styles.counter}>
            {form.values.dmTemplate.length} / {DM_TEMPLATE_MAX_LENGTH}
          </span>
          <div className={styles.placeholderList}>
            <span>{"{{CODE}}"} 기프트코드</span>
            <span>{"{{PRIZE_NAME}}"} 경품명</span>
            <span>{"{{USERNAME}}"} 당첨자</span>
            <span>{"{{BRAND_NAME}}"} 브랜드명</span>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>발송 미리보기</span>
          <div className={styles.dmPreview}>{preview}</div>
          <span className={styles.fieldHint}>
            실제 발송 시 코드·경품명·당첨자는 당첨 건마다 다른 값으로 바뀝니다.
          </span>
        </div>

        {form.blockedReason && <div className={styles.warning}>{form.blockedReason}</div>}
        {form.error && <div className={styles.errorText}>{form.error}</div>}

        <div className={styles.saveRow}>
          <Button
            variant="primary"
            size="md"
            onClick={() => void form.save()}
            disabled={form.saving || form.blockedReason !== null}
          >
            {form.saving ? "저장 중…" : "저장"}
          </Button>
          {form.saved && <span className={styles.savedText}>저장됨</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: index 재노출**

```ts
export { ResultTab } from "./ResultTab";
export { renderDmPreview, dmTemplateMissingCode, DEFAULT_DM_TEMPLATE, DM_PREVIEW_SAMPLE } from "./dmTemplatePreview";
```

- [ ] **Step 5: 정적 검사**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/admin-web test
```
Expected: green

- [ ] **Step 6: 커밋**

```bash
git add apps/admin-web/src/components/JwinCampaignForm/useJwinResultForm.ts \
  apps/admin-web/src/components/JwinCampaignForm/ResultTab.tsx \
  apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css \
  apps/admin-web/src/components/JwinCampaignForm/index.ts
git commit -m "feat(admin-web): J-WIN 결과화면·DM 탭 — 미리보기 + {{CODE}} 누락 시 저장 차단"
```

---

### Task 9: 상태 전환 + 체크리스트 + 페이지 조립

**Files:**
- Create: `apps/admin-web/src/components/JwinCampaignForm/useJwinStatusTransition.ts`
- Create: `apps/admin-web/src/components/JwinCampaignForm/StatusTransition.tsx`
- Create: `apps/admin-web/src/components/JwinCampaignForm/PauseCampaignDialog.tsx`
- Create: `apps/admin-web/src/components/JwinCampaignForm/ResumeCampaignDialog.tsx`
- Create: `apps/admin-web/src/components/JwinCampaignForm/EndCampaignDialog.tsx`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css`
- Modify: `apps/admin-web/src/components/JwinCampaignForm/index.ts`
- Modify: `apps/admin-web/src/pages/Jwin/CampaignEdit.tsx`

**Interfaces:**
- Consumes:
  - `activationChecklist(input): ActivationCheck[]`, `canActivate(checks): boolean` (Task 3)
  - `postTemplateCoverage(campaign, templates)` (Task 2)
  - `useJwinPrizes(campaignId)` (Task 6), `useJwinPostTemplates(campaignId)` (Task 7)
  - `PrizeTab` (Task 6), `PostTemplateTab` (Task 7), `ResultTab` (Task 8)
  - 기존: `useJwinCampaignForm`, `BasicTab`, `ConnectTab`, `SegmentedTabs`, `JwinStatusBadge`
- Produces:
  - `useJwinStatusTransition(campaignId, onChanged): { changing: boolean; error: string | null; change: (status) => Promise<void> }`
  - `<StatusTransition detail checks changing error onChange />`

**전환 규칙**

| 현재 | 가능한 전환 | 확인 |
|---|---|---|
| `SETUP` | → `ACTIVE` | 체크리스트 4항목 전부 충족해야 버튼 활성화 (다이얼로그 없음) |
| `ACTIVE` | → `PAUSED` / → `ENDED` | 각각 전용 다이얼로그 |
| `PAUSED` | → `ACTIVE` / → `ENDED` | 각각 전용 다이얼로그 |
| `ENDED` | 없음 | — |

`ENDED` 는 되돌릴 수 없고 배송지 입력이 즉시 잠긴다는 점을 문구로 명시한다.

- [ ] **Step 1: 상태 전환 훅 작성**

`apps/admin-web/src/components/JwinCampaignForm/useJwinStatusTransition.ts`:

```ts
import { useState } from "react";
import {
  jwinErrorMessage,
  updateCampaign,
  type AdminCampaignDetail,
} from "@/domains/jwin";

export type JwinCampaignStatus = AdminCampaignDetail["status"];

export function useJwinStatusTransition(
  campaignId: string,
  onChanged: (updated: AdminCampaignDetail) => void,
) {
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (status: JwinCampaignStatus) => {
    setChanging(true);
    setError(null);
    try {
      const updated = await updateCampaign(campaignId, { status });
      onChanged(updated);
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, "상태 전환에 실패했습니다."));
    } finally {
      setChanging(false);
    }
  };

  return { changing, error, change };
}
```

- [ ] **Step 2: 확인 다이얼로그 3개 작성**

`apps/admin-web/src/components/JwinCampaignForm/PauseCampaignDialog.tsx`:

```tsx
import { Button, Dialog } from "@/components/ui";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
};

/** 일시중지 확인. 되돌릴 수 있으므로 경고 수위가 낮다. */
export function PauseCampaignDialog({ open, onClose, onConfirm, pending }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="캠페인 일시중지"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} disabled={pending}>
            {pending ? "전환 중…" : "일시중지"}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <p>
          매일 자동 게시가 멈춥니다. 응모 페이지는 계속 열려 있지만 새 응모는 받지 않습니다. 언제든
          다시 재개할 수 있습니다.
        </p>
      </div>
    </Dialog>
  );
}
```

`apps/admin-web/src/components/JwinCampaignForm/ResumeCampaignDialog.tsx`:

```tsx
import { Button, Dialog } from "@/components/ui";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
};

/** 일시중지 해제 확인. 다음 게시 시각부터 자동 게시가 다시 나간다. */
export function ResumeCampaignDialog({ open, onClose, onConfirm, pending }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="캠페인 재개"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} disabled={pending}>
            {pending ? "전환 중…" : "재개"}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <p>
          다음 게시 시각부터 자동 게시가 다시 나갑니다. 중지 기간 동안 건너뛴 날은 소급 게시되지
          않습니다.
        </p>
      </div>
    </Dialog>
  );
}
```

`apps/admin-web/src/components/JwinCampaignForm/EndCampaignDialog.tsx`:

```tsx
import { Button, Dialog } from "@/components/ui";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
};

/** 종료 확인. 되돌릴 수 없고 배송지 입력이 즉시 잠기므로 문구로 명시한다. */
export function EndCampaignDialog({ open, onClose, onConfirm, pending }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="캠페인 종료"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} disabled={pending}>
            {pending ? "종료 중…" : "종료"}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.warning}>
          되돌릴 수 없습니다. 종료하면 자동 게시가 끝나고, 당첨자의 배송지 입력이 즉시 잠깁니다.
          아직 배송지를 입력하지 않은 당첨자는 더 이상 입력할 수 없습니다.
        </div>
        <p>정말 종료하시겠습니까?</p>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 3: CSS 클래스 추가**

`JwinCampaignTabs.module.css` **끝에** 이어붙인다:

```css
/* ── 상태 전환 ── */
.transition {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.transitionButtons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.checklist {
  list-style: none;
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--border, #e5e7eb);
  background: var(--surface-muted, #f9fafb);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  text-align: left;
  min-width: 320px;
}

.checkItem {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.checkMark {
  flex-shrink: 0;
}

.checkOk {
  color: var(--success, #16a34a);
}

.checkFail {
  color: var(--danger, #dc2626);
}

.checkReason {
  display: block;
  color: var(--text-tertiary, #6b7280);
  margin-top: 2px;
}
```

- [ ] **Step 4: 상태 전환 컴포넌트 작성**

`apps/admin-web/src/components/JwinCampaignForm/StatusTransition.tsx`:

```tsx
import { useState } from "react";
import { JwinStatusBadge } from "@/components/composites";
import { Button } from "@/components/ui";
import type { AdminCampaignDetail } from "@/domains/jwin";
import { canActivate, type ActivationCheck } from "./activationChecklist";
import { PauseCampaignDialog } from "./PauseCampaignDialog";
import { ResumeCampaignDialog } from "./ResumeCampaignDialog";
import { EndCampaignDialog } from "./EndCampaignDialog";
import type { JwinCampaignStatus } from "./useJwinStatusTransition";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  detail: AdminCampaignDetail;
  checks: ActivationCheck[];
  changing: boolean;
  error: string | null;
  onChange: (status: JwinCampaignStatus) => void;
};

function ChecklistView({ checks }: { checks: ActivationCheck[] }) {
  return (
    <ul className={styles.checklist}>
      {checks.map((check) => (
        <li key={check.key} className={styles.checkItem}>
          <span className={[styles.checkMark, check.ok ? styles.checkOk : styles.checkFail].join(" ")}>
            {check.ok ? "✓" : "✗"}
          </span>
          <span>
            {check.label}
            {check.reason && <span className={styles.checkReason}>{check.reason}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 상태 배지 + 전환 버튼. SETUP 에서는 발행 전 체크리스트를 함께 보여주고,
 * 4항목을 전부 충족해야 ACTIVE 전환 버튼이 열린다.
 */
export function StatusTransition({ detail, checks, changing, error, onChange }: Props) {
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const confirm = (status: JwinCampaignStatus, close: () => void) => {
    close();
    onChange(status);
  };

  return (
    <div className={styles.transition}>
      <div className={styles.transitionButtons}>
        <JwinStatusBadge status={detail.status} />

        {detail.status === "SETUP" && (
          <Button
            variant="primary"
            size="md"
            onClick={() => onChange("ACTIVE")}
            disabled={changing || !canActivate(checks)}
          >
            {changing ? "전환 중…" : "캠페인 시작"}
          </Button>
        )}

        {detail.status === "ACTIVE" && (
          <>
            <Button variant="secondary" size="md" onClick={() => setPauseOpen(true)} disabled={changing}>
              일시중지
            </Button>
            <Button variant="secondary" size="md" onClick={() => setEndOpen(true)} disabled={changing}>
              종료
            </Button>
          </>
        )}

        {detail.status === "PAUSED" && (
          <>
            <Button variant="primary" size="md" onClick={() => setResumeOpen(true)} disabled={changing}>
              재개
            </Button>
            <Button variant="secondary" size="md" onClick={() => setEndOpen(true)} disabled={changing}>
              종료
            </Button>
          </>
        )}
      </div>

      {detail.status === "SETUP" && <ChecklistView checks={checks} />}
      {error && <span className={styles.errorText}>{error}</span>}

      <PauseCampaignDialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        onConfirm={() => confirm("PAUSED", () => setPauseOpen(false))}
        pending={changing}
      />
      <ResumeCampaignDialog
        open={resumeOpen}
        onClose={() => setResumeOpen(false)}
        onConfirm={() => confirm("ACTIVE", () => setResumeOpen(false))}
        pending={changing}
      />
      <EndCampaignDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={() => confirm("ENDED", () => setEndOpen(false))}
        pending={changing}
      />
    </div>
  );
}
```

- [ ] **Step 5: index 재노출**

```ts
export { StatusTransition } from "./StatusTransition";
export { useJwinStatusTransition } from "./useJwinStatusTransition";
export type { JwinCampaignStatus } from "./useJwinStatusTransition";
export { activationChecklist, canActivate } from "./activationChecklist";
export type { ActivationCheck, ActivationCheckKey } from "./activationChecklist";
```

- [ ] **Step 6: 페이지 조립**

`apps/admin-web/src/pages/Jwin/CampaignEdit.tsx` 전체를 아래로 교체한다. 경품·소재 훅을 페이지에서 한 번만 부르고 탭과 체크리스트가 같은 데이터를 쓴다(중복 fetch 방지).

```tsx
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { SegmentedTabs } from "@/components/composites/SegmentedTabs";
import {
  useJwinCampaignForm,
  useJwinPrizes,
  useJwinPostTemplates,
  useJwinStatusTransition,
  activationChecklist,
  postTemplateCoverage,
  BasicTab,
  ConnectTab,
  PrizeTab,
  PostTemplateTab,
  ResultTab,
  StatusTransition,
} from "@/components/JwinCampaignForm";
import type { AdminCampaignDetail } from "@/domains/jwin";
import styles from "./Jwin.module.css";

type TabKey = "basic" | "connect" | "prize" | "template" | "result";

const EDIT_TABS: { key: TabKey; label: string }[] = [
  { key: "basic", label: "기본" },
  { key: "connect", label: "연동" },
  { key: "prize", label: "경품" },
  { key: "template", label: "소재" },
  { key: "result", label: "결과화면" },
];

const NEW_TABS: { key: TabKey; label: string }[] = [{ key: "basic", label: "기본" }];

/**
 * S2 캠페인 생성·편집 (겸용). id 없으면 생성, 있으면 편집.
 * 경품·소재는 캠페인 id 가 있어야 붙일 수 있으므로 생성 모드에서는 기본 탭만 연다.
 * 페이지는 조립만 한다 — 데이터는 각 훅이, 판정은 순수 함수가 맡는다.
 */
export function JwinCampaignEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const form = useJwinCampaignForm(id);
  const [tab, setTab] = useState<TabKey>("basic");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaved(false);
    const result = await form.save();
    if (!result) return;
    if (form.mode === "new") {
      navigate(`/jwin/campaigns/${result.id}`);
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  if (form.mode === "edit" && form.loading) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>불러오는 중…</div>
      </div>
    );
  }

  if (form.mode === "edit" && form.loadError) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>{form.loadError}</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <button
            type="button"
            className={styles.backLink}
            onClick={() => navigate("/jwin/campaigns")}
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> 캠페인 목록
          </button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              {form.mode === "new" ? "캠페인 생성" : (form.detail?.brandName ?? "캠페인 편집")}
            </h1>
          </div>
        </div>
        <div className={styles.saveRow}>
          {saved && <span className={styles.saved}>저장됨</span>}
          {form.saveError && <span className={styles.saveError}>{form.saveError}</span>}
          <Button variant="primary" size="md" onClick={handleSave} loading={form.saving}>
            {form.mode === "new" ? "생성" : "저장"}
          </Button>
        </div>
      </div>

      <SegmentedTabs
        items={form.mode === "edit" ? EDIT_TABS : NEW_TABS}
        value={tab}
        onChange={setTab}
      />

      <div className={styles.tabContent}>
        {tab === "basic" && (
          <BasicTab
            values={form.values}
            errors={form.errors}
            setField={form.setField}
            slugLocked={form.detail?.status === "ACTIVE"}
          />
        )}
        {tab === "connect" && form.detail && (
          <ConnectTab
            detail={form.detail}
            accounts={form.accounts}
            onSelectAccount={form.selectAccount}
            selectError={form.selectError}
            accountsError={form.accountsError}
          />
        )}
        {form.detail && form.mode === "edit" && (
          <CampaignEditBody
            campaignId={form.detail.id}
            detail={form.detail}
            tab={tab}
            onDetailChanged={form.reload}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 경품·소재를 함께 읽는 편집 전용 본문.
 * 상태 전환 체크리스트가 경품·소재·커버리지를 모두 봐야 해서 한 곳에서 훅을 부른다.
 */
function CampaignEditBody({
  campaignId,
  detail,
  tab,
  onDetailChanged,
}: {
  campaignId: string;
  detail: AdminCampaignDetail;
  tab: TabKey;
  onDetailChanged: () => void;
}) {
  const prizes = useJwinPrizes(campaignId);
  const postTemplates = useJwinPostTemplates(campaignId);
  const transition = useJwinStatusTransition(campaignId, onDetailChanged);

  const checks = useMemo(
    () =>
      activationChecklist({
        detail,
        prizes: prizes.prizes,
        coverage: postTemplateCoverage(detail, postTemplates.templates),
      }),
    [detail, prizes.prizes, postTemplates.templates],
  );

  const hasCodePrize = prizes.prizes.some((prize) => prize.type === "CODE");

  return (
    <>
      <div className={styles.statusRow}>
        <StatusTransition
          detail={detail}
          checks={checks}
          changing={transition.changing}
          error={transition.error}
          onChange={transition.change}
        />
      </div>

      {tab === "prize" && (
        <PrizeTab
          prizes={prizes.prizes}
          loading={prizes.state.kind === "loading"}
          loadError={prizes.state.kind === "error" ? prizes.state.message : null}
          onAdd={prizes.add}
          onEdit={prizes.edit}
          onAppendCodes={prizes.appendCodes}
        />
      )}

      {tab === "template" && (
        <PostTemplateTab
          detail={detail}
          templates={postTemplates.templates}
          loading={postTemplates.loading}
          loadError={postTemplates.loadError}
          onAdd={postTemplates.add}
          onDelete={postTemplates.remove}
        />
      )}

      {tab === "result" && (
        <ResultTab detail={detail} hasCodePrize={hasCodePrize} onSaved={onDetailChanged} />
      )}
    </>
  );
}
```

- [ ] **Step 7: 페이지 CSS 추가**

`apps/admin-web/src/pages/Jwin/Jwin.module.css` **끝에** 이어붙인다:

```css
/* 상태 전환 영역 — 탭 내용 위에 붙는다 */
.statusRow {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
```

- [ ] **Step 8: 정적 검사**

Run:
```bash
pnpm --filter @jsure/admin-web typecheck
pnpm --filter @jsure/admin-web lint
pnpm --filter @jsure/admin-web test
pnpm --filter @jsure/admin-web build
```
Expected: 전부 green (`build` 는 i18n 검증 + tsc + vite build)

> `StatusTransition` 이 배지를 그리므로, 헤더의 `JwinStatusBadge` 는 중복이라 제거했다(위 코드 반영됨 — `@/components/composites` import 도 함께 사라진다).

- [ ] **Step 9: 커밋**

```bash
git add apps/admin-web/src/components/JwinCampaignForm/useJwinStatusTransition.ts \
  apps/admin-web/src/components/JwinCampaignForm/StatusTransition.tsx \
  apps/admin-web/src/components/JwinCampaignForm/PauseCampaignDialog.tsx \
  apps/admin-web/src/components/JwinCampaignForm/ResumeCampaignDialog.tsx \
  apps/admin-web/src/components/JwinCampaignForm/EndCampaignDialog.tsx \
  apps/admin-web/src/components/JwinCampaignForm/JwinCampaignTabs.module.css \
  apps/admin-web/src/components/JwinCampaignForm/index.ts \
  apps/admin-web/src/pages/Jwin/CampaignEdit.tsx \
  apps/admin-web/src/pages/Jwin/Jwin.module.css
git commit -m "feat(admin-web): J-WIN 상태 전환 + 발행 전 체크리스트, 편집 화면 탭 5개 조립"
```

---

### Task 10: 라이브 e2e 검증 + 문서 갱신

**Files:**
- Modify: `docs/jwin/MVP_PLAN.md` (Phase 4 완료 표시)

**Interfaces:**
- Consumes: Task 1~9 전부
- Produces: 없음 (검증 태스크)

**목적**: 설계 §7 의 핵심 검증 — **화면만으로** 캠페인 하나를 `ACTIVE` 까지 올린다. 이미 연동된 `@devsure5` 브랜드 계정을 쓴다.

- [ ] **Step 1: 서버 기동**

터미널 3개에서 각각:

```bash
pnpm --filter @jsure/api dev        # 대시보드 API :3000 (로그인·presign)
pnpm --filter @jsure/jwin-api dev   # J-WIN API :8080
pnpm --filter @jsure/admin-web dev  # admin-web :5173
```

**vite 가 실제로 바인딩한 포트를 콘솔 출력에서 확인한다.** 5173이 이미 점유돼 있으면 5174/5175로 밀린다 — 다른 포트를 보면서 "안 된다"고 판단하는 실수가 이 프로젝트에서 이미 한 번 있었다.

- [ ] **Step 2: 미충족 상태에서 ACTIVE가 막히는지 확인**

1. `/jwin/campaigns` → "캠페인 생성" → 브랜드명·slug·기간(오늘~5일 뒤)을 넣고 생성
2. 편집 화면으로 이동한 뒤 체크리스트를 본다

Expected: 4항목 중 계정·경품·소재가 ✗ 로 뜨고 각각 사유가 보인다. **"캠페인 시작" 버튼이 비활성화**돼 있다.

- [ ] **Step 3: 계정 연동**

연동 탭 → 드롭다운에서 `@devsure5` 선택

Expected: 상태에 `CONNECTED` 배지. 체크리스트 ① 이 ✓ 로 바뀐다.

- [ ] **Step 4: 경품 등록 (CODE 포함)**

경품 탭 → "경품 추가" → 유형 `기프트코드`, 이름 아무거나, 티어 1, 수량 3, 확률 0.5, 코드란에 아래를 붙여넣는다:

```
TESTCODE-0001
TESTCODE-0002
TESTCODE-0003
```

Expected:
- 붙여넣는 즉시 `입력 3건 / 수량 3` 이 보인다
- 등록 성공, 목록에 `코드 재고 3` 이 보인다
- 체크리스트 ② 가 ✓, **④ 는 아직 ✓** (DM 문구가 비어 있으면 서버 기본 문구가 쓰이므로)

이어서 **개수 불일치를 일부러 만들어** 본다: 수량 5에 코드 3건 → 등록 버튼을 누르면 `코드 수(3)가 수량(5)과 일치하지 않습니다` 가 다이얼로그에 보여야 한다(서버까지 안 가고 화면에서 막힌다).

- [ ] **Step 5: 소재 등록 (미디어 업로드 포함)**

소재 탭 → 등록 전에 **커버리지 경고**가 떠 있는지 먼저 확인한다(소재 0개 → 기간 전체가 빈틈).

"소재 추가" → 이름 `1주차`, 본문에 `{{LP_URL}}` 을 포함한 문구, 미디어에 PNG 파일 1개 업로드, 유효 기간은 기본값(캠페인 전 기간) 그대로 → 등록

Expected:
- 업로드 중 버튼이 "업로드 중…" 으로 바뀌고, 끝나면 미리보기 이미지가 뜬다
- 등록 후 **커버리지 경고가 사라진다**
- 체크리스트 ③ 이 ✓

이어서 **빈틈을 일부러 만들어** 본다: 유효 기간이 캠페인 마지막 날을 안 덮는 소재만 남기면 `⚠ 소재가 없는 날: …` 이 떠야 한다.

- [ ] **Step 6: 결과화면·DM 등록 + 저장 차단 확인**

결과화면 탭 → DM 문구에 `{{CODE}}` **없이** 아무 문장을 넣는다.

Expected: 경고 박스가 뜨고 **저장 버튼이 비활성화**된다.

`{{CODE}}` 를 넣으면 저장 버튼이 열리고, 미리보기에 `ABCD-1234-EFGH` 가 치환돼 보인다. 당첨/낙첨 이미지도 업로드하고 저장한다.

- [ ] **Step 7: ACTIVE 전환**

체크리스트 4항목이 전부 ✓ 인지 확인 → "캠페인 시작"

Expected: 배지가 `ACTIVE` 로 바뀌고, 버튼이 "일시중지"/"종료" 로 바뀐다.

- [ ] **Step 8: 일시중지 → 재개 → 종료 확인**

"일시중지" → 다이얼로그 문구 확인 → 확인 → `PAUSED`
"재개" → `ACTIVE`
"종료" → **되돌릴 수 없다는 경고 문구**가 보이는지 확인 → 확인 → `ENDED`, 전환 버튼이 사라진다

- [ ] **Step 9: 전체 검증 스위트**

Run:
```bash
pnpm typecheck
pnpm lint
pnpm test
```
Expected: 전부 green

- [ ] **Step 10: MVP_PLAN 갱신**

`docs/jwin/MVP_PLAN.md` 에서 Phase 4(경품·소재·결과화면 탭 + 상태 전환) 항목을 완료로 표시하고, 남은 것이 Phase 5(통계·당첨자 관리)임을 한 줄로 적는다.

- [ ] **Step 11: 커밋**

```bash
git add docs/jwin/MVP_PLAN.md
git commit -m "docs(jwin): Phase 4 완료 반영 — 화면만으로 캠페인 ACTIVE 전환 가능"
```

---

## 이 플랜이 의도적으로 하지 않는 것

설계 §2 의 비목표를 그대로 따른다. 리뷰에서 "빠졌다"고 지적하지 말 것:

- 통계 탭, 당첨자 관리 (Phase 5)
- 경품 삭제, 소재 수정 — 잘못 등록하면 재등록으로 대체한다(MVP_PLAN §1)
- 소재 기간 자동 제안·자동 채우기
- 미디어 갤러리·재사용 라이브러리 (업로드 후 URL 만 보관)
- 드래그 앤 드롭 업로드
- UI 컴포넌트 테스트 (jsdom·testing-library 미도입)
- `POST /admin/prizes` · `POST /admin/post-templates` 의 서버 응답을 계약 모양으로 바꾸는 것 — 이번 Phase 는 프론트 작업이다. 화면은 응답을 쓰지 않고 목록을 다시 불러온다.
