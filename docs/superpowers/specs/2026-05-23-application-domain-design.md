# Influencer / CampaignApplication Domain — Design Spec

작성일: 2026-05-23
스코프: 인플루언서·캠페인 신청·투고 데이터 모델 구축 + 캠페인 목록 페이지 실데이터 연결 + Application 라이프사이클을 지지하는 최소 API.

선행 spec: `docs/superpowers/specs/2026-05-19-campaign-form-design.md` (Campaign 모델/CRUD).

---

## 1. 목표

1. 인플루언서가 캠페인에 지원하고 → 어드민이 승인 → 상품 배송(운송장→도착) → 인플루언서가 SNS별 투고 링크 제출 → 완료 까지의 도메인을 표현하는 데이터 모델을 만든다.
2. 캠페인 관리 페이지의 카드를 mock에서 실데이터로 전환한다 (브랜드명·기간·보수·SNS·`applied/capacity`).
3. 향후 신청 플로우(인플루언서 가입 사이트 + 어드민 신청 관리 UI)를 위한 API 엔드포인트와 상태 전이 메서드를 미리 깐다.

### 명시적 비범위

- 인플루언서 자기 가입(인증, 비밀번호) — 추후 client-web 작업.
- Applicants / Drafts / Monitoring 어드민 페이지 UI — 본 spec에서는 mock 유지. 다음 작업.
- `User → AdminUser` 리네임 — 별도 PR.
- 캠페인 상태(`recruit/review/progress/done`) 자동 갱신 — 본 spec에서는 도입하지 않음. 카드 표시는 모집기간/완료 등으로 derive (§4 참조).

---

## 2. 데이터 모델

### 2.1 ER 개요

```
Influencer 1 ── N InfluencerSnsAccount
Influencer 1 ── N CampaignApplication N ── 1 Campaign
                       │ 1
                       │ N
                  SubmittedPost
```

### 2.2 Prisma 스키마 변경 (`apps/api/prisma/schema.prisma`)

```prisma
model Influencer {
  id        String   @id @default(cuid())
  name      String
  email     String?  @unique           // 가입 사이트 생기면 NOT NULL로 마이그레이션
  phone     String?
  memo      String?                    // 어드민용 자유 메모
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  snsAccounts  InfluencerSnsAccount[]
  applications CampaignApplication[]

  @@map("influencers")
}

model InfluencerSnsAccount {
  id            String   @id @default(cuid())
  influencerId  String
  snsType       SnsType
  handle        String
  followerCount Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  influencer Influencer @relation(fields: [influencerId], references: [id], onDelete: Cascade)

  @@unique([influencerId, snsType])
  @@map("influencer_sns_accounts")
}

enum SnsType {
  INSTAGRAM
  TIKTOK
  X
  YOUTUBE
}

enum ApplicationStatus {
  APPLIED
  REJECTED
  APPROVED
  SHIPPED
  DELIVERED
  COMPLETED
  CANCELLED
}

model CampaignApplication {
  id            String            @id @default(cuid())
  campaignId    String
  influencerId  String
  status        ApplicationStatus @default(APPLIED)

  appliedAt     DateTime  @default(now())
  reviewedAt    DateTime?
  reviewedById  String?           // AdminUser(User).id — FK는 보류, 식별자만
  rejectReason  String?

  trackingNumber String?
  shippedAt      DateTime?
  deliveredAt    DateTime?
  completedAt    DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  campaign   Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  influencer Influencer @relation(fields: [influencerId], references: [id], onDelete: Restrict)
  posts      SubmittedPost[]

  @@unique([campaignId, influencerId])
  @@index([campaignId, status])
  @@index([influencerId, status])
  @@map("campaign_applications")
}

model SubmittedPost {
  id            String   @id @default(cuid())
  applicationId String
  snsType       SnsType
  url           String
  submittedAt   DateTime @default(now())
  updatedAt     DateTime @updatedAt

  application CampaignApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, snsType])
  @@index([applicationId])
  @@map("submitted_posts")
}
```

### 2.3 기존 Campaign 모델 보완

`Campaign.snsTypes`는 현재 `String[]`. 본 spec에서는 그대로 유지하되, **Prisma `SnsType` enum**을 새로 도입하면서 `snsTypes`를 `SnsType[]`로 변경한다. 이미 저장된 string 값(`"INSTAGRAM"` 등)이 enum 값과 동일하므로 Postgres `USING` 절로 안전하게 변환 가능.

또한 `Campaign`에 역참조 관계 추가:

```prisma
model Campaign {
  // ... 기존 필드 그대로 ...
  snsTypes     SnsType[]   // String[] → SnsType[] 로 변경
  applications CampaignApplication[]
}
```

### 2.4 데이터 무결성 룰

- **CampaignApplication.influencer × campaign** 유니크 — 같은 인플루언서가 같은 캠페인에 중복 지원 불가.
- **SubmittedPost.application × snsType** 유니크 — 신청당 SNS별 1건. 재제출은 upsert (덮어쓰기).
- **SubmittedPost.snsType** 는 해당 캠페인의 `snsTypes` 부분집합이어야 한다 → DB 제약이 아닌 **서비스 레이어**에서 검증 (cross-table 검사).
- **CampaignApplication.influencer**의 onDelete는 Restrict — 신청 이력이 있는 인플루언서는 삭제 불가.

---

## 3. 상태 전이 규칙

라이프사이클은 단방향에 가깝다. 서비스 메서드만 다음 전이를 허용한다:

```
APPLIED ─────► APPROVED ────► SHIPPED ────► DELIVERED ────► COMPLETED
   │              │                                            ▲
   ├──► REJECTED  ▼                                            │
   │           CANCELLED ◄──── (모든 단계에서 가능, COMPLETED 제외)
   └──► CANCELLED
```

서비스 메서드 (NestJS `CampaignApplicationsService`):

| 메서드 | 허용 from | to | 부수효과 |
|---|---|---|---|
| `create(campaignId, influencerId)` | (신규) | `APPLIED` | `appliedAt = now()` |
| `approve(id, reviewerId)` | `APPLIED` | `APPROVED` | `reviewedAt`, `reviewedById` |
| `reject(id, reviewerId, reason)` | `APPLIED` | `REJECTED` | `reviewedAt`, `reviewedById`, `rejectReason` |
| `markShipped(id, trackingNumber)` | `APPROVED` | `SHIPPED` | `trackingNumber`, `shippedAt` |
| `markDelivered(id)` | `SHIPPED` | `DELIVERED` | `deliveredAt` |
| `complete(id)` | `DELIVERED` | `COMPLETED` | `completedAt` |
| `cancel(id, reason?)` | `APPLIED`, `APPROVED`, `SHIPPED`, `DELIVERED` | `CANCELLED` | — |
| `upsertPost(id, snsType, url)` | `DELIVERED` only | (상태 유지) | `SubmittedPost` upsert |

허용되지 않는 전이 요청은 `BadRequestException("Invalid state transition")`.

`upsertPost`는 추가 검증: `snsType ∈ campaign.snsTypes`. 위반 시 `BadRequestException`.

---

## 4. 캠페인 목록 페이지 실데이터 연결

### 4.1 API: `GET /campaigns`

`apps/api/src/campaigns/campaigns.controller.ts`에 목록 엔드포인트 추가.

쿼리 파라미터:
- `q?: string` — 제목 부분 일치(대소문자 무시)
- `status?: "recruit" | "review" | "progress" | "done"` — derive 기반 필터 (§4.2)

응답:
```ts
CampaignListResponseSchema = z.object({
  campaigns: z.array(
    CampaignResponseSchema.extend({
      appliedCount: z.number().int().nonnegative(),
      derivedStatus: z.enum(["recruit", "review", "progress", "done"]),
    })
  ),
});
```

`appliedCount`는 `COUNT(*) WHERE campaignId=X AND status IN (APPROVED, SHIPPED, DELIVERED, COMPLETED)` — 즉 어드민이 승인한 자리만 "찬 자리"로 본다. APPLIED/REJECTED/CANCELLED는 제외.

### 4.2 `derivedStatus` 정의

캠페인 status는 DB 컬럼이 아니라 다음 규칙으로 계산:

- `now < recruitStartAt` → `recruit` (모집 예정도 일단 recruit로 묶음 — 본 spec에서 분리하지 않음)
- `recruitStartAt ≤ now ≤ recruitEndAt` AND `appliedCount < recruitCount` → `recruit`
- `recruitStartAt ≤ now ≤ recruitEndAt` AND `appliedCount ≥ recruitCount` → `review`
- `now > recruitEndAt` AND 모든 application status가 `COMPLETED`/`REJECTED`/`CANCELLED` → `done`
- 그 외 `now > recruitEndAt` → `progress`

(이 derive 규칙은 본 spec에서 한 번 박고, 추후 실 운영 데이터로 다듬을 여지 있음. §9 참조)

### 4.3 프런트 변경

`apps/admin-web/src/pages/Campaigns/index.tsx`:
- 현재 하드코딩 `CAMPAIGNS` 배열 제거.
- `useEffect`로 `GET /campaigns?q=…&status=…` 호출, 디바운스된 검색어/필터 변경 시 재호출.
- `Campaign` 카드 타입을 `CampaignListItem` (응답 한 건)에 매핑.
- 진행률 표시는 `appliedCount/recruitCount`. 보수는 `¥{rewardJpy.toLocaleString()}円`. 기간은 `recruitStartDate ~ recruitEndDate`.
- 빈 상태/로딩/에러 표시.
- 기존 mock 전용 필드(`brand`, `thumbIcon`, `dday`) 제거. 브랜드 컬럼은 본 spec 범위 외(브랜드 모델 미정) → 임시로 캠페인 제목만 카드 헤더에 노출. dday는 `recruitEndDate - today`로 derive.

### 4.4 시드(seed) 옵션

목록 페이지 동작 확인용으로 캠페인 2~3건 + 인플루언서 2건 + 신청 2건을 박는 `apps/api/prisma/seed.ts`를 추가(옵션). 사용자가 dev에서 `pnpm --filter @jsure/api exec prisma db seed` 호출.

---

## 5. API 엔드포인트 (Phase 1 최소 표면)

| 메서드 | 경로 | 용도 | 가드 |
|---|---|---|---|
| GET | `/campaigns` | 목록 (검색/필터/applied 카운트 포함) | Jwt |
| GET | `/campaigns/:id` | 단건 (기존, 변경 없음) | Jwt |
| POST | `/campaigns` | 생성 (기존) | Jwt |
| PATCH | `/campaigns/:id` | 수정 (기존) | Jwt |
| GET | `/influencers` | 어드민 인플루언서 목록 (페이지네이션 X, MVP는 전체) | Jwt |
| POST | `/influencers` | 어드민이 인플루언서 수동 등록 (SNS 계정 동시 입력 허용) | Jwt |
| GET | `/influencers/:id` | 단건 + SNS 계정 | Jwt |
| PATCH | `/influencers/:id` | 정보 수정 (SNS 계정은 별도 endpoint or 동일 payload?) | Jwt |
| POST | `/campaign-applications` | 신청 생성 (어드민이 대신 만드는 MVP — 가입 사이트 나오면 인플루언서 본인이 호출) | Jwt |
| POST | `/campaign-applications/:id/approve` | 승인 | Jwt |
| POST | `/campaign-applications/:id/reject` | 반려 (`reason` 필수) | Jwt |
| POST | `/campaign-applications/:id/ship` | 운송장 등록 (`trackingNumber` 필수) | Jwt |
| POST | `/campaign-applications/:id/deliver` | 도착 처리 | Jwt |
| POST | `/campaign-applications/:id/complete` | 완료 처리 | Jwt |
| POST | `/campaign-applications/:id/cancel` | 취소 | Jwt |
| PUT  | `/campaign-applications/:id/posts/:snsType` | 투고 링크 upsert | Jwt |
| GET  | `/campaign-applications` | 어드민 목록 (필터: `campaignId`, `status`) | Jwt |

(어드민 UI는 다음 spec에서 만들지만, 엔드포인트는 본 spec에서 미리 만든다 — 그래야 통합 테스트와 향후 작업이 매끄러움.)

### 5.1 shared zod 스키마 (`packages/shared/src/types/`)

새 파일:
- `influencer.ts` — `SnsTypeSchema`(기존 campaign.ts에 있음 — 재사용), `InfluencerSnsAccountSchema`, `InfluencerSchema`, `CreateInfluencerRequestSchema` (이름+이메일+선택적 SNS 계정 배열), `UpdateInfluencerRequestSchema`.
- `application.ts` — `ApplicationStatusSchema`, `CampaignApplicationSchema` (관계 포함), `CreateApplicationRequestSchema`, `RejectRequestSchema`, `ShipRequestSchema`, `SubmitPostRequestSchema`, `ListApplicationsQuerySchema`.
- `campaign.ts` 확장 — `CampaignListItemSchema = CampaignResponseSchema.extend({ appliedCount, derivedStatus })`, `CampaignListResponseSchema`, `ListCampaignsQuerySchema`.

`SnsTypeSchema`는 기존 `packages/shared/src/types/campaign.ts`의 enum을 그대로 사용 (Prisma enum 이름과 값 일치).

---

## 6. 백엔드 구조

새 NestJS 모듈:
- `apps/api/src/influencers/` (controller, service, module)
- `apps/api/src/campaign-applications/` (controller, service, module)

기존 `campaigns` 모듈:
- `campaigns.service.ts`에 `list(query)` 추가 — `derivedStatus` 계산 + `appliedCount` 집계는 service에서 수행. Postgres에서 `COUNT(*) FILTER (WHERE status IN ...)` 사용 시 raw query 필요할 수 있음 → 1차 구현은 `prisma.campaign.findMany` + 각 row마다 `prisma.campaignApplication.count` 호출(N+1이지만 MVP 트래픽엔 충분). 후속 최적화는 별도 작업.

`AppModule` imports에 두 새 모듈 추가.

---

## 7. 에러 / 검증 / 보안

- 모든 mutation은 `ZodValidationPipe(<schema>)`.
- 상태 전이 검증은 서비스 레이어 — 실패는 `BadRequestException`.
- `SubmittedPost.url`은 zod `.url()` 검증.
- `trackingNumber`는 zod 정규식 없이 `string().min(1).max(64)` — 운송사별 포맷 차이 큼.
- `reviewedById`는 가드의 `req.user.id`에서 채움 (컨트롤러 인자가 아닌 `@Req()`).
- 응답은 Prisma row 그대로 노출 금지 → service가 shared 응답 스키마 모양으로 매핑.

---

## 8. 테스트

- `apps/api/src/campaigns/campaigns.service.spec.ts`에 `derivedStatus` 룰 단위 테스트 케이스 추가 (5가지 시나리오).
- `apps/api/src/campaign-applications/campaign-applications.service.spec.ts` 신규 — 상태 전이 메서드 각각의 허용/거절 케이스 (mock된 PrismaService).
- 인플루언서 도메인은 단순 CRUD라 단위 테스트 생략 (수동 검증).

---

## 9. 미해결 / 후속

- `derivedStatus` 룰의 운영 적합성 — 실데이터로 다듬을 여지.
- `Campaign` 상태를 DB 컬럼화 할지 (성능/필터링 단순화) vs derive 유지.
- 인플루언서 정렬/페이지네이션 — 현재 전체 반환. 200건 넘기 전에 추가.
- `applied`/`appliedCount` 캐싱 컬럼 — 트래픽 보고 결정.
- Applicants/Drafts/Monitoring 어드민 UI — 다음 spec.
- `User → AdminUser` 리네임 — 별도 PR (이 spec과 독립).
