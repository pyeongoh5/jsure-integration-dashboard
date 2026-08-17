# 리포트 모집기간 표시·필터 + 엑셀 전량 다운로드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리포트 목록에 캠페인 모집기간 표시·기간/카테고리 필터를 추가하고, 엑셀 다운로드의 참여자 truncation 버그를 고치며 모집기간 컬럼을 포함한다.

**Architecture:** DB 스키마 변경 없음. `CampaignReportRowSchema`(shared)에 `category`/`recruitStartDate`/`recruitEndDate`를 추가하고 API 서비스에서 매핑만 한다. 필터링은 전량 로드된 데이터 위에서 클라이언트(React useMemo)로 수행한다. 엑셀 다운로드는 pageSize 10000으로 반복 조회해 `total`까지 전량 수집한다.

**Tech Stack:** Turborepo + pnpm, zod(@jsure/shared), NestJS + Prisma(api), React + exceljs(admin-web), jest(api만 테스트 러너 존재 — admin-web/shared에는 러너 없음).

## Global Constraints

- 커밋 메시지는 한글, 말미에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `.claude/CODE_RULES.md` 준수: 변수 약어 금지, 중첩 삼항 금지, `@jsure/shared` 변경 후 `pnpm --filter @jsure/shared build`, 완료 전 `pnpm typecheck`.
- `git add`는 명시 경로만 (`git add -A` 금지).
- 라이브 서비스 — 기존 응답 필드/동작의 하위 호환을 깨지 않는다 (필드 추가만).
- 새 의존성 추가 금지.
- 작업 디렉토리: `.claude/worktrees/report-recruit-period` (브랜치 `worktree-report-recruit-period`).

---

### Task 1: shared 스키마에 category·모집기간 필드 추가

**Files:**
- Modify: `packages/shared/src/types/adminReport.ts`

**Interfaces:**
- Produces: `CampaignReportRow`에 `category: CampaignCategory`, `recruitStartDate: string`, `recruitEndDate: string` (JST `YYYY-MM-DD`). Task 2~4가 소비.

- [ ] **Step 1: 스키마 수정**

`packages/shared/src/types/adminReport.ts` — import에 추가:

```ts
import { CampaignCategorySchema } from "./campaign.js";
```

`CampaignReportRowSchema`의 `campaignTitle: z.string(),` 바로 아래에 추가:

```ts
  category: CampaignCategorySchema,
  /** 모집 시작일 (JST, YYYY-MM-DD). */
  recruitStartDate: z.string(),
  /** 모집 종료일 (JST, YYYY-MM-DD). */
  recruitEndDate: z.string(),
```

- [ ] **Step 2: shared 빌드로 검증**

Run: `pnpm --filter @jsure/shared build`
Expected: 성공. (이 시점에 api는 아직 매핑 전이라 `pnpm typecheck`는 admin-reports.service에서 실패할 수 있음 — Task 2에서 해소)

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/src/types/adminReport.ts
git commit -m "feat(shared): 리포트 행에 카테고리·모집기간 필드 추가"
```

---

### Task 2: API 서비스 매핑 (TDD)

**Files:**
- Modify: `apps/api/src/admin-reports/admin-reports.service.ts`
- Test: `apps/api/src/admin-reports/admin-reports.service.spec.ts`

**Interfaces:**
- Consumes: Task 1의 `CampaignReportRow` 필드, `apps/api/src/campaigns/campaigns.service.ts:40`의 `export function utcToJstDateStr(d: Date): string`
- Produces: `GET /admin/reports/campaigns` 응답 rows에 `category`/`recruitStartDate`/`recruitEndDate` 포함. 컨트롤러 변경 없음.

- [ ] **Step 1: 실패하는 테스트 작성**

`admin-reports.service.spec.ts`의 `makeService` 내 campaign stub(`{ id: "c1", title: "캠페인", applications }`)을 다음으로 교체:

```ts
        {
          id: "c1",
          title: "캠페인",
          category: "SNS",
          recruitStartAt: new Date("2026-06-30T15:00:00Z"), // JST 2026-07-01 00:00
          recruitEndAt: new Date("2026-07-31T14:59:59Z"),   // JST 2026-07-31 23:59
          applications,
        },
```

파일 끝에 테스트 추가:

```ts
it("campaignReports 는 카테고리와 JST 모집기간을 내려준다", async () => {
  const service = makeService([]);
  const { rows } = await service.campaignReports("campaignTitle", "asc");
  expect(rows[0].category).toBe("SNS");
  expect(rows[0].recruitStartDate).toBe("2026-07-01");
  expect(rows[0].recruitEndDate).toBe("2026-07-31");
});
```

(`makeService`가 applications 배열을 받는 기존 시그니처 그대로 사용. 빈 배열이면 집계는 0이지만 이 테스트에는 무관.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api test -- admin-reports.service.spec`
Expected: FAIL — `rows[0].category`가 `undefined` (매핑 전이므로)

- [ ] **Step 3: 매핑 구현**

`admin-reports.service.ts` import 추가:

```ts
import { utcToJstDateStr } from "../campaigns/campaigns.service";
```

`campaignReports`의 반환 객체에서 `campaignTitle: campaign.title,` 아래에 추가:

```ts
        category: campaign.category,
        recruitStartDate: utcToJstDateStr(campaign.recruitStartAt),
        recruitEndDate: utcToJstDateStr(campaign.recruitEndAt),
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api test -- admin-reports.service.spec`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/admin-reports/admin-reports.service.ts apps/api/src/admin-reports/admin-reports.service.spec.ts
git commit -m "feat(api): 리포트 응답에 카테고리·모집기간 매핑"
```

---

### Task 3: 리포트 목록 UI — 모집기간 표시 + 기간/카테고리 필터

**Files:**
- Modify: `apps/admin-web/src/pages/Reports/index.tsx`
- Modify: `apps/admin-web/src/pages/Reports/Reports.module.css`
- Modify(필요 시): `apps/admin-web/src/domains/application/index.ts` — `CATEGORY_FILTER_OPTIONS`가 export 안 돼 있으면 export 추가

**Interfaces:**
- Consumes: Task 1 필드, `@/components/composites`의 `FilterChipBar`/`MultiSelectFilterChip`(제네릭 `<T extends string>`, props: `emptyLabel`, `labelPrefix`, `options: readonly {key,label}[]`, `value: Set<T>`, `onChange`), `@/domains/application`의 `CATEGORY_FILTER_OPTIONS: { key: CampaignCategory; label: string }[]`
- Produces: `filteredRows: CampaignReportRow[]` — 테이블·서브타이틀·다운로드 다이얼로그가 사용. Task 4는 이 파일의 `CampaignDownloadDialog`를 수정.

- [ ] **Step 1: 모집기간 포맷터 + 겹침 판정 함수 추가**

`Reports/index.tsx`의 `formatPercent` 아래에 추가:

```ts
/** "2026-07-01","2026-07-31" → "26.07.01 - 07.31" (같은 해면 종료일 연도 생략). */
function formatRecruitPeriod(startDate: string, endDate: string): string {
  const shorten = (dateStr: string) => dateStr.slice(2).replaceAll("-", ".");
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  const endLabel = sameYear ? shorten(endDate).slice(3) : shorten(endDate);
  return `${shorten(startDate)} - ${endLabel}`;
}

/** 모집기간과 필터 기간이 하루라도 겹치면 true. 빈 필터 값은 열린 구간. */
function recruitPeriodOverlaps(
  row: CampaignReportRow,
  filterStartDate: string,
  filterEndDate: string,
): boolean {
  if (filterEndDate !== "" && row.recruitStartDate > filterEndDate) return false;
  if (filterStartDate !== "" && row.recruitEndDate < filterStartDate) return false;
  return true;
}
```

(`YYYY-MM-DD` 문자열은 사전순 비교 = 날짜 비교라서 Date 변환 불필요.)

- [ ] **Step 2: 필터 상태와 filteredRows 추가**

`Reports()` 컴포넌트 상태에 추가:

```ts
const [filterStartDate, setFilterStartDate] = useState<string>("");
const [filterEndDate, setFilterEndDate] = useState<string>("");
const [selectedCategories, setSelectedCategories] = useState<Set<CampaignCategory>>(
  () => new Set(),
);
```

`handleSortClick` 아래에 추가:

```ts
const filteredRows = useMemo(
  () =>
    rows.filter(
      (row) =>
        recruitPeriodOverlaps(row, filterStartDate, filterEndDate) &&
        (selectedCategories.size === 0 || selectedCategories.has(row.category)),
    ),
  [rows, filterStartDate, filterEndDate, selectedCategories],
);
```

import 추가: `import type { CampaignCategory } from "@jsure/shared";`, `CATEGORY_FILTER_OPTIONS`는 `@/domains/application`에서, `FilterChipBar`/`MultiSelectFilterChip`은 `@/components/composites`에서. (`CATEGORY_FILTER_OPTIONS`가 `domains/application/index.ts`에서 export 안 돼 있으면 export 라인 추가.)

- [ ] **Step 3: 필터바 렌더링 + 목록을 filteredRows로 전환**

헤더 `</div>`(header 닫는 태그)와 `<div className={styles.card}>` 사이에 삽입:

```tsx
<div className={styles.filterBar}>
  <FilterChipBar>
    <div className={styles.dateRange}>
      <span className={styles.dateRangeLabel}>모집기간</span>
      <input
        type="date"
        className={styles.dateInput}
        value={filterStartDate}
        onChange={(event) => setFilterStartDate(event.target.value)}
        aria-label="모집기간 검색 시작일"
      />
      <span aria-hidden="true">~</span>
      <input
        type="date"
        className={styles.dateInput}
        value={filterEndDate}
        onChange={(event) => setFilterEndDate(event.target.value)}
        aria-label="모집기간 검색 종료일"
      />
    </div>
    <MultiSelectFilterChip
      emptyLabel="카테고리"
      labelPrefix="카테고리"
      options={CATEGORY_FILTER_OPTIONS}
      value={selectedCategories}
      onChange={setSelectedCategories}
    />
  </FilterChipBar>
</div>
```

목록 전환 — 아래 4곳의 `rows`를 `filteredRows`로 교체:
1. subtitle: `` return `총 ${filteredRows.length}개 캠페인`; `` (useMemo deps도 `filteredRows.length`로)
2. 빈 상태 분기 `rows.length === 0` → `filteredRows.length === 0`
3. `rows.map((row) => {` → `filteredRows.map((row) => {`
4. `<CampaignDownloadDialog rows={rows}` → `rows={filteredRows}` (엑셀 버튼 `disabled={filteredRows.length === 0}`도 함께)

데이터 로드 useEffect의 `setRows(response.rows)`는 그대로 둔다.

- [ ] **Step 4: 캠페인명 하단 모집기간 표시**

행 렌더링에서 셀 내용 `{column.format(row)}`을 첫 컬럼만 분기하도록 교체 — `columnIndex === 0`인 `<td>` 내부를:

```tsx
{columnIndex === 0 ? (
  <>
    <span
      className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ""}`}
      aria-hidden="true"
    >
      ▶
    </span>
    <span>{row.campaignTitle}</span>
    <span className={styles.recruitPeriod}>
      🗓️ {formatRecruitPeriod(row.recruitStartDate, row.recruitEndDate)}
    </span>
  </>
) : (
  column.format(row)
)}
```

(기존 `columnIndex === 0 && <span .../>` 확장 아이콘 로직은 위 분기 안으로 흡수.)

- [ ] **Step 5: CSS 추가**

`Reports.module.css` 끝에 추가 (기존 클래스 네이밍 관례 따름):

```css
.filterBar {
  margin-bottom: 12px;
}

.dateRange {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #555);
}

.dateRangeLabel {
  font-weight: 600;
}

.dateInput {
  padding: 4px 8px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
  font: inherit;
}

.recruitPeriod {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-text-secondary, #777);
}
```

(변수가 프로젝트에 없으면 fallback 값이 적용되므로 그대로 동작. 기존 CSS에서 실제 사용하는 색 변수를 먼저 확인하고 있으면 그걸 사용.)

- [ ] **Step 6: 타입 검증**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add apps/admin-web/src/pages/Reports/index.tsx apps/admin-web/src/pages/Reports/Reports.module.css
git add apps/admin-web/src/domains/application/index.ts  # export 추가한 경우만
git commit -m "feat(admin-web): 리포트 목록에 모집기간 표시와 기간·카테고리 필터 추가"
```

---

### Task 4: 엑셀 다운로드 — 전량 수집 버그 수정 + 모집기간 컬럼

**Files:**
- Modify: `apps/admin-web/src/pages/Reports/index.tsx` (`CampaignDownloadDialog.handleDownload`, 시트 컬럼 구성)

**Interfaces:**
- Consumes: `getCampaignParticipants(campaignId, page, pageSize)` — 응답 `{ total, participants }`. 서버 pageSize 상한 10000 (`admin-reports.controller.ts`).
- Produces: 없음 (말단 UI).

**버그 배경 (코드에 주석으로 남기지 말 것 — 커밋 메시지용):** 기존 코드는 `pageSize = participantCount`(승인 응모 건수) 1회 조회인데, 서버는 응모를 서브타입별 행으로 펼치므로 실제 행 수가 더 많으면 잘리고, 10000 초과 시 컨트롤러가 pageSize를 20으로 되돌려 더 심하게 잘린다.

- [ ] **Step 1: 전량 수집 함수 추가**

`uniqueSheetName` 위에 추가:

```ts
/** 서버 pageSize 상한(10000) 단위로 반복 조회해 참여자 전량을 모은다. */
const PARTICIPANTS_DOWNLOAD_PAGE_SIZE = 10000;

async function fetchAllParticipants(
  campaignId: string,
): Promise<CampaignReportParticipant[]> {
  const collected: CampaignReportParticipant[] = [];
  for (let page = 0; ; page += 1) {
    const response = await getCampaignParticipants(
      campaignId,
      page,
      PARTICIPANTS_DOWNLOAD_PAGE_SIZE,
    );
    collected.push(...response.participants);
    const noMoreRows = response.participants.length === 0;
    if (collected.length >= response.total || noMoreRows) return collected;
  }
}
```

- [ ] **Step 2: handleDownload 를 전량 수집 + 모집기간 컬럼으로 수정**

`handleDownload` 내부의 기존 조회부:

```ts
const response = await getCampaignParticipants(
  target.campaignId,
  0,
  Math.max(1, target.participantCount),
);
```

를 다음으로 교체:

```ts
const participants = await fetchAllParticipants(target.campaignId);
```

이후 `response.participants` 순회를 `participants` 순회로 변경.

시트 컬럼에 모집기간 추가 — `const sheetColumns = [...PARTICIPANT_COLUMNS, ...EXCEL_ONLY_COLUMNS];` 를:

```ts
const sheetColumns = [...PARTICIPANT_COLUMNS, ...EXCEL_ONLY_COLUMNS];
const recruitPeriodColumns = [
  { key: "recruitStartDate", label: "모집 시작일", value: target.recruitStartDate },
  { key: "recruitEndDate", label: "모집 종료일", value: target.recruitEndDate },
];
```

로 확장하고, `sheet.columns` 구성을:

```ts
sheet.columns = [
  ...sheetColumns.map((column) => ({
    header: column.label,
    key: column.key,
    width: column.width ?? (column.numeric ? 12 : 18),
    style: column.numeric ? { alignment: { horizontal: "right" } } : undefined,
  })),
  ...recruitPeriodColumns.map((column) => ({
    header: column.label,
    key: column.key,
    width: 14,
  })),
];
```

행 기록 루프에서 participant 값 채운 뒤 모집기간 값 추가:

```ts
for (const participant of participants) {
  const row: Record<string, string | number> = {};
  for (const column of sheetColumns) {
    row[column.key] = column.excelValue(participant);
  }
  for (const column of recruitPeriodColumns) {
    row[column.key] = column.value;
  }
  sheet.addRow(row);
}
```

- [ ] **Step 3: 타입 검증 + 전체 테스트**

Run: `pnpm typecheck && pnpm --filter api test`
Expected: 둘 다 PASS

- [ ] **Step 4: 커밋**

```bash
git add apps/admin-web/src/pages/Reports/index.tsx
git commit -m "fix(admin-web): 리포트 엑셀이 참여자 일부만 받던 버그 수정 + 모집기간 컬럼 추가

participantCount(응모 건수)를 pageSize 로 쓰던 1회 조회를 total 도달까지
반복 조회로 교체 — 서브타입 다중 참여로 행 수가 응모 수보다 많으면 잘리고,
10000 초과 시 서버가 pageSize 를 20 으로 되돌려 더 크게 잘리던 문제"
```

---

### Task 5: 최종 검증 + 푸시

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 검증**

Run: `pnpm --filter @jsure/shared build && pnpm typecheck && pnpm --filter api test`
Expected: 전부 PASS

- [ ] **Step 2: 푸시**

```bash
git push -u origin worktree-report-recruit-period
```

- [ ] **Step 3: 보고 사항 (CODE_RULES §0)**

- **배포 대상**: `packages/shared` 변경 → `api`(Railway) + `admin-web`(Vercel) 둘 다 재배포 필요. `client-web` 무관.
- **사이드이펙트**: `CampaignReportRowSchema`는 리포트 화면 전용 — 필드 추가만이라 하위 호환 유지. 단 **admin-web 이 신 스키마로 먼저 배포되고 api 가 구버전이면 `Schema.parse` 가 필수 필드 누락으로 실패** → api 먼저 배포. `CATEGORY_FILTER_OPTIONS` export 는 추가일 뿐 기존 사용처(Applicants) 영향 없음.
