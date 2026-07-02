# LINE 메시지 템플릿 관리 시스템 설계

- 작성일: 2026-07-02
- 상태: Draft (설계 확정, 구현 계획 대기)

## 배경

현재 인플루언서 캠페인 라이프사이클의 각 단계에서 LINE 메시지 발송 여부와 문구가 서버 코드에 하드코딩되어 있다. 문구 하나를 바꾸려 해도 배포가 필요하고, 새 트리거를 추가하려면 코드 수정이 불가피하다. 이는 운영자 관점에서 지속적인 비효율을 낳는다.

목표: **모든 라이프사이클 단계에서 선택적으로 LINE 메시지를 발송할 수 있게 하되, 발송 여부와 문구는 어드민 UI에서 관리한다.** 문구에는 캠페인 타이틀·정산금액·기한 같은 동적 값이 변수로 삽입된다.

## 현재 LINE 발송 지점 (SNS 캠페인)

| # | 프로세스 단계 | 상태 | LINE 발송 | 발송 유형 | 현재 위치 |
|---|--------------|------|:--------:|----------|----------|
| 1 | 캠페인 신청 | APPLIED | 📩 | 즉시 | influencer-applications.service.ts:395 |
| 2-a | 신청 승인 | APPROVED | 📩 | 즉시 | admin-applications.service.ts:169 |
| 2-b | 신청 반려 | REJECTED | — | — | — |
| 3 | 상품 발송 | SHIPPED | 📩 | 즉시 | admin-applications.service.ts:240 |
| 4 | 배송 완료 | DELIVERED | 📩 | 즉시 | admin-applications.service.ts:267 |
| 5 | 수령 확인 | receivedAt 기록 | — | — | — |
| 6 | 게시물 URL 제출 | SubmittedPost.PENDING | — | — | — |
| 6-R | 게시 마감 3일/1일 전 | 미제출 | 📩 | 크론 09:00 JST | line-reminders.service.ts:46 |
| 7-a | 게시물 승인 | APPROVED | — | — | — |
| 7-b | 게시물 반려 | REJECTED | 📩 | 즉시 | admin-applications.service.ts:403 |
| 7-R | 반려 다음날 | 미재제출 | 📩 | 크론 09:00 JST | line-reminders.service.ts:93 |
| 8 | 인사이트 제출 | insightSubmittedAt | — | — | — |
| 8-R | 게시 후 7일 경과 | 미제출 | 📩 | 크론 09:00 JST | line-reminders.service.ts:135 |
| 9 | 정산 완료 | Settlement.COMPLETED | 📩 | 즉시 | admin-applications.service.ts:581 |
| 10 | 캠페인 종료 | COMPLETED | — | — | — |

즉시 발송 6건 + 크론 리마인더 3건 = 총 9개 발송 지점이 코드에 존재한다. 새 시스템에서는 **전체 15개 트리거(현재 발송 없음 6건 포함)** 를 커버한다.

## 요구사항 요약

| 항목 | 결정 |
|-----|-----|
| 템플릿 스코프 | 전역 기본값 + SNS 타입별 분리. 추후 카테고리(SNS/가구매) 도입 |
| 리마인더 타이밍 | 코드 고정(3일/1일 전 등), 본문만 어드민 편집 |
| 템플릿 문법 | 변수 삽입만(`{{key}}`), 조건문/반복문 없음 |
| 메시지 타입 | 텍스트 전용 (버튼/i18n은 별도 프로젝트) |
| 트리거 범위 | 라이프사이클 전 15개 |
| 마이그레이션 기본값 | 현재 발송 중인 9개: enabled + 현재 문구 시드. 나머지 6개: disabled + 빈 본문 |
| 미리보기/테스트 | 화면내 미리보기 + 어드민 본인 LINE으로 테스트 발송 |
| 라벨/설명 언어 | 영문 (KR/JP 어드민 공용) |
| 미지정 변수 처리 | 저장 blocking (에러 표시) |
| UI 위치 | 사이드바 `시스템 > 메시지 템플릿` |

## §1. 아키텍처

```
[비즈니스 서비스]                    [Dispatcher]                   [DB]
 admin-applications.approve() ──► LineDispatcherService.dispatch(
                                    'SNS_APPLICATION_APPROVED',
                                    { application }
                                  )
                                    │
                                    ├─► 1) template 조회 (category, subType, triggerKey)
                                    ├─► 2) enabled=false면 SKIPPED_DISABLED 로그
                                    ├─► 3) 변수 치환 (renderer)
                                    ├─► 4) LineMessagingApi.pushText()
                                    └─► 5) LineDispatchLog 기록
```

**원칙**
- 발송 진입점은 오직 `dispatch(triggerKey, context)` 하나
- 트리거별 허용 변수는 **코드 상수**로 정의 (`TRIGGER_META`) → 타입 안전 + 어드민 UI 소스 겸용
- 크론잡(리마인더)도 동일 dispatcher 경유
- 예외는 dispatcher 내부에서 catch → 비즈니스 트랜잭션이 LINE 발송 실패로 롤백되지 않음 (기존 fire-and-forget 유지)

## §2. 데이터 모델

### 2-1. Enum

```prisma
enum CampaignCategory {
  SNS
  FAKE_PURCHASE   // 추후
}

enum LineTriggerKey {
  // SNS 캠페인
  SNS_APPLICATION_APPLIED
  SNS_APPLICATION_APPROVED
  SNS_APPLICATION_REJECTED
  SNS_APPLICATION_SHIPPED
  SNS_APPLICATION_DELIVERED
  SNS_APPLICATION_RECEIPT_CONFIRMED
  SNS_POST_SUBMITTED
  SNS_POST_DEADLINE_REMINDER
  SNS_POST_APPROVED
  SNS_POST_REJECTED
  SNS_POST_REJECTION_REMINDER
  SNS_INSIGHT_SUBMITTED
  SNS_INSIGHT_REMINDER
  SNS_SETTLEMENT_COMPLETED
  SNS_CAMPAIGN_COMPLETED
  // 가구매 캠페인용 트리거는 추후 정의 (FAKE_PURCHASE_*)
}

enum LineTriggerSubType {
  INSTAGRAM
  X
}

enum LineDispatchStatus {
  SUCCESS
  FAILED
  SKIPPED_DISABLED
  SKIPPED_NO_TEMPLATE
}
```

- `LineTriggerKey`의 접두어(`SNS_*`)로 카테고리 소속을 문자열 수준에서 노출
- (category, triggerKey) 정합성은 코드 상수 `TRIGGER_META`가 강제
- `LineTriggerSubType`은 카테고리에 따라 의미가 다르고 nullable

### 2-2. 모델

```prisma
model LineMessageTemplate {
  id          String              @id @default(cuid())
  category    CampaignCategory
  subType     LineTriggerSubType?
  triggerKey  LineTriggerKey
  enabled     Boolean             @default(false)
  body        String              @db.Text
  updatedAt   DateTime            @updatedAt
  updatedById String?
  updatedBy   AdminUser?          @relation(fields: [updatedById], references: [id])

  @@unique([category, subType, triggerKey])
}

model LineDispatchLog {
  id            String                 @id @default(cuid())
  category      CampaignCategory
  subType       LineTriggerSubType?
  triggerKey    LineTriggerKey
  templateId    String?
  template      LineMessageTemplate?   @relation(fields: [templateId], references: [id])
  applicationId String?
  application   InfluencerApplication? @relation(fields: [applicationId], references: [id])
  toLineUserId  String
  renderedBody  String                 @db.Text
  status        LineDispatchStatus
  errorMessage  String?
  createdAt     DateTime               @default(now())

  @@index([applicationId, triggerKey])
  @@index([createdAt])
}

// AdminUser에 컬럼 추가
model AdminUser {
  // ...
  testLineUserId String?
}
```

**설계 근거**
- `(category, subType, triggerKey)` unique → 트리거당 한 벌
- 로그에 `renderedBody` 저장 → 템플릿이 나중에 수정되어도 실제 발송 내용 재현 가능
- `SKIPPED_*` 상태로 "왜 발송 안 됐는지" 답 가능

## §3. 트리거 변수 스키마

트리거별 사용 가능 변수는 **코드 상수**로 정의한다. 어드민 UI, 렌더러 검증, 미리보기 샘플 데이터가 모두 이 스키마를 소스로 삼는다.

### 3-1. 타입

```ts
type TriggerVariable = {
  key: string          // {{key}}
  label: string        // Admin UI heading (English)
  description: string  // Admin UI description (English)
  sample: string       // Preview sample value
  resolver: (ctx: DispatchContext) => string | null
}

type TriggerMetaEntry = {
  category: CampaignCategory
  requiresSubType: boolean
  variables: TriggerVariable[]
}

const TRIGGER_META: Record<LineTriggerKey, TriggerMetaEntry>
```

### 3-2. 공용 변수 하이브리드

자주 쓰이는 변수는 `COMMON_VARS`로 정의해 재사용, 트리거 고유 변수는 인라인.

```ts
const COMMON_VARS = {
  influencerName: {
    key: 'influencerName',
    label: 'Influencer Name',
    description: 'Name of the influencer who applied',
    sample: 'Hanako Yamada',
    resolver: (ctx) => ctx.application.influencer.name,
  },
  campaignTitle: {
    key: 'campaignTitle',
    label: 'Campaign Title',
    description: 'Title of the campaign the influencer applied to',
    sample: 'Summer Cosmetics PR Campaign',
    resolver: (ctx) => ctx.application.campaign.title,
  },
}

const TRIGGER_META = {
  SNS_APPLICATION_SHIPPED: {
    category: 'SNS',
    requiresSubType: true,
    variables: [
      COMMON_VARS.influencerName,
      COMMON_VARS.campaignTitle,
      {
        key: 'trackingCarrier',
        label: 'Shipping Carrier',
        description: 'Carrier registered at shipment',
        sample: 'Yamato Transport',
        resolver: (ctx) => ctx.application.trackingCarrier,
      },
      {
        key: 'trackingNumber',
        label: 'Tracking Number',
        description: 'Tracking number provided by the carrier',
        sample: '1234-5678-9012',
        resolver: (ctx) => ctx.application.trackingNumber,
      },
    ],
  },
  // ... 나머지 14개
}
```

### 3-3. DispatchContext

```ts
type DispatchContext = {
  application?: InfluencerApplication & { campaign, influencer }
  post?: SubmittedPost
  settlement?: Settlement | Settlement[]
  rejection?: SubmittedPostRejection
  // 트리거별 필요한 필드만 채움 — DispatchContext[K]로 트리거별 필수 필드를 타입에 강제
}
```

### 3-4. 렌더러

- 정규식 `{{\s*(\w+)\s*}}` 매칭
- 미지정 변수는 저장 단계에서 blocking이므로 렌더 시엔 발생하지 않아야 하지만, 안전망으로 원문 유지 + 경고 로그
- `resolver` 반환값이 `null`이면 빈 문자열
- 미리보기 모드에서는 `resolver` 대신 `sample` 값 사용

### 3-5. 값 포맷팅

- 통화(`rewardJpy`): `formatJpy(15000) → "15,000"`
- 날짜(`postDeadline`, `resubmitDeadline`): `format(d, 'yyyy年M月d日')` JST 기준
- 포맷팅은 `resolver` 내부에서 처리 (템플릿 문법에는 filter 미도입)

## §4. 코드 훅 리팩터링

### 4-1. 파일 구조

```
apps/api/src/line-templates/
├── trigger-keys.ts              # enum, 카테고리 매핑
├── trigger-meta.ts              # TRIGGER_META, COMMON_VARS
├── line-dispatcher.service.ts   # dispatch() 진입점
├── template-renderer.ts         # {{var}} 치환
└── line-templates.module.ts

apps/api/src/influencer-auth/
└── line-messaging.service.ts    # pushText만 남김 (raw 전송)
```

### 4-2. Dispatcher 시그니처

```ts
class LineDispatcherService {
  async dispatch<K extends LineTriggerKey>(
    triggerKey: K,
    context: DispatchContext[K],
  ): Promise<void> {
    // 1. TRIGGER_META로 category 확인, context에서 subType/lineUserId 추출
    // 2. LineMessageTemplate 조회
    //    - 없음 → SKIPPED_NO_TEMPLATE 로그, return
    //    - enabled=false → SKIPPED_DISABLED 로그, return
    // 3. renderer.render(template.body, meta.variables, context)
    // 4. lineMessagingService.pushText(lineUserId, rendered)
    //    - 실패 시 FAILED 로그 (예외 삼킴)
    //    - 성공 시 SUCCESS 로그
  }
}
```

### 4-3. 호출부 변경

**Before**
```ts
void this.lineMessagingService.notifyApproved(
  application.influencer.lineUserId,
  application.campaign.title,
  application.campaign.postDeadline,
)
```

**After**
```ts
void this.lineDispatcher.dispatch('SNS_APPLICATION_APPROVED', { application })
```

15개 호출 지점 + 크론 3건 모두 동일 패턴으로 교체.

### 4-4. 삭제 대상

- `LineMessagingService.notify*` 함수 15개 (약 250줄)
- `LineRemindersService`의 인라인 문구 조립 로직 (약 60줄)
- `LineMessagingService`는 `pushText(userId, text)` 만 남긴 raw API 어댑터로 축소

## §5. 어드민 UI

### 5-1. 메뉴 위치

사이드바 `시스템 > 메시지 템플릿`

### 5-2. 목록 화면

- 카테고리 탭: `SNS Campaign` / `Fake Purchase (coming soon)`
- SubType 필터 (SNS 카테고리에서만): `Instagram` / `X`
- 테이블 컬럼: Trigger 이름 / Status (ON/OFF) / Last Updated / Updated By
- 행 클릭 → 편집 페이지

### 5-3. 편집 화면

**좌측**: 본문 에디터
- Textarea, monospace, 5000자 카운터
- 저장 전 클라이언트/서버 양쪽 검증

**우측**: 사용 가능 변수 패널
- 각 변수: `label` (heading), `description` (subtext), `[insert]` 버튼
- `[insert]` 클릭 → 커서 위치에 `{{key}}` 삽입

**상단**: `enabled` 토글

**하단**: `[Preview]`, `[Send Test to My LINE]`, `[Cancel]`, `[Save]`

### 5-4. 저장 시 검증 (blocking)

우선순위 순서:
1. `body` 길이 1~5000
2. `body` 내 모든 `{{key}}` 가 `TRIGGER_META[triggerKey].variables` 에 존재해야 함 (미존재 시 400 에러 + 해당 변수명 표시)
3. `enabled=true` 시 `body`가 공백 아님

프론트에서 동일 검증을 실시간으로 돌려 저장 버튼 상태 + 문제 변수 하이라이트.

### 5-5. 미리보기 & 테스트 발송

**Preview**
- `TRIGGER_META[triggerKey].variables[*].sample` 로 치환한 결과를 모달에 표시
- LINE 말풍선 스타일링 (선택)

**Send Test to My LINE**
- 어드민의 `testLineUserId` 로 실제 발송
- 미등록 시 안내 + 프로필 페이지 링크
- 미리보기와 동일한 sample 데이터로 렌더 후 발송

### 5-6. API 엔드포인트

```
GET  /admin/line-templates?category=SNS&subType=INSTAGRAM
     → [{ triggerKey, enabled, updatedAt, updatedBy }]

GET  /admin/line-templates/:category/:subType/:triggerKey
     → { template, meta: { variables, sampleContext } }

PUT  /admin/line-templates/:category/:subType/:triggerKey
     body: { enabled, body }
     → { template }

POST /admin/line-templates/:category/:subType/:triggerKey/preview
     body: { body }
     → { renderedBody }

POST /admin/line-templates/:category/:subType/:triggerKey/test-send
     body: { body }
     → { sent: true }

PATCH /admin/me/test-line-user-id
     body: { testLineUserId }
     → { adminUser }
```

## §6. 마이그레이션 & 시드

### 6-1. Prisma 마이그레이션

- `CampaignCategory`, `LineTriggerKey`, `LineTriggerSubType`, `LineDispatchStatus` enum 추가
- `LineMessageTemplate`, `LineDispatchLog` 테이블 추가
- `AdminUser.testLineUserId` 컬럼 추가 (nullable)

### 6-2. 시드 데이터

`prisma/seed-line-templates.ts` — 마이그레이션 직후 실행.

- 현재 발송 중인 9개 트리거 × Instagram/X 2 subType = **18 row**: `enabled=true`, 현재 하드코딩된 문구를 변수화하여 삽입
- 나머지 6개 트리거 × 2 subType = **12 row**: `enabled=false`, `body=''`
- **총 30 row**

작업 순서:
1. `line-messaging.service.ts:205-437` 및 `line-reminders.service.ts` 의 각 문구 원문 추출
2. 하드코딩된 값(`campaign.title`, `application.trackingCarrier` 등) → `{{...}}` 로 치환
3. Instagram/X 두 subType에 동일 문구로 삽입 (추후 분기 원하면 어드민에서 편집)

### 6-3. Cutover

한 PR에서 다음을 원자적으로 처리:
1. Prisma 마이그레이션 실행
2. 시드 스크립트 실행
3. `LineDispatcherService`, `TemplateRenderer`, `TRIGGER_META` 추가
4. 15개 호출부 + 크론 3건 `dispatch()` 로 교체
5. `LineMessagingService.notify*` 삭제 (`pushText` 만 남김)
6. 어드민 UI 추가

### 6-4. 검증

- 스테이징에서 15개 트리거 각각 한 번씩 태워 실제 LINE 발송 확인
- `LineDispatchLog` 조회 → 모든 트리거의 발송 상태 검증

### 6-5. 롤백

- 경증: 어드민 UI에서 문제 트리거만 `enabled=false`
- 중증: PR revert. 새 테이블/컬럼은 남아도 무해 (하드코딩된 `notify*` 함수가 복귀)

## §7. 테스트 전략

**단위**
- `TemplateRenderer.render()`: 정상 치환 / resolver null → 빈 문자열 / 미지정 변수 원문 유지
- 저장 검증: 길이 초과 blocking / 미지정 변수 blocking / enabled+빈 body blocking

**통합**
- `LineDispatcherService.dispatch()`: enabled/disabled/no-template 각 경로에서 로그 상태 검증
- Instagram/X subType별로 다른 템플릿이 호출되는지 검증

**E2E**
- 어드민 UI 편집 → 저장 → dispatcher 트리거 → 실제 pushText 호출 인자에 새 문구 반영 확인

## 오픈 이슈

- **어드민의 testLineUserId 확보 방법**: 현재는 어드민 프로필에 수동 입력. 자동 연동(어드민 LINE 로그인)은 별도 프로젝트로 미룸.
- **i18n**: 라벨/설명 영문 고정. 향후 KR/JP 어드민 로케일별 라벨은 별도 프로젝트에서 `label: { en, ja, ko }` 로 확장.
- **가구매(FAKE_PURCHASE) 트리거 정의**: 본 스펙 범위 밖. 프로세스 단계가 확정되면 별도 스펙으로 `FAKE_PURCHASE_*` 트리거 키와 변수 스키마 추가.
