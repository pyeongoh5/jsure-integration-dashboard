# 가구매 주문 마감기한·리마인더·자동 취소 설계

## 배경 / 문제

가구매 캠페인은 승인(`APPROVED` = 주문 대기) 후 인플루언서가 상품을 주문하고 주문번호·명세를 제출해야(`ORDER_SUBMITTED`) 다음 단계로 넘어간다. 지금은 **주문을 하지 않아도 아무 일이 일어나지 않는다.**

리뷰 마감 리마인더(5-R)는 `orderSubmittedAt` 기준이라 주문 전 응모에는 애초에 걸리지 않는다. 결과적으로 승인만 받고 주문하지 않는 응모가 정원을 무기한 점유하고, 운영자는 수동으로 찾아내야 한다.

## 목표

1. 캠페인에 주문 마감기한을 설정한다(승인일 + N일).
2. 마감 3일 전·당일에 주문 리마인더를 발송한다.
3. 마감 다음날까지 주문하지 않은 응모를 자동 취소하고 안내를 발송한다.

## 비목표

- 절대 날짜(`orderDeadlineAt`) 방식은 쓰지 않는다. 마감 직전에 승인된 응모자가 주문할 시간을 못 받는다.
- 자동 취소 복구 기능 없음. 되돌리려면 DB에서 `status`를 `APPROVED`로 되돌린다.
- 재응모 허용 변경 없음. 아래 "사이드이펙트" 참고.
- SNS·단순리뷰 변경 없음. 두 카테고리에는 주문 단계가 없다.

## 설계

### 1. 캠페인 필드

`campaigns.orderPeriodDays Int?` (nullable)

가구매 전용이다. `null`이면 마감 개념이 없어 리마인더도 자동 취소도 동작하지 않는다 — 기존 캠페인 전부가 여기 해당하므로 배포로 인한 동작 변화가 0건이다.

- `packages/shared`: `orderPeriodDays: z.number().int().positive().nullable()` (생성·수정 요청과 응답 모두)
- 어드민 캠페인 폼: `게시 기간(일)` 아래에 `주문 마감 기한(일)` 입력. **가구매 카테고리일 때만 노출**하고, 비우면 `null`.

마감 시각은 `reviewedAt + orderPeriodDays`다. `reviewedAt`은 승인·반려 모두에서 갱신되지만 대상 조건이 `status = APPROVED`라 승인 시각으로만 쓰인다.

### 2. 트리거 2종

| 트리거 키 | 라벨 | 목록 설명 | 변수 |
|---|---|---|---|
| `FAKE_PURCHASE_ORDER_DEADLINE_REMINDER` | `2-r. 주문 리마인더` | 주문 마감 3일 전·당일 발송 | base + `subType`, `productUrl`, `productPriceJpy`, `orderDeadline`, `remainingDays` |
| `FAKE_PURCHASE_ORDER_EXPIRED` | `2-x. 주문 기한 초과 취소 안내` | 주문 마감 다음날 자동 취소 시 발송 | base + `subType`, `orderDeadline` |

상품 URL·가격을 리마인더에 넣는 이유는 메시지의 목적이 "지금 여기서 주문하세요"이기 때문이다.

`orderDeadline` 변수 리졸버를 `trigger-meta.ts`에 추가한다 — `reviewedAt`과 캠페인의 `orderPeriodDays`로 계산해 JST 월일로 포맷한다. 둘 중 하나라도 없으면 빈 문자열이다. `DISPATCH_APPLICATION_INCLUDE`의 캠페인 select에 `orderPeriodDays`를 추가해야 한다.

**마이그레이션 필요.** `campaigns.orderPeriodDays` nullable 컬럼 추가 + `LineTriggerKey` enum 값 2개 추가(`ALTER TYPE ... ADD VALUE ... AFTER ...`). 둘 다 additive다.

**데이터 시딩은 없다.** 본문 없는 트리거는 `SKIPPED_NO_TEMPLATE`으로 건너뛴다. 어드민에서 본문을 작성하고 토글을 켠 뒤에야 발송된다.

### 3. 리마인더와 자동 취소

대상 조건이 같으므로 쿼리 한 번, 루프 한 번으로 처리한다. 매일 09:00 JST 크론에서:

```
category = FAKE_PURCHASE
AND campaign.orderPeriodDays IS NOT NULL
AND campaign.deletedAt IS NULL
AND status = APPROVED          -- 주문 제출 전
AND reviewedAt IS NOT NULL
```

`status = APPROVED`가 곧 "주문 대기"라서 주문을 낸 사람(`ORDER_SUBMITTED`)은 자동으로 빠진다.

판단은 순수 함수로 분리한다:

```ts
const ORDER_REMINDER_DAYS = [3, 0];   // 마감 3일 전, 마감 당일
const ORDER_CANCEL_DAY = -1;          // 마감 다음날

type OrderDeadlineAction = "remind" | "cancel" | "none";

/** 주문 마감까지 남은 일수로 그날 할 일을 고른다. */
export function orderDeadlineActionFor(remainingDays: number): OrderDeadlineAction {
  if (ORDER_REMINDER_DAYS.includes(remainingDays)) return "remind";
  if (remainingDays === ORDER_CANCEL_DAY) return "cancel";
  return "none";
}
```

`runDaily`에 `runOrderDeadlineReminders()`를 추가하고 루프에서 `switch`로 분기한다. `cancel`은 `status = CANCELLED` 갱신 후 `FAKE_PURCHASE_ORDER_EXPIRED` 발송 순서다. 마감 이틀 뒤(`-2`)부터는 `none`이며, 애초에 취소된 응모는 `status = APPROVED` 조건에서 빠져 재처리되지 않는다.

중첩 삼항연산자를 쓰지 않는다 — `.claude/CODE_RULES.md` §10.

### 4. 인플루언서 웹

주문 제출 화면(`OrderSubmitForm`)에 마감일과 남은 일수를 표시한다. 리뷰 제출 화면(`ReviewSubmitForm`)이 이미 같은 형태로 마감을 보여주므로 그 패턴을 따른다. `orderPeriodDays`가 `null`이면 아무것도 표시하지 않는다.

마감을 알리지 않고 취소하면 문의가 몰리므로 이 표시는 필수다. `InfluencerApplication` 응답에 `orderDeadlineAt`(승인일 + `orderPeriodDays`)을 **서버에서 계산해** 내린다 — 이미 같은 방식의 `postingDeadlineAt`이 있어 클라이언트가 일수 계산을 하지 않아도 된다. 마감이 없거나 승인 전이면 `null`.

모든 문자열은 i18n 처리하고, 신규 property 에는 `// new` 주석을 단다.

## 에러 처리

- 본문 미작성 트리거는 기존 `SKIPPED_NO_TEMPLATE` 경로를 탄다. 새 예외 없음.
- 자동 취소는 상태 갱신을 먼저 하고 발송을 뒤에 한다. 발송이 실패해도 취소는 확정되고, 실패는 `line_dispatch_logs`에 `FAILED`로 남는다.
- 개별 응모 처리 실패가 나머지 대상을 막지 않는다(디스패처가 예외를 삼키고 로그에 남기는 기존 동작).

## 테스트

- **`orderDeadlineActionFor` 단위 테스트**: `3`·`0` → remind, `-1` → cancel, `1`·`2`·`-2`·`5` → none.
- **서비스 테스트 4건**: 마감 3일 전이면 리마인더 발송 / 마감 다음날이면 `status`가 `CANCELLED`로 바뀌고 취소 안내 발송 / 이미 주문한 응모(`ORDER_SUBMITTED`)는 대상 아님 / `orderPeriodDays = null` 캠페인은 대상 아님.
- **클라이언트**: 테스트 인프라 없음. `pnpm typecheck`가 `TRIGGER_LABELS`의 새 키 누락을 잡는다.

## 사이드이펙트

- **자동 취소된 인플루언서는 그 캠페인에 재응모할 수 없다.** 응모 생성은 상태와 무관하게 `(campaignId, influencerId)` 행 존재 여부만 보고 `ALREADY_APPLIED`로 거부한다. 의도된 동작이다.
- `CANCELLED`는 정원을 소비하지 않으므로 자동 취소가 일어나면 승인 인원이 줄고, 모집기간이 남아 있는 캠페인은 `모집 완료` → `모집중`으로 되돌아간다. 자리가 비면 다른 인플루언서가 응모할 수 있으므로 의도된 동작이다.
- Prisma enum 값 추가는 되돌리기 어렵다(PostgreSQL은 enum 값 삭제를 지원하지 않는다). 트리거 키 이름을 확정한 뒤 배포한다.
- 배포 순서는 api(Railway, 마이그레이션 포함) → admin-web·client-web(Vercel). `packages/shared` 필드 추가가 api 배포에 포함된다.
