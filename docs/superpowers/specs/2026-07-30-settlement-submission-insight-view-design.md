# 정산관리 제출물·인사이트 열람 및 CSV 확장 설계

## 배경 / 문제

응모가 정산관리(Payouts) 단계로 넘어가면, 관리자가 그 응모의 **제출물(리뷰/게시물)과 인사이트 수치**를 확인할 방법이 없다. 검수 단계(Drafts)에서는 `InsightDetailDialog`로 수치·스크린샷·URL을 볼 수 있지만, 정산 화면에는 진입점이 없고 정산 CSV에도 인사이트 수치가 빠져 있다.

핵심: **데이터는 사라지지 않는다.** `listSubmissions`는 상태와 무관하게 posts가 있는 응모를 모두 반환하고, 인사이트 수치·첨부도 그대로 보존된다. 따라서 이 작업은 새 기능 구현이 아니라 **정산 화면에 표시 경로를 추가**하는 것이다.

## 목표

1. 정산관리 화면에서 각 정산 행의 제출물/인사이트 상세를 열람(기존 상세 모달 재사용).
2. 정산 CSV에 인사이트 수치를 서브타입 단위로 포함.

## 비목표

- client-web(인플루언서 웹) 변경 없음.
- 스크린샷 이미지의 파일 임베드(xlsx) 없음 — 이미지는 UI 모달에서만.
- 페이지네이션·정산 로직 자체 변경 없음.

## 설계

### 1. UI — 기존 `InsightDetailDialog` 재사용

정산 테이블 각 행에 "제출물 보기" 진입점(행의 액션 버튼)을 추가하고, 클릭 시 검수에서 쓰는 `InsightDetailDialog`를 그대로 연다.

- 그 모달은 `DraftReview`를 입력으로 받는다. Payouts가 로드하는 `AdminSettlement`에는 그 형태가 없으므로, **응모 단위 제출물 단건 조회 API**를 추가한다:
  - `GET /campaign-applications/:applicationId/submission` → `AdminSubmission`
  - 서버는 기존 `toSubmissionResponse`를 재사용해 단건 반환(없으면 404).
- 클라이언트: 모달을 열 때 이 API로 `AdminSubmission`을 받아 기존 `draftTransform`으로 `DraftReview`로 변환해 모달에 전달. 스크린샷은 모달이 이미 사용하는 `applicationId` 첨부 엔드포인트로 로드(추가 작업 없음).
- 새 다이얼로그 컴포넌트를 만들지 않는다(중복 회피, 검수와 동일 UX).

대안(채택 안 함): Payouts에서 `listSubmissions` 전체를 받아 인덱싱 → 새 API 불필요하나 한 건을 보려고 전체 목록을 받는 낭비. 단건 엔드포인트가 명확·저렴.

### 2. CSV — 서브타입-건별 1행 + 그룹핑

한 정산(응모)의 서브타입 posts를 각각 1행으로 펼친다.

**그룹 ID (표시용, CSV 생성 시점에 조립):**
- 형식: `YYMM-<코드>-NNN` (예 `2606-SNS-001`)
  - `YYMM`: 정산월(파일의 month 필터 `YYYY-MM` → 2자리 연 + 2자리 월). 파일 내 상수.
  - `<코드>`: 카테고리 코드 — `SNS`(SNS) / `Q10`(FAKE_PURCHASE) / `REV`(SIMPLE_REVIEW).
  - `NNN`: **카테고리별로 001부터** 3자리 zero-pad. 카테고리가 바뀌면 다시 001.
- 부여 순서: 시트에 출력되는 정산 행 순서(현재 정렬: status asc → createdAt desc) 기준으로 정산건마다 1씩 증가.
- 이 값은 같은 정산의 모든 서브타입 행에 동일하게 기입 → 행 묶기 가능. DB 저장·서버 생성 없음(전적으로 `downloadCsv`에서 계산).

**행 구성:**
- **그룹 ID**: 모든 행.
- **정산금·상품환급·합계·은행 계좌 일체·인보이스 등록번호·정산 등록일·정산 완료일·상태**: 그룹의 **첫 행에만**, 이후 행은 공란.
- **행마다(서브타입별)**: SNS 종류, 제출 URL, 투고 게시일, 인사이트 제출일, 인사이트 수치 7종 — 좋아요/댓글/공유/리포스트/저장/조회/리치.
- 리뷰형(가구매·단순리뷰): 인사이트 수치 컬럼은 공란, 제출 URL만. QOO10 추가 리뷰 URL(LIPS/@cosme)은 해당 서브타입 행의 "추가 리뷰 URL" 컬럼에 병기.

**컬럼 순서(안):**
`그룹 ID, 인플루언서, 캠페인, 카테고리, SNS, 제출 URL, 추가 리뷰 URL, 투고 게시일, 인사이트 제출일, 좋아요, 댓글, 공유, 리포스트, 저장, 조회, 리치, 은행명, 은행코드, 지점명, 지점코드, 계좌번호, 계좌명의(카나), 인보이스 등록번호, 보수(JPY), 상품환급(JPY), 합계(JPY), 정산 등록일, 정산 완료일, 상태`

(그룹 ID·인플루언서·캠페인·카테고리는 판독 편의상 매 행 기입, 나머지 정산·계좌 필드는 첫 행에만.)

**데이터 출처:** `AdminSettlement.posts`에 인사이트 수치 7종 필드를 추가해, CSV는 로드된 정산 목록만으로 생성(추가 조회 없음).

### 3. 변경 범위

- **packages/shared**: `AdminSettlementSchema.posts` 항목에 `insightLikes/Comments/Shares/Reposts/Saves/Views/Reach`(각 `number.int().nullable()`) 추가. 단건 조회 응답은 기존 `AdminSubmissionSchema` 재사용.
- **apps/api**:
  - 정산 목록 쿼리(`listSettlements` 계열)의 posts select에 인사이트 수치 컬럼 추가, 매핑에 반영.
  - `GET /campaign-applications/:applicationId/submission` 컨트롤러/서비스 추가(`toSubmissionResponse` 재사용, 미존재 시 404).
- **apps/admin-web**:
  - Payouts 테이블 행에 "제출물 보기" 진입점 + `InsightDetailDialog` 연결(단건 조회 → `draftTransform`).
  - `downloadCsv`를 서브타입-건별 + 그룹 ID + 첫 행 병합 레이아웃으로 재작성. 그룹 ID 생성 헬퍼 분리(순수 함수).
- **apps/client-web**: 없음.

## 데이터 흐름

- **상세 열람**: Payouts 행 클릭 → `GET .../submission` → `AdminSubmission` → `draftTransform` → `InsightDetailDialog` → (모달 내부) 첨부 presigned URL 로드.
- **CSV**: `listSettlements(month)` 결과(인사이트 수치 포함) → `downloadCsv`가 정산별 그룹 ID 부여 → 서브타입 posts를 행으로 펼침 → 첫 행에만 정산·계좌 필드 → Blob 다운로드.

## 엣지 케이스

- 인사이트 미제출 서브타입 → 수치 컬럼 공란.
- 리뷰형 카테고리 → 인사이트 수치 없음, URL/스크린샷 위주(모달이 `isReviewCategory`로 이미 분기).
- posts가 0개인 정산은 실무상 발생하지 않음(제출물 승인 후 정산 생성). 방어적으로 posts가 없으면 정산 필드만 1행 출력.
- 카테고리 코드 매핑은 3종 고정(SNS/FAKE_PURCHASE/SIMPLE_REVIEW). 신규 카테고리 추가 시 코드 매핑도 갱신 필요(테이블 상수로 관리).

## 검증

- 그룹 ID 생성 헬퍼: 카테고리별 001 리셋·zero-pad·월 토큰 조립을 assert 자기검증.
- CSV 빌더: 다중 서브타입 정산 1건이 N행으로 펼쳐지고 정산·계좌 필드가 첫 행에만 있는지, 그룹 ID가 전 행 동일한지 assert.
- tsc(shared/api/admin-web), admin-web vite build, eslint.
- 단건 조회 API: 존재/미존재(404) 경로.
