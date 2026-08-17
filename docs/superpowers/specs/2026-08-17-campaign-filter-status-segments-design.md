# 캠페인 필터 상태 세그먼트 (진행중/전체/종료)

## 배경

응모자 관리(Applicants)·검토(Drafts) 페이지의 캠페인 필터 칩은 `useCampaignOptions` 훅이 `closedAt === null` 인 캠페인만 내려줘 종료된 캠페인을 아예 선택할 수 없었다. 종료 캠페인의 응모/제출물도 조회할 수 있어야 한다.

## 결정 사항

- 캠페인 칩 팝오버 상단(검색창 위)에 `[진행중 | 전체 | 종료]` 세그먼트를 추가한다.
- 기본 선택값은 **진행중** — 기존 동작과 동일. 팝오버가 remount 되는 구조라 열 때마다 진행중으로 초기화된다.
- 서버·API 변경 없음. `listCampaigns()` 가 이미 종료 캠페인 포함 전체를 내려주므로 프런트에서만 처리.

## 변경 내역

| 파일 | 변경 |
| --- | --- |
| `applicants/types.ts` | `CampaignOption` 에 `closed?: boolean` 추가 (옵셔널 — Payouts 처럼 자체 옵션을 만드는 화면 호환) |
| `applicants/useCampaignOptions.ts` | closed 필터 제거, 전체 캠페인 + `closed` 플래그 반환 |
| `applicants/CampaignFilterChip.tsx` | `showStatusSegments` prop(기본 off) 추가. 켜면 세그먼트 렌더 + `세그먼트 → 검색어` 순 필터. 세그먼트별 빈 목록 문구 분기 |
| `applicants/ApplicantFilters.tsx` | `showStatusSegments` 전달 (응모자·검토 두 페이지 공통 적용) |
| `FilterChip.module.css` | `.popoverSegments` / `.popoverSegment` / `.popoverSegmentOn` 추가 |
| `Applicants/ApprovedApplicantsDialog.tsx` | 훅 결과에서 `!closed` 필터 — 기존 동작(진행중만) 유지 |

## 영향 범위 및 비고

- **Payouts**: 자체 옵션(`{id, title}`)을 칩에 넘기고 `showStatusSegments` 를 켜지 않으므로 변화 없음.
- 종료 캠페인을 선택한 채 세그먼트를 바꿔도 선택 유지 — 칩 라벨은 `campaignTitleById`(전체 기준)로 해석되므로 문제 없음.
