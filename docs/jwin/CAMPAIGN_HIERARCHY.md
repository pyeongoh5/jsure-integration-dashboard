# 캠페인 위계 개편 — 시즌 · 참여 · 브랜드

> 2026-09-06 확정. 기존 "캠페인 = 브랜드 1개" 구조를 "시즌 캠페인에 브랜드들이 참여"하는 2층 구조로 바꾼다.
> 관련 문서: `REQUIREMENTS.md`(§3 도메인 모델) · `DECISIONS.md` · `DEPLOY.md`

---

## 0. 배경

운영 현황이 "9월 캠페인 / 가을 캠페인"처럼 **기간 단위 묶음에 브랜드들이 참여**하는 형태다.
지금 `BrandCampaign` 하나가 브랜드·기간·LP·경품·응모 단위를 전부 겸하고 있어 묶을 층이 없다.

---

## 1. 위계

```
Campaign (시즌)         "9월 캠페인" · slug · 기간(startsAt~endsAt)
   └─ BrandCampaign     참여 = Campaign × Brand · 상태 · 게시 설정 · 경품 · 응모
         └─ BrandXAccount  브랜드 = 표시명 · slug · 로고 · X 계정 토큰
```

**브랜드 간에는 상관관계가 없다.** 응모 하루 1회 제한, 경품 재고, `dailyWinCap`, 추첨은
전부 **참여 단위**로 지금 로직 그대로 동작한다. 시즌은 묶음·전시·기간의 층일 뿐이다.

**URL**: `/c/{campaignSlug}/{brandSlug}`
같은 브랜드가 여러 시즌에 참여해도 주소가 갈리므로, 과거 트윗의 링크가 계속 그 시즌 페이지를 가리킨다.
(트윗 본문의 URL 은 되돌릴 수 없다 — `DEPLOY.md` §5-3)

**기간은 시즌, 상태는 참여.** 시즌이 9/1~9/30 을 한 번 정하고, 브랜드마다 준비·진행·중지를 따로 관리한다.

---

## 2. 데이터 모델

### 2.1 신설 — `Campaign`

| 필드 | 설명 |
|---|---|
| `id` | cuid |
| `name` | "9월 캠페인" |
| `slug` | 전역 고유 · URL 조각 |
| `startsAt` / `endsAt` | JST 입력 · UTC 저장 (기존 규칙 그대로) |
| `createdAt` / `updatedAt` | |

- 인덱스: `@@index([startsAt, endsAt])`
- **상태·공개 플래그를 두지 않는다.** 시즌 LP 노출 조건은 "기간 내 + `ACTIVE` 참여 ≥ 1".
  플래그를 더하면 상태가 두 곳으로 갈라져 "왜 안 보이지"가 두 배가 된다.

### 2.2 승격 — `BrandXAccount` = 브랜드

| 변경 | 내용 |
|---|---|
| `label` | 표시명으로 승격 (기존 값 그대로 사용) |
| `slug` | **신설** · 전역 고유 · URL 조각 |
| `logoUrl` | **신설** · 시즌 LP 카드용 |
| X 토큰 필드 | 전부 유지 |

브랜드를 먼저 등록하고(연동은 나중에 해도 된다) 시즌에 참여시킨다.
연동 링크는 이미 계정 단위(`/oauth/brand/start?accountId=`)라 이 순서가 자연스럽다.

### 2.3 축소 — `BrandCampaign` = 참여

| 변경 | 내용 |
|---|---|
| `+ campaignId` | 필수 · FK → `Campaign` |
| `brandAccountId` | nullable → **필수** |
| `− brandName` | 브랜드에서 가져온다 |
| `− slug` | 캠페인 slug + 브랜드 slug 로 구성 |
| `− startsAt` / `− endsAt` | 시즌에서 가져온다 |
| 유지 | `status`, `dailyPostTime`, `dailyWinCap`, `cardImageUrl`, `rulesUrl`, `prUrl`, `winMediaUrl`, `loseMediaUrl`, `dmTemplate` |
| 제약 | `@@unique([campaignId, brandAccountId])` — 한 시즌에 같은 브랜드 중복 참여 금지 |

`Prize` · `PostTemplate` · `CampaignPost` · `Entry` 는 **FK 포함 무변경**이다.
데이터의 대부분이 여기 있는데 손대지 않는 것이 이 설계의 핵심이다.

### 2.4 기간 판정이 옮겨가는 곳

지금 `campaign.startsAt/endsAt` 을 직접 읽는 네 곳이 시즌을 참조하도록 바뀐다.

| 파일 | 판정 |
|---|---|
| `services/draw.ts` | 응모 가능 여부 |
| `services/scheduler.ts` | 게시 대상 · `SKIPPED` 처리 |
| `routes/public.ts` | LP 조회 |
| 배송지 마감 (`Winner`) | `endsAt` 기준 입력 마감 (F-6.3) |

---

## 3. API

리소스 이름을 둘로 나눈다: **시즌 = `campaigns`**, **참여 = `brand-campaigns`**.
아직 운영 전이라 하위 호환은 두지 않는다.

### 3.1 공개 API (`routes/public.ts`)

| 지금 | 변경 후 | 내용 |
|---|---|---|
| `GET /campaigns` | `GET /campaigns` | **시즌 목록** |
| `GET /campaigns/:slug` | `GET /campaigns/:campaignSlug` | 시즌 LP — 시즌 정보 + 참여 브랜드 카드 |
| — | `GET /campaigns/:campaignSlug/brands/:brandSlug` | 참여 LP (기존 `CampaignLp` 자리) |
| `POST /campaigns/:campaignId/entries` | `POST /brand-campaigns/:id/entries` | 응모 |
| `GET /me/wins?campaignId=` | `GET /me/wins?brandCampaignId=` | 파라미터명 변경 |

### 3.2 어드민 API (`routes/admin.ts`)

```
시즌    GET|POST          /admin/campaigns
        GET|PATCH|DELETE  /admin/campaigns/:id
        GET               /admin/campaigns/:id/brand-campaigns
        GET               /admin/campaigns/:id/delete-impact

참여    POST              /admin/brand-campaigns            { campaignId, brandAccountId, ... }
        GET|PATCH|DELETE  /admin/brand-campaigns/:id
        GET               /admin/brand-campaigns/:id/delete-impact
        GET               /admin/brand-campaigns/:id/prizes
        GET               /admin/brand-campaigns/:id/post-templates
        GET               /admin/brand-campaigns/:id/stats
        GET               /admin/brand-campaigns/:id/winners

브랜드  GET|POST|PATCH    /admin/brand-accounts             표시명·slug·로고 편집
```

`/admin/prizes/*` · `/admin/post-templates/*` · `/admin/winners/*` 처럼 자기 id 로 접근하는
엔드포인트는 경로가 그대로다.

**삭제 의미**
- 참여 삭제 = 지금의 캠페인 삭제와 동일 (응모·당첨자·포스트·경품 연쇄, 영향도 다이얼로그 재사용)
- 시즌 삭제 = 참여 전부 삭제. 영향도를 시즌 단위로 합산해 보여준다.

### 3.3 shared 타입 (`@jsure/jwin-shared`)

- `CampaignLp` — 참여 LP 로 유지하되 `campaign`(이름·slug) · `brand`(이름·slug·로고) 추가
- `CampaignSeasonLp` — **신설** · 시즌 정보 + 참여 브랜드 카드 목록
- `CampaignSummary` — 의미가 시즌 요약으로 바뀜
- 어드민: `AdminCampaign*`(시즌) / `AdminBrandCampaign*`(참여) 로 분리

---

## 4. 어드민 화면

```
/jwin/campaigns              시즌 목록
/jwin/campaigns/new          시즌 생성
/jwin/campaigns/:id          시즌 상세 + 참여 브랜드 관리   ← 신규
/jwin/brand-campaigns/:id    참여 편집 (기존 캠페인 편집 탭 화면)
/jwin/accounts               브랜드 관리
/jwin/winners                당첨자
```

**시즌 목록** — 이름 · slug · 기간 · 참여 브랜드 수 · 응모 합계 · 경고 합계(재연동 필요·게시 실패를
참여들에서 합산). 행 클릭 → 시즌 상세. 삭제 시 영향도는 시즌 전체 합산.

**시즌 상세 (신규)** — 두 블록.
1. 시즌 기본 정보 폼 (이름 · slug · 기간) — 기존 `BasicTab` 에서 떼어낸 필드들
2. 참여 브랜드 표 — 브랜드(로고+이름) · 상태 · 연동 계정 · 응모 수 · 경고 · [편집] · [삭제].
   상단에 **[브랜드 참여 추가]**: 등록된 브랜드를 고르고 게시 시각·당첨 상한만 입력

**참여 편집** — 기존 탭 화면을 재사용한다. 바뀌는 것은 둘뿐이다.
- **기본 탭**: 브랜드명·slug·기간이 빠지고 `게시 시각` · `일일 당첨 상한` 만 남는다.
  상단에 "9월 캠페인 · 9/1~9/30 · DAMU" 요약과 시즌으로 돌아가는 링크.
- **연동 탭**: 계정 선택 드롭다운이 사라지고 연결 상태 표시 + 재연동 링크만 남는다(브랜드가 곧 계정).

경품 · 포스팅 설정 · 결과화면 · 통계 탭과 상태 전환 아코디언은 **그대로**다.
포스트 커버리지 판정만 시즌 기간을 기준으로 계산한다.

**브랜드 관리** — 계정 목록에 표시명 · slug · 로고 편집을 붙인다. "브랜드를 먼저 등록"하는 입구.

**당첨자** — 캠페인 드롭다운 하나(`Winners.tsx:37`)를 **시즌 → 브랜드 2단 선택**으로 바꾼다.
CSV 내보내기는 선택된 참여 기준으로 동일하게 동작한다.

**i18n** — `jwin.campaign.*`(시즌) / `jwin.brandCampaign.*`(참여) 로 분리하고 ko·en·ja 모두 채운다.

---

## 5. 마이그레이션

단일 SQL, 순서 고정.

```
① CREATE TABLE "Campaign"
② BrandXAccount += slug, logoUrl  → 백필 → NOT NULL + UNIQUE(slug)
③ brandAccountId 가 NULL 인 BrandCampaign → 그 brandName 으로 BrandXAccount 생성해 연결
④ BrandCampaign 1행마다 Campaign 1개 생성 (name=brandName, slug=기존 slug, 기간 이관) → campaignId 채움
⑤ campaignId NOT NULL + FK, brandAccountId NOT NULL, UNIQUE(campaignId, brandAccountId)
⑥ DROP COLUMN brandName, slug, startsAt, endsAt
```

③④ 로 **데이터 손실이 없다** — 기존 캠페인 하나하나가 "브랜드 1개짜리 시즌"으로 변환된다.
운영 후 정리는 어드민에서 시즌을 합치는 식으로 한다.

`BrandXAccount.slug` 백필은 `label` 을 슬러그화하지 않고 **`brand-<id 앞 8자>`** 로 채운다.
label 이 일본어·한글이면 슬러그화 결과가 빈 문자열이 되어 UNIQUE 충돌이 난다.
사람이 읽는 slug 는 어드민 브랜드 화면에서 나중에 고친다.

**되돌릴 수 없는 지점은 ⑥ 하나**다. 실행 전 스냅샷(Neon 브랜치 또는 `pg_dump`)을 권한다.

---

## 6. 배포 순서

```
1. prisma migrate deploy   (jwin DB)
2. jwin-api  배포          새 경로 제공
3. jwin-web  배포          /c/[campaign]/[brand]
4. admin-web 배포          새 어드민 경로 사용
```

API 계약이 깨지므로 순서가 중요하다. 2번 전에 3·4번이 나가면 404 고, 1번만 하고 2번이 늦으면
구코드가 삭제된 컬럼을 읽어 500 이 난다 — **1·2 사이는 붙여서** 진행한다.

---

## 7. 검증

**자동**
- `draw.test.ts` — 기간 판정이 시즌 참조로 바뀌므로 픽스처 수정.
  **"참여 A 에 응모해도 참여 B 에는 응모할 수 있다"**(브랜드 간 독립)를 새 케이스로 추가
- 포스트 커버리지 — 시즌 기간 기준 계산 확인
- `adminMappers.test.ts` — 응답 모양 변경 반영

**수동 시나리오**
1. 시즌 생성 → 브랜드 2개 등록 → 참여 2개 추가
2. 각 참여를 `ACTIVE` 로 전환 → 시즌 LP 에 카드 2장
3. 각 참여 LP 에서 응모 → **하루 1회 제한이 참여별로 걸리는지** 확인
4. 한 참여를 `PAUSED` 로 → 시즌 LP 에서 그 카드만 사라지는지

---

## 8. 구현 순서

1. `jwin-db` 스키마 + 마이그레이션, `jwin-shared` 타입
2. `jwin-api` — public / admin / scheduler / draw
3. `jwin-web` — 라우팅 2단, 시즌 LP 신규
4. `admin-web` — 시즌 목록·상세, 참여 편집, 브랜드 관리, 당첨자 2단 필터
5. i18n 키 분리
