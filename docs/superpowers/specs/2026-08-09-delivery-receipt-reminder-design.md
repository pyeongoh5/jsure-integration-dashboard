# 배송완료 후 수령확인 리마인더(4-r) 설계

## 배경 / 문제

어드민이 배송완료 처리를 하면 `4. 배송 완료` 안내가 나가고, 인플루언서가 수령확인을 하면 `5. 수령 확인` 안내가 나간다. 그 사이에서 인플루언서가 수령확인을 하지 않으면 아무 일도 일어나지 않는다.

수령확인이 없으면 `receivedAt`이 비어 있고, 게시 마감은 `receivedAt + postingPeriodDays`로 계산되므로 **게시 마감 리마인더(6-R)와 마감 경과 독촉(6-r)도 영원히 발송되지 않는다.** 응모가 조용히 방치된다.

## 목표

배송완료 다음날 09:00 JST에, 아직 수령확인하지 않은 인플루언서에게 리마인더를 1회 발송한다. SNS와 단순리뷰 두 카테고리에 적용한다(가구매는 배송 단계가 없다).

## 비목표

- 반복 발송 없음. 다음날 1회만.
- 수령확인 자동 처리 없음. 배송완료 후 일정 기간이 지나면 자동으로 수령 처리하는 정책은 별건이다.
- `client-web` 변경 없음.
- 기존 `4. 배송 완료` 템플릿 본문 수정 없음.

## 설계

### 1. 새 트리거 2종

| 트리거 키 | 카테고리 | 라벨 | 목록 설명 | 변수 |
|---|---|---|---|---|
| `SNS_APPLICATION_DELIVERY_REMINDER` | SNS | `4-r. 배송완료 리마인더` | 배송완료 다음날 발송 (수령확인 미완료자) | base + `trackingCarrier`, `trackingNumber`, `applicationShippedDate`, `applicationDeliveredDate` |
| `SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER` | SIMPLE_REVIEW | 〃 | 〃 | 위 + `subType` |

변수는 각 카테고리의 `4. 배송 완료` 트리거와 동일하게 맞춘다 — 같은 배송 건을 다시 안내하는 메시지라 운영자가 4번 본문을 참고해 작성하게 된다.

변경 파일: `apps/api/prisma/schema.prisma`(Prisma enum), `packages/shared/src/types/lineTemplate.ts`(zod enum), `apps/api/src/line-templates/trigger-meta.ts`(`TRIGGER_META`), `apps/admin-web/src/domains/messageTemplate/types.ts`(라벨·설명).

`listTriggersForCategory`가 `Object.keys(TRIGGER_META)` 순서를 그대로 쓰므로 각 카테고리의 `APPLICATION_DELIVERED` **바로 뒤**에 키를 삽입한다.

**마이그레이션 필요.** `LineTriggerKey`는 Prisma enum이기도 하다. `ALTER TYPE ... ADD VALUE ... AFTER ...` 2줄로 additive하게 추가한다.

**데이터 시딩은 없다.** DB row가 없는 트리거는 `enabled: false`, 본문 없음 → 디스패처가 `SKIPPED_NO_TEMPLATE`으로 건너뛴다. 어드민에서 본문을 작성하고 토글을 켠 뒤에야 발송된다.

### 2. 발송 조건

매일 09:00 JST 크론에서 다음을 만족하는 응모가 대상이다.

```
status = DELIVERED
AND receivedAt IS NULL
AND deliveredAt 의 JST 일자 == 어제
AND campaign.deletedAt IS NULL
```

`receivedAt`이 채워지면 그날 이후로는 대상에서 빠지므로, 어제 배송완료된 건 중 아직 수령확인하지 않은 사람에게 정확히 한 번 나간다. 경과일을 동등 비교(`=== 1`)하는 것도 재발송을 막는다.

### 3. 구현

`apps/api/src/line-templates/line-reminders.service.ts`에 메서드 하나를 추가한다. 두 카테고리가 카테고리·트리거 키만 다르므로 마감 리마인더와 같은 방식으로 설정 배열을 쓴다.

```ts
/** 배송완료 다음날. 수령확인 독촉을 1회만 보내기 위해 동등 비교로 쓴다. */
const DELIVERY_RECEIPT_REMINDER_DAY = 1;

type DeliveryReceiptReminderConfig = {
  category: CampaignCategory;
  triggerKey: LineTriggerKey;
};

const DELIVERY_RECEIPT_REMINDER_CONFIGS: DeliveryReceiptReminderConfig[] = [
  { category: "SNS", triggerKey: "SNS_APPLICATION_DELIVERY_REMINDER" },
  { category: "SIMPLE_REVIEW", triggerKey: "SIMPLE_REVIEW_APPLICATION_DELIVERY_REMINDER" },
];
```

`runDaily`가 이 배열을 돌며 `runDeliveryReceiptReminders(config)`를 호출한다. 경과일 동등 비교는 기존 인사이트 리마인더(`collectSnsInsightPendingApplications`)와 같은 패턴이다.

## 에러 처리

- 본문 미작성 트리거는 기존 `SKIPPED_NO_TEMPLATE` 경로를 탄다. 새 예외 없음.
- 발송 실패는 이미 `LinePushResult` 기반으로 `FAILED`/`SKIPPED_DISABLED`로 로그에 남는다. 변경 없음.
- 개별 발송 실패가 나머지 대상을 막지 않는다(디스패처가 예외를 삼키고 로그에 남기는 기존 동작).

## 테스트

`line-reminders.service.spec.ts`에 4건 추가:

- 어제 배송완료 + `receivedAt = null` → 해당 트리거로 디스패치
- 어제 배송완료 + 수령확인 완료 → 미발송
- 이틀 전 배송완료 + 미수령 → 미발송(1회만)
- 삭제된 캠페인의 응모 → 미발송

클라이언트는 테스트 인프라가 없다. `pnpm typecheck`가 `TRIGGER_LABELS`의 새 키 누락을 잡는다(`Record<LineTriggerKey, string>`는 전체 키 필수).

## 사이드이펙트

- 어드민이 배송완료 처리를 하지 않아 `SHIPPED`에 머물러 있는 응모는 `deliveredAt`이 없어 대상이 아니다. 인플루언서는 `SHIPPED` 상태에서도 수령확인이 가능하므로, 이 리마인더는 "배송완료 처리를 한 건"에만 걸린다.
- Prisma enum 값 추가는 되돌리기 어렵다(PostgreSQL은 enum 값 삭제를 지원하지 않는다). 트리거 키 이름을 확정한 뒤 배포한다.
- 신규 트리거는 본문·토글이 없으면 침묵하므로 배포 자체로 인한 발송 변화는 0건이다.
- 배포 순서는 api(Railway, 마이그레이션 포함) → admin-web(Vercel).
