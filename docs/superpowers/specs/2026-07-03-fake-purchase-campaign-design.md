# 가구매 캠페인 설계

- 작성일: 2026-07-03
- 상태: Draft

## 배경

현재 캠페인은 SNS 게시(Instagram/TikTok/X/YouTube) 만 지원한다. 새로 "가구매 캠페인" 을 도입한다.

가구매 캠페인은 인플루언서가 지정된 커머스/리뷰 플랫폼(Qoo10, LIPS, @cosme)에서 상품을 **자비로 구매**한 뒤 리뷰를 작성하는 캠페인이다. 인플루언서에게는 **보수 + 상품가격 환급**이 지급된다.

프로세스가 SNS와 다르므로 캠페인 카테고리 개념을 도입하고, 상태/모집조건/제출데이터/정산 로직을 확장한다.

## 프로세스 비교

**SNS**: 신청 → 승인 → 상품 발송 → 배송 완료 → 수령 확인 → 게시물 URL 제출 → (반려 시 재제출) → 인사이트 제출 → 정산

**가구매**: 신청 → 승인 → 인플루언서 자비 주문 → 주문번호 + 명세서 스크린샷 제출(≥1) → 리뷰 작성 → 리뷰 URL + 스크린샷 제출(≥2) → 정산

주요 차이:
- 관리자가 상품을 발송하지 않음 (인플루언서 자비 구매)
- 관리자 검토는 **신청 승인/반려에만** 존재 (주문 제출, 리뷰 제출은 자동 통과)
- 인사이트 제출 단계 없음
- 정산 금액 = 보수 + 상품가격
- `orderSubmittedAt` 기준 게시 기간 3/1일 전 리마인더 (SNS 는 `receivedAt` 기준)

## 요구사항 요약

| 항목 | 결정 |
|-----|-----|
| 캠페인 카테고리 | 캠페인은 SNS 또는 FAKE_PURCHASE 중 하나로 고정 |
| 가구매 서브타입 | QOO10, LIPS, ATCOSME (@cosme) |
| 서브타입별 설정 | `recruitCount`, `productPriceJpy`, `productUrl` (모두 필수) |
| 팔로워 조건 | 가구매엔 없음 |
| 관리자 검토 | 신청 승인/반려 + 리뷰 제출 승인/반려. 주문 제출은 자동 통과 |
| 리뷰 재제출 | 반려 시 인플루언서가 URL과 스크린샷 재제출 가능. 재제출 후 다시 관리자 승인 대기 |
| 정산 | Settlement에 `rewardAmountJpy` + `productRefundJpy` 증빙 분리, `amountJpy` 는 합계 |
| 주문 명세서 | 최소 1장, 재제출은 REVIEW_SUBMITTED 이전까지 허용 |
| 리뷰 스크린샷 | 최소 2장, 리뷰 제출 이후 재제출 불가 |
| 리마인더 | 리뷰 마감 3/1일 전 (일 1회, JST 09:00) |
| 상태 값 | `ApplicationStatus` enum에 ORDER_SUBMITTED, REVIEW_SUBMITTED 추가 |
| client-web 문자열 | 모든 신규 인플루언서 대면 문자열은 i18n 키로 정의 (기본 ja) |
| admin-web 문자열 | 한국어 직접 사용 (기존 관례) |
| 네이밍 | `SnsType` → `CampaignSubType`, `sns_type` → `sub_type`, `CampaignSnsRecruit` → `CampaignRecruit` 로 rename |
| Attachment 통합 | 기존 `SubmittedPostAttachment` → `Attachment` (kind 컬럼 도입, application/post 폴리모픽) |

## §1. 데이터 모델 개요

```
Campaign (category: SNS | FAKE_PURCHASE)
  ├── recruits (CampaignRecruit) : subType, recruitCount, ...(카테고리별 조건 필드 nullable)
  └── applications
        ├── subType, status
        ├── SNS 전용: trackingCarrier, trackingNumber, shippedAt, deliveredAt, receivedAt
        ├── 가구매 전용: orderNumber, orderSubmittedAt, reviewSubmittedAt
        ├── attachments[] (kind=ORDER_RECEIPT, applicationId 종속, 가구매만)
        └── SubmittedPost
              ├── url (SNS: 게시물 URL / 가구매: 리뷰 URL)
              ├── attachments[] (kind=INSIGHT_SCREENSHOT/REVIEW_SCREENSHOT)
              ├── insight* (SNS만)
              └── Settlement (rewardAmountJpy + productRefundJpy)
```

**원칙**:
- 캠페인은 한 카테고리로 고정
- 상태 enum은 카테고리 무관 통합 (SHIPPED/DELIVERED는 SNS만 사용, ORDER_SUBMITTED/REVIEW_SUBMITTED는 가구매만 사용). 카테고리별 유효 전이는 서비스 레이어에서 강제
- 서브타입 필드 및 enum은 rename하여 SNS 전용 네이밍을 제거
- 첨부 파일은 하나의 `Attachment` 테이블로 통합, `kind` 로 분기

## §2. Prisma 스키마

### 2-1. Enum 변경

```prisma
// Rename SnsType → CampaignSubType, 값 3개 추가
enum CampaignSubType {
  INSTAGRAM
  TIKTOK
  X
  YOUTUBE
  QOO10
  LIPS
  ATCOSME
}

// 상태 값 2개 추가
enum ApplicationStatus {
  APPLIED
  APPROVED
  REJECTED
  SHIPPED           // SNS 전용
  DELIVERED         // SNS 전용
  ORDER_SUBMITTED   // 가구매 전용 (신규)
  REVIEW_SUBMITTED  // 가구매 전용 (신규)
  COMPLETED
  CANCELLED
}

// 신규 enum
enum AttachmentKind {
  INSIGHT_SCREENSHOT     // SNS: 게시 후 인사이트
  ORDER_RECEIPT          // 가구매: 주문 명세서
  REVIEW_SCREENSHOT      // 가구매: 리뷰 스크린샷
}

// LINE 트리거 subtype (메시지 템플릿) 에도 값 추가
enum LineTriggerSubType {
  INSTAGRAM
  X
  QOO10
  LIPS
  ATCOSME
}

// LINE 트리거 키에 FAKE_PURCHASE 8개 추가
enum LineTriggerKey {
  // 기존 15개 SNS_* 유지
  ...
  FAKE_PURCHASE_APPLICATION_APPLIED
  FAKE_PURCHASE_APPLICATION_APPROVED
  FAKE_PURCHASE_APPLICATION_REJECTED
  FAKE_PURCHASE_ORDER_SUBMITTED
  FAKE_PURCHASE_REVIEW_SUBMITTED
  FAKE_PURCHASE_REVIEW_APPROVED
  FAKE_PURCHASE_REVIEW_REJECTED
  FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER
  FAKE_PURCHASE_SETTLEMENT_COMPLETED
  FAKE_PURCHASE_CAMPAIGN_COMPLETED
}
```

### 2-2. Campaign 모델

```prisma
model Campaign {
  id                 String            @id @default(cuid())
  category           CampaignCategory  @default(SNS)   // 신규
  title              String
  rewardJpy          Int
  // ... 기존 필드 유지
  postingPeriodDays  Int               @default(14)   // SNS: 수령확인 기준. 가구매: 주문 제출 기준
  // ...
  recruits           CampaignRecruit[]                // rename (기존 snsRecruits)
  // ...
}
```

### 2-3. CampaignRecruit (기존 CampaignSnsRecruit rename)

```prisma
model CampaignRecruit {
  id                 String                @id @default(cuid())
  campaignId         String
  subType            CampaignSubType                            // rename (기존 snsType)
  minFollowers       Int                   @default(0)          // SNS만 의미. 가구매는 0
  recruitCount       Int
  instagramPostTypes InstagramPostType[]                        // Instagram 만
  insightRequired    Boolean               @default(true)       // SNS만 의미. 가구매는 false 고정
  productPriceJpy    Int?                                       // 신규: 가구매만 (>0)
  productUrl         String?                                    // 신규: 가구매만
  createdAt          DateTime              @default(now())
  updatedAt          DateTime              @updatedAt

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, subType])
  @@map("campaign_recruits")
}
```

**규약** (서비스 검증):
- `campaign.category === SNS`: `subType ∈ {INSTAGRAM, TIKTOK, X, YOUTUBE}`, `productPriceJpy` null, `productUrl` null
- `campaign.category === FAKE_PURCHASE`: `subType ∈ {QOO10, LIPS, ATCOSME}`, `productPriceJpy > 0`, `productUrl` non-empty, `minFollowers = 0`, `insightRequired = false`, `instagramPostTypes = []`

### 2-4. CampaignApplication 확장

```prisma
model CampaignApplication {
  id                 String                 @id @default(cuid())
  campaignId         String
  influencerId       String
  subType            CampaignSubType                            // rename (기존 snsType)
  instagramPostType  InstagramPostType?                         // Instagram만
  status             ApplicationStatus      @default(APPLIED)

  appliedAt          DateTime               @default(now())
  reviewedAt         DateTime?
  reviewedById       String?
  rejectReason       String?

  // SNS 전용 (기존)
  trackingCarrier    String?
  trackingNumber     String?
  shippedAt          DateTime?
  deliveredAt        DateTime?
  receivedAt         DateTime?
  completedAt        DateTime?

  // 가구매 전용 (신규)
  orderNumber        String?
  orderSubmittedAt   DateTime?
  reviewSubmittedAt  DateTime?

  attachments        Attachment[]
  posts              SubmittedPost[]
  lineDispatchLogs   LineDispatchLog[]

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  campaign   Campaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  influencer Influencer @relation(fields: [influencerId], references: [id], onDelete: Restrict)

  @@unique([campaignId, influencerId, subType])
  @@index([campaignId, status])
  @@index([influencerId, status])
  @@map("campaign_applications")
}
```

### 2-5. Attachment 통합 (기존 SubmittedPostAttachment rename + 확장)

```prisma
model Attachment {
  id            String              @id @default(cuid())
  kind          AttachmentKind
  applicationId String                                       // 항상 존재
  postId        String?                                      // post 스코프일 때만
  objectKey     String              @unique
  contentType   String
  sizeBytes     Int
  uploadedAt    DateTime            @default(now())

  application   CampaignApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  post          SubmittedPost?      @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([applicationId, kind])
  @@index([postId, kind])
  @@map("attachments")
}
```

**스코프 규칙**:
- `ORDER_RECEIPT`: `applicationId` 필수, `postId = null`
- `INSIGHT_SCREENSHOT`, `REVIEW_SCREENSHOT`: `applicationId` + `postId` 모두 필수

기존 `SubmittedPostAttachment` row 는 `kind = INSIGHT_SCREENSHOT`, `applicationId = post.applicationId` 로 백필.

### 2-6. SubmittedPost 필드 rename

```prisma
model SubmittedPost {
  // ...
  subType      CampaignSubType                                 // rename (기존 snsType)
  reviewStatus PostReviewStatus @default(PENDING)              // 가구매는 항상 APPROVED로 생성
  // ...
  attachments  Attachment[]                                    // rename (기존 SubmittedPostAttachment[])
}
```

### 2-7. Settlement 확장

```prisma
model Settlement {
  id                String           @id @default(cuid())
  postId            String           @unique
  amountJpy         Int                                        // 합계
  rewardAmountJpy   Int              @default(0)              // 신규
  productRefundJpy  Int              @default(0)              // 신규
  status            SettlementStatus @default(PENDING)
  createdAt         DateTime         @default(now())
  completedAt       DateTime?
  completedById     String?

  post SubmittedPost @relation(fields: [postId], references: [id], onDelete: Cascade)
}
```

- SNS: `rewardAmountJpy = campaign.rewardJpy`, `productRefundJpy = 0`, `amountJpy = campaign.rewardJpy`
- 가구매: `rewardAmountJpy = campaign.rewardJpy`, `productRefundJpy = recruit.productPriceJpy`, `amountJpy = 합계`

기존 row 백필: `rewardAmountJpy = amountJpy`, `productRefundJpy = 0`.

## §3. 프로세스 전이 및 서비스 액션

### 3-1. 가구매 상태 전이

Application 상태와 SubmittedPost 상태가 함께 흐름을 결정한다.

```
APPLIED ─(admin.approve)→ APPROVED ─(inf.submitOrder)→ ORDER_SUBMITTED
                                                              │
                                                              │ inf.submitReview
                                                              │   → SubmittedPost (reviewStatus=PENDING)
                                                              ↓
                                                       REVIEW_SUBMITTED

REVIEW_SUBMITTED
   ├── admin.approveSubmittedPost (post PENDING → APPROVED)
   │        → Settlement 자동 생성 (PENDING)
   │        → admin.completeSettlements → application COMPLETED
   │
   ├── admin.rejectSubmittedPost (post PENDING → REJECTED, reason)
   │        → 인플루언서에게 반려 통보
   │        → inf.submitReview 재호출 (post REJECTED → PENDING, url/screenshots 갱신)
   │
   └── (반복)

APPLIED ─(admin.reject)→ REJECTED
APPLIED ─(inf.cancel)→ CANCELLED
```

**핵심 원칙**:
- Application.status 는 리뷰 검토 사이클 동안 `REVIEW_SUBMITTED` 로 고정. Post 의 `reviewStatus` 가 서브 스테이트 (PENDING / APPROVED / REJECTED)
- `undo` 액션 (application 승인/반려 취소): APPROVED/REJECTED → APPLIED 만 허용 (SNS 와 동일)
- 게시물 검토 되돌리기(`undoSubmittedPostReview`): 기존 SNS 로직 재사용 (Settlement 미완료 상태에서만 PENDING 으로 회복)

### 3-2. 신규 서비스 액션

**`InfluencerApplicationsService.submitOrder`**
```ts
async submitOrder(
  influencerId: string,
  applicationId: string,
  orderNumber: string,
  receiptObjectKeys: { objectKey: string; contentType: string; sizeBytes: number }[],
): Promise<InfluencerApplication>
```
- 소유권 검증
- 카테고리 검증: `campaign.category === FAKE_PURCHASE` 만 허용
- 상태 검증: `APPROVED` 또는 `ORDER_SUBMITTED` (재제출 허용). REVIEW_SUBMITTED 이후 잠금
- 입력 검증: `orderNumber.trim().length > 0`, `receiptObjectKeys.length >= 1`
- 트랜잭션:
  1. 재제출 시 기존 `Attachment (kind=ORDER_RECEIPT)` 전체 삭제
  2. 신규 `Attachment[]` create (`kind=ORDER_RECEIPT, applicationId, postId=null`)
  3. `CampaignApplication` 업데이트: `orderNumber`, `orderSubmittedAt = new Date()`, `status = ORDER_SUBMITTED`
- 발송: `dispatcher.dispatch("FAKE_PURCHASE_ORDER_SUBMITTED", { application })`

**`InfluencerApplicationsService.submitReview`**
```ts
async submitReview(
  influencerId: string,
  applicationId: string,
  reviewUrl: string,
  screenshotObjectKeys: { objectKey: string; contentType: string; sizeBytes: number }[],
): Promise<InfluencerApplication>
```
- 소유권 / 카테고리 검증
- 상태 검증: 다음 중 하나만 허용
  - `ORDER_SUBMITTED` (첫 제출)
  - `REVIEW_SUBMITTED` 이면서 관련 `SubmittedPost.reviewStatus === REJECTED` (재제출)
- 상태 잠금: `REVIEW_SUBMITTED` 이면서 post `reviewStatus === PENDING` 또는 `APPROVED` 이면 400 반환
- 입력 검증: `reviewUrl.trim().length > 0`, `screenshotObjectKeys.length >= 2`
- 트랜잭션:
  1. 기존 `SubmittedPost` 존재 여부 확인 (application 당 최대 1개)
     - 없으면 새 `SubmittedPost` create — `applicationId`, `subType = application.subType`, `url = reviewUrl`, `reviewStatus = PENDING`
     - 있으면 (재제출) update — `url = reviewUrl`, `reviewStatus = PENDING`, `reviewedAt = null`, `reviewedById = null`
  2. 재제출 시 기존 `Attachment (kind=REVIEW_SCREENSHOT, postId)` 전체 삭제
  3. 새 `Attachment[]` create — `kind=REVIEW_SCREENSHOT, postId, applicationId`
  4. `CampaignApplication` 업데이트: `reviewSubmittedAt = new Date()`, `status = REVIEW_SUBMITTED`
- 발송: `dispatcher.dispatch("FAKE_PURCHASE_REVIEW_SUBMITTED", { application, post })`
- **Settlement 자동 생성 없음** (관리자 승인 시점으로 이동)

### 3-3. `ensureSettlementForPost` 확장

`submitReview` 대신 `approveSubmittedPost` 시점에 호출됨 (SNS 와 동일 트리거).

```ts
// application 은 SubmittedPost.application (campaign include)
if (application.campaign.category === "FAKE_PURCHASE") {
  const recruit = await prisma.campaignRecruit.findUnique({
    where: {
      campaignId_subType: {
        campaignId: application.campaignId,
        subType: application.subType,
      },
    },
  })
  const rewardAmountJpy = application.campaign.rewardJpy
  const productRefundJpy = recruit.productPriceJpy!
  const amountJpy = rewardAmountJpy + productRefundJpy
  return upsertSettlement({
    postId: post.id,
    amountJpy,
    rewardAmountJpy,
    productRefundJpy,
    status: "PENDING",
  })
}
// 기존 SNS 로직 유지
```

### 3-4. `deriveDisplayStage` 확장

가구매 stage 추가:

| 조건 | displayStage |
|-----|-------------|
| status = APPLIED | `APPLIED` |
| status = APPROVED (가구매) | `AWAITING_ORDER` |
| status = ORDER_SUBMITTED | `AWAITING_REVIEW` |
| status = REVIEW_SUBMITTED + post.reviewStatus = PENDING | `REVIEW_PENDING` (관리자 심사중) |
| status = REVIEW_SUBMITTED + post.reviewStatus = REJECTED | `REVIEW_REJECTED` (재제출 필요) |
| status = REVIEW_SUBMITTED + post.reviewStatus = APPROVED + Settlement PENDING | `REVIEWING` (정산 대기) |
| status = REVIEW_SUBMITTED + post.reviewStatus = APPROVED + Settlement COMPLETED | `SETTLED` |
| status = COMPLETED | `SETTLED` |
| REJECTED / CANCELLED | 동일 |

기존 SNS stage 그대로 유지. 신규 stage: `AWAITING_ORDER`, `AWAITING_REVIEW`, `REVIEW_PENDING`, `REVIEW_REJECTED`.

### 3-5. 관리자 액션 정책

- `approve`, `reject`, `undo`, `completeSettlements`: 카테고리 무관 공통
- `ship`, `deliver`: 카테고리 = SNS 만 허용
- `approveSubmittedPost`, `rejectSubmittedPost`, `undoSubmittedPostReview`: **양 카테고리 공통**. 카테고리별 차이:
  - SNS: 승인 후 `insightRequired` 에 따라 인사이트 대기 → Settlement 생성
  - 가구매: 승인 즉시 Settlement 생성 (인사이트 없음)
  - 반려 시 인플루언서에게 재제출 알림 (SNS: `SNS_POST_REJECTED` / 가구매: `FAKE_PURCHASE_REVIEW_REJECTED`)
- `settleSubmittedPost`: SNS 만 (기존 로직 유지)

### 3-6. 인플루언서 액션 정책

- `create`, `cancel`: 공통. `create()` 시 `subType` 이 campaign.category 에 유효한지 검증
- `confirmReceipt`, `upsertPost`, `upsertInsight`: 카테고리 = SNS 만
- `submitOrder`, `submitReview`: 카테고리 = FAKE_PURCHASE 만

### 3-7. 마감 리마인더

`orderSubmittedAt + campaign.postingPeriodDays` = 리뷰 제출 마감일 (JST).

`LineRemindersService` 에 `runFakePurchaseReviewReminders()` 추가:
- 대상: `category=FAKE_PURCHASE + status=ORDER_SUBMITTED + posts.length=0`
- 마감까지 남은 일수 ∈ {3, 1} 인 응모에 대해 `FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER` 발송
- 매일 JST 09:00 실행 (기존 크론 `runDaily()` 에 추가)

응답 shape 에 `postingDeadlineAt` 필드는 카테고리별 anchor 로 계산:
- SNS: `receivedAt + postingPeriodDays`
- 가구매: `orderSubmittedAt + postingPeriodDays`

## §4. UI 변경

### 4-1. 캠페인 설정 (admin-web)

**CampaignForm**:
- 최상단에 카테고리 라디오 추가: `[● SNS] [○ 가구매]`
- 신규 생성 시만 선택 가능. 편집 시 잠금
- 선택에 따라 하단 RecruitList UI 및 검증 분기

**RecruitList / RecruitSlot** (기존 SnsRecruitList 재작성):

SNS 카테고리:
- 서브타입 체크박스: Instagram / TikTok / X / YouTube
- 각 서브타입 카드: `minFollowers`, `recruitCount`, `insightRequired` 토글, (Instagram만) `instagramPostTypes`

가구매 카테고리:
- 서브타입 체크박스: Qoo10 / LIPS / @cosme
- 각 서브타입 카드: `recruitCount`, `productPriceJpy`, `productUrl`

내부 데이터 shape 은 통일된 `recruits: RecruitSlot[]` (필드는 nullable, 카테고리별 검증).

### 4-2. 어드민 응모/검토/정산 페이지

- **Applicants**: 카테고리 컬럼 + 필터 추가. 액션: 승인/반려 공통, ship/deliver 은 SNS 만
- **응모자 상세**: 카테고리별 진행 데이터 표시 (가구매: 주문번호/명세서 썸네일/리뷰 URL/스크린샷 썸네일)
- **Drafts (게시물 검토)**: SNS 게시물 + 가구매 리뷰 둘 다 노출. 카테고리 컬럼 + 필터 추가. 액션(승인/반려) 동일하게 작동
- **Payouts (정산)**: 컬럼 추가 — `rewardAmountJpy`, `productRefundJpy`, `amountJpy(합계)`. 카테고리 필터

### 4-3. 인플루언서 앱 (client-web)

- 캠페인 카드에 카테고리 뱃지
- 가구매 캠페인 상세: 상품가격(서브타입별), 상품 URL, 예상 정산액(reward + productPrice) 표시
- 응모 상세 페이지 — 카테고리 = 가구매 인 경우 stage 별 폼:

| displayStage | UI |
|-------------|-----|
| APPLIED | "심사 중" 안내 |
| AWAITING_ORDER | 안내 + `submitOrder` 폼 (orderNumber input + 파일 업로드 ≥ 1) + 상품 URL 링크 |
| AWAITING_REVIEW | 안내 + `submitReview` 폼 (URL input + 파일 업로드 ≥ 2) + D-day |
| REVIEW_PENDING | "관리자 검토 중" 안내 + 제출한 URL/스크린샷 읽기전용 표시 |
| REVIEW_REJECTED | "재제출 필요" 안내 + 반려 사유 표시 + `submitReview` 폼 (URL/스크린샷 새로 입력) |
| REVIEWING | "정산 진행 중" |
| SETTLED | "정산 완료" |
| REJECTED / CANCELLED | 상태 표시 |

`submitOrder` 는 ORDER_SUBMITTED 상태에서도 재제출 가능 (폼 노출). 리뷰 제출(REVIEW_SUBMITTED) 이후 잠금.

`submitReview` 재제출 조건: `REVIEW_REJECTED` stage 에서만 폼 노출. `REVIEW_PENDING`/`REVIEWING`/`SETTLED` 에서는 읽기전용.

### 4-4. i18n (client-web)

신규 인플루언서 대면 문자열은 모두 i18n 키로 정의. 기본 로케일 `ja`.

핵심 키 목록(예시, 실제 네이밍은 client-web 컨벤션에 맞춰 최종 조정):

| 컨텍스트 | 키 | ja |
|---------|---|-----|
| 심사 중 | `application.stage.applied.description` | 応募内容を審査中です |
| 주문 대기 헤딩 | `application.stage.awaitingOrder.heading` | ご注文をお願いいたします |
| 주문 대기 안내 | `application.stage.awaitingOrder.description` | 商品をご購入後、注文番号と注文明細のスクリーンショットをご提出ください |
| 주문번호 라벨 | `application.stage.awaitingOrder.orderNumber.label` | 注文番号 |
| 명세서 업로드 라벨 | `application.stage.awaitingOrder.receipts.label` | 注文明細のスクリーンショット (1枚以上) |
| 리뷰 대기 헤딩 | `application.stage.awaitingReview.heading` | レビューの投稿をお願いいたします |
| 리뷰 대기 안내 | `application.stage.awaitingReview.description` | 各プラットフォームでレビューを投稿後、URLとスクリーンショットをご提出ください |
| 리뷰 URL 라벨 | `application.stage.awaitingReview.url.label` | レビューURL |
| 리뷰 스크린샷 라벨 | `application.stage.awaitingReview.screenshots.label` | レビューのスクリーンショット (2枚以上) |
| 마감 D-day 포맷 | `application.stage.awaitingReview.deadlineDays` | 投稿期限まであと{days}日 |
| 리뷰 심사 중 안내 | `application.stage.reviewPending.description` | 提出いただいたレビューを審査中です |
| 리뷰 반려 헤딩 | `application.stage.reviewRejected.heading` | レビューの再提出をお願いいたします |
| 리뷰 반려 사유 라벨 | `application.stage.reviewRejected.reasonLabel` | 修正の理由 |
| 리뷰 반려 재제출 안내 | `application.stage.reviewRejected.description` | ガイドラインに沿ってレビューを修正し、URLとスクリーンショットを再度ご提出ください |
| 정산 진행 안내 | `application.stage.reviewing.description` | 精算処理中です |
| 정산 완료 안내 | `application.stage.settled.description` | 精算が完了しました |
| 상품 URL | `campaign.detail.productUrl` | 商品ページ |
| 예상 정산액 | `campaign.detail.expectedSettlement` | 予定精算金額 |
| 카테고리 뱃지 | `campaign.category.sns` / `campaign.category.fakePurchase` | SNS / 買取レビュー |
| 서브타입 뱃지 | `subType.qoo10` / `subType.lips` / `subType.atcosme` | Qoo10 / LIPS / @cosme |

**admin-web**: 한국어 하드코딩 (현행 관례 유지).

### 4-5. 파일 업로드

`presignInsightUpload` 를 대체하는 **통합 presign 엔드포인트**:

```
POST /uploads/influencer/attachment/presign
body: { kind, applicationId, contentType, sizeBytes }
→ { objectKey, uploadUrl, viewUrl }
```

- `kind`: `ORDER_RECEIPT | REVIEW_SCREENSHOT | INSIGHT_SCREENSHOT`
- `objectKey` 규칙: `attachments/{applicationId}/{kind}/{uuid}.{ext}`
- 검증: 소유권 (applicationId 가 influencer 소유), kind 유효성 (카테고리와 매치)
- `Attachment` row 는 presign 단계에서 생성하지 않음. `submitOrder` / `submitReview` / `upsertInsight` 트랜잭션에서 서버가 생성

기존 `presignInsightUpload` 는 새 엔드포인트로 대체 후 제거 (내부 API, 하위 호환 불필요).

## §5. 메시지 템플릿

### 5-1. 신규 트리거 8개

| 트리거 | 발송 시점 | 유형 | Seed 기본값 |
|-------|---------|-----|-----------|
| `FAKE_PURCHASE_APPLICATION_APPLIED` | `create()` 성공 | 즉시 | enabled + 초안 |
| `FAKE_PURCHASE_APPLICATION_APPROVED` | `approve()` 성공 | 즉시 | enabled + 초안 |
| `FAKE_PURCHASE_APPLICATION_REJECTED` | `reject()` 성공 | 즉시 | disabled |
| `FAKE_PURCHASE_ORDER_SUBMITTED` | `submitOrder()` 성공 | 즉시 | disabled |
| `FAKE_PURCHASE_REVIEW_SUBMITTED` | `submitReview()` 성공 | 즉시 | disabled |
| `FAKE_PURCHASE_REVIEW_APPROVED` | `approveSubmittedPost()` 카테고리=FAKE_PURCHASE 시 | 즉시 | disabled |
| `FAKE_PURCHASE_REVIEW_REJECTED` | `rejectSubmittedPost()` 카테고리=FAKE_PURCHASE 시 | 즉시 | enabled + 초안 |
| `FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER` | 마감 3/1일 전 크론 | 크론 09:00 JST | enabled + 초안 |
| `FAKE_PURCHASE_SETTLEMENT_COMPLETED` | `completeSettlements()` 시 | 즉시 | enabled + 초안 |
| `FAKE_PURCHASE_CAMPAIGN_COMPLETED` | (자동 종료 시) | 즉시 | disabled |

트리거 총 **10개** (기존 8개 + 리뷰 승인/반려 2개).

### 5-2. 변수 태그

트리거 편집 페이지 우측 태그 패널에 노출:

**재사용 (SNS 공통)**: `influencerName`, `campaignTitle`, `campaignRewardJpy`, `campaignPostingPeriodDays`, `campaignProductSummary`, `remainingDays` (REVIEW_DEADLINE_REMINDER 전용), `rejectReason` (REVIEW_REJECTED 전용)

**신규 (가구매 전용)**:

| key | 라벨 | 설명 | resolver |
|-----|-----|-----|---------|
| `subType` | 서브타입 | 신청한 플랫폼 라벨 (Qoo10 / LIPS / @cosme) | subType 라벨 매핑 |
| `productPriceJpy` | 상품가격(엔) | 서브타입별 상품가격 (쉼표 포맷) | `formatJpy(recruit.productPriceJpy)` |
| `productUrl` | 상품 URL | 서브타입별 상품 페이지 링크 | `recruit.productUrl` |
| `totalSettlementJpy` | 정산 예상액(엔) | 보수 + 상품가격 합계 | `formatJpy(campaign.rewardJpy + recruit.productPriceJpy)` |
| `orderNumber` | 주문번호 | 인플루언서 제출 주문번호 | `application.orderNumber` |
| `orderSubmittedDate` | 주문 제출일 | JST 月日 포맷 | `formatJstMonthDay(application.orderSubmittedAt)` |
| `reviewDeadline` | 리뷰 마감일 | `orderSubmittedAt + postingPeriodDays` JST 月日 | 계산 + 포맷 |
| `reviewUrl` | 리뷰 URL | 제출된 리뷰 URL | `post.url` |

### 5-3. TRIGGER_META 노출 매핑

| 트리거 | 노출 변수 |
|-------|---------|
| APPLICATION_APPLIED / APPROVED | 재사용 기본 + subType, productPriceJpy, productUrl, totalSettlementJpy |
| APPLICATION_REJECTED | 재사용 기본 |
| ORDER_SUBMITTED | 재사용 기본 + subType + orderNumber + orderSubmittedDate + reviewDeadline |
| REVIEW_DEADLINE_REMINDER | 재사용 기본 + subType + reviewDeadline + remainingDays |
| REVIEW_SUBMITTED | 재사용 기본 + subType + reviewUrl |
| REVIEW_APPROVED | 재사용 기본 + subType + reviewUrl + totalSettlementJpy |
| REVIEW_REJECTED | 재사용 기본 + subType + reviewUrl + rejectReason |
| SETTLEMENT_COMPLETED | 재사용 기본 + subType + totalSettlementJpy |
| CAMPAIGN_COMPLETED | 재사용 기본 |

### 5-4. DispatchContext 확장

recruit 정보 접근을 위해 컨텍스트에 `recruit?: CampaignRecruit | null` 추가.

`LineDispatcherService.dispatch()` 진입 시 카테고리 확인 후 해당 subType 의 recruit 조회하여 컨텍스트에 삽입.

### 5-5. Seed

10개 트리거 × 3 subType (QOO10, LIPS, ATCOSME) = **30 row** 추가.
- REVIEW_DEADLINE_REMINDER, APPLICATION_APPLIED, APPLICATION_APPROVED, REVIEW_REJECTED, SETTLEMENT_COMPLETED: `enabled=true` + 일본어 초안 body
- 나머지 5개: `enabled=false, body=""`

기존 30개 SNS row 는 `update: {}` 로 보존.

## §6. 마이그레이션 전략

### 6-1. 단계별 마이그레이션

**M1. Enum 변경**
- `SnsType` 을 `CampaignSubType` 으로 rename (Postgres `ALTER TYPE ... RENAME TO`)
- `CampaignSubType` 에 QOO10, LIPS, ATCOSME 추가
- `ApplicationStatus` 에 ORDER_SUBMITTED, REVIEW_SUBMITTED 추가
- `LineTriggerSubType` 에 QOO10, LIPS, ATCOSME 추가
- `LineTriggerKey` 에 FAKE_PURCHASE_* 8개 추가
- 신규 enum `AttachmentKind` 생성

Prisma가 enum rename 을 감지 못할 수 있어 마이그레이션 SQL 편집 필요.

**M2. Campaign / Recruit / Application 컬럼 추가**
- `Campaign.category` NOT NULL default `SNS` (기존 row 전부 SNS 로 백필)
- `CampaignSnsRecruit`: `productPriceJpy Int?`, `productUrl String?` 추가
- `CampaignApplication`: `orderNumber String?`, `orderSubmittedAt DateTime?`, `reviewSubmittedAt DateTime?` 추가

**M3. 필드/모델/컬럼 rename**
- Prisma 모델 `CampaignSnsRecruit` → `CampaignRecruit` (`@@map("campaign_recruits")` — 테이블명도 변경)
- 컬럼 `sns_type` → `sub_type` (3개 테이블)
- 테이블 `campaign_sns_recruits` → `campaign_recruits`

**M4. Attachment 통합**
- 테이블 `submitted_post_attachments` → `attachments`
- 컬럼 추가: `kind AttachmentKind`, `application_id String?`
- 컬럼 변경: `post_id` NOT NULL → NULL 허용
- 백필:
  - `kind = 'INSIGHT_SCREENSHOT'` (기존 row 전부)
  - `application_id = (SELECT application_id FROM submitted_posts WHERE id = post_id)` — 후 NOT NULL 강제

**M5. Settlement 확장**
- 컬럼 추가: `reward_amount_jpy Int default 0`, `product_refund_jpy Int default 0`
- 백필: `reward_amount_jpy = amount_jpy` (기존 SNS row 전부)

**M6. 시드**
- `seed:line-templates` 재실행 → FAKE_PURCHASE 24 row 추가

**M7. 인덱스**
- `Attachment` 인덱스: `(applicationId, kind)`, `(postId, kind)`

### 6-2. 코드 변경 순서

1. M1~M5 실행 (DB 스키마 준비)
2. Prisma client 재생성
3. 코드 변경 (schema/service/controller/UI 전체) + 배포
4. M6 실행 (seed)
5. M7 인덱스

### 6-3. 리스크

- **enum rename**: Prisma 5+ 지원. 스테이징 전면 회귀 필수. 코드 사용처 전체 (grep `SnsType`, `snsType`) 업데이트 필요
- **테이블 rename**: 원자적 마이그레이션. 앱 배포 순서 중요 (스키마 → 코드)
- **Attachment 통합**: 기존 row 백필 실패 시 앱 400 가능성 → 검증 쿼리 (`SELECT COUNT(*) FROM attachments WHERE application_id IS NULL`) 필수
- **원자성**: M1~M5 는 하나의 배포 사이클에서 완료. 스키마와 코드 사이 불일치 시간 최소화

### 6-4. 롤백 정책

- 스테이징 전면 검증 후 프로덕션 진행
- 프로덕션 롤백 대신 forward-fix 원칙
- 데이터 손실 없는 마이그레이션 (기존 row 는 백필로 SNS 카테고리 유지)

## §7. 테스트 전략

**단위**
- `deriveDisplayStage` 확장 케이스 (가구매 각 stage)
- `ensureSettlementForPost` 카테고리 분기
- Recruit 검증 (SNS/가구매 유효 조합)
- `submitOrder`, `submitReview` 상태 전이/검증

**통합**
- 가구매 전체 흐름 (create → approve → submitOrder → submitReview → complete)
- 카테고리별 액션 가드 (SNS 액션이 가구매 응모에 400 반환)
- 첨부 파일 개수 검증 (order ≥ 1, review ≥ 2)
- Settlement 금액 계산 (reward + product)

**E2E**
- 어드민에서 가구매 캠페인 생성 → 인플루언서 신청 → 승인 → 주문 → 리뷰 → 정산까지
- 리마인더 크론 시뮬레이션 (마감 3일 전 발송 확인)

## §8. 향후 (본 스펙 범위 밖)

- 가구매 캠페인 자동 종료(`CAMPAIGN_COMPLETED`) 로직
- 관리자용 주문/리뷰 검증 워크플로우 (필요 시 후속 스펙)
- FAKE_PURCHASE 서브타입에서 `subType = NULL` 케이스 대비한 partial unique index (현재 요구 없음)
- 인플루언서 프로필의 리뷰 플랫폼 계정 연동
