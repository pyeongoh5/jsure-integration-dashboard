# SNS 단위 캠페인 제외(디펜던시) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캠페인 제외 차단을 "캠페인 전체 차단"에서 "같은 SNS 기준 차단"으로 바꾸고, 응모 화면에 제외된 SNS를 비활성화 표시한다.

**Architecture:** 제외 설정(`CampaignExclusion`)과 관리자 UI는 그대로 캠페인 단위로 둔다. 응모 생성 차단 로직을 같은-SNS 매칭으로 바꾸고, 인플루언서 캠페인 상세 응답에 `excludedSnsTypes` 를 추가해 응모 화면이 해당 SNS를 비활성화하도록 한다. DB 마이그레이션 없음.

**Tech Stack:** Turborepo + pnpm 모노레포, NestJS + Prisma(api), zod(`@jsure/shared`), React + Vite(client-web).

**참고 — 테스트 방식:** 이 레포는 prisma mock 기반 서비스 테스트 패턴이 없다(`*.service.spec.ts` 는 순수 함수만 테스트). CODE_RULES §0(새 패턴 도입 전 확인) 에 따라 prisma-mock jest 테스트를 새로 도입하지 않는다. 대신 각 백엔드 변경은 `pnpm typecheck` 와 실제 DB 기반 검증 스크립트로 확인한다.

---

### Task 1: `@jsure/shared` 에 `excludedSnsTypes` 필드 추가

**Files:**
- Modify: `packages/shared/src/types/campaign.ts` (`InfluencerCampaignDetailSchema`)

- [ ] **Step 1: 스키마에 필드 추가**

`InfluencerCampaignDetailSchema` 의 `.extend({...})` 안, `appliedSnsTypes` 정의 바로 아래에 추가한다. 현재 정의:

```ts
export const InfluencerCampaignDetailSchema =
  InfluencerCampaignCardSchema.extend({
    productDetailUrl: z.string().url(),
    guideline: z.string(),
    referenceMediaUrls: z.array(z.string().url()),
    cautions: z.string(),
    /** 인플루언서가 이 캠페인에 이미 신청한(취소 제외) SNS 목록 */
    appliedSnsTypes: z.array(SnsTypeSchema),
  });
```

변경 후:

```ts
export const InfluencerCampaignDetailSchema =
  InfluencerCampaignCardSchema.extend({
    productDetailUrl: z.string().url(),
    guideline: z.string(),
    referenceMediaUrls: z.array(z.string().url()),
    cautions: z.string(),
    /** 인플루언서가 이 캠페인에 이미 신청한(취소 제외) SNS 목록 */
    appliedSnsTypes: z.array(SnsTypeSchema),
    /** 과거 응모 이력(제외 캠페인) 때문에 이 캠페인에서 응모할 수 없는 SNS 목록 */
    excludedSnsTypes: z.array(SnsTypeSchema),
  });
```

- [ ] **Step 2: shared 빌드**

Run: `pnpm --filter @jsure/shared build`
Expected: 에러 없이 빌드 완료 (`dist/types/campaign.js` 갱신).

- [ ] **Step 3: 타입 점검 (이 시점엔 api/client 가 아직 필드를 안 채워서 실패 예상)**

Run: `pnpm --filter @jsure/api typecheck`
Expected: `influencer-campaigns.service.ts` 의 `detail()` 반환에서 `excludedSnsTypes` 누락으로 타입 에러. (Task 2 에서 해결) — 이는 의도된 빨강이다.

- [ ] **Step 4: 커밋**

```bash
git add packages/shared/src/types/campaign.ts
git commit -m "feat(shared): 인플루언서 캠페인 상세에 excludedSnsTypes 추가"
```

---

### Task 2: 인플루언서 캠페인 상세에서 `excludedSnsTypes` 계산

**Files:**
- Modify: `apps/api/src/influencer-campaigns/influencer-campaigns.service.ts` (`detail()`, 약 119-164행)

- [ ] **Step 1: `detail()` 의 findUnique 에 제외 캠페인 관계 포함**

현재:

```ts
    const row = await this.prisma.campaign.findUnique({
      where: { id: args.campaignId },
      include: {
        snsRecruits: {
          select: { snsType: true, minFollowers: true, recruitCount: true },
          orderBy: { snsType: "asc" },
        },
      },
    });
```

변경:

```ts
    const row = await this.prisma.campaign.findUnique({
      where: { id: args.campaignId },
      include: {
        snsRecruits: {
          select: { snsType: true, minFollowers: true, recruitCount: true },
          orderBy: { snsType: "asc" },
        },
        exclusionsAsExcluding: { select: { excludedCampaignId: true } },
      },
    });
```

- [ ] **Step 2: `excludedSnsTypes` 계산 후 반환에 포함**

`const existing = await this.prisma.campaignApplication.findMany({ ... select: { snsType: true } });` 블록 (약 142-149행) 바로 다음에 아래 계산을 추가한다:

```ts
    const excludedCampaignIds = row.exclusionsAsExcluding.map(
      (exclusion) => exclusion.excludedCampaignId,
    );
    let excludedSnsTypes: SnsType[] = [];
    if (excludedCampaignIds.length > 0) {
      const recruitedSnsTypes = new Set(
        row.snsRecruits.map((recruit) => recruit.snsType),
      );
      const priorOnExcluded = await this.prisma.campaignApplication.findMany({
        where: {
          influencerId: args.influencerId,
          campaignId: { in: excludedCampaignIds },
          status: { not: "CANCELLED" },
        },
        select: { snsType: true },
        distinct: ["snsType"],
      });
      excludedSnsTypes = priorOnExcluded
        .map((application) => application.snsType)
        .filter((snsType) => recruitedSnsTypes.has(snsType));
    }
```

그리고 `return { ... }` 객체의 `appliedSnsTypes: existing.map((r) => r.snsType),` 다음 줄에 추가:

```ts
      excludedSnsTypes,
```

- [ ] **Step 3: `SnsType` 타입 import 확인**

파일 상단 import 에 `SnsType` 이 없으면 추가한다. 기존 import 가 `import type { ... } from "@jsure/shared";` 형태이면 거기에 `SnsType` 을 넣는다. (이미 `appliedSnsTypes` 등에서 쓰고 있을 수 있으니 중복 추가 금지 — 없을 때만.)

- [ ] **Step 4: api 타입 점검**

Run: `pnpm --filter @jsure/api typecheck`
Expected: PASS (Task 1 의 빨강이 해소됨).

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/influencer-campaigns/influencer-campaigns.service.ts
git commit -m "feat(api): 인플루언서 캠페인 상세에 excludedSnsTypes 계산"
```

---

### Task 3: 응모 생성 차단을 같은-SNS 매칭으로 변경

**Files:**
- Modify: `apps/api/src/influencer-applications/influencer-applications.service.ts` (`create()`, 약 245-297행)

- [ ] **Step 1: 기존 "전체 차단" 블록을 excludedSnsTypes 계산으로 교체**

현재 (약 245-264행):

```ts
    // 제외 캠페인 응모 이력이 하나라도 있으면 응모 차단 (CANCELLED 제외)
    const excludedIds = campaign.exclusionsAsExcluding.map(
      (e) => e.excludedCampaignId,
    );
    if (excludedIds.length > 0) {
      const conflict = await this.prisma.campaignApplication.findFirst({
        where: {
          influencerId,
          campaignId: { in: excludedIds },
          status: { not: "CANCELLED" },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new BadRequestException({
          code: "EXCLUDED_BY_PREVIOUS_APPLICATION",
          message: "同種のキャンペーンに既に応募済みのため応募できません",
        });
      }
    }
```

변경:

```ts
    // 제외 캠페인에 "같은 SNS"로 응모한 이력이 있으면 그 SNS 응모만 차단 (CANCELLED 제외)
    const excludedCampaignIds = campaign.exclusionsAsExcluding.map(
      (exclusion) => exclusion.excludedCampaignId,
    );
    const excludedSnsTypes = new Set<SnsType>();
    if (excludedCampaignIds.length > 0) {
      const priorOnExcluded = await this.prisma.campaignApplication.findMany({
        where: {
          influencerId,
          campaignId: { in: excludedCampaignIds },
          status: { not: "CANCELLED" },
        },
        select: { snsType: true },
        distinct: ["snsType"],
      });
      for (const application of priorOnExcluded) {
        excludedSnsTypes.add(application.snsType);
      }
    }
```

- [ ] **Step 2: 요청 SNS 검증에 제외 SNS 차단 추가**

기존 `invalid` 검증 블록 (약 290-297행):

```ts
    const qualifyingSet = new Set(qualifyingSns);
    const invalid = snsTypes.filter((s) => !qualifyingSet.has(s));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: "SNS_NOT_QUALIFIED",
        message: "応募条件を満たさないSNSが含まれています",
      });
    }
```

바로 다음에 추가:

```ts
    const blockedByExclusion = snsTypes.filter((snsType) =>
      excludedSnsTypes.has(snsType),
    );
    if (blockedByExclusion.length > 0) {
      throw new BadRequestException({
        code: "EXCLUDED_BY_PREVIOUS_APPLICATION",
        message: "同種のキャンペーンに既に応募済みのため、このSNSでは応募できません",
      });
    }
```

- [ ] **Step 3: `SnsType` import 확인**

파일 상단 import 에 `SnsType` 이 이미 있다(`import type { InfluencerApplication, SnsType, ... } from "@jsure/shared";`). 없을 때만 추가.

- [ ] **Step 4: api 타입 점검**

Run: `pnpm --filter @jsure/api typecheck`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/influencer-applications/influencer-applications.service.ts
git commit -m "feat(api): 응모 차단을 같은 SNS 기준으로 변경"
```

---

### Task 4: 응모 화면에서 제외 SNS 비활성화 + 사유 표시

**Files:**
- Modify: `apps/client-web/src/pages/Apply/index.tsx` (SNS 선택 목록 렌더링)

- [ ] **Step 1: 행 단위 excluded 판정 + disabled 반영**

`campaign.data.snsRecruits.map((r) => { ... })` 안에서, 기존:

```tsx
                const isQualifying = qualifying.includes(r.snsType);
                const alreadyApplied = campaign.data.appliedSnsTypes.includes(
                  r.snsType,
                );
                const myFollowers = followerByMySns.get(r.snsType);
                const isSelected = selectedSns.has(r.snsType);
                const disabled = !isQualifying || alreadyApplied;
```

변경:

```tsx
                const isQualifying = qualifying.includes(r.snsType);
                const alreadyApplied = campaign.data.appliedSnsTypes.includes(
                  r.snsType,
                );
                const isExcluded = campaign.data.excludedSnsTypes.includes(
                  r.snsType,
                );
                const myFollowers = followerByMySns.get(r.snsType);
                const isSelected = selectedSns.has(r.snsType);
                const disabled = !isQualifying || alreadyApplied || isExcluded;
```

- [ ] **Step 2: 사유 라벨 표시**

`alreadyApplied` 배지 표시 부분:

```tsx
                          {alreadyApplied && (
                            <span style={{ marginLeft: 8, color: "#10b981", fontSize: 11 }}>
                              応募済み
                            </span>
                          )}
```

바로 다음에 추가:

```tsx
                          {!alreadyApplied && isExcluded && (
                            <span style={{ marginLeft: 8, color: "#ef4444", fontSize: 11 }}>
                              参加不可（類似キャンペーンに応募済み）
                            </span>
                          )}
```

- [ ] **Step 3: client 타입 점검**

Run: `pnpm --filter @jsure/admin-web typecheck && pnpm --filter @jsure/client-web typecheck`
Expected: PASS. (client-web 의 `getCampaign` 응답은 `InfluencerCampaignDetailSchema.parse` 를 거치므로 새 필드가 자동 반영됨.)

- [ ] **Step 4: 커밋**

```bash
git add apps/client-web/src/pages/Apply/index.tsx
git commit -m "feat(client-web): 응모 화면에서 제외 SNS 비활성화 및 사유 표시"
```

---

### Task 5: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 타입 점검**

Run: `pnpm typecheck`
Expected: 5개 패키지 모두 PASS.

- [ ] **Step 2: DB 기반 동작 검증 스크립트**

`apps/api` 에 임시 스크립트를 만들어 실제 DB로 시나리오를 확인한다. 실제 제외 관계가 설정된 캠페인 한 쌍(E, A)과, A에 인스타로 응모한 인플루언서 id 를 사용한다(없으면 prisma studio 또는 SQL 로 하나 구성).

```js
// apps/api/verify-exclusion.tmp.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const currentCampaignId = process.argv[2]; // E
const influencerId = process.argv[3];
const e = await prisma.campaign.findUnique({
  where: { id: currentCampaignId },
  include: {
    snsRecruits: { select: { snsType: true } },
    exclusionsAsExcluding: { select: { excludedCampaignId: true } },
  },
});
const excludedCampaignIds = e.exclusionsAsExcluding.map((x) => x.excludedCampaignId);
const prior = await prisma.campaignApplication.findMany({
  where: { influencerId, campaignId: { in: excludedCampaignIds }, status: { not: "CANCELLED" } },
  select: { snsType: true }, distinct: ["snsType"],
});
const recruited = new Set(e.snsRecruits.map((r) => r.snsType));
const excludedSns = prior.map((p) => p.snsType).filter((s) => recruited.has(s));
console.log("recruited:", [...recruited].join(","));
console.log("excludedSnsTypes:", excludedSns.join(",") || "(none)");
await prisma.$disconnect();
```

Run: `cd apps/api && node verify-exclusion.tmp.mjs <E_campaignId> <influencerId>; rm -f verify-exclusion.tmp.mjs`
Expected: A에 인스타로 응모한 인플루언서면 `excludedSnsTypes: INSTAGRAM` 출력. 틱톡은 목록에 없어야 함.

- [ ] **Step 3: 수동 확인 (선택)**

client-web 응모 화면에서 해당 인플루언서로 E 응모 진입 → 인스타 행이 비활성화 + 「参加不可」 표시, 틱톡 행은 선택 가능한지 확인.

- [ ] **Step 4: 스펙과 대조 후 마무리**

`docs/superpowers/specs/2026-06-12-sns-level-campaign-exclusion-design.md` 의 각 항목이 구현되었는지 확인.
