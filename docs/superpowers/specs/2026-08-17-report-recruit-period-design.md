# 리포트 목록 모집기간 표시·필터 + 엑셀 전량 다운로드 설계

2026-08-17

## 목적

- 동일 캠페인 재진행 시 모집기간으로 차수를 구분할 수 있게 한다.
- 원하는 기간·카테고리의 캠페인 리포트만 조회할 수 있게 한다.
- 엑셀 다운로드에 모집기간을 포함하고, 참여자 일부만 잘려서 받히는 버그를 고친다.

## 배경 사실 (탐색 결과)

- DB `Campaign`에 `recruitStartAt`/`recruitEndAt`이 이미 존재한다. 별도의 "캠페인 진행기간" 필드는 없다. 스키마 변경 없음.
- 리포트 API(`GET /admin/reports/campaigns`)는 전체 캠페인을 로드해 JS로 집계한다. 페이지네이션 없음 → 필터는 클라이언트에서 수행한다. 서버 쿼리 파라미터 추가 없음.
- 카테고리 enum(`SNS`/`FAKE_PURCHASE`/`SIMPLE_REVIEW`), 한국어 라벨, `CATEGORY_FILTER_OPTIONS`, `MultiSelectFilterChip`이 이미 존재하므로 재사용한다.
- 날짜 입력은 기존 관례(네이티브 `<input type="date">`)를 따른다. 캘린더 피커 라이브러리 추가 없음.

## 변경 사항

### 1. 공유 타입 + API 응답 확장

- `packages/shared/src/types/adminReport.ts` — `CampaignReportRowSchema`에 `category`(CampaignCategory), `recruitStartDate`, `recruitEndDate`(JST `YYYY-MM-DD` 문자열) 추가.
- `apps/api/src/admin-reports/admin-reports.service.ts` — `campaignReports` 반환 객체에 세 필드 매핑. 날짜 변환은 기존 `utcToJstDateStr` 재사용.

### 2. 리포트 목록 UI (`apps/admin-web/src/pages/Reports/index.tsx`)

- 캠페인명 하단에 `🗓️ 26.07.01 - 07.31` 표시. 시작·종료가 같은 해면 종료일의 연도를 생략한다.
- 상단 필터바 신설:
  - 모집기간 필터: `<input type="date">` 2개(시작~끝). **겹침 단일 방식** — 선택 기간과 캠페인 모집기간이 하루라도 겹치면 노출. 기준 선택 드롭다운 없음. 한쪽만 입력해도 동작(열린 구간).
  - 카테고리 필터: `MultiSelectFilterChip` + `CATEGORY_FILTER_OPTIONS` 재사용 (SNS / 가구매 / 단순 리뷰).
  - 별도 [조회] 버튼 없음 — 데이터가 이미 메모리에 있으므로 상태 변경 즉시 필터 적용.
- "총 N개 캠페인" 카운트와 다운로드 다이얼로그의 캠페인 목록은 필터 결과 기준.

### 3. 엑셀 다운로드

- 참여자 시트에 캠페인 단위 컬럼 **모집 시작일 / 모집 종료일** 2개 추가 (행마다 반복).
- **truncation 버그 수정**: 현재 `pageSize = participantCount`(승인 응모 건수)로 1회 요청하는데, 서버는 응모를 서브타입별 행으로 펼치므로(`collectParticipants`의 flatMap) 실제 행 수가 participantCount보다 많으면 뒤가 잘린다. participantCount > 10000이면 컨트롤러가 pageSize를 20으로 되돌리는 문제도 있다.
  - 수정: `pageSize = 10000`으로 page 0부터 반복 조회, 수집 행 수가 `response.total`에 도달할 때까지 누적한 뒤 시트에 기록.

## 에러 처리 / 테스트

- 다운로드 반복 조회 중 실패 시 기존 catch 흐름 그대로(에러 메시지 표시).
- API 매핑(카테고리·모집기간)은 기존 jest spec(`admin-reports.service.spec.ts`)에 테스트 추가.
- 프론트(겹침 판정·페이지 누적)는 admin-web에 테스트 러너가 없으므로 `pnpm typecheck` + 수동 확인으로 검증한다. 러너 신설은 범위 외.

## 범위 외 (YAGNI)

- 서버사이드 기간 필터, 기준 선택 드롭다운, 캘린더 피커 라이브러리, 캠페인 진행기간 필드 신설.
