# 마감 경과 독촉 리마인더 추가 및 템플릿 설명 표시 설계

## 배경 / 문제

**1) 마감 이후 안내가 없다.** 게시/리뷰 제출 마감 리마인더는 마감 **3일 전·1일 전**에만 나간다(`POSTING_REMINDER_DAYS = [3, 1]`). 마감이 지나도록 제출하지 않은 응모에는 아무 안내가 없다. 마감 후 독촉은 인사이트에만 존재한다(`SNS_INSIGHT_OVERDUE_REMINDER`, 8-r).

**2) 운영자가 리마인더 성격을 구분할 수 없다.** 어드민 템플릿 목록은 트리거 라벨만 보여준다. `6-R. 게시 마감 리마인더`라는 제목만으로는 이게 마감 전 독려인지 마감 후 독촉인지, 며칠 전에 나가는지 알 수 없다. 실제로 이 때문에 마감 후 독촉문이 3일 전 리마인더 본문에 작성돼 오발송으로 인지된 사례가 있었다.

## 목표

1. 세 카테고리(SNS 게시 / 가구매 리뷰 / 단순리뷰) 모두에 **마감 다음날 09:00 JST 1회** 발송되는 독촉 트리거 추가.
2. 어드민 템플릿 목록·수정 화면에서 트리거 제목 아래 **발송 시점 설명** 표시.

## 비목표

- 기존 템플릿 **본문 수정 없음**. 잘못 작성된 문구 정정은 어드민에서 하는 별건의 운영 작업이다.
- 반복 발송 없음. 마감 다음날 1회만. (매일 발송은 미제출 방치 시 무한 발송 위험, +3일 2회차는 문구가 하나뿐이라 상충.)
- 마감 경과 시 응모 상태 전이 없음.
- `client-web` 변경 없음.
- description을 API로 내려주지 않는다(아래 §2 근거).

## 설계

### 1. 서버 — 마감 경과 독촉 트리거 3종

**새 트리거 키** (기존 `8-r. 인사이트 제출 다음날 독촉` 네이밍 규칙을 따라 소문자 `r`)

| 트리거 키 | 카테고리 | 라벨 | 변수 |
|---|---|---|---|
| `SNS_POST_OVERDUE_REMINDER` | SNS | `6-r. 게시 마감 다음날 독촉` | base + `postingDeadline` |
| `FAKE_PURCHASE_REVIEW_OVERDUE_REMINDER` | FAKE_PURCHASE | `5-r. 리뷰 마감 다음날 독촉` | base + `subType`, `reviewDeadline` |
| `SIMPLE_REVIEW_OVERDUE_REMINDER` | SIMPLE_REVIEW | `6-r. 리뷰 마감 다음날 독촉` | base + `subType`, `postingDeadline` |

`remainingDays`는 항상 -1이라 변수로 주지 않는다.

변경 파일: `apps/api/prisma/schema.prisma`(Prisma enum), `packages/shared/src/types/lineTemplate.ts`(zod enum), `apps/api/src/line-templates/trigger-meta.ts`(`TRIGGER_META`), `apps/admin-web/src/domains/messageTemplate/types.ts`(라벨).

`listTriggersForCategory`가 `Object.keys(TRIGGER_META)` 순서를 그대로 쓰므로, 목록에서 대응하는 마감 리마인더 **바로 뒤**에 오도록 키를 삽입한다.

**마이그레이션 필요.** `LineTriggerKey`는 Prisma enum이기도 하다(`line_message_templates.triggerKey`, `line_dispatch_logs.triggerKey`). `ALTER TYPE ... ADD VALUE ... AFTER ...` 3줄로 값을 추가한다. additive라 기존 row·구 코드에 영향이 없다. 값 추가 후 같은 마이그레이션에서 그 값을 사용하지 않으므로 PostgreSQL 트랜잭션 제약에도 걸리지 않는다.

**데이터 시딩은 없다.** DB row가 없는 트리거는 `enabled: false`, 본문 없음 → 디스패처가 `SKIPPED_NO_TEMPLATE`으로 건너뛴다. 어드민에서 본문을 작성하고 토글을 켠 뒤에야 발송된다. 배포 직후 갑자기 발송되는 일은 없다.

**발송 조건.** 기존 마감 리마인더와 동일한 대상 집합(제출물 0건인 응모)에서 `remainingDays === -1` 인 건. 마감일 다음날 09:00 JST 1회.

**중복 로직 정리.** `runSnsPostingReminders` / `runFakePurchaseReviewReminders` / `runSimpleReviewDeadlineReminders` 세 메서드는 앵커 필드·status·카테고리·트리거 키만 다른 동일 코드다. 여기에 트리거 분기를 세 번 복붙하지 않고 하나로 합친다.

```ts
const POSTING_REMINDER_DAYS = [3, 1];
const OVERDUE_REMINDER_DAY = -1;

type DeadlineReminderConfig = {
  category: CampaignCategory;
  /** 마감 계산 기준 시각 필드. SNS·단순리뷰는 수령확인, 가구매는 주문 제출. */
  anchor: "receivedAt" | "orderSubmittedAt";
  statuses: ApplicationStatus[];
  deadlineTriggerKey: LineTriggerKey;
  overdueTriggerKey: LineTriggerKey;
};

/** 마감까지 남은 일수로 보낼 리마인더를 고른다. 해당 없으면 null. */
function reminderTriggerKeyFor(
  remainingDays: number,
  config: DeadlineReminderConfig,
): LineTriggerKey | null {
  if (remainingDays === OVERDUE_REMINDER_DAY) return config.overdueTriggerKey;
  if (POSTING_REMINDER_DAYS.includes(remainingDays)) return config.deadlineTriggerKey;
  return null;
}
```

`reminderTriggerKeyFor`는 순수 함수이므로 클래스 밖 모듈 스코프에 둔다. 호출부:

```ts
const triggerKey = reminderTriggerKeyFor(remainingDays, config);
if (!triggerKey) continue;
await this.dispatcher.dispatch(triggerKey, { application, extra: { remainingDays } });
```

`runDaily`는 `runDeadlineReminders(config)`를 3번 호출한다. 순 결과는 약 60줄 삭제 + 신규 분기 1곳.

중첩 삼항연산자를 쓰지 않는다 — `.claude/CODE_RULES.md` §10.

### 2. 어드민 — 트리거 설명 표시

`apps/admin-web/src/domains/messageTemplate/types.ts`에 `TRIGGER_LABELS` 옆에 추가:

```ts
/** 발송 시점이 제목만으로 드러나지 않는 트리거에만 설명을 붙인다. */
export const TRIGGER_DESCRIPTIONS: Partial<Record<LineTriggerKey, string>> = { ... };
```

**설명을 붙이는 기준: 크론으로 발송되는 트리거(= 리마인더)만.** 나머지는 이벤트 발생 즉시 발송되고 제목이 그 이벤트 이름이라 설명이 중복된다.

| 트리거 | 설명 |
|---|---|
| `SNS_POST_DEADLINE_REMINDER` | 게시 마감 3일 전·1일 전 발송 |
| `SNS_POST_OVERDUE_REMINDER` | 게시 마감 다음날 발송 (미제출자 독촉) |
| `SNS_POST_REJECTION_REMINDER` | 게시물 반려 다음날 발송 (재제출 독려) |
| `SNS_INSIGHT_REMINDER` | 게시물 제출 7일 후 발송 |
| `SNS_INSIGHT_OVERDUE_REMINDER` | 게시물 제출 8일 후 발송 (미제출자 독촉) |
| `FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER` | 리뷰 마감 3일 전·1일 전 발송 |
| `FAKE_PURCHASE_REVIEW_OVERDUE_REMINDER` | 리뷰 마감 다음날 발송 (미제출자 독촉) |
| `SIMPLE_REVIEW_DEADLINE_REMINDER` | 리뷰 마감 3일 전·1일 전 발송 |
| `SIMPLE_REVIEW_OVERDUE_REMINDER` | 리뷰 마감 다음날 발송 (미제출자 독촉) |
| `SIMPLE_REVIEW_REJECTION_REMINDER` | 리뷰 반려 다음날 발송 (재제출 독려) |

표시 위치 — 두 곳 모두 제목 아래 작은 회색 텍스트, `TRIGGER_DESCRIPTIONS[key]`가 없으면 렌더하지 않는다:

- 목록(`pages/MessageTemplates/index.tsx`): 트리거 셀의 라벨 아래
- 수정(`pages/MessageTemplates/Edit.tsx`): `editTitle` 아래

**왜 admin-web 정적 맵인가.** 파일 1개만 바뀌고 `packages/shared`·API가 그대로여서 배포 순서 제약이 없다(admin-web만 올리면 끝). 대가는 발송 시점을 바꿀 때 서버 상수와 이 맵을 함께 고쳐야 하는 것인데, 발송 시점 변경 자체가 드물고 그 작업은 어차피 이 표를 읽고 시작한다.

## 에러 처리

- 본문 미작성 트리거는 기존 `SKIPPED_NO_TEMPLATE` 경로를 그대로 탄다. 새 예외 없음.
- 발송 실패는 이미 `LinePushResult` 기반으로 `FAILED`/`SKIPPED_DISABLED`로 로그에 남는다. 변경 없음.
- `TRIGGER_DESCRIPTIONS`는 `Partial<Record<...>>`라 누락이 에러가 아니다 — 설명 없는 트리거가 정상 케이스다.

## 테스트

- **`reminderTriggerKeyFor` 단위 테스트**: `-1` → overdue, `3`·`1` → deadline, `0`·`-2`·`5` → null.
- **`line-reminders.service.spec.ts`**: 세 카테고리 각각 마감 다음날 응모가 overdue 트리거로 디스패치되는지, 제출물이 있는 응모는 대상에서 빠지는지, 마감 이틀 뒤(`-2`)에는 아무것도 안 나가는지.
- **클라이언트**: 테스트 인프라 없음. `pnpm typecheck`가 `TRIGGER_LABELS`의 새 키 누락을 잡는다(`Record<LineTriggerKey, string>`는 전체 키 필수).
- **수동 확인**: 어드민 목록에서 새 트리거 3개가 대응 마감 리마인더 바로 뒤에 보이고 설명이 붙는지, 토글이 꺼진 상태인지.

## 사이드이펙트

- Prisma enum 값 추가는 되돌리기 어렵다(PostgreSQL은 enum 값 삭제를 지원하지 않는다). 트리거 키 이름을 확정한 뒤 배포한다.
- `LineTriggerKey` enum 확장은 additive다. 구 admin-web + 신 API 조합에서도 목록 응답의 새 항목이 `TRIGGER_LABELS`에 없어 라벨이 `undefined`로 그려질 수는 있으나, `packages/shared`가 신 API에 포함돼 배포되므로 **api → admin-web 순**으로 올리면 문제없다.
- 세 리마인더 메서드 통합으로 기존 3·1일 전 발송 로직이 한 함수를 공유한다. 회귀 위험은 이 세 리마인더에 한정되고 스펙이 커버한다.
- 신규 트리거는 본문·토글이 없으면 침묵하므로 배포 자체로 인한 발송 변화는 0건이다.
