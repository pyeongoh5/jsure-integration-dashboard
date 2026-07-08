# 가구매 캠페인 단일 트랙 재설계 (2026-07-08)

## 배경

Plan A/B/C 는 가구매 카테고리를 SNS 처럼 서브타입(QOO10/LIPS/ATCOSME) 병렬로 다뤘다. 실제 요구사항은 다르다:

- 가구매는 **QOO10 에서만 구매** 하는 단일 트랙
- LIPS / @cosme 는 **추가 리뷰 채널** 로, 캠페인이 요구할 때만 URL 로 제출

즉 응모 1건 = QOO10 필수 + (선택적으로) 추가 채널 리뷰. 승인/반려도 응모 단위 통합.

서비스가 아직 오픈 전이라 기존 FAKE_PURCHASE 데이터는 파괴적으로 정리해도 무방하다.

## 요구사항 요약

- FAKE_PURCHASE 카테고리 캠페인의 서브타입은 **QOO10 하나**로 고정
- CampaignRecruit 은 QOO10 recruit 1개만 존재 (`productPriceJpy`, `productUrl`, `recruitCount`)
- 그 recruit 이 **`subTypeOptions: String[]`** 필드로 추가 리뷰 채널 요구를 표현 (`[]`, `["LIPS"]`, `["ATCOSME"]`, `["LIPS", "ATCOSME"]`)
- 기존 `instagramPostTypes` 는 같은 컬럼(`subTypeOptions`) 으로 통합 — INSTAGRAM recruit 은 `["FEED", "REELS"]` 등
- 인플루언서 응모 시 `CampaignApplication.subType = "QOO10"` 강제
- 리뷰 제출은 **QOO10 이미지 ≥ 2장 + 요구 채널별 URL** 통합 제출
- 어드민 승인/반려는 응모 단위 (채널 개별 판정 없음)

## §1. 데이터 모델

### 1-1. Enum 변경

- `CampaignSubType`: `INSTAGRAM | TIKTOK | X | YOUTUBE | QOO10` (LIPS, ATCOSME 삭제)
- `LineTriggerSubType`: `INSTAGRAM | X | QOO10` (LIPS, ATCOSME 삭제)
- `LineTriggerKey`: 변경 없음. 기존 FAKE_PURCHASE_* 10 종 유지

### 1-2. CampaignRecruit

| 필드 | 변경 | 설명 |
|---|---|---|
| `subType` | 유지 | CampaignSubType |
| `recruitCount` | 유지 | |
| `minFollowers` | 유지 | SNS 만 사용, QOO10 은 0 |
| `insightRequired` | 유지 | SNS 만 사용, QOO10 은 false |
| `productPriceJpy` | 유지 | QOO10 recruit 에 필수 |
| `productUrl` | 유지 | QOO10 recruit 에 필수 |
| ~~`instagramPostTypes`~~ | **삭제 → rename** | `subTypeOptions` 로 이관 |
| **`subTypeOptions`** | **신규 (rename)** | `String[]` — INSTAGRAM: `["FEED", "REELS"]` 등 / QOO10: `["LIPS"?, "ATCOSME"?]` / 기타: `[]` |

값 검증 (Zod / 서비스):
- SNS INSTAGRAM: `subTypeOptions` ⊆ `{FEED, REELS}` (기존 InstagramPostType)
- SNS 기타: `subTypeOptions = []`
- FAKE_PURCHASE QOO10: `subTypeOptions` ⊆ `{LIPS, ATCOSME}`

### 1-3. CampaignApplication

- `subType`: FAKE_PURCHASE 응모 시 `"QOO10"` 강제 (서비스 create 에서 payload 무시하고 세팅)
- `instagramPostType`: INSTAGRAM 응모에만 유효 (기존)
- `orderNumber`, `orderSubmittedAt`, `reviewSubmittedAt`: 기존

### 1-4. SubmittedPost

| 필드 | 변경 | 설명 |
|---|---|---|
| `url` | **nullable** | QOO10 는 이미지 기반이라 없음 |
| `subType` | 유지 | FAKE_PURCHASE 는 항상 QOO10 |
| **`submissionData: Json?`** | **신규** | 서브타입/카테고리별 부가 제출 데이터. FAKE_PURCHASE 예: `{ "reviewUrls": { "LIPS": "https://...", "ATCOSME": "https://..." } }` |

### 1-5. Attachment / Settlement

변경 없음. Attachment 는 `kind=REVIEW_SCREENSHOT` 로 QOO10 이미지 계속 저장. Settlement 는 `rewardJpy + productPriceJpy` (QOO10 recruit) 로 계산.

### 1-6. LineMessageTemplate

- 기존 시드된 subType IN ('LIPS','ATCOSME') row 20 개 삭제
- FAKE_PURCHASE_* 트리거 × QOO10 = 10 row 만 남음

## §2. 프로세스

### 2-1. 상태 전이

기존 그대로:
```
APPLIED → APPROVED → ORDER_SUBMITTED → REVIEW_SUBMITTED → (APPROVED/REJECTED) → COMPLETED
```

displayStage 4 종 (`AWAITING_ORDER`, `AWAITING_REVIEW`, `REVIEW_PENDING`, `REVIEW_REJECTED`) 유지.

### 2-2. 응모 (create)

- FAKE_PURCHASE 캠페인 응모 요청에서 `subTypes` 필드는 무시 (또는 클라이언트가 아예 안 보냄)
- 서버는 항상 `subType = "QOO10"` 로 신청 1건 생성
- 팔로워/allowed subType 검증 스킵 (기존 로직 유지)
- dispatch: `FAKE_PURCHASE_APPLICATION_APPLIED`

### 2-3. 주문 (submitOrder)

변경 없음.

### 2-4. 리뷰 제출 (submitReview) — **재작성**

요청:
```ts
type SubmitReviewRequest = {
  screenshots: AttachmentUploadInput[]; // 2..10 장
  reviewUrls: Partial<Record<"LIPS" | "ATCOSME", string>>;
};
```

검증 (서비스):
1. 카테고리 = FAKE_PURCHASE
2. 상태 = ORDER_SUBMITTED (첫 제출) 또는 REVIEW_SUBMITTED + 마지막 리뷰 REJECTED (재제출)
3. `screenshots.length >= 2`
4. QOO10 recruit 의 `subTypeOptions` 로부터 요구 채널 집합 계산. 각 채널에 대해:
   - `reviewUrls[channel]` 존재 + trim() ≥ 1 + `https://` 시작
5. `reviewUrls` 에 있지만 recruit 이 요구하지 않은 채널은 400 (`REVIEW_URL_NOT_REQUESTED` 등)

저장 (트랜잭션):
- 첫 제출: `submittedPost.create({ subType: "QOO10", url: null, submissionData: { reviewUrls }, reviewStatus: "PENDING" })`
- 재제출: 기존 `submittedPost.update({ submissionData: { reviewUrls }, reviewStatus: "PENDING", reviewedAt: null, reviewedById: null })` + 기존 attachment.deleteMany(kind=REVIEW_SCREENSHOT)
- attachment.createMany (kind=REVIEW_SCREENSHOT, postId)
- application.update(status=REVIEW_SUBMITTED, reviewSubmittedAt)

dispatch: `FAKE_PURCHASE_REVIEW_SUBMITTED`.

### 2-5. 어드민 승인/반려

기존 로직 유지. 통합 승인/반려. dispatch: `FAKE_PURCHASE_REVIEW_APPROVED` / `FAKE_PURCHASE_REVIEW_REJECTED`.

### 2-6. 정산

변경 없음. QOO10 recruit 의 productPriceJpy 사용.

## §3. UI

### 3-1. admin-web CampaignForm

- 기존 `.snsRow`/카드 구조 재사용
- FAKE_PURCHASE 카테고리 선택 시:
  - QOO10 recruit 카드 1개 강제 (체크박스로 붙였다 뗐다 하지 않음)
  - 필드: `recruitCount`, `productPriceJpy`, `productUrl`
  - **`subTypeOptions` 체크박스**: LIPS / @cosme (0-2 선택)
- INSTAGRAM recruit 의 기존 `instagramPostTypes` 체크박스는 필드 이름만 `subTypeOptions` 로 변경 (UI 동일)

### 3-2. admin-web Applicants / Drafts

- 매체 컬럼: FAKE_PURCHASE 응모는 **QOO10 pill 만** (LIPS/@cosme pill 없음)
- Drafts 상세 다이얼로그(`InsightDetailDialog`):
  - QOO10 스크린샷 그리드 (기존)
  - 신규 섹션 "추가 리뷰 URL": `submissionData.reviewUrls` 를 라벨(LIPS/@cosme) + 링크로 나열. 없으면 섹션 숨김
- 메시지 템플릿 관리 페이지: FAKE_PURCHASE 카테고리 선택 시 서브타입 라디오는 **QOO10 만** 노출

### 3-3. client-web Browse / CampaignDetail

- Browse: FAKE_PURCHASE 카드는 QOO10 아이콘/라벨만
- CampaignDetail: recruits 렌더 QOO10 1개. 상품가격/상품URL/예상 정산액 표시. `subTypeOptions` 에 값이 있으면 안내 문구 추가 — 예: "リビューチャンネル: Qoo10 + LIPS + @cosme"

### 3-4. client-web Apply

- FAKE_PURCHASE 는 subType 선택 체크박스 완전 숨김
- QOO10 자동 응모 (payload 에 subTypes 를 보내지 않거나 서버가 무시)
- 팔로워 조건 스킵
- INSIGHTS 동의 숨김 (기존)

### 3-5. client-web ReviewSubmitForm

- 폼 필드:
  - QOO10 스크린샷 (2-10 장)
  - recruit.subTypeOptions 에 있는 채널 각각에 대해 URL 입력 (필수, https)
- 제출:
  ```ts
  { screenshots: [...], reviewUrls: { LIPS: "...", ATCOSME: "..." } }
  ```

### 3-6. i18n (client-web)

- 신규 키:
  - `application.stage.awaitingReview.channelUrlLabel`: `"{channel} リビューURL"` (channel 은 dot-path 대신 prefix/suffix)
  - `campaign.detail.reviewChannels`: `"リビューチャンネル"`
- 기존 `awaitingReview` 설명 문구 QOO10 이미지 중심으로 갱신 (2장 이상 + 추가 URL)

## §4. 마이그레이션

Prisma 마이그레이션 1개 (`YYYYMMDDHHMMSS_fake_purchase_single_track`):

```sql
-- 1) FAKE_PURCHASE 관련 dead data 정리
DELETE FROM attachments WHERE application_id IN (
  SELECT id FROM campaign_applications WHERE sub_type IN ('LIPS','ATCOSME')
);
DELETE FROM submitted_posts WHERE sub_type IN ('LIPS','ATCOSME');
DELETE FROM campaign_applications WHERE sub_type IN ('LIPS','ATCOSME');
DELETE FROM campaign_recruits WHERE sub_type IN ('LIPS','ATCOSME');
DELETE FROM line_message_templates WHERE sub_type IN ('LIPS','ATCOSME');

-- 2) enum 축소 (PostgreSQL: rename-old, create-new, alter-column, drop-old)
--    CampaignSubType 에서 LIPS/ATCOSME 제거, LineTriggerSubType 도 동일

-- 3) CampaignRecruit 컬럼 rename
ALTER TABLE campaign_recruits RENAME COLUMN instagram_post_types TO sub_type_options;

-- 4) SubmittedPost 신규 필드 + url nullable
ALTER TABLE submitted_posts ADD COLUMN submission_data JSONB;
ALTER TABLE submitted_posts ALTER COLUMN url DROP NOT NULL;
```

시드 재실행: `line-templates.seed.ts` 에서 LIPS/ATCOSME 서브타입 루프 삭제 후 실행. QOO10 templates 10 row 만 upsert.

## §5. 테스트 전략

- `campaigns.service.spec.ts`: FAKE_PURCHASE recruit 검증 (subType=QOO10 강제, subTypeOptions ⊆ {LIPS, ATCOSME}, 기타 SNS 는 기존 검증 유지)
- `influencer-applications.service.spec.ts`:
  - submitOrder: 기존 유지
  - submitReview: 
    - screenshots ≥ 2
    - reviewUrls 요구 채널 누락 → 400
    - reviewUrls 초과 채널(요구되지 않음) → 400
    - 재제출: 기존 attachment/submissionData 초기화 후 재생성
- `ensure-settlement.spec.ts`: 기존 유지
- typecheck / build: admin-web / client-web / api 전체 통과

## §6. 향후 (본 스펙 범위 밖)

- 채널별 개별 승인 정책 도입 시 별도 스펙
- QOO10 외 신규 가구매 플랫폼 추가 시 subType enum 확장
- SubmittedPost.submissionData 를 SNS 인사이트 데이터 통합 저장소로 확장하는 리팩터

## 오픈 이슈

- FAKE_PURCHASE 트리거 템플릿 본문에 `subTypeOptions` 를 반영할지 (예: "LIPS/@cosme 도 함께 리뷰해주세요") — 본 스펙에선 문구만 언급, 실제 시드 본문 갱신은 이후 이터레이션
