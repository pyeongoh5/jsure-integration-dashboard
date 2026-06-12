# 인플루언서 웹: 응모내역 필터 + 신청 화면 주소 확인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인플루언서 응모내역에 SNS(다중)·상태(신청/반려/진행중/종료) 필터를 추가하고, 캠페인 신청 화면에 배송지 주소 확인 UI(필수 체크 + 수정 링크)를 추가한다.

**Architecture:** client-web 전용. 응모 목록은 본인 것만이라 작으므로 클라이언트 사이드 필터(순수 함수 + presentational 컴포넌트 + 페이지 state). 주소는 이미 `fetchMe()`로 받는 `me.address`를 신청 화면에 표시하고 필수 확인 체크를 신청 버튼 활성 조건에 추가. API/`@jsure/shared`/DB 변경 없음.

**Tech Stack:** React + Vite, React Router, @tanstack/react-query, zod 타입(`@jsure/shared`).

**테스트 방식:** client-web에 자동 테스트 인프라(vitest 등)가 없다. CODE_RULES §0(새 패턴 도입 전 확인)에 따라 새 테스트 러너를 도입하지 않고, 각 작업은 `pnpm --filter @jsure/client-web typecheck`로 검증한다. 필터 로직은 순수 함수로 분리해 추후 테스트 추가가 쉽도록 한다.

---

### Task 1: 응모 필터 순수 함수 + 필터 바 컴포넌트

**Files:**
- Create: `apps/client-web/src/components/Application/applicationFilter.ts`
- Create: `apps/client-web/src/components/Application/ApplicationFilters.tsx`
- Modify: `apps/client-web/src/pages/Applications/Applications.css` (필터 스타일 추가)

- [ ] **Step 1: 순수 필터 함수 작성**

`apps/client-web/src/components/Application/applicationFilter.ts`:

```ts
import type {
  ApplicationStatus,
  InfluencerApplication,
  SnsType,
} from "@jsure/shared";

export type StatusFilter =
  | "all"
  | "applied"
  | "rejected"
  | "in_progress"
  | "ended";

/** 상태 필터 → 실제 status 집합. null 이면 전체. CANCELLED 는 서버에서 이미 제외됨. */
export const STATUS_FILTER_GROUPS: Record<
  StatusFilter,
  ApplicationStatus[] | null
> = {
  all: null,
  applied: ["APPLIED"],
  rejected: ["REJECTED"],
  in_progress: ["APPROVED", "SHIPPED", "DELIVERED"],
  ended: ["COMPLETED"],
};

export function filterApplications(
  applications: InfluencerApplication[],
  statusFilter: StatusFilter,
  selectedSnsTypes: Set<SnsType>,
): InfluencerApplication[] {
  const statuses = STATUS_FILTER_GROUPS[statusFilter];
  return applications.filter((application) => {
    const statusMatch =
      statuses === null || statuses.includes(application.status);
    const snsMatch =
      selectedSnsTypes.size === 0 ||
      selectedSnsTypes.has(application.snsType);
    return statusMatch && snsMatch;
  });
}
```

- [ ] **Step 2: presentational 필터 바 컴포넌트 작성**

`apps/client-web/src/components/Application/ApplicationFilters.tsx`:

```tsx
import type { SnsType } from "@jsure/shared";
import type { StatusFilter } from "./applicationFilter";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "applied", label: "申請" },
  { value: "rejected", label: "却下" },
  { value: "in_progress", label: "進行中" },
  { value: "ended", label: "終了" },
];

const SNS_CHIPS: { value: SnsType; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "YouTube" },
];

type Props = {
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  selectedSnsTypes: Set<SnsType>;
  onToggleSns: (snsType: SnsType) => void;
};

export function ApplicationFilters({
  statusFilter,
  onStatusChange,
  selectedSnsTypes,
  onToggleSns,
}: Props) {
  return (
    <div className="apps-filters">
      <div className="apps-filters__row">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`apps-filters__tab ${
              statusFilter === tab.value ? "is-active" : ""
            }`}
            onClick={() => onStatusChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="apps-filters__row">
        {SNS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={`apps-filters__chip ${
              selectedSnsTypes.has(chip.value) ? "is-active" : ""
            }`}
            onClick={() => onToggleSns(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 필터 스타일 추가**

`apps/client-web/src/pages/Applications/Applications.css` 파일 맨 끝에 추가:

```css
.apps-filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.apps-filters__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.apps-filters__tab,
.apps-filters__chip {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.apps-filters__tab.is-active {
  background: #111827;
  border-color: #111827;
  color: #fff;
}

.apps-filters__chip.is-active {
  background: #eef2ff;
  border-color: #6366f1;
  color: #4338ca;
}
```

- [ ] **Step 4: 타입 점검**

Run: `pnpm --filter @jsure/client-web typecheck`
Expected: PASS (새 파일은 아직 미사용이지만 타입상 독립적이라 통과).

- [ ] **Step 5: 커밋**

```bash
git add apps/client-web/src/components/Application/applicationFilter.ts \
        apps/client-web/src/components/Application/ApplicationFilters.tsx \
        apps/client-web/src/pages/Applications/Applications.css
git commit -m "feat(client-web): 응모내역 필터 함수/컴포넌트 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 응모내역 페이지에 필터 연결

**Files:**
- Modify: `apps/client-web/src/pages/Applications/index.tsx`

- [ ] **Step 1: 페이지에 필터 state + 적용 로직 반영**

`apps/client-web/src/pages/Applications/index.tsx` 전체를 아래로 교체:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { SnsType } from "@jsure/shared";
import { listApplications } from "../../lib/api/applications";
import { ApplicationCard } from "../../components/Application/ApplicationCard";
import { ApplicationFilters } from "../../components/Application/ApplicationFilters";
import {
  filterApplications,
  type StatusFilter,
} from "../../components/Application/applicationFilter";
import "./Applications.css";

export function Applications() {
  const nav = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["applications"],
    queryFn: listApplications,
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedSnsTypes, setSelectedSnsTypes] = useState<Set<SnsType>>(
    new Set(),
  );

  const toggleSns = (snsType: SnsType) => {
    setSelectedSnsTypes((prev) => {
      const next = new Set(prev);
      if (next.has(snsType)) next.delete(snsType);
      else next.add(snsType);
      return next;
    });
  };

  const applications = data ?? [];
  const filtered = filterApplications(
    applications,
    statusFilter,
    selectedSnsTypes,
  );

  return (
    <div className="apps">
      <header className="apps__header">
        <h1>応募内訳</h1>
      </header>

      {!isLoading && !isError && applications.length > 0 && (
        <ApplicationFilters
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          selectedSnsTypes={selectedSnsTypes}
          onToggleSns={toggleSns}
        />
      )}

      <div className="apps__list">
        {isLoading && <div className="apps__empty">読み込み中…</div>}
        {isError && (
          <div className="apps__empty">読み込みに失敗しました</div>
        )}
        {!isLoading && !isError && applications.length === 0 && (
          <div className="apps__empty">
            まだ応募していません
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="apps__cta"
                onClick={() => nav("/")}
              >
                キャンペーンを探す
              </button>
            </div>
          </div>
        )}
        {!isLoading &&
          !isError &&
          applications.length > 0 &&
          filtered.length === 0 && (
            <div className="apps__empty">該当する応募がありません</div>
          )}
        {filtered.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            onSelect={() => nav(`/applications/${app.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 점검**

Run: `pnpm --filter @jsure/client-web typecheck`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add apps/client-web/src/pages/Applications/index.tsx
git commit -m "feat(client-web): 응모내역에 SNS/상태 필터 적용

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 신청 화면 배송지 주소 확인 UI

**Files:**
- Modify: `apps/client-web/src/pages/Apply/index.tsx`
- Modify: `apps/client-web/src/pages/Apply/Apply.css` (주소 섹션 스타일 추가)

- [ ] **Step 1: 주소 확인 state 추가**

`Apply()` 컴포넌트의 기존 state 선언부(예: `const [error, setError] = useState<string | null>(null);`) 바로 아래에 추가:

```tsx
  const [addressConfirmed, setAddressConfirmed] = useState(false);
```

- [ ] **Step 2: 주소 섹션 렌더링 추가**

`<section className="apply__sec"><h3>応募にあたっての再確認</h3> ... </section>` 블록 **바로 앞**에 다음 섹션을 추가한다. (`me`는 이미 `const me = useQuery(...)`로 선언되어 있으므로 `me.data?.address`로 접근)

```tsx
        <section className="apply__sec">
          <h3>お届け先住所</h3>
          {me.data?.address ? (
            <>
              <div className="apply__address">
                〒{me.data.address.postalCode}
                <br />
                {me.data.address.prefecture}
                {me.data.address.city}
                {me.data.address.addressLine1}
                {me.data.address.addressLine2
                  ? ` ${me.data.address.addressLine2}`
                  : ""}
              </div>
              <label className="apply__chk">
                <input
                  type="checkbox"
                  checked={addressConfirmed}
                  onChange={() => setAddressConfirmed((prev) => !prev)}
                />
                <span>この住所で受け取ります</span>
              </label>
              <button
                type="button"
                className="apply__address-edit"
                onClick={() => nav("/me/address")}
              >
                住所を修正する
              </button>
            </>
          ) : (
            <div className="apply__address apply__address--missing">
              お届け先住所が未登録です。
              <button
                type="button"
                className="apply__address-edit"
                onClick={() => nav("/me/address")}
              >
                住所を登録する
              </button>
            </div>
          )}
        </section>
```

- [ ] **Step 3: 신청 버튼 활성 조건에 주소 확인 추가**

CTA 버튼의 `disabled` 식을 아래로 교체:

```tsx
          disabled={
            isClosed ||
            !allAgreed ||
            !hasSelection ||
            qualifying.length === 0 ||
            !me.data?.address ||
            !addressConfirmed ||
            apply.isPending
          }
```

- [ ] **Step 4: 주소 섹션 스타일 추가**

`apps/client-web/src/pages/Apply/Apply.css` 파일 맨 끝에 추가:

```css
.apply__address {
  font-size: 14px;
  line-height: 1.6;
  color: #111827;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}

.apply__address--missing {
  color: #ef4444;
}

.apply__address-edit {
  margin-top: 8px;
  background: none;
  border: none;
  color: #4f46e5;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}
```

- [ ] **Step 5: 타입 점검**

Run: `pnpm --filter @jsure/client-web typecheck`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add apps/client-web/src/pages/Apply/index.tsx \
        apps/client-web/src/pages/Apply/Apply.css
git commit -m "feat(client-web): 신청 화면에 배송지 주소 확인 UI 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 전체 검증

- [ ] **Step 1: client-web 전체 타입 점검**

Run: `pnpm --filter @jsure/client-web typecheck`
Expected: PASS.

- [ ] **Step 2: 스펙 대조**

`docs/superpowers/specs/2026-06-12-influencer-applications-filter-and-address-confirm-design.md`의 각 항목(상태 그룹 매핑, SNS 다중 선택, 주소 표시+필수 체크+수정 링크, 버튼 비활성 조건)이 구현되었는지 확인.

- [ ] **Step 3: (선택) 수동 확인**

client-web 실행 후: 응모내역에서 상태 탭/SNS 칩 조합 필터 동작, 신청 화면에서 주소 표시·체크 전 버튼 비활성·미등록 시 비활성 확인.
