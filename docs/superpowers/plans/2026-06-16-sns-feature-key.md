# SNS 활성 플래그(Feature Key) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SNS 활성 목록을 단일 빌드 타임 상수로 관리하여 초기 운영 시 Instagram·X만 입력·표시되도록 한다.

**Architecture:** `packages/shared`에 `SNS_ENABLED: Record<SnsType, boolean>`를 추가하고, 거기서 파생한 `ENABLED_SNS_TYPES` 배열과 `EnabledSnsTypeSchema` zod 스키마를 노출한다. API 입력 경계 zod 스키마와 6개 UI 옵션 컴포넌트가 이를 참조한다. enum·Prisma·DB는 변경하지 않는다.

**Tech Stack:** TypeScript, zod, NestJS, React (Vite), pnpm monorepo (`@jsure/shared` 공유 패키지)

**Spec:** `docs/superpowers/specs/2026-06-16-sns-feature-key-design.md`

---

## File Structure

**Create / Modify:**

- Modify: `packages/shared/src/types/influencer.ts` — `SNS_ENABLED`, `isEnabledSnsType`, `ENABLED_SNS_TYPES`, `EnabledSnsTypeSchema`, `EnabledSnsType` 추가. `InfluencerSnsAccountInputSchema.snsType`를 `EnabledSnsTypeSchema`로 교체.
- Modify: `packages/shared/src/types/campaign.ts` — `SnsRecruitInputSchema`(입력 전용) 신설. `CampaignFormSchema`·`UpdateCampaignRequestSchema`에서 입력용 스키마 참조. `SnsRecruitSchema`(표시용)는 `SnsTypeSchema` 유지.
- Modify: `packages/shared/src/types/application.ts` — `CreateApplicationRequestSchema.snsTypes`를 `z.array(EnabledSnsTypeSchema)`로 교체.
- Modify: `packages/shared/src/index.ts` — 신규 export.
- Modify: `apps/admin-web/src/domains/campaign/components/SnsTypeChips.tsx` — 옵션 필터.
- Modify: `apps/admin-web/src/domains/campaign/components/SnsRecruitList.tsx` — 옵션 필터.
- Modify: `apps/client-web/src/domains/campaign/components/SnsTabBar.tsx` — 탭 필터.
- Modify: `apps/client-web/src/domains/application/components/ApplicationFilters.tsx` — 필터 옵션 필터.
- Modify: `apps/client-web/src/pages/Signup/Sns.tsx` — 가입 SNS 입력 필터.
- Modify: `apps/client-web/src/pages/Me/Sns.tsx` — SNS 계정 관리 필터.

**No change:** Prisma 스키마, DB enum, 표시용 dict(`SNS_ICON`/`SNS_CLASS` 등 라벨·아이콘 매핑), 읽기 응답 스키마, CSV 출력 스키마, `apps/admin-web/src/pages/Influencers/index.tsx`(SNS 선택 옵션 없음, 표시만 함).

**Note (테스트 인프라):** `packages/shared`에는 단위 테스트 인프라가 없다. 본 계획은 `pnpm typecheck`·`pnpm build`·수동 UI 확인을 검증 수단으로 사용한다. 새로운 zod 거부 동작은 schema에 `safeParse`를 직접 호출하는 **검증 스니펫**으로 확인한다(Task 6).

---

## Task 1: shared 패키지에 SNS feature key SSOT 추가

**Files:**
- Modify: `packages/shared/src/types/influencer.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: `influencer.ts` 상단에 `SNS_ENABLED` 및 파생 값 추가**

`SnsTypeSchema`/`SnsType` 정의 바로 아래(line 5 다음)에 삽입한다.

```ts
/**
 * SNS 활성 플래그. 초기 운영은 Instagram·X만 허용한다.
 * TikTok·YouTube를 재오픈하려면 이 객체의 값만 `true`로 바꾸고 빌드한다.
 * `Record<SnsType, boolean>`로 두어, 새 SnsType 추가 시 키 누락을 컴파일 타임에 잡는다.
 */
export const SNS_ENABLED: Record<SnsType, boolean> = {
  INSTAGRAM: true,
  TIKTOK: false,
  X: true,
  YOUTUBE: false,
};

export const isEnabledSnsType = (snsType: SnsType): boolean =>
  SNS_ENABLED[snsType];

export const ENABLED_SNS_TYPES: readonly SnsType[] = (
  Object.keys(SNS_ENABLED) as SnsType[]
).filter(isEnabledSnsType);

export const EnabledSnsTypeSchema = z.enum(
  ENABLED_SNS_TYPES as unknown as [SnsType, ...SnsType[]],
);
export type EnabledSnsType = z.infer<typeof EnabledSnsTypeSchema>;
```

- [ ] **Step 2: `InfluencerSnsAccountInputSchema.snsType`를 `EnabledSnsTypeSchema`로 교체**

같은 파일 line 53–61의 `InfluencerSnsAccountInputSchema`에서 `snsType: SnsTypeSchema`를 `snsType: EnabledSnsTypeSchema`로 변경한다.

```ts
export const InfluencerSnsAccountInputSchema = z.object({
  snsType: EnabledSnsTypeSchema,
  handle: z
    .string()
    .transform(normalizeSnsHandle)
    .pipe(z.string().min(1, "ハンドルを入力してください").max(64)),
  followerCount: z.number().int().nonnegative(),
});
```

- [ ] **Step 3: `packages/shared/src/index.ts`에서 신규 export 추가**

`influencer.ts`에서 이미 다른 항목을 export하는 줄을 찾아 거기에 묶어서 추가하거나, 별도 줄로 추가한다.

```ts
export {
  SnsTypeSchema,
  SNS_ENABLED,
  isEnabledSnsType,
  ENABLED_SNS_TYPES,
  EnabledSnsTypeSchema,
} from "./types/influencer.js";
export type { SnsType, EnabledSnsType } from "./types/influencer.js";
```

기존 export 라인 구조에 맞추어 자연스럽게 통합한다. 중복 export가 생기면 정리한다.

- [ ] **Step 4: shared 빌드·typecheck**

```bash
pnpm --filter @jsure/shared build
pnpm --filter @jsure/shared typecheck
```

Expected: 모두 성공.

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/types/influencer.ts packages/shared/src/index.ts
git commit -m "feat(shared): SNS 활성 플래그(feature key)와 EnabledSnsTypeSchema 추가"
```

---

## Task 2: 캠페인 입력 스키마에 EnabledSnsType 적용

`SnsRecruitSchema`는 응답 스키마(`CampaignResponseSchema.snsRecruits`, `InfluencerCampaignCardSchema.snsRecruits`)에서도 재사용되므로 그대로 두고, 입력 전용으로 별도 스키마를 만든다.

**Files:**
- Modify: `packages/shared/src/types/campaign.ts`

- [ ] **Step 1: `SnsRecruitInputSchema` 신설 및 `SnsRecruitInputArray` 분리**

`campaign.ts` line 11–24의 `SnsRecruitSchema`·`SnsRecruitArray` 정의 **아래**(`SnsRecruitArray` 정의 직후)에 입력 전용 변형을 추가한다.

```ts
const SnsRecruitInputSchema = z.object({
  snsType: EnabledSnsTypeSchema,
  minFollowers: z.number().int().nonnegative("0 이상의 정수"),
  recruitCount: z.number().int().positive("1 이상"),
});

const SnsRecruitInputArray = z
  .array(SnsRecruitInputSchema)
  .min(1, "1개 이상의 SNS를 모집해야 합니다")
  .refine(
    (arr) => new Set(arr.map((r) => r.snsType)).size === arr.length,
    "SNS가 중복되었습니다",
  );
```

파일 상단 import에 `EnabledSnsTypeSchema`를 추가한다.

```ts
import {
  SnsTypeSchema,
  EnabledSnsTypeSchema,
  type SnsType,
} from "./influencer.js";
```

- [ ] **Step 2: `CampaignFormSchema`·`UpdateCampaignRequestSchema`에서 입력 배열 교체**

line 37: `snsRecruits: SnsRecruitArray,` → `snsRecruits: SnsRecruitInputArray,`
line 64: `snsRecruits: SnsRecruitArray.optional(),` → `snsRecruits: SnsRecruitInputArray.optional(),`

`SnsRecruitArray`(읽기/표시용)는 다른 사용처가 있다면 그대로 유지하고, 사용처가 없어졌다면 제거한다. 사용처는 `grep -rn "SnsRecruitArray" packages/shared/src apps/`로 확인한다(없을 가능성 높음).

- [ ] **Step 3: shared 빌드·typecheck + 모노레포 전체 typecheck**

```bash
pnpm --filter @jsure/shared build
pnpm typecheck
```

Expected: 모두 성공. admin-web 캠페인 폼이 `CampaignForm` 타입을 쓰는데, 폼 상태가 `SnsRecruit[]`(`snsType: SnsType`)인 상황에서도 입력 시 `EnabledSnsType`로 좁혀진 값만 들어가므로 일반적으로 호환되지만, 만약 타입 에러가 나면 폼 컴포넌트 상태 타입을 `snsType: SnsType` 그대로 두고(상태는 넓게, 검증은 좁게) zod에서 거부되도록 한다.

- [ ] **Step 4: 커밋**

```bash
git add packages/shared/src/types/campaign.ts
git commit -m "feat(shared): 캠페인 모집 SNS 입력 스키마를 활성 SNS로 제한"
```

---

## Task 3: 응모 생성 입력 스키마에 EnabledSnsType 적용

**Files:**
- Modify: `packages/shared/src/types/application.ts`

- [ ] **Step 1: `CreateApplicationRequestSchema.snsTypes`를 `EnabledSnsTypeSchema` 배열로 교체**

line 86–95 부근을 다음과 같이 변경한다.

```ts
export const CreateApplicationRequestSchema = z.object({
  campaignId: z.string().min(1),
  snsTypes: z
    .array(EnabledSnsTypeSchema)
    .min(1, "1つ以上のSNSを選択してください")
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "SNSが重複しています",
    ),
});
```

상단 import에 `EnabledSnsTypeSchema`를 추가한다.

```ts
import { SnsTypeSchema, EnabledSnsTypeSchema } from "./influencer.js";
```

`SubmittedPostSchema.snsType`(line 43)과 `InfluencerApplicationSchema.snsType`(line 125)은 **응답 스키마**이므로 그대로 둔다.

- [ ] **Step 2: shared 빌드·전체 typecheck**

```bash
pnpm --filter @jsure/shared build
pnpm typecheck
```

Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/src/types/application.ts
git commit -m "feat(shared): 응모 생성 입력 SNS를 활성 SNS로 제한"
```

---

## Task 4: admin-web SNS 선택 UI 필터링

**Files:**
- Modify: `apps/admin-web/src/domains/campaign/components/SnsTypeChips.tsx`
- Modify: `apps/admin-web/src/domains/campaign/components/SnsRecruitList.tsx`

- [ ] **Step 1: `SnsTypeChips.tsx`의 `OPTIONS` 필터링**

상단 import를 다음으로 교체한다.

```ts
import { isEnabledSnsType, type SnsType } from "@jsure/shared";
```

`OPTIONS` 정의 직후에 활성 옵션만 노출하는 변수를 추가하고, JSX에서 그것을 사용한다. 원본 4종 정의는 유지(라벨 출처)하고 필터링만 한다.

```ts
const OPTIONS: readonly { value: SnsType; label: string }[] = [
  { value: "INSTAGRAM", label: "인스타그램" },
  { value: "TIKTOK", label: "틱톡" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "유튜브" },
];

const VISIBLE_OPTIONS = OPTIONS.filter((opt) => isEnabledSnsType(opt.value));
```

JSX의 `{OPTIONS.map(...)}`을 `{VISIBLE_OPTIONS.map(...)}`로 변경한다.

- [ ] **Step 2: `SnsRecruitList.tsx`의 `OPTIONS` 필터링**

같은 패턴을 적용한다. 상단 import에 `isEnabledSnsType`를 추가한다.

```ts
import { isEnabledSnsType, type SnsRecruit, type SnsType } from "@jsure/shared";
```

기존 `OPTIONS` 배열 정의 아래에 추가한다.

```ts
const VISIBLE_OPTIONS = OPTIONS.filter((opt) => isEnabledSnsType(opt.value));
```

`{OPTIONS.map((opt) => { ... })}` (line 79) 부분을 `{VISIBLE_OPTIONS.map((opt) => { ... })}`로 변경한다. `SNS_ICON_CLASS`(line 36–41) Record는 그대로 둔다(표시 dict 보존).

- [ ] **Step 3: admin-web typecheck**

```bash
pnpm --filter admin-web typecheck
```

Expected: 성공.

- [ ] **Step 4: 커밋**

```bash
git add apps/admin-web/src/domains/campaign/components/SnsTypeChips.tsx \
        apps/admin-web/src/domains/campaign/components/SnsRecruitList.tsx
git commit -m "feat(admin): 캠페인 SNS 선택 UI에 활성 SNS만 노출"
```

---

## Task 5: client-web SNS 선택 UI 필터링

**Files:**
- Modify: `apps/client-web/src/domains/campaign/components/SnsTabBar.tsx`
- Modify: `apps/client-web/src/domains/application/components/ApplicationFilters.tsx`
- Modify: `apps/client-web/src/pages/Signup/Sns.tsx`
- Modify: `apps/client-web/src/pages/Me/Sns.tsx`

- [ ] **Step 1: `SnsTabBar.tsx` — 탭 SNS 목록을 활성으로 좁히기**

기존 라인 1·4를 변경한다.

```ts
// before:
import { SnsTypeSchema, type SnsType } from "@jsure/shared";
const SNS_TYPES = SnsTypeSchema.options;

// after:
import { ENABLED_SNS_TYPES, type SnsType } from "@jsure/shared";
const SNS_TYPES = ENABLED_SNS_TYPES;
```

`LABEL` Record(4키)는 그대로 둔다(표시 dict 보존).

- [ ] **Step 2: `ApplicationFilters.tsx` — 필터 옵션 좁히기**

상단 import에 `isEnabledSnsType`를 추가하고, `SNS_OPTIONS` 정의 직후에 필터링 변수를 추가한 뒤 사용처를 교체한다.

```ts
import { isEnabledSnsType, type SnsType } from "@jsure/shared";

const SNS_OPTIONS: { value: SnsType; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "YouTube" },
];
const VISIBLE_SNS_OPTIONS = SNS_OPTIONS.filter((opt) =>
  isEnabledSnsType(opt.value),
);
```

파일 내 `SNS_OPTIONS` 사용처(line 88, 186 부근)를 `VISIBLE_SNS_OPTIONS`로 모두 교체한다. `grep -n "SNS_OPTIONS" apps/client-web/src/domains/application/components/ApplicationFilters.tsx`로 사용처를 모두 확인하고 교체한다.

- [ ] **Step 3: `Signup/Sns.tsx` — 입력 SNS 목록 좁히기**

라인 6·11을 다음과 같이 변경한다.

```ts
// before:
import { SnsTypeSchema, type SnsType } from "@jsure/shared";
const SNS_TYPES = SnsTypeSchema.options;

// after:
import { ENABLED_SNS_TYPES, type SnsType } from "@jsure/shared";
const SNS_TYPES = ENABLED_SNS_TYPES;
```

`TYPE_TO_KEY` Record(4키)는 그대로 둔다(표시·키 매핑 보존).

- [ ] **Step 4: `Me/Sns.tsx` — 동일 변경**

라인 6·14를 동일 패턴으로 변경한다.

```ts
import { ENABLED_SNS_TYPES, type SnsType } from "@jsure/shared";
const SNS_TYPES = ENABLED_SNS_TYPES;
```

`SnsTypeSchema` import가 다른 곳에서 쓰이지 않는다면 제거한다. `TYPE_TO_KEY`는 그대로 둔다.

- [ ] **Step 5: client-web typecheck**

```bash
pnpm --filter client-web typecheck
```

Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add apps/client-web/src/domains/campaign/components/SnsTabBar.tsx \
        apps/client-web/src/domains/application/components/ApplicationFilters.tsx \
        apps/client-web/src/pages/Signup/Sns.tsx \
        apps/client-web/src/pages/Me/Sns.tsx
git commit -m "feat(client): SNS 선택/탭/필터 UI에 활성 SNS만 노출"
```

---

## Task 6: 동작 검증 (수동·스니펫)

자동 테스트 인프라가 없으므로 다음 검증을 수행한다.

- [ ] **Step 1: 모노레포 전체 typecheck + build**

```bash
pnpm typecheck
pnpm build
```

Expected: 모두 성공.

- [ ] **Step 2: zod 거부 동작 스니펫 검증**

임시 검증 스크립트 `/tmp/sns-verify.mjs`를 생성한다.

```js
// /tmp/sns-verify.mjs
import {
  EnabledSnsTypeSchema,
  ENABLED_SNS_TYPES,
  isEnabledSnsType,
  SNS_ENABLED,
} from "./packages/shared/dist/types/influencer.js";

console.log("SNS_ENABLED:", SNS_ENABLED);
console.log("ENABLED_SNS_TYPES:", ENABLED_SNS_TYPES);
console.log("isEnabledSnsType(INSTAGRAM):", isEnabledSnsType("INSTAGRAM"));
console.log("isEnabledSnsType(TIKTOK):", isEnabledSnsType("TIKTOK"));
console.log(
  "EnabledSnsTypeSchema.safeParse('INSTAGRAM').success:",
  EnabledSnsTypeSchema.safeParse("INSTAGRAM").success,
);
console.log(
  "EnabledSnsTypeSchema.safeParse('TIKTOK').success:",
  EnabledSnsTypeSchema.safeParse("TIKTOK").success,
);
console.log(
  "EnabledSnsTypeSchema.safeParse('YOUTUBE').success:",
  EnabledSnsTypeSchema.safeParse("YOUTUBE").success,
);
console.log(
  "EnabledSnsTypeSchema.safeParse('X').success:",
  EnabledSnsTypeSchema.safeParse("X").success,
);
```

프로젝트 루트에서 실행한다.

```bash
node /tmp/sns-verify.mjs
```

Expected output:
```
SNS_ENABLED: { INSTAGRAM: true, TIKTOK: false, X: true, YOUTUBE: false }
ENABLED_SNS_TYPES: [ 'INSTAGRAM', 'X' ]
isEnabledSnsType(INSTAGRAM): true
isEnabledSnsType(TIKTOK): false
EnabledSnsTypeSchema.safeParse('INSTAGRAM').success: true
EnabledSnsTypeSchema.safeParse('TIKTOK').success: false
EnabledSnsTypeSchema.safeParse('YOUTUBE').success: false
EnabledSnsTypeSchema.safeParse('X').success: true
```

확인 후 임시 스크립트는 삭제: `rm /tmp/sns-verify.mjs`.

- [ ] **Step 3: 컴파일 타임 키 누락 가드 확인 (수동)**

`packages/shared/src/types/influencer.ts`의 `SNS_ENABLED` 객체에서 임시로 한 키(예: `X: true,`)를 주석 처리하고 `pnpm --filter @jsure/shared typecheck`를 실행한다.

Expected: `Property 'X' is missing in type ...` 류의 컴파일 에러가 발생한다.

확인 후 즉시 원복한다.

- [ ] **Step 4: 수동 UI 점검 (가능 시)**

`pnpm --filter admin-web dev` / `pnpm --filter client-web dev` 실행 후 다음을 확인한다.

| 화면 | 기대 결과 |
|---|---|
| admin-web 캠페인 생성 폼 SNS 칩 | Instagram, X만 노출 |
| admin-web 캠페인 모집 SNS 리스트 | Instagram, X만 노출 |
| client-web 캠페인 목록 SNS 탭 | Instagram, X 탭만 |
| client-web 응모 페이지 SNS 필터 | Instagram, X만 옵션 |
| client-web 가입 SNS 입력 | Instagram, X만 등록 가능 |
| client-web Me/Sns | Instagram, X만 등록·관리 가능 |

UI 환경 접근이 불가능하면 이 단계를 생략하고 사용자에게 수동 확인을 요청한다.

- [ ] **Step 5: 본 작업 외 변경 없음 확인 후 마무리**

```bash
git status
git log --oneline -10
```

작업 외 파일에 변경이 있는지 확인하고, 없다면 사용자에게 완료 보고한다.

---

## 자체 검토 체크리스트

- ✅ spec의 SSOT(`SNS_ENABLED` Record) — Task 1
- ✅ 입력 스키마 교체(인플루언서 SNS 등록, 캠페인 작성·수정, 응모 생성) — Task 1·2·3
- ✅ 표시·필터 스키마 유지(`SnsRecruitSchema`, `InfluencerApplicationSchema.snsType`, `applicationExport`, `adminInfluencer` 등) — 변경 없음
- ✅ admin-web 선택 UI 2개 — Task 4
- ✅ client-web 선택 UI 4개 — Task 5
- ✅ 표시용 라벨·아이콘 dict 보존 — 명시적으로 그대로 둠
- ✅ 컴파일 타임 키 누락 가드 검증 — Task 6 Step 3
- ✅ zod 거부 동작 검증 — Task 6 Step 2
- ✅ Prisma·DB·읽기 스키마 무변경 — spec과 일치
