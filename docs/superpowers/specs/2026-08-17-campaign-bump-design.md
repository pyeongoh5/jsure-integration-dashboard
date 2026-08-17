# 캠페인 끌어올리기(bump) 설계

2026-08-17

## 배경

유저(client-web) 캠페인 목록 정렬은 현재 **[상태 그룹(모집중→개시전→정원충족→종료)] → [createdAt desc]** 다.
(`apps/api/src/influencer-campaigns/influencer-campaigns.service.ts:121,161`)

생성된 지 오래됐지만 지원이 저조한 캠페인을 다시 상단에 노출할 방법이 없다.
`updatedAt`은 `@updatedAt`이라 일반 수정에도 갱신되므로 정렬 기준으로 쓸 수 없다.

## 결정

**일회성 끌어올리기.** 중고거래 앱 방식: 끌어올린 시점 기준으로 목록 맨 위로 가고,
이후 새 캠페인이 생기거나 다른 캠페인이 끌어올려지면 자연스럽게 다시 밀려난다.
고정(핀)이나 순서 직접 관리(sortOrder)는 하지 않는다.

## 설계

### 1. DB (Prisma)

`Campaign` 모델에 컬럼 추가:

```prisma
bumpedAt DateTime @default(now()) @map("bumped_at")
```

- non-null. 신규 캠페인은 생성 시각 = bumpedAt이라 기존 정렬과 동일하게 동작.
- 마이그레이션은 수동 작성 컨벤션(타임스탬프 디렉토리명 + 한국어 주석) 따름:

```sql
-- 캠페인 끌어올리기용 bumped_at 컬럼 추가. 기존 행은 created_at 으로 백필.
ALTER TABLE "campaigns" ADD COLUMN "bumped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "campaigns" SET "bumped_at" = "created_at";
```

- 인덱스는 추가하지 않음 (캠페인 수가 작아 불필요).

### 2. API

- `PATCH /campaigns/:id/bump` 추가 — 기존 close/hide 액션 엔드포인트와 같은 패턴
  (`apps/api/src/campaigns/campaigns.controller.ts`).
  동작: 해당 캠페인의 `bumpedAt = now()` 갱신. 삭제된 캠페인이면 404 (기존 액션과 동일한 한국어 예외 메시지).
- 유저 목록 정렬 변경: `influencer-campaigns.service.ts:121`의
  `orderBy: [{ createdAt: "desc" }]` → `orderBy: [{ bumpedAt: "desc" }]`.
  상태 그룹 정렬(`listSortRank`)은 그대로 유지 — 끌어올려도 종료 캠페인이 모집중 위로 올라가지 않는다.
- 어드민 목록 정렬(`campaigns.service.ts:743-761`)은 현행(createdAt desc) 유지.
- NEW 배지는 지금처럼 `createdAt` 기준 유지 — 끌어올려도 신규로 위장되지 않는다.

### 3. admin-web

- `domains/campaign/api.ts`에 `bumpCampaign(campaignId)` 추가.
- `CampaignActionsMenu.tsx`에 "끌어올리기" 메뉴 항목 추가.
- 확인 다이얼로그는 액션별 개별 컴포넌트 컨벤션에 따라 `BumpCampaignDialog` 신규 작성.
- 성공 시 캠페인 목록 쿼리 무효화(기존 액션과 동일).

### 4. client-web

변경 없음. 서버가 내려주는 순서를 그대로 렌더한다.

## 하지 않는 것 (YAGNI)

- 고정(핀), 순서 직접 관리, 끌어올리기 횟수 제한/이력, 정렬용 인덱스.

## 테스트

- API: bump 후 `bumpedAt`이 갱신되고 유저 목록에서 같은 상태 그룹 내 최상단에 오는지.
- 신규 생성 캠페인의 기본 정렬이 기존과 동일한지(bumpedAt = 생성 시각).
