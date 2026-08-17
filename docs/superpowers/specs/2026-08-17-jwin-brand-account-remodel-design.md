# J-WIN 브랜드 계정 1급 엔티티 승격 · 설계

> 작성일: 2026-08-17 · 브랜치: `j-win`
> 선행: `docs/jwin/MVP_PLAN.md`(Phase 3 완료), `docs/jwin/DECISIONS.md`(D-10 인증, D-11 계약)
> 이 변경은 MVP_PLAN §3.3 탭2("브랜드 연동")의 전제를 바꾼다 — 확정 시 DECISIONS에 **D-13**으로 기록한다.

---

## 1. 배경 · 문제

현재 X 계정 연동은 캠페인과 **1:1로 강결합**돼 있다.

```
BrandXCredential { campaignId @unique ... }   // 캠페인당 토큰 1행
BrandCampaign    { xUserId?, xUsername?, credential BrandXCredential? }
```

이 모델의 한계:

- 한 브랜드 계정으로 캠페인을 여러 번 돌려도 **매번 새로 연동**해야 한다(토큰 행이 캠페인마다 생성됨).
- 토큰 refresh 실패 복구도 캠페인마다 따로 처리해야 한다.
- 연동 링크에 `campaignId`가 박혀 있어, 계정을 "먼저 확보하고 캠페인은 나중에" 하는 실제 운영 순서와 어긋난다.

**결정(운영자 요구)**: 계정 연동은 캠페인의 **전제조건**이지 캠페인과 1:1이 아니다. 브랜드 계정을 독립 엔티티로 승격하고, 캠페인은 그 계정을 **참조**한다(계정 1 : 캠페인 N).

## 2. 목표 · 비목표

**목표**

- `BrandXAccount`를 독립 엔티티로 만들고 한 계정을 여러 캠페인이 재사용.
- 어드민에 `/jwin/accounts` 페이지 신설: 계정 목록·헬스 표시 + 계정 추가 + 재연동.
- 캠페인은 연동 탭에서 **연동된 계정을 드롭다운으로 선택**.
- 토큰 refresh는 계정 단위 — 한 번 복구되면 그 계정을 쓰는 모든 캠페인이 복구.

**비목표(YAGNI — 이번에 안 함)**

- 계정 삭제/연동 해제.
- 계정별 캠페인 목록 그룹 펼침(사용 중 캠페인 **개수**만 표시).
- 어드민 인라인 OAuth(브랜드에게 링크 전달 방식 유지).
- 계정 라벨 이후 수정 UI(생성 시 1회 입력).

## 3. 데이터 모델

```prisma
model BrandXAccount {
  id                    String    @id @default(cuid())
  label                 String    // 운영자용 식별 메모 (예: "코카콜라 재팬 공식")
  xUserId               String?   @unique  // 브랜드 승인 후 채워짐 (계정 정체성)
  xUsername             String?            // @handle (표시용)
  encryptedAccessToken  String?
  encryptedRefreshToken String?
  accessTokenExpiresAt  DateTime?
  scopes                String?
  refreshFailedAt       DateTime?          // 브랜드가 연동 해제/비번 변경 시
  refreshFailCount      Int       @default(0)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  campaigns             BrandCampaign[]
}

model BrandCampaign {
  // ... 기존 필드 유지 ...
  brandAccountId String?
  brandAccount   BrandXAccount? @relation(fields: [brandAccountId], references: [id])
  // 삭제: xUserId, xUsername, credential (전부 계정으로 이동)
}
```

**계정 상태(파생 — DB 컬럼 아님)**

| 상태 | 조건 |
|---|---|
| 대기(pending) | `xUserId == null` (아직 브랜드 승인 전) |
| 연동됨(connected) | `xUserId != null && encryptedAccessToken != null && refreshFailedAt == null` |
| 재연동 필요 | `refreshFailedAt != null` |

토큰 관련 필드가 nullable이 되는 이유: 대기 계정은 label만 있고 토큰이 없다. 스케줄러/게시는 **ACTIVE 캠페인**만 다루고, ACTIVE는 발행 전 체크(연동됨 계정 필수)를 통과해야 하므로 대기 계정이 게시 경로에 도달하지 않는다.

## 4. OAuth 플로우 (브랜드가 링크 승인 — 기존 유지)

- 연동 링크: `{API_BASE_URL}/oauth/brand/start?campaignId=…` → **`?accountId=…`** 로 변경. `state`가 `accountId`를 담는다.
- **계정 추가**(어드민): label 입력 → 대기 계정 row 생성 → 그 계정의 `accountId` 링크 반환 → 운영자가 브랜드에 전달.
- **콜백** `/oauth/brand/callback`:
  1. 토큰 교환 + `GET /users/me` → `xUserId`, `xUsername`.
  2. **중복 방지**: 그 `xUserId`가 이미 **다른** 계정(id ≠ state.accountId)에 있으면 → `WEB_BASE_URL/connect/failed?reason=duplicate`.
  3. 아니면 `accountId` 계정에 `xUserId·xUsername·토큰·scopes` 채우고 `refreshFailedAt=null, refreshFailCount=0`. → `WEB_BASE_URL/connect/done?account={xUsername}` (jwin-web 착지 유지).
- **재연동**: 같은 `accountId` 링크를 다시 전달. 콜백이 같은 계정에 토큰을 덮어쓰고 실패 표시를 클리어 → 그 계정을 쓰는 모든 캠페인 복구.
- 링크에서 `campaignId` 개념 제거. 캠페인↔계정 연결은 어드민에서 드롭다운으로 별도 지정.

## 5. 어드민 API (jwin-api)

**신규**

| 메서드 | 경로 | 용도 |
|---|---|---|
| `GET` | `/admin/brand-accounts` | 계정 목록 + 헬스 + 사용 캠페인 수 + `connectUrl` |
| `POST` | `/admin/brand-accounts` | `{label}` → 대기 계정 생성, `{account, connectUrl}` 반환 |

`GET` 응답 항목: `id, label, xUserId, xUsername, status(대기/연동됨/재연동필요 파생), refreshFailCount, accessTokenExpiresAt, campaignCount, connectUrl`.
재연동은 별도 엔드포인트 없이 목록의 `connectUrl`(accountId 링크)을 복사해 재전달한다.

**변경**

- `POST`·`PATCH /admin/campaigns`: `brandAccountId`(nullable) 수용.
- `GET /admin/campaigns`(목록)·`GET /admin/campaigns/:id`(상세): `needsReconnect`·`xUsername`를 `brandAccount`에서 파생(include). 상세의 `connectUrl` **제거**, 대신 `brandAccountId` + 선택 계정 요약(`xUsername`, `status`) 노출.
- `GET /admin/campaigns/:id/stats`: `needsReconnect`를 `brandAccount` 기준으로.

**계약 스키마(jwin-shared `adminApi.ts`)**

- 신규: `AdminBrandAccountSchema`, `AdminBrandAccountListSchema`, `AdminBrandAccountCreateSchema`.
- `AdminCampaignDetailSchema`: `connectUrl` 제거, `brandAccountId`(nullable) + `brandAccount`(요약, nullable) 추가.
- `AdminCampaignCreateSchema`/`PatchSchema`: `brandAccountId` 추가.
- `AdminCampaignListItemSchema`: 필드 유지(값 출처만 account로).

## 6. 소비자 변경 (jwin-api 내부)

`campaign.credential` → `campaign.brandAccount` 로 일괄 치환:

- `services/scheduler.ts` (게시): `campaign.brandAccount`에서 토큰. 없거나 대기면 `FAILED('brand not connected')`.
- `services/fulfillment.ts` (DM): 동일.
- `services/verification.ts` (팔로우 검증): `campaign.xUserId` → `campaign.brandAccount.xUserId`. (이미 토큰 때문에 계정 include 하므로 추가 비용 없음.)
- `lib/tokens.ts` `getBrandAccessToken`: 인자를 `BrandXAccount`로. refresh 시 계정 row 갱신(공유).
- `routes/public.ts` (LP): `campaign.xUsername` → `campaign.brandAccount?.xUsername`. include 한 줄 추가.
- `routes/oauth.ts`: §4대로 accountId 기반으로 재작성.

`campaign.xUserId/xUsername` 삭제로 인한 리더는 위가 전부(grep 확인 완료).

## 7. 어드민 화면 (admin-web)

**신규 페이지 `/jwin/accounts`** (사이드바 3번째 메뉴 — `navigation.ts`)

```
src/components/JwinBrandAccounts/
  useJwinBrandAccountsData.ts      목록 fetch + reload
  useJwinBrandAccountMutations.ts  계정 생성(+연동링크 반환)
  jwinBrandAccountTransform.ts     상태 판정 순수 함수 (대기/연동됨/재연동필요)
  JwinBrandAccountTable.tsx        presentational (label·@handle·상태·캠페인수·재연동 링크복사)
  AddBrandAccountDialog.tsx        label 입력 → 생성 → 연동 링크 표시 (입력 상태는 내부, CODE_RULES §7)
src/pages/Jwin/BrandAccounts.tsx   조립
src/components/composites/JwinAccountStatusBadge/  대기/연동됨/재연동 배지 (§8)
```

목록 열: label / @handle(또는 "미승인") / 상태 배지 / 사용 캠페인 수 / 액션(연동 링크 복사 = 추가·재연동 공용).
`계정 추가` 버튼 → `AddBrandAccountDialog`: label 입력 → 생성 시 `connectUrl` 즉시 표시 + 복사.

**캠페인 연동 탭 변경** (`JwinCampaignForm/ConnectTab.tsx`)

- 기존 "연동 URL 복사" 제거.
- **계정 선택 드롭다운**(연동된 계정 목록, `GET /admin/brand-accounts`에서 채움) → 선택 시 캠페인 `PATCH { brandAccountId }`.
- 선택된 계정의 상태(@handle 연동됨 / 재연동 필요) 표시 + "계정 추가·재연동은 브랜드 계정 페이지에서" 안내 링크.

**발행 전 체크리스트** (`activationChecklist.ts` — Phase 4 항목이지만 여기서 계약 확정):
"X 계정 연동됨" 조건 = `brandAccountId != null && 선택 계정.status == 연동됨`.

## 8. 마이그레이션

MVP 미배포(Railway/Vercel 미생성) → **dev Neon DB만 존재**. 운영 데이터 없음.

- Prisma 스키마 변경 후 `prisma migrate dev`로 마이그레이션 생성.
- 기존 dev 데이터(스모크 캠페인 `smoke-ms35ek5d` + `@devsure5` credential)는 재사용 가치 없으므로 **`prisma migrate reset`으로 초기화**(가장 단순·안전). 데이터 백필 스크립트는 작성하지 않는다(YAGNI — 운영 데이터가 없다).
- 운영 배포 전이므로 CODE_RULES §9(Expand→Contract)의 무중단 절차는 불필요.

## 9. 검증 계획

- **jwin-api 유닛**: `adminMappers` 계정 매핑 + oauth 콜백 중복 방지(dedupe) 분기 테스트(`admin` 또는 `oauth` 테스트 파일).
- **typecheck + lint**: 전 패키지 green (기존 기준).
- **라이브 스모크**(포지드 토큰 + 실 jwin-api):
  1. `POST /admin/brand-accounts {label}` → 대기 계정 + connectUrl.
  2. 실제 X 계정(예: devsure5)으로 연동 링크 승인 → 계정 `연동됨` 전이 확인.
  3. `PATCH /admin/campaigns/:id {brandAccountId}` → 캠페인이 계정 참조.
  4. 같은 계정을 두 번째 캠페인에도 연결 → 재사용 확인.
- **화면**: `/jwin/accounts` 목록·추가 다이얼로그, 캠페인 연동 탭 드롭다운을 브라우저로 확인.

## 10. 작업 순서(플랜에서 상세화)

1. 스키마 + 마이그레이션(reset).
2. jwin-shared 계약(계정 + 캠페인 필드 변경).
3. jwin-api: oauth 재작성 + 계정 엔드포인트 + 소비자 치환 + 매퍼.
4. admin-web: `/jwin/accounts` 페이지 + 연동 탭 드롭다운 + 네비게이션.
5. 검증(유닛·typecheck·라이브·화면).
6. DECISIONS.md D-13 기록.
