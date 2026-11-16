# 캠페인별 운영 담당자 지정 — 설계

- 날짜: 2026-11-16
- 참고 요건: Notion「(2)-1 캠페인별 운영 담당자(매니저) 지정 및 담당자별 필터링 기능」

## 1. 의도와 배경

동시에 여러 브랜드 시책이 돌아가는데 각 캠페인을 누가 맡는지가 어디에도 기록돼 있지 않다.
그래서 세 가지가 안 된다.

- **R&R 식별** — 어드민 화면만 봐서는 이 캠페인 담당이 누구인지 알 수 없어 커뮤니케이션이 샌다.
- **개인 업무 집중** — "오늘 내가 볼 캠페인"을 추려낼 방법이 없다.
- **백업·인수인계** — 담당자 부재 시 누가 대신 대응해야 하는지 즉시 알 수 없다.

캠페인에 어드민 유저(복수)를 꼬리표로 붙이고, 그 꼬리표로 거르고 집계할 수 있게 한다.

## 2. 목표 / 비목표 / 안티목표

### 목표

1. 캠페인 생성·수정 화면에서 담당자(어드민 유저)를 다중 선택해 저장한다. 기본값은 작성자 본인.
2. 캠페인 관리 목록에서 카드를 다중 선택해 담당자를 **일괄 교체**한다.
3. 캠페인 관리 목록에서 담당자로 거른다 (`내 캠페인만 보기` 포함).
4. 대시보드에 "내 담당 모집중 캠페인" KPI 카드를 추가하고, 클릭하면 캠페인 관리 목록이 내 담당 필터가 걸린 채로 열린다.
5. 성과 리포트 엑셀 다운로드에 담당자 컬럼을 포함한다.

### 비목표

- 대시보드 캠페인 현황 **테이블** 신설 — 현재 `pages/Overview/index.tsx:219-256` 테이블은 통째로 주석 처리돼 있어 붙일 대상이 없다. 테이블을 새로 만드는 건 담당자 기능이 아니라 별개 과제다.
- **캠페인 목록 CSV 다운로드** 신설 — 캠페인 관리 페이지에는 다운로드 기능 자체가 없다. 이번엔 만들지 않는다.
- 성과 리포트 **화면 테이블**의 담당자 컬럼 — 엑셀에만 넣는다.
- 담당자 기반 권한 제어(담당자만 수정 가능 등). 꼬리표일 뿐 권한이 아니다.
- 담당자 변경 이력/알림.
- 우클릭 메뉴의 "담당자 확인" + 담당자 목록 모달. 카드 표기로 대체한다 (§5.6).

### 안티목표 (기능이 돌아가도 실패로 치는 것)

- 기존 캠페인 데이터가 깨지거나, 담당자가 없는 기존 캠페인이 목록에서 사라지는 것.
- 카드 클릭이 선택으로 바뀌면서 기존 액션(수정·복사·마감·삭제)에 도달할 길이 막히는 것.
- 일괄 교체가 "추가"로 오인돼 기존 담당자가 소리 없이 날아가는 것.
- 인플루언서 응답(client-web)에 담당자가 새어 나가는 것. 담당자는 어드민 전용이다.

## 3. 제약

- **라이브 서비스**다. 스키마 변경은 additive 만, 기존 row 가 깨지지 않아야 한다 (CODE_RULES §9).
- `.env` 가 운영 Neon 을 가리킨다. **마이그레이션 실행과 API 재시작은 사용자가 직접** 한다. 마이그레이션 파일만 작성해 두고 명령을 안내한다.
- 워크트리마다 `node_modules` 가 분리돼 있어 스키마 변경 후 실행 워크트리에서 `prisma generate` 가 따로 필요하다.
- API 계약은 `packages/shared` zod 단일 소스 (CODE_RULES §2). shared 변경 시 `pnpm --filter @jsure/shared build` + api 재배포.
- admin-web 의 새 UI 문자열은 전부 `i18n/admin/messages.ts` 키(ko/en/ja) + `useT()`.
- 변수·파라미터 약어 금지, 중첩 삼항 금지 (CODE_RULES §4, §10).

## 4. 접근안

검토한 세 가지:

**A. `Campaign.managerIds String[]` + 기존 컴포넌트 재사용 — 채택**
`audienceCampaignIds` / `audienceTagIds` / `audienceInfluencerIds` 가 이미 같은 모양으로 Campaign 에 붙어 있다. 필터는 Postgres `has`(GIN 인덱스), 화면은 이미 있는 `MultiSelectFilterChip` 을 쓴다. 새 테이블도 새 화면도 없다.

**B. 조인 테이블 `CampaignManager`**
AdminUser FK 무결성과 cascade 를 얻는다. 그러나 팀원 관리에는 삭제 기능이 없고(승인/거절/권한변경뿐) 담당자는 표시·필터용 꼬리표라 무결성 이득이 얇다. 반면 쓰기마다 트랜잭션, 읽기마다 join 이라는 비용은 확실하다. 탈락.

**C. 대시보드 캠페인 현황 테이블 신설**
Notion 요건 2·3번을 글자 그대로 충족하지만, 안에 "대시보드에 캠페인 테이블 만들기"라는 별개 과제가 숨어 있다. 탈락.

**사용자가 A 를 선택했다.** 대시보드는 KPI 카드 1장 + 캠페인 관리 필터 딥링크, CSV 는 성과 리포트 엑셀 컬럼만.

## 5. 설계

### 5.1 데이터 모델

`apps/api/prisma/schema.prisma` — `Campaign` 에 한 줄:

```prisma
/// 이 캠페인의 운영 담당 어드민 id. 표시·필터용 꼬리표이며 권한과 무관하다.
/// AdminUser 와 FK 로 묶지 않는다 — audience* 배열과 같은 취급.
managerIds String[] @default([])
```

인덱스: `@@index([managerIds], type: Gin)` — "내 담당" 필터가 전 캠페인 스캔이 되지 않도록.

마이그레이션은 additive 하나뿐이다. default 가 `[]` 라서 기존 row 는 그대로 "담당자 없음" 이 된다. 백필 없음.

> `ponytail:` FK 없는 id 배열이라 어드민이 물리 삭제되면 유령 id 가 남는다. 지금은 어드민 물리 삭제 경로가 없어 발생하지 않고, 화면은 "알 수 없는 담당자"를 그냥 건너뛴다. 삭제 기능이 생기면 조인 테이블(접근안 B)로 올린다.

### 5.2 shared 스키마 (`packages/shared/src/types/campaign.ts`)

```ts
/** 어드민 전용. 인플루언서 응답 스키마에는 절대 포함하지 않는다. */
export const CampaignManagerSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
});
export type CampaignManager = z.infer<typeof CampaignManagerSchema>;
```

- `CampaignFormSchema`: `managerIds: z.array(z.string()).max(20).default([])`
- `UpdateCampaignRequestSchema`: `managerIds: z.array(z.string()).max(20).optional()`
- `CampaignDraftRequestSchema`: 위와 동일 (임시저장도 담당자를 보존한다)
- `CampaignResponseSchema`: `managers: z.array(CampaignManagerSchema).default([])`
  - 응답은 **이름까지 풀어서** 내려준다. 캠페인 관리 카드·일괄 지정 모달·리포트 엑셀이 전부 이름을 필요로 하는데, id 만 내리면 세 화면이 각자 팀원 목록과 조인해야 한다.
  - `default([])` 는 배포 갭(구 API) 대비. `audienceMode` 가 쓰는 것과 같은 방패.
  - 폼 복원은 `managers.map((manager) => manager.id)`.
- `InfluencerCampaignCardSchema` / `InfluencerCampaignDetailSchema` 는 **건드리지 않는다**.

일괄 지정 (`packages/shared/src/types/campaign.ts`):

```ts
export const BulkAssignCampaignManagersRequestSchema = z.object({
  campaignIds: z.array(z.string()).min(1).max(200),
  managerIds: z.array(z.string()).max(20),
});
export const BulkAssignCampaignManagersResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});
```

`managerIds` 가 빈 배열이면 담당자 해제다. 허용한다.

전부 `packages/shared/src/index.ts` 에서 export.

### 5.3 API

**담당자 후보**는 기존 `GET /admin-users` 를 그대로 쓴다. 새 엔드포인트를 만들지 않는다. 화면이 `status === "ACTIVE"` 로 거른다 — PENDING(승인 대기)·SUSPENDED 는 "활성 운영진"이 아니다. role 은 가리지 않는다(GUEST 도 담당자가 될 수 있다).

**생성·수정·임시저장** (`apps/api/src/campaigns/campaigns.service.ts`, `campaign-drafts.controller.ts`)
- `managerIds` 를 다른 필드와 같이 저장한다.
- 저장 전에 존재하는 AdminUser id 인지 확인하고, 아니면 `BadRequestException("존재하지 않는 담당자가 포함돼 있습니다")`.
- 응답 매핑 시 `managerIds` → `managers`. 목록 API 는 전 캠페인의 managerIds 를 모아 `adminUser.findMany({ where: { id: { in: unique } } })` **한 번**으로 해결한다 (캠페인당 쿼리 금지).
- 찾지 못한 id 는 응답에서 그냥 빠진다. 유령 id 가 화면을 깨지 않는다.

**일괄 지정** — `apps/api/src/campaigns/campaigns.controller.ts`

```
POST /campaigns/managers/bulk
```

- `@Body(new ZodValidationPipe(BulkAssignCampaignManagersRequestSchema))` (메서드 레벨 `@UsePipes` 금지 — CODE_RULES §2).
- `JwtAuthGuard`.
- `managerIds` 존재 검증 후 `campaign.updateMany({ where: { id: { in: campaignIds }, deletedAt: null }, data: { managerIds } })`.
- **덮어쓰기(set)** 다. 추가가 아니다.
- 응답 `{ updatedCount }`. 화면이 요청 건수와 다르면 그대로 알린다.
- 라우트 선언 순서 주의 — `@Post(":id/bump")` 류와 충돌하지 않도록 `managers/bulk` 를 그 위에 둔다. 이미 `@Post("audience/preview")` 가 같은 이유로 그 위에 있다.
- 권한은 컨트롤러 수준 `JwtAuthGuard` 만. 캠페인 생성·수정에 role 가드가 없으므로 일괄 지정도 같은 수준으로 맞춘다.
- 임시저장 발행(`POST /campaign-drafts/:id/publish`)은 `CreateCampaignRequest` 를 받으므로 `managerIds` 가 자동으로 함께 넘어온다.

**대시보드** (`apps/api/src/admin-overview/`)
- `AdminOverviewResponseSchema` 에 `myRecruitingCampaignCount: z.number().int().nonnegative()` 추가.
- `stats(adminUserId)` 로 시그니처를 바꾸고, 컨트롤러가 `@Req() request: { user: AuthenticatedUser }` 로 `request.user.id` 를 넘긴다 (`admin-notices.controller.ts:43` 과 같은 패턴).
- 집계: 기존 "모집 중" 조건 + `managerIds: { has: adminUserId }`.

**성과 리포트** (`apps/api/src/admin-reports/admin-reports.service.ts`)
- `CampaignReportRowSchema` 에 `managers: z.array(CampaignManagerSchema).default([])` 추가.
- 이미 `campaign.findMany` 로 캠페인을 전부 읽고 있으므로 `managerIds` 를 select 에 더하고, 어드민은 한 번에 모아 조회해 행에 붙인다.
- `CampaignReportSortKeySchema` 에는 담당자를 **추가하지 않는다** (정렬 대상 아님).

### 5.4 admin-web — 공용 부품

**`src/domains/team/adminUserLabel.ts`** (신규, 순수 함수)

```ts
/** 담당자 표시명 — 이름이 없으면 이메일로 대체한다. */
export function adminUserLabel(user: { name: string | null; email: string }): string;
```

**`src/components/composites/FilterChip/index.tsx`** (수정)
- `FilterChipProps` 에 `activeTitle?: string` 추가 → 칩 버튼의 네이티브 `title` 속성. 호버 툴팁은 브라우저 기본 동작으로 해결한다(별도 툴팁 컴포넌트 없음).
- `MultiSelectFilterChipProps` 에 `maxVisibleLabels?: number` 추가. 선택이 그보다 많으면 표시는 `앞 N개 … 외 M명`, `activeTitle` 에는 **전원**을 넣는다.
- 라벨 조립은 `buildMultiSelectLabel(labels, maxVisibleLabels)` 순수 함수로 빼고 여기에 테스트를 건다.
- 기존 호출부(응모자·인플루언서·리포트 필터)는 `maxVisibleLabels` 를 넘기지 않으므로 동작이 그대로다.

> `ponytail:` 툴팁은 네이티브 `title` 이라 표시 지연이 있고 스타일을 못 준다. 디자인 요구가 붙으면 그때 커스텀 툴팁으로 올린다.

**`src/domains/campaign/components/CampaignManagerPicker.tsx`** (신규)
- props: `value: string[]`, `onChange: (managerIds: string[]) => void`, `managers: PublicAdminUser[]`
- 내부적으로 `FilterChipBar` + `MultiSelectFilterChip` (`maxVisibleLabels={2}`) 을 쓴다. 캠페인 폼 헤더와 일괄 지정 모달이 이걸 공유한다.
- 자체 fetch 하지 않는다 (CODE_RULES §7 — presentational).

**`src/domains/campaign/useAdminUserOptions.ts`** (신규 훅)
- `listAdminUsers()` 로 받아 `status === "ACTIVE"` 만 남기고 표시명으로 정렬해 돌려준다. 캠페인 폼·캠페인 관리 페이지가 쓴다.

**`src/domains/campaign/components/CampaignManagerChips.tsx`** (신규, 표시 전용)
- 카드에 담당자를 보여주는 작은 컴포넌트. 초과분은 `+N`, `title` 에 전원. 도메인 개념이 두 화면에서 그려지므로 컴포넌트 하나로 격리한다 (CODE_RULES §8).

### 5.5 admin-web — 캠페인 생성·수정 폼

담당자 선택기는 **페이지 헤더 우측**(이미지의 검은 박스 자리)에 놓는다. `CampaignForm` 이 아니라 `pages/Campaigns/New.tsx` · `Edit.tsx` 의 헤더 영역이다.

폼 값과 선택기가 다른 컴포넌트에 있으므로, 페이지가 `managerIds` 상태를 들고 `CampaignForm` 에 controlled prop 으로 내린다:

```tsx
<CampaignForm
  managerIds={managerIds}
  onManagerIdsChange={setManagerIds}
  ...
/>
```

`CampaignForm` 은 submit·임시저장 시점에 `{ ...values, managerIds }` 로 합쳐 보낸다. 담당자는 검증 규칙이 없는 id 배열이라 react-hook-form 바깥에 둬도 잃는 게 없다.

초기값:
- 신규(`New.tsx`): `[getStoredUser()?.id]` — 로그인 정보가 없으면 `[]`.
- **복사(`?copyFrom=`)도 본인**으로 시작한다. 담당자는 R&R 이지 캠페인 내용이 아니다.
- 수정(`Edit.tsx`): `state.campaign.managers.map((manager) => manager.id)`.

### 5.6 admin-web — 캠페인 관리 페이지 (`pages/Campaigns/index.tsx`)

**카드 인터랙션 전환**
- 좌클릭 → 선택 토글. 선택된 카드는 테두리 강조 + 체크 표시.
- 우클릭(`onContextMenu`, `preventDefault()`) → 기존 `CampaignActionsMenu` (지금 좌클릭이 하던 일).
- 선택 상태는 `Set<string>`.
- 카테고리·상태 필터나 검색어가 바뀌면 선택을 비운다. 화면에 없는 카드가 선택된 채 남으면 "N개" 가 거짓말이 된다.
- `Esc` 로 전체 선택 해제.

**툴바**
- 선택이 1건 이상이면 `+ 새 캠페인` **왼쪽**에 `N개 캠페인 담당자 지정` 버튼을 노출한다.
- 담당자 필터 칩을 기존 카테고리·상태 칩 옆에 추가한다. 옵션은 활성 어드민 + 맨 위 `내 캠페인만 보기`.
- URL 파라미터 `manager` — `me` 또는 쉼표로 이은 어드민 id. 기존 `status`/`category` 와 같은 방식. 대시보드 KPI 카드가 `/campaigns?manager=me` 로 들어온다.
  - `me` 는 URL 에 `me` 그대로 남는다. 로그인 계정이 바뀌어도 "내 캠페인"이라는 의미가 유지돼야 하므로 id 로 치환해 저장하지 않는다. 필터 계산 시점에만 `getStoredUser()?.id` 로 푼다.
  - 여러 담당자를 고르면 **OR** 이다 (그 중 한 명이라도 담당이면 통과). `me` 와 특정 담당자를 함께 골라도 같다.
  - 로그인 정보가 없으면 `me` 는 아무것도 매치하지 않는다.
- 카드 변환(`toCard`)에 `managers` 를 실어 보낸다. `Campaign` 뷰 타입(`domains/campaign/types.ts`)에도 필드를 더한다.
- 필터링은 지금의 다른 필터와 같이 **클라이언트에서** 한다. 이 페이지는 이미 전량 로드 후 클라 필터 구조다(`index.tsx:196`). 담당자만 서버 필터로 가면 구조가 갈라진다.

**카드 표시**

담당자는 **카드 제목 줄 오른쪽, D-day 왼쪽**에 `CampaignManagerChips` 로 그린다 (Notion 요건 2의 "담당자 컬럼"에 해당). `CampaignCardTitle` 이 이미 좌(상태·카테고리 뱃지) / 우(D-day) 로 나뉘어 있고, 모집중이 아닌 카드는 우측이 비어 있어 그대로 들어간다.

```
[모집중] [SNS] [대상자]        선희 카린 +2  D-5
[종료]   [가구매]                      선희
[모집중] [SNS]                              D-5   ← 담당자 없음: 아무것도 안 그림
```

- 넘치는 인원은 `+N`, 호버하면 네이티브 `title` 로 전원이 뜬다. 접는 규칙은 폼 헤더 선택기와 같은 `buildMultiSelectLabel` 을 쓴다.
- 담당자가 없으면 **아무것도 그리지 않는다**. "담당자 없음" 같은 플레이스홀더를 깔면 마이그레이션 직후 전 카드가 그 문구로 덮인다.
- 우클릭 메뉴에 "담당자 확인" 항목은 **넣지 않는다**. 이름만 보여주는 모달은 카드 표기와 중복이고, 메뉴 → 모달 2단계는 "어드민 화면에서 즉시 식별"이라는 목적을 거스른다. 많은 인원의 전원 확인은 호버 툴팁이 이미 해결한다.

**일괄 지정 다이얼로그** — `src/domains/campaign/components/BulkAssignManagersDialog.tsx` (신규)
- 자기 입력 상태(선택한 담당자)를 **자기 안에서** 관리한다 (CODE_RULES §7).
- 저장을 누르면 기존 `ConfirmDialog` composite 로 경고를 띄운다:
  > 선택한 N개 캠페인의 담당자가 지정한 담당자로 **모두 교체**됩니다. 기존 담당자는 해제됩니다.
- 확인 시 `bulkAssignCampaignManagers({ campaignIds, managerIds })` 호출 → 성공하면 선택 해제 + 목록 reload.
- 액션별 독립 다이얼로그 원칙에 따라 기존 `CampaignActionDialog` 에 type 분기를 더하지 않고 새 컴포넌트로 만든다.

### 5.7 admin-web — 대시보드 (`pages/Overview/index.tsx`)

- `buildKpis` 에 카드 한 장 추가: 라벨 "내 담당 모집중 캠페인", 값 `stats.myRecruitingCampaignCount`, `to: "/campaigns?manager=me"`.
- 기존 KPI 카드가 이미 `to` 로 딥링크하는 구조라 추가 배선이 없다.

### 5.8 admin-web — 성과 리포트 엑셀 (`pages/Reports/index.tsx`)

- 엑셀 시트에 `담당자` 컬럼 추가. 값은 `row.managers.map(adminUserLabel).join(", ")`, 없으면 빈 문자열.
- 화면 테이블 `COLUMNS` 는 건드리지 않는다.

### 5.9 i18n (`i18n/admin/messages.ts`)

ko/en/ja 3개 언어로 신규 키를 추가한다. 최소 목록:

- `domains.campaign.managers.label` — 운영 담당자
- `domains.campaign.managers.chipEmpty` — + 담당자
- `domains.campaign.managers.popoverTitle` — 담당자 선택
- `domains.campaign.managers.overflow` — 외 {count}명
- `domains.campaign.managers.unassigned` — 담당자 없음
- `pages.campaigns.managerFilter.mine` — 내 캠페인만 보기
- `pages.campaigns.bulkAssign.button` — {count}개 캠페인 담당자 지정
- `pages.campaigns.bulkAssign.title` / `.subtitle` / `.confirmTitle` / `.confirmBody` / `.submit`
- `pages.overview.kpi.myRecruitingCampaigns` — 내 담당 모집중 캠페인
- `pages.reports.columns.managers` — 담당자

## 6. 검증

CODE_RULES 가 "비자명한 로직은 테스트를 남긴다" 수준이면 충분하다. 새로 만드는 테스트는 셋:

1. `buildMultiSelectLabel` — 초과분 접기. 경계(정확히 N개, N+1개, 0개).
2. 일괄 지정 서비스 — 덮어쓰기인지(기존 담당자가 남지 않는지), 삭제된 캠페인이 제외되는지, 없는 어드민 id 가 거부되는지. `campaigns.service.spec.ts` 에 추가.
3. 대시보드 "내 담당 모집중" 집계 — 담당자가 다른 캠페인이 세어지지 않는지.

전 작업 후 `pnpm typecheck`.

수동 확인(사용자):
- 담당자 없는 기존 캠페인이 목록에 그대로 보이는지.
- 우클릭으로 기존 액션 메뉴 전부 도달 가능한지.
- 일괄 지정 후 카드 담당자 표기와 필터 결과가 일치하는지.
- 인플루언서 웹(client-web)에 담당자가 노출되지 않는지.

## 7. 배포와 사이드이펙트

**배포 대상**
- `packages/shared` 변경 → `pnpm --filter @jsure/shared build` 후 **api 재배포(Railway) 필수**.
- `apps/api` — Railway. 마이그레이션 선행.
- `apps/admin-web` — Vercel.
- `apps/client-web` — 변경 없음.

**사용자가 직접 실행할 것** (내가 돌리지 않는다)
```
pnpm --filter @jsure/shared build
cd apps/api && pnpm prisma migrate deploy
pnpm prisma generate   # 실행할 워크트리에서도 각각
```

**회귀 위험**
- `MultiSelectFilterChip` 은 응모자·인플루언서·리포트 필터가 공유한다. 추가 props 는 전부 optional 이고 기본 동작이 바뀌지 않는지 호출부를 확인한다.
- `AdminOverviewResponseSchema` 에 필드가 늘어난다. admin-web 이 `parse` 하므로 **api 를 먼저 배포**해야 한다. 안 그러면 대시보드가 파싱에서 죽는다. → `myRecruitingCampaignCount` 에 `.default(0)` 를 주어 배포 순서에 의존하지 않게 한다.
- `CampaignResponseSchema.managers` 도 같은 이유로 `.default([])`.
- 캠페인 관리 페이지의 좌클릭 의미가 바뀐다. 기존 사용자에게는 체감 변화가 크므로 선택 상태를 분명히 보여야 한다.

## 8. 구현자에게 남기는 것

- 선택된 카드의 시각 처리(테두리 색, 체크 아이콘 위치)는 기존 `Campaigns.module.css` 톤에 맞춰 구현자가 정한다.
- `maxVisibleLabels` 기본값(2 로 제안)과 `+N` 표기의 정확한 문구는 실제 담당자 이름 길이를 보고 조정해도 된다.
- 담당자 칩의 생김새(글씨 크기, 배경 유무, 뱃지와의 간격)는 기존 `Campaigns.module.css` 톤에 맞춰 정한다. 위치는 §5.6 에 고정.
- 일괄 지정 다이얼로그에서 선택된 캠페인 제목을 몇 건까지 미리 보여줄지.

## 9. 미결로 남긴 판단 (내 결정)

사용자가 명시하지 않아 내가 정한 것들. 다르면 말해주면 바꾼다.

- 담당자 후보 = `status === "ACTIVE"` 인 어드민 전원 (role 무관).
- 캠페인 **복사** 시 담당자는 원본을 승계하지 않고 본인으로 초기화.
- 필터·검색이 바뀌면 카드 선택을 해제.
- 담당자 최대 20명/캠페인, 일괄 지정 최대 200건/요청.
- 호버 툴팁은 네이티브 `title` 속성.
- 성과 리포트는 엑셀 컬럼만. 화면 테이블 컬럼도, 담당자 필터도 넣지 않는다 (Notion 3번은 "대시보드 및 캠페인 관리 목록" 만 지목).
