# 인플루언서 수령 확인 단계 도입

## 배경

현재 흐름은 admin이 `배송완료(DELIVERED)`를 처리하는 즉시 인플루언서 측 상태가 `POSTING(투고 기간)`으로 전환된다. 그러나 admin의 `배송완료`는 택배사가 회사에 전달한 "배송 완료" 통보 시점이며, 인플루언서가 실제로 상품을 손에 받은 시점과 다를 수 있다.

게시 기한은 **인플루언서가 실제로 상품을 받은 시점**부터 시작되어야 하므로, admin의 배송완료 처리와 인플루언서의 "수령 확인" 액션을 분리한다.

## 변경 요약

1. `Application`에 `receivedAt` 필드 추가
2. `displayStage`에 `AWAITING_RECEIPT` 추가
3. `Campaign`에 `postingPeriodDays`(수령 후 N일) 추가
4. 인플루언서 전용 `POST /applications/:id/confirm-receipt` API 추가
5. 인플루언서 client-web에 "수령 확인" UI(목록 + 상세 + 확인 모달) 추가
6. admin-web 캠페인 생성/수정 폼에 `投稿期間(日数)` 입력 추가

## 데이터 모델

### Campaign
- 신규 필드: `postingPeriodDays: number` (1 이상 정수, 예: 14)
- 캠페인 생성/수정 시 필수 입력
- 기존 캠페인 마이그레이션: 기본값 14

### Application
- 신규 필드: `receivedAt: string | null` (ISO datetime)
- `status`는 변경 없음 — 기존 enum 그대로 사용
- `postingDeadlineAt` 계산식:
  - `receivedAt != null` → `receivedAt + campaign.postingPeriodDays`
  - `receivedAt == null` → `null`

### displayStage 분기 (서버 계산)
| status | receivedAt | displayStage |
|---|---|---|
| SHIPPED | null | `AWAITING_RECEIPT` |
| SHIPPED | not null | `POSTING` |
| DELIVERED | null | `AWAITING_RECEIPT` |
| DELIVERED | not null | `POSTING` |
| 그 외 | - | 기존 규칙 유지 |

## API

### `POST /applications/:id/confirm-receipt`
- 인증: 인플루언서(해당 application의 소유자)
- 본문: 없음
- 허용 조건:
  - `status ∈ {SHIPPED, DELIVERED}`
  - `receivedAt == null`
- 동작:
  - `receivedAt = now()`
  - `postingDeadlineAt = now() + campaign.postingPeriodDays`
- 응답: 갱신된 `InfluencerApplication`
- 에러:
  - 404: application not found / not owner
  - 409: 이미 `receivedAt` 존재 또는 허용 조건 미충족

## 클라이언트 UI (client-web)

### ApplicationCard (목록)
- `displayStage === AWAITING_RECEIPT`일 때:
  - 단계 뱃지: `受領確認待ち`
  - 하단에 보조 안내 + `受領を確認` 버튼
- 클릭 → 확인 모달

### Applications 상세 페이지
- `stage === AWAITING_RECEIPT` 분기 신설:
  - 배송 정보(`trackingNumber`, `shippedAt`, `deliveredAt`) 노출
  - 안내 문구: `商品が届きましたか？受領を確認すると投稿期間が始まります。`
  - 큰 CTA: `受領を確認する`

### 확인 모달
- 일본어 본문:
  - `受領を確認すると、ここから投稿期間（N日）が始まります。`
  - `この操作は取り消せません。`
- 버튼: `キャンセル` / `受領を確認する`
- 확인 시 API 호출 → 성공 시 stage가 `POSTING`으로 자동 전환되고 `postingDeadlineAt` 표시

### 단계 라벨/진행도
- `STAGE_LABEL.AWAITING_RECEIPT = "受領確認待ち"`
- `STAGE_BADGE_TONE.AWAITING_RECEIPT = "warn"`
- 진행도: `SHIPPED → AWAITING_RECEIPT → POSTING → POSTED → ...` 으로 1단계 추가, 분모 상향

## Admin (admin-web)

### 캠페인 생성/수정 폼
- `投稿期間(日数)` 숫자 입력 추가 (필수, 1 이상)

### 지원자 테이블
- `AWAITING_RECEIPT`는 admin 입장에서 `DELIVERED` 또는 `SHIPPED` 상태이므로 기존 표시와 동일. 별도 필터/뱃지 추가는 이번 범위 제외.

## 엣지 케이스

- `APPROVED` 단계(아직 SHIPPED 전): 수령 확인 버튼 비노출
- `COMPLETED`/`CANCELLED` 등 종료 상태: 수령 확인 버튼 비노출 및 API 거부
- 중복 호출: 409 반환, 클라이언트는 새 상태 재조회
- 레거시 캠페인 데이터: `postingPeriodDays` 기본값 14로 마이그레이션
- admin 강제 `receivedAt` 입력 백오피스 액션: 이번 범위 제외 (후속 과제)

## 비범위

- admin이 인플루언서를 대신해 수령 확인하는 백오피스 액션
- 수령 확인 취소(인플루언서가 실수로 누른 경우 admin이 되돌리는 기능)
- 자동 리마인더(배송완료 후 N일간 미수령 시 알림)
