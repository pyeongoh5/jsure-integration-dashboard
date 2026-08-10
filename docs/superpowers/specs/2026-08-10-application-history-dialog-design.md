# 응모 이력 다이얼로그 — 응모자관리·검토·정산 공통

작성일: 2026-08-10
선행: [2026-08-09-admin-activity-log-design.md](./2026-08-09-admin-activity-log-design.md) (감사 로그 자체의 설계)

## 목적

어드민이 세 목록 페이지(응모자관리·검토·정산)에서 행 단위로 "이 응모자가 이
캠페인에서 어떤 액션을 거쳐 왔는지"를 즉시 확인할 수 있게 한다. 데이터 원천은
이미 구축된 감사 로그(`admin_activity_logs`)뿐이고, 새로 쌓거나 추론하지 않는다.

## 범위

- **표시 단위: 응모(application) 1건.** 행을 클릭하면 그 행의 응모 이력만 본다.
  캠페인 전체(모든 응모자) 이력은 이번 범위가 아니다 — `campaignId` 인덱스와
  페이지네이션이 필요해 별도 과제로 남긴다.
- 세 페이지 모두 행이 응모 단위이고 `applicationId` 를 갖고 있어
  `GET /api/campaign-applications/:id/activity` 를 그대로 재사용한다.
- **백엔드 변경 없음.**

### 인플루언서 액션 합성 (2026-08-10 추가)

어드민 액션만 보이면 타임라인의 시간 간격이 해석 불가다 — `제출물 승인`이
`택배 발송` 5일 뒤로 보일 때, 어드민이 늦은 것인지 인플루언서 투고를 기다린
것인지 구분되지 않는다. `직전 액션 +N일` 표기가 오히려 오해를 만든다.

그래서 인플루언서 액션을 **응모의 타임스탬프 컬럼에서 조회 시점에 합성**한다
(`apps/api/src/audit/influencer-activity.ts`). 감사 로그에 계측을 추가하는 대신
합성을 택한 이유:

- 감사 로그 계측 이전 응모도 인플루언서 흐름이 보인다 — 계측 방식은 배포 이후
  데이터만 남아, 기존 응모는 영구히 반쪽 타임라인이 된다
- 인플루언서 제출 경로가 7군데라 계측 누락이 컴파일·테스트로 잡히지 않는다
- 사용자 대면 쓰기 경로를 건드리지 않는다 (읽기 경로 한 곳만 변경)

| 액션 | 원천 컬럼 |
|---|---|
| 응모 | `appliedAt` |
| 주문번호 제출 | `orderSubmittedAt` |
| 수령 확인 | `receivedAt` |
| 투고 제출 | `posts.submittedAt` |
| 인사이트 제출 | `posts.insightSubmittedAt` |

`origin: "INFLUENCER"`, `actor: null` — 응모의 인플루언서는 1명으로 고정이라
행위자가 자명하고, `actorId` 에 어드민·인플루언서 id 를 섞지 않는다. UI 는
담당자 컬럼에 "인플루언서"로 표시하고 배지는 달지 않는다(ADMIN 과 같은 규칙).

같은 시각에 제출된 게시물은 1건으로 묶고 서브타입을 metadata 에 모은다 — 일괄
제출 폼은 타임스탬프가 동일해 그대로 두면 중복 행으로 보인다.

**한계:** 컬럼이 덮어써지므로 재제출 반복은 마지막 1회만 남는다. 반려는 별도
테이블에 행이 쌓여 전부 보이므로, 여러 번 반려된 응모는 반려 N건 대 제출 1건으로
비대칭하게 읽힌다. 재제출 이력이 실제로 필요해지면 제출 경로 3곳을 계측해 얹고,
"감사 로그 행이 있으면 같은 종류의 합성 항목을 억제한다"는 중복 제거 규칙을
추가한다.

**응모 취소는 합성할 수 없다** — 전용 타임스탬프 없이 `status` 만 바뀐다.

**`reviewSubmittedAt` 은 쓰지 않는다** — 컬럼명이 가구매 전용처럼 보이지만 실제로는
카테고리 무관하게 모든 제출 경로가 `status: REVIEW_SUBMITTED` 와 함께 찍는 "제출
완료" 마커다. `posts.submittedAt` 과 같은 사건이라 둘 다 넣으면 SNS 응모에서
`투고 제출`과 `리뷰 제출`이 같은 시각에 중복으로 뜬다.

`AdminActivityOriginSchema` 에 `INFLUENCER` 를 추가했지만 Prisma enum 에는 넣지
않았다. 합성 전용이라 DB 에 기록되지 않으며, `AuditEntry.origin` 을
`Exclude<AdminActivityOrigin, "INFLUENCER">` 로 좁혀 실수로 기록하는 경로를
타입으로 막았다.

### 감사 로그 행으로 뜨는 어드민 액션

`applicationId` 를 넣어 기록한 액션만 걸린다 (24개 중 12개):

| 뜨는 것 | 뜨지 않는 것 |
|---|---|
| 응모 승인·거절·검토취소·발송·배송 (5) | 캠페인 생성/수정/종료/숨김/삭제·드래프트 (9) — `campaignId` 만 기록 |
| 제출물 승인·반려·검토취소 (3) | 인플루언서 메모·플래그 (3) — `influencerId` 만 기록 |
| 정산 생성·등록·완료·자동완료 (4) | |

캠페인 수정은 "이 응모자의 흐름"이 아니라 캠페인 단위 사건이므로 의도된 제외다.
`ACTIVITY_ACTION_LABEL` 은 24개 전체 키를 유지한다 — 캠페인 단위 이력 화면을
나중에 붙일 때 그대로 쓰이고, 액션 추가 시 라벨 누락을 typecheck 가 잡는 장치다.

### 배포 이전 데이터

감사 로그는 계측 배포 시점부터 append-only 로 쌓인다. 이미 처리가 끝난 기존
응모는 이력이 비어 있다 — 빈 목록은 버그가 아니라 정상 상태이며, 빈 상태 문구가
그 맥락을 밝힌다.

## 구조

공통 다이얼로그 1개를 세 페이지가 재사용한다. 페이지별 개별 다이얼로그를 두지
않는 이유: 동작이 다른 액션 다이얼로그(승인/거절)와 달리 이것은 동일한 읽기 전용
뷰이므로, 3벌 유지가 곧 3벌 불일치다.

```
domains/application/components/history/     ← 신규 폴더
  ApplicationHistoryDialog.tsx              ← 신규: 다이얼로그 셸(헤더 + 타임라인)
  ApplicationHistoryDialog.module.css       ← 신규
  elapsed.ts                                ← 신규: 경과 시간 포맷 순수 함수
  metadataLabels.ts                         ← 신규: metadata 키 한국어 부분 매핑
  ActivityTimeline.tsx                      ← applicants/ 에서 이동
  ActivityTimeline.module.css               ← 이동
  activityLabels.ts                         ← 이동
  useApplicationActivity.ts                 ← 이동
```

세 페이지가 공유하므로 applicant 하위 도메인에서 `history/` 로 옮긴다. 현재
사용처가 한 곳뿐이라 이동 비용은 import 경로 정리뿐이다.

### props 계약

행 타입이 페이지마다 다르다(`campaign` / `campaignTitle` / `campaign.title`,
`name` / `influencerName` / `influencer.name`). 다이얼로그는 정규화된 값만 받고,
매핑은 각 페이지가 한다.

```ts
type HistoryTarget = {
  applicationId: string;
  campaignTitle: string;
  influencerName: string;
  /** 페이지가 자기 라벨맵으로 이미 변환한 현재 상태 표시값. */
  statusLabel: string;
};
```

각 페이지는 `useState<HistoryTarget | null>` 하나를 들고, 버튼 클릭 시 자기 행을
매핑해 넣는다. `null` 이면 다이얼로그를 언마운트 — 열 때만 fetch 가 돈다
(`useApplicationActivity` 가 `applicationId` 의존성으로 그렇게 동작).

상태 라벨을 문자열로 받는 이유: 세 페이지가 각각 다른 상태 도메인
(`ApplicantStatus` / `DraftStatus` / `SettlementStatus`)을 쓰므로, 공통 다이얼로그가
세 라벨맵을 모두 알게 만들면 결합이 늘어난다.

## 화면

### 헤더

```
여름 신제품 리뷰 캠페인              ×
김인플 · [정산완료]
```

캠페인 제목이 h2, 그 아래 인플루언서명 + 현재 상태 배지. 이력 목록만으로는
"그래서 지금 어떤 상태냐"가 보이지 않으므로 맥락을 준다.

### 타임라인 항목 (최신순)

```
정산 완료          [연쇄]     +5일   08/10 14:22
오피디
금액: 3,000 · 일괄 건수: 2
```

- **액션 라벨** — `ACTIVITY_ACTION_LABEL[action]`
- **출처 배지** — `ADMIN` 무배지, `CASCADE` "연쇄", `SYSTEM` "시스템".
  같은 `SETTLEMENT_CREATE` 가 어드민 승인의 연쇄(액터 있음)로도, 인플루언서
  인사이트 제출이 유발한 자동 처리(액터 없음)로도 생기므로 구분이 필요하다.
- **경과 시간** — 목록이 최신순이므로 각 항목의 값은 `자기 시각 − 바로 아래(더
  오래된) 항목 시각`. 가장 오래된 항목은 표시하지 않는다. 상태 간 병목(승인 후
  발송 지연 등)을 한눈에 보기 위한 것.
- **시각** — JST, `MM/DD HH:mm`
- **담당자** — `actorName` 스냅샷. 액터 없으면 "시스템". `AdminUser` 를 조인하지
  않으므로 계정 삭제·개명 후에도 행위 시점 이름이 유지된다.
- **상세(metadata)** — 사유·운송장·금액 등 한 줄 요약

### 경과 시간 포맷 (`elapsed.ts`)

```
1분 미만        → 표시 없음
60분 미만       → "+12분"
24시간 미만     → "+3시간"
그 이상         → "+5일"
```

### metadata 키 한국어화 (`metadataLabels.ts`)

현재 `reason: 사진 화질 미달` 처럼 영문 키가 노출된다. 실제 쓰이는 키가 16개뿐이라
부분 매핑 `Record<string, string>` 을 두고, 미등록 키는 원문 그대로 흘린다
(전체 키 필수 Record 로 만들면 백엔드가 metadata 키를 추가할 때마다 프론트가
깨지는데, metadata 는 자유 형식이라 그 결합이 부적절하다).

| 키 | 표시 |
|---|---|
| `reason` | 사유 |
| `trackingCarrier` | 택배사 |
| `trackingNumber` | 운송장 |
| `amountJpy` | 금액 |
| `batchSize` | 일괄 건수 |
| `autoCompleted` | 자동완료 |
| `previousStatus` | 이전 상태 |
| `previousReviewerId` | 이전 검토자 |
| `triggeredBy` | 유발 |
| `changedFields` | 변경 필드 |
| `title` | 제목 |
| `category` | 카테고리 |
| `publishState` | 발행 상태 |
| `hardDeleted` | 물리 삭제 |
| `memoId` | 메모 ID |
| `previousFlaggedById` | 이전 설정자 |

### 상태별 표시

| 상태 | 표시 |
|---|---|
| 로딩 | "불러오는 중…" |
| 빈 목록 | "이 응모에 기록된 작업 이력이 없습니다. 감사 로그 도입 이전 처리 건일 수 있습니다." |
| 실패 | 훅의 error 메시지 |

감사 로그 조회 실패는 다이얼로그 안에서만 표시되고 목록 페이지 동작을 막지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `components/history/*` | 신규 4개 + 이동 4개 |
| `applicants/ApplicantTable.tsx` | `액션` 컬럼 끝에 `이력` 버튼 (카테고리 무관 전 행) |
| `drafts/DraftTable.tsx` | `액션` 컬럼 끝에 `이력` 버튼 |
| `pages/Payouts/index.tsx` | `상태` 뒤에 `이력` 컬럼 신규 + 버튼, `historyTarget` state + 다이얼로그 마운트 (테이블이 페이지 안에 인라인으로 있다) |
| `pages/Applicants/index.tsx` | `historyTarget` state + 다이얼로그 마운트 |
| `pages/Drafts/index.tsx` | 동일 |
| `pages/Applicants/ApplicantDetailDialog.tsx` | "작업 이력" 섹션 제거 |
| `domains/application/index.ts` | export 경로 갱신 |

`ApplicantDetailDialog` 의 "작업 이력" 섹션을 제거하는 이유: 그 모달은
가구매(FAKE_PURCHASE) 응모에만 열리므로, 남겨두면 가구매 행만 이력 진입점이 2개가
되고 SNS 행은 상세 모달이 없어 비대칭이 된다. 이력 진입점은 전 행에 붙는 히스토리
버튼 하나로 통일하고, 상세 모달은 주문정보·첨부파일 역할로 되돌린다.

## 검증

`admin-web` 에는 테스트 러너가 없다(테스트는 `apps/api` 에만 있다). 따라서:

- `pnpm typecheck` — PASS
- `pnpm --filter @jsure/admin-web build` — PASS (CSS module 클래스 누락, import 경로 오류가 여기서 잡힌다)
- 수동 확인: 세 페이지에서 버튼 클릭 → 헤더 값 정확 / 이력 렌더 / 경과 시간 표기,
  이력 없는 응모에서 빈 상태 문구, 가구매 `상세` 모달에서 이력 섹션이 사라졌는지

## 남기는 것 (YAGNI)

- **캠페인 전체 이력 화면** — `campaignId` 인덱스 + 페이지네이션 + 필터가 필요.
  응모자 수십~수백 명이면 단순 목록으로는 못 읽는다. 수요가 확인되면 별도 과제.
- **페이지네이션** — 응모당 이력이 수십 건 수준이라 전량 반환으로 충분.
- **이력 필터/검색** — 항목 수가 적어 불필요.
- **실시간 갱신** — 다이얼로그를 열 때 조회하면 충분하다.
