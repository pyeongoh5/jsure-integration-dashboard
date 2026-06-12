# 인플루언서 웹: 응모내역 필터 + 신청 화면 주소 확인 설계

작성일: 2026-06-12
범위: `apps/client-web` 전용. API/`@jsure/shared` 스키마 변경 없음. 마이그레이션 없음.

## 기능 1 — 응모내역(応募内訳) 필터

### 현재
`pages/Applications/index.tsx`가 `listApplications()`로 본인 응모 전체를 받아
`ApplicationCard` 리스트로 렌더. 필터 없음.

### 변경
목록 위에 필터 바 추가. 본인 응모만이라 목록이 작으므로 **클라이언트 사이드 필터**.

- **상태 필터(단일 선택 탭):** `전체 / 신청 / 반려 / 진행중 / 종료`
  - 전체 = 전부
  - 신청 = `["APPLIED"]`
  - 반려 = `["REJECTED"]`
  - 진행중 = `["APPROVED", "SHIPPED", "DELIVERED"]`
  - 종료 = `["COMPLETED"]`
  - (CANCELLED는 서버 `listForInfluencer`에서 이미 제외되어 목록에 없음)
- **SNS 필터(다중 선택 칩):** `INSTAGRAM / TIKTOK / X / YOUTUBE`. 토글식, 아무것도
  선택 안 하면 전체로 간주.
- **조합(AND):** 응모가 (선택 상태 그룹에 속함) **그리고** (SNS 미선택 ∨ `app.snsType`이
  선택 집합에 포함)일 때만 표시.

### 구조 (CODE_RULES §7)
- `components/Application/applicationFilter.ts` — 순수 함수:
  - `STATUS_GROUPS: Record<StatusFilter, ApplicationStatus[] | null>` (null = 전체)
  - `filterApplications(apps, statusFilter, snsSet): InfluencerApplication[]`
  - `StatusFilter` 타입: `"all" | "applied" | "rejected" | "in_progress" | "ended"`
- `components/Application/ApplicationFilters.tsx` — presentational. props:
  `statusFilter`, `onStatusChange`, `snsSelected: Set<SnsType>`, `onToggleSns`. 자체 fetch/route 접근 없음.
- `pages/Applications/index.tsx` — 필터 state(`useState`) 보유, 순수 함수로 필터링 후 렌더.
- 빈 결과(필터 후 0건) → "該当する応募がありません" 표시. 전체 0건(미응모) 기존 메시지와 구분.

## 기능 2 — 신청 화면(応募確認) 주소 확인

### 현재
`pages/Apply/index.tsx`가 `fetchMe()`로 `me`를 조회(이미 SNS 선택에 사용).
`me.address`는 `InfluencerMeResponse.address`(nullable, 우편번호/도도부현/시/번지 등).

### 변경
신청 화면에 "お届け先住所" 섹션 추가:
- `me.address`를 포맷해 표시 (우편번호 + 도도부현·시·번지·건물).
- **필수 체크박스** "この住所で受け取ります" — 로컬 `useState`(`addressConfirmed`).
- **"修正" 링크** → 주소 수정 화면(`pages/Me/Address.tsx`의 라우트). 새 탭/같은 화면 이동은
  기존 라우팅 패턴을 따른다.
- `me.address`가 `null`(미등록)이면: 안내 문구 + 등록 링크 표시, 체크박스 숨김.

### 신청 버튼 활성 조건
기존 `allAgreed && hasSelection && !isClosed`에 다음을 AND로 추가:
- 주소 존재(`me.address !== null`)
- `addressConfirmed === true`

주소 미등록이거나 체크 안 하면 신청 버튼 비활성.

### 언어
신청 화면은 일본어 UI이므로 라벨도 일본어.

## 영향 범위 요약
| 레이어 | 파일 | 변경 |
|---|---|---|
| client | `components/Application/applicationFilter.ts` | 신규 — 순수 필터 함수 |
| client | `components/Application/ApplicationFilters.tsx` | 신규 — 필터 바 presentational |
| client | `pages/Applications/index.tsx` | 필터 state + 적용 |
| client | `pages/Apply/index.tsx` | 주소 확인 섹션 + 신청 버튼 조건 |

API/shared/DB: 변경 없음.

## 범위 밖
어드민, 백엔드, 정산, 상태 필터 다중 선택(상태는 단일 선택 탭으로 확정).
