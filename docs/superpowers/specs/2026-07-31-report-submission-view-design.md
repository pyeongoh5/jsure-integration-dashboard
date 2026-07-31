# 리포트 참여자 제출물 열람 및 xlsx 컬럼 확장 설계

## 배경 / 문제

2026-07-30 작업으로 정산관리(Payouts)에서 응모의 제출물·인사이트를 열람할 수 있게 됐다(`2026-07-30-settlement-submission-insight-view-design.md`). 리포트(Reports) 화면에는 같은 진입점이 없다.

리포트 참여자 패널은 인사이트 수치 7종을 이미 보여주지만, **게시물 URL과 스크린샷은 볼 수 없다**. 응답 스키마에 `applicationId`가 없어 상세 모달을 열 키조차 없는 것이 근본 원인이다. xlsx 다운로드에도 게시물 URL과 제출일이 빠져 있다.

정산관리와 마찬가지로 데이터는 이미 보존돼 있다. 이 작업은 **표시 경로 추가**다.

## 목표

1. 리포트 참여자 표에서 제출물/인사이트 상세를 열람(기존 `InsightDetailDialog` 재사용).
2. 리포트 xlsx에 게시물 URL·제출일 컬럼 추가.
3. 정산관리와 리포트가 공유하는 상세 열람 로직을 훅 하나로 모아 중복 제거.

## 비목표

- client-web 변경 없음.
- 스크린샷 이미지의 xlsx 임베드 없음 — 이미지는 모달에서만.
- admin-web 토스트 도입 없음. 에러는 기존 `window.alert` 유지(admin-web에 토스트 컴포넌트가 없고, 현재 `window.alert` 14곳을 한 번에 정리하는 별도 작업이 맞다).
- 리포트 집계 로직·정렬·페이지네이션 변경 없음.
- 다운로드 포맷 변경 없음. 리포트는 캠페인마다 시트를 만들어야 해서 xlsx이고, 정산·인플루언서·승인자 명단은 단일 표라 CSV다. 이 구분은 유지한다.

## 설계

### 1. 서버 — 참여자 응답 확장

`CampaignReportParticipantSchema`(`packages/shared/src/types/adminReport.ts`)에 세 필드 추가:

| 필드 | 타입 | 용도 |
|---|---|---|
| `applicationId` | `string` | 상세 모달을 열 키 |
| `postUrl` | `string \| null` | 게시물 URL (미입력 가능) |
| `submittedAt` | `string` (ISO datetime) | 제출일 |

`AdminReportsService.collectParticipants`는 이미 `submittedPost`를 조회한다. `select`에 `url`·`submittedAt`을 더하고 `application` select에 `id`를 추가한다. 추가 쿼리·N+1 없음.

상세 조회 엔드포인트는 새로 만들지 않는다. 정산관리가 쓰는 `GET /campaign-applications/:applicationId/submission`을 그대로 쓴다.

**배포 순서**: 필수 필드가 늘어나므로 `packages/shared` → api(Railway) → admin-web(Vercel) 순. 구 API + 신 웹이면 참여자 응답 파싱이 실패한다.

### 2. 클라이언트 — `useSubmissionDetail` 훅

`apps/admin-web/src/domains/application/useSubmissionDetail.tsx` (JSX 반환이므로 `.tsx`):

```ts
const { open, loadingId, dialog } = useSubmissionDetail();
```

- `open(applicationId)` — `fetchSubmission` → `toDraftReview` → 모달 오픈
- `loadingId` — 로딩 중인 응모 id. 버튼 비활성·문구 전환용. **한 번에 하나만** 로딩하는 규칙을 훅이 보장한다
- `dialog` — 열려 있을 때만 `InsightDetailDialog`를 렌더하는 노드. 호출부는 `{dialog}` 한 줄
- 실패 시 `window.alert` (기존 정산관리 동작 그대로 이전)

**라벨은 훅이 갖지 않는다.** 정산관리는 문구가 3종(`제출 결과 보기` / `인사이트 보기` / `제출 보기`)이고 리포트는 고정이므로 화면별 규칙으로 남긴다. 훅의 책임은 데이터 로딩과 모달 소유권뿐이다.

호출부 변경:

- **Payouts**: 상태 2개(`detailDraft`, `detailLoadingId`)·`openSubmissionDetail`·모달 렌더를 삭제하고 훅으로 교체. 사용자 눈에 보이는 동작 변화 없음.
- **Reports**: 참여자 표 마지막에 `제출물` 열을 추가하고 버튼에서 `open(participant.applicationId)`.

대안(채택 안 함):
- 정산관리 코드를 리포트에 복제 — 최소 변경이지만 같은 14줄이 두 화면에 남고 세 번째 화면에서 또 복제된다.
- `<SubmissionDetailButton>` 컴포넌트 — 호출부가 가장 짧지만 라벨 규칙을 prop으로 주입해야 하고, 모달 소유권이 행 단위로 흩어져 "동시에 하나만 열림"을 보장하지 못한다.

### 3. xlsx 컬럼

현재 `PARTICIPANT_COLUMNS` 하나가 화면 표와 xlsx를 동시에 정의한다(`format`은 셀 텍스트, `excelValue`는 엑셀 값). URL을 여기 넣으면 화면 표에 긴 URL이 박혀 표가 넓어진다. 그래서 분리한다:

- `PARTICIPANT_COLUMNS` — 화면 + xlsx 공통 (기존: 이름·SNS·SNS ID·인사이트 7종)
- `EXCEL_ONLY_COLUMNS` — `게시물 URL`, `제출일`. xlsx는 `[...PARTICIPANT_COLUMNS, ...EXCEL_ONLY_COLUMNS]`로 시트를 만든다

결과: 화면에는 `제출물` 버튼 열, xlsx에는 URL·제출일 열이 붙는다. 화면에서 URL이 필요하면 모달을 열면 보이므로 중복이 아니다.

옵션(피드/릴스)은 이미 `SNS` 컬럼에 포함돼 있어 추가하지 않는다.

## 에러 처리

- 참여자 응답에 `applicationId`가 항상 있으므로 버튼은 조건부 렌더가 아니다.
- `fetchSubmission` 404(제출물 없음) — `window.alert`로 서버 메시지 표시. 리포트 참여자는 posts가 있는 응모만 나오므로 정상 흐름에서는 발생하지 않는다.
- 로딩 중 다른 행 클릭 — 훅이 무시한다.

## 테스트

- **서버**: `collectParticipants`가 `applicationId`·`postUrl`·`submittedAt`을 채우는지 확인하는 단위 테스트 1건 추가(`admin-reports`에 기존 스펙 없음).
- **클라이언트**: 테스트 인프라가 없어 신규 테스트 없음. `pnpm typecheck`가 스키마 변경을 두 화면에서 잡는다.
- **수동 확인**: 리포트 참여자 행 → 모달 열림 / 정산관리 동작 무변화 / xlsx에 열 2개 추가.

## 사이드이펙트

- `InsightDetailDialog`·`fetchSubmission`·`toDraftReview`는 기존 export를 그대로 쓴다(검수 화면 영향 없음).
- Payouts는 훅 교체로 코드가 줄지만 동작은 동일하다. 회귀 위험은 정산관리 '제출물 보기' 한 곳에 한정된다.
- `CampaignReportParticipant`를 쓰는 곳은 리포트 화면뿐이라 스키마 확장의 파급은 좁다.
