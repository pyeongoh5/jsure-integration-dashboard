# 인플루언서 목록 서버 필터·총 건수 설계

작성일: 2026-09-06

## 배경

어드민 [인플루언서 관리] 화면에서 SNS 채널 필터를 걸어도 상단 총 건수가 변하지 않는다.
`apps/admin-web/src/pages/Influencers/index.tsx:135` 가 필터 적용 전 배열(`state.rows`)의 길이를
표시하기 때문이다. CSV·빈 상태·일괄발송 후보는 모두 필터 적용분(`filtered`)을 쓰고 있어
상단 카운트만 어긋나 있다.

목표는 채널별 인플루언서 모수를 즉시 파악하는 것이다. 담당자가 [인스타그램]을 선택하면
인스타그램 계정을 등록한 인원수가 상단에 바로 집계되어 캠페인 모객 규모를 판단할 수 있어야 한다.

카운트만 고치는 것은 한 줄이지만, 이 화면은 아직 전체 인플루언서를 한 번에 내려받아
클라이언트에서 필터링한다. 목록 필터는 서버에서 처리하고 커서 무한 스크롤을 쓴다는
프로젝트 방침에 맞춰 이번에 서버 필터·서버 집계로 함께 옮긴다.

## 범위

- 포함: 인플루언서 목록의 서버 필터(SNS 채널 다중 선택 + 검색어), 서버 total 집계,
  커서 무한 스크롤, CSV 전체 데이터 내보내기, 일괄 발송 후보 전체 확보.
- 제외: LIPS / @cosme 를 인플루언서 SNS 계정 타입으로 추가하는 일. 현재
  `SnsAccountSubType` 은 INSTAGRAM / TIKTOK / X / YOUTUBE 4종이며, LIPS·ATCOSME 는
  인플루언서 SNS 계정으로 저장되지 않는다. 채널 확장은 등록 화면·검증까지 번지므로 별건.

## 현재 구조

- `GET /influencers` — 쿼리 파라미터 없음, 페이지네이션 없음.
  `apps/api/src/influencers/influencers.controller.ts:30`
- `InfluencersService.listForAdmin()` — 전량 `findMany` + 크로스포스트 있는 모든 응모를
  메모리로 끌어와 병합. `apps/api/src/influencers/influencers.service.ts:97`
- SNS 계정은 별도 테이블 `InfluencerSnsAccount` (`apps/api/prisma/schema.prisma:316`),
  `@@unique([influencerId, snsType])`.
- 화면은 `useEffect` 한 방 로드 + `useMemo` 클라이언트 필터.

기존에 서버 필터 + 커서 + total 을 이미 구현한 곳은 어드민 응모자 목록이다. 이 설계는
그 패턴을 이식한다.

- `AdminApplicationsService.listApplicantsPage` — `apps/api/src/admin-applications/admin-applications.service.ts:1207`
- `packages/shared/src/types/applicantFilter.ts` — 필터 스키마 + 직렬화 쌍
- `apps/admin-web/src/domains/application/components/applicants/useApplicantsData.ts` — `useInfiniteQuery`
- `apps/admin-web/src/pages/Applicants/index.tsx` — 디바운스, sentinel, CSV

## 데이터 계약 (`packages/shared`)

신규 `src/types/influencerFilter.ts`:

- `InfluencerFilterSchema` = `{ snsTypes: SnsAccountSubType[], query: string }`.
  전 필드 `.default()` 를 가져 `parse({})` 가 `EMPTY_INFLUENCER_FILTER` 를 만든다.
- `influencerFilterToParams(filter): Record<string, string>` — 빈 값은 키 자체를 생략하고
  배열은 `,` 로 조인한다. 목록·CSV·발송 후보가 같은 함수로 파라미터를 만들어 서로 어긋날 수 없다.
- `parseInfluencerFilterParams(query): InfluencerFilter` — 역변환. 알 수 없는 SNS 값은
  조용히 버린다(필터를 좁혀 잘못된 결과를 내는 것보다 낫다).

`src/types/adminInfluencer.ts` 에 추가:

- `AdminInfluencerPageResponseSchema` = `{ influencers, nextCursor: string | null, total: int }`
- `AdminInfluencerExportResponseSchema` = `{ influencers, truncated: boolean }`
- `INFLUENCER_EXPORT_MAX_ROWS = 20000` (응모자 CSV 상한과 같은 값)

## API (`apps/api/src/influencers`)

### 목록

`listForAdmin()` 을 `listForAdminPage(filter, cursor, limit)` 으로 교체한다.

조건은 Prisma `where` 로 모두 표현 가능해 raw SQL 을 쓰지 않는다.

- SNS: `snsAccounts: { some: { snsType: { in: filter.snsTypes } } }` — 선택한 채널 중
  하나라도 보유하면 포함(기존 클라이언트 OR 매칭과 같은 의미).
- 검색: 이름 / 이메일 / SNS 핸들에 대한 `contains` + `mode: "insensitive"` OR.

정렬은 `[{ createdAt: "desc" }, { id: "desc" }]`. 커서는 응모자와 마찬가지로 평문 id 이며
Prisma `cursor: { id }` + `skip: 1` + `take: limit + 1` 로 다음 페이지 존재를 판정한다.
`total` 은 같은 `where` 로 `prisma.influencer.count()` 를 `Promise.all` 로 병렬 조회한다.

크로스포스트 집계는 페이지 대상으로 좁힌다 — `influencerId: { in: pageIds }`.
지금은 크로스포스트가 있는 모든 응모를 메모리로 끌어오는데, 페이지 단위가 생겼으므로
불필요하다.

컨트롤러는 응모자와 같은 형태를 쓴다.

```ts
@Get()
list(@Query() query: Record<string, string>): Promise<AdminInfluencerPageResponse> {
  const limit = Number(query.limit);
  return this.svc.listForAdminPage(
    parseInfluencerFilterParams(query),
    query.cursor?.trim() || null,
    Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 30,
  );
}
```

`GET /influencers` 응답 모양이 `{ influencers }` 에서 `{ influencers, nextCursor, total }`
로 바뀐다. 소비처는 admin-web 인플루언서 목록 한 곳뿐임을 확인했으므로 하위호환 분기 없이
교체한다.

### 전체 조회 (CSV·발송 후보 공용)

`GET /influencers/export` 를 신규로 둔다. 목록과 같은 `where` 를 쓰고 커서·limit 이 없으며
`take: INFLUENCER_EXPORT_MAX_ROWS + 1` 로 초과 여부를 판정해 `truncated` 를 함께 반환한다.

응모자 CSV 는 PII 가 더 많은 별도 select 를 쓰지만, 여기서는 `AdminInfluencer` 에 이미
주소가 포함되어 있어 목록과 같은 응답 모양을 재사용한다. select 를 이원화하지 않는다.

이 한 엔드포인트를 CSV 다운로드와 일괄 발송 후보가 공유한다.

## 화면 (`apps/admin-web`)

### 목록·총 건수

- `useEffect` + `LoadState` 를 `useInfiniteQuery` 로 교체한다.
  `queryKey: ["influencers", filter]` — 필터 객체가 곧 키라서 필터 변경이 새 쿼리가 되고
  커서가 자동으로 리셋된다. 별도 리셋 코드가 없다.
- `refetchOnWindowFocus: false`, `staleTime: 30_000`. 무한 쿼리는 리페치 시 로드된 페이지를
  전부 다시 부르므로 포커스 리페치를 끈다. 갱신은 변경 후 명시적 무효화로 한다.
- 검색어는 `useDebouncedValue(query, 300)` 를 거친 값만 필터에 넣는다. SNS `Set` 은
  `[...set].sort()` 해서 선택 순서가 다른 쿼리 키를 만들지 않게 한다.
- **상단 총 건수는 `pages[0].total`** 을 쓴다. 기존 i18n 키 `pages.influencers.totalCount`
  를 그대로 재사용한다. 빈 상태 판정도 `total === 0` 기준으로 바꾼다.
- 클라이언트 `filtered` useMemo 는 삭제한다.

### SNS 필터 칩

데이터 파생(`snsOptions`)을 폐기하고 고정 목록으로 바꾼다. 커서 페이징에서는 1페이지에
우연히 담긴 채널만 옵션에 남기 때문이다. shared 의 `ENABLED_SNS_TYPES` 를 쓰므로
`SNS_ENABLED` 가 false 인 YOUTUBE 는 빠지고 인스타그램 / 틱톡 / X 3종이 항상 노출된다.

해당 채널 인원이 0명이어도 칩은 보이며 선택 시 "총 0명"이 나온다. 모수 확인이 목적이므로
0명도 확인 가능한 편이 맞다.

### 무한 스크롤

sentinel `div` 를 목록 끝에 렌더하고 `IntersectionObserver` 로 감시한다. 응모자
화면은 `root` 를 테이블의 스크롤 컨테이너로 잡지만, 이 화면은 그러면 안 된다 —
응모자의 `.card` 는 남은 높이를 채우는 flex 컬럼이라 `ScrollTable` 이 세로 스크롤
컨테이너가 되는 반면, 인플루언서의 `.card` 는 내용만큼 늘어나 세로로 스크롤되지
않는다. 그 박스를 `root` 로 잡으면 감시자가 늘 안쪽에 있어 스크롤 없이도 마지막
페이지까지 연달아 요청이 나간다. 따라서 `root` 는 뷰포트(기본값)로 둔다.

`loadMore` 는 mutable ref 로 참조하고 effect 의존성은 `[hasMore, rows.length]` 만 둔다.
페이지가 뷰포트를 채우지 못한 경우를 위해 페이지가 붙을 때마다 한 번씩만 재등록된다.

### CSV

`GET /influencers/export` 를 `influencerFilterToParams` 로 호출해 전체를 받고 기존
`buildInfluencersCsv` 에 넘긴다. 목록과 CSV 가 같은 직렬화 함수를 쓰므로 어긋날 수 없다.
`truncated` 면 경고 메시지를 띄운다(신규 i18n 키). 버튼 비활성 조건은 서버 `total === 0`.

### 일괄 메시지 발송

`BroadcastDialog` 는 후보 명단을 띄우고 개별 체크박스로 골라 `influencerIds` 배열을
`POST /admin/broadcasts` 에 보내는 UI 다. 조건만 서버로 넘기면 이 선별 UX 가 사라진다.

따라서 다이얼로그를 열 때 `GET /influencers/export` 를 호출해 필터 전체 후보를 받아
`candidates` 를 채운다. 발송 API 와 다이얼로그 내부는 바뀌지 않는다. 로드 중 표시와
`truncated` 경고만 추가한다.

이로써 상단 총 건수, CSV 행 수, 발송 후보 수가 언제나 같은 필터 조건에서 나온 같은 모수가 된다.

## 검증

- shared: 직렬화 왕복 테스트 — `parseInfluencerFilterParams(influencerFilterToParams(f))`
  가 `f` 와 같다. 빈 필터, SNS 다중 선택, 알 수 없는 SNS 값 무시를 포함한다.
- api: 서비스 스펙 — SNS OR 매칭, 검색어 매칭(이름·이메일·핸들), 커서 연속성(페이지 경계에서
  누락·중복 없음), `total` 이 필터 조건과 일치.
- `pnpm --filter @jsure/shared build`, `pnpm typecheck`.

## 배포·사이드이펙트

- 배포 대상: `packages/shared` 변경 → 이를 소비하는 **api(Railway) 재배포 필수**,
  **admin-web(Vercel) 재배포**. client-web 은 영향 없음.
- API 계약 변경: `GET /influencers` 응답 모양이 바뀐다. 소비처가 admin-web 목록 한 곳뿐임을
  확인했으므로 api 와 admin-web 을 함께 배포한다. 순서상 api 를 먼저 올리면 구버전
  admin-web 이 잠시 목록을 못 읽으므로 두 배포를 붙여서 진행한다.
- 공용 컴포넌트: `BroadcastDialog` 는 인플루언서 목록에서만 쓰이며 props 계약은 그대로다.
  `ScrollTable` 은 읽기만 하고 바꾸지 않는다.
- i18n: 기존 `pages.influencers.totalCount` 재사용. 신규 키는 CSV·발송 후보의 `truncated`
  경고 정도이며 ko/en/ja 3개 언어를 모두 채운다.
