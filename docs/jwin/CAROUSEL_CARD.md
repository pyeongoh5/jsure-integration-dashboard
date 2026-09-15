# 캐러셀 카드 게시 (Ads API) — 설계 노트

> 2026-09-06 작성 · 2026-09-15 갱신: Ads API 액세스 **승인 완료**, §3 미확정 2건 실측 반영.
> 관련 문서: `REQUIREMENTS.md` · `DECISIONS.md` · `DEPLOY.md`

---

## 0. 왜 이 작업이 필요한가

목표는 **"게시물의 이미지를 누르면 응모 페이지가 열리는 것"** 이다.

오가닉 트윗(무료 `POST /2/tweets`)으로 할 수 있는 건 두 가지뿐이고, 둘 다 목표를 완전히 만족하지 못한다.

| 형태 | 이미지 | 이미지 클릭 시 | 무료 API 로 가능? |
|---|---|---|---|
| 미디어 첨부 | 최대 4장 | **이미지 뷰어**가 열린다 | 가능 (현재 구현) |
| 링크 카드 (OG 스크래핑) | 1장 | 링크가 열린다 | 가능 (LP 에 OG 태그 필요) |
| **캐러셀 카드** | 2~6장, **슬라이드마다 다른 링크** | 링크가 열린다 | **불가 — Ads API 필요** |

참고 서비스(Vegreen / neo-atatter.com)가 쓰는 형태가 세 번째다.

---

## 1. 참고 서비스 분석 — 확정된 사실

트윗 DOM 과 랜딩 페이지를 직접 조사해 확인한 것. 추정이 아니다.

**트윗 DOM**
- `data-testid="LayoutCardCarousel-slide"` 가 2개 — 링크 카드 2장의 캐러셀
- 슬라이드 1: `…/entry.html`, 헤드라인 `☝️抽選はこちらをタップ`
- 슬라이드 2: `…/rules`, 헤드라인 `☝️応募規約はコチラ`
- → **슬라이드마다 목적지 URL 과 헤드라인이 다르다** (multi-destination)
- 이미지 경로가 `pbs.twimg.com/media/…` — OG 스크래핑 카드가 쓰는 `card_img/` 가 아니라 **업로드된 미디어**
- 미디어 영역이 `padding-bottom: 100%` → **1:1 정사각형**

**랜딩 페이지** (`https://vegreen.neo-atatter.com/entry.html` 를 Twitterbot UA 로 직접 요청)
- `og:` · `twitter:` 메타 태그가 **하나도 없다** (응답 1,930바이트 전체 확인)
- 페이지 `<title>` 은 `Vegreen フォロー&リポストキャンペーン` 인데 카드 헤드라인은 `☝️抽選はこちらをタップ` — **다르다**
- → 이 카드는 페이지 스크래핑이 아니라 **카드 생성 시 제목·이미지·목적지를 직접 지정**한 것이다.
  LP 에 OG 태그를 아무리 잘 넣어도 이 모양은 나오지 않는다.

---

## 2. X 공식 문서에서 확정된 사실

- `POST /2/tweets` 에 **`card_uri` 필드가 있다** — 미리 만든 카드를 트윗에 붙일 수 있다.
  ([X API 문서](https://docs.x.com/x-api/posts/creation-of-a-post))
- 캐러셀 카드는 **`POST accounts/:account_id/cards`** 로만 만든다. 미디어 2~6장,
  응답에 `card_uri: card://[id]`. 경로에 `account_id` 가 있다 = **광고 계정이 전제**.
  ([Creatives](https://docs.x.com/x-ads-api/creatives))
- `SWIPEABLE_MEDIA` 의 `media_keys` 는 **미디어 라이브러리**(`accounts/:account_id/media_library`)
  응답의 `media_key` 다 (`13_875943225764098048` 형식).
- Ads API 인증은 **OAuth 1.0a 3-legged 서명**. 지금 브랜드 연동(OAuth 2.0 PKCE)과 **다른 인증 축**이다.
- 슬라이드별 다른 목적지·헤드라인은 X 광고의 **multi-destination 캐러셀** 기능
  ("최대 6개 고유 웹 목적지", "카드마다 고유 헤드라인", 본문 카피는 전 카드 공통).
  ([Carousel Ads](https://business.x.com/en/advertising/carousels))

---

## 3. 미확정 2건 — 2026-09-15 실측 결과 (`spikes/spike-ads-carousel.ts`)

1. **multi-destination 을 API 로 만드는 요청 형태** → **`slides`(배열의 배열)로 가능.**
   `components` 에 `DETAILS` 를 2개 넣는 방식은 `400 INVALID_CARD_COMPONENTS_COMBINATION` 이지만,
   `slides: [[MEDIA, DETAILS], [MEDIA, DETAILS], ...]` 로 보내면 `201` — 슬라이드마다
   제목·목적지 URL 이 다르게 만들어진다 (같은 날 추가 실측). `slides: [{components: [...]}]`
   형태(객체 배열)는 `400 not a valid Seq`. 참고: X devcommunity "Multi-Destination Website
   Carousels" 공지, docs.x.com/x-ads-api/creatives/reference.
2. **오가닉 트윗 렌더** → **게시는 성공, 렌더는 눈 확인 필요.**
   - `POST /2/tweets` + `card_uri: "card://<id>"` → `400 The card URI provided is invalid`
   - `POST /2/tweets` + `card_uri: "<숫자 id만>"` → **`201` 게시 성공**
   - Ads API `POST accounts/:id/tweet` + `nullcast=false` → `400` — *"You cannot set nullcast
     to false. To make organic posts use the X app"* (Ads API 로는 오가닉 게시 자체가 막혀 있다)
   - v1.1 `statuses/update` → `404` (폐기)

**함께 확인된 것**
- 광고 계정의 `approval_status: "REJECTED"` 는 카드 생성·미디어 라이브러리 등록을 **막지 않는다**
  (광고 집행 승인과 별개).
- 미디어 라이브러리 등록은 v1.1 `media/upload` (`media_category=TWEET_IMAGE`) 의 `media_key` 를
  `POST accounts/:id/media_library` 에 넘기면 된다 — `3_...` 형식 key 그대로 통과.

---

## 4. 승인 신청 상태

| 항목 | 값 |
|---|---|
| App ID | `33241164` |
| 광고 계정 ID | `18ce55xapqv` (계정명 `devsure`) |
| 인가 X 계정 | `@devsure5` |
| 신청 티어 | Standard Access (Creatives 포함) |
| 신청 폼 | https://docs.x.com/forms/ads-api-access |
| 신청일 | 2026-09-06 |

**승인 완료 (2026-09-15 확인)** — 토큰 재발급 후 `GET /12/accounts` 가 `200` + `18ce55xapqv`.
승인 전 이력: 2026-09-06 엔 `403 UNAUTHORIZED_CLIENT_APPLICATION`(앱 미승인), 승인 후
구토큰으로는 `403 INSUFFICIENT_USER_AUTHORIZED_PERMISSION`(재발급 필요) — 문서 명시대로
OAuth 1.0a 토큰을 **재발급**해야 통과했다.

확인 스크립트:

```bash
cd apps/jwin-api
X_API_KEY=... X_API_SECRET=... X_ACCESS_TOKEN=... X_ACCESS_SECRET=... \
  npx tsx spikes/spike-ads-accounts.ts
```

`200` + `data[].id === "18ce55xapqv"` 면 통과. 키 4개는 console.x.com 앱의
**OAuth 1.0 키** 섹션에서 재생성하며 복사한다(시크릿은 생성 시 한 번만 표시된다).
OAuth **2.0** 키(클라이언트 ID·시크릿)는 브랜드 연동이 쓰는 값이므로 건드리지 않는다.

---

## 5. 게시 파이프라인 — 2026-09-15 구현 완료

구현된 것 (§5-1~5-2 의 계획을 실측 결과에 맞춰 반영):

- `src/lib/ads-api.ts` — OAuth 1.0a 서명 · 미디어 라이브러리 등록 · 카드 생성(`buildCarouselCard`).
  자격증명은 환경변수(`ADS_ACCOUNT_ID`, `X_API_KEY/SECRET`, `X_ACCESS_TOKEN/SECRET`) —
  자사 광고 계정 하나만 쓰므로 DB 보관은 하지 않았다
- `PostTemplate.cardTitle` — 값이 있고 이미지 2장 이상이면 카드로 게시.
  `cardId`+`cardFingerprint` 로 카드 캐싱(슬라이드·헤드라인·목적지가 그대로면 재사용)
- 스케줄러 분기(`shouldUseCarousel`) — 카드 게시 시 본문에 LP URL 자동 첨부 없음
  (`buildCardPostText`), 카드가 목적지를 갖는다
- 어드민 소재 다이얼로그에 캐러셀 헤드라인 입력(ko/en/ja), 이미지 2장 미만이면 등록 차단
  (화면 + 서버 zod 이중)

**슬라이드별 URL (같은 날 추가)** — `slides` 방식으로 전환했다. 마지막 슬라이드는 **응모 규약
페이지**(`BrandCampaign.rulesUrl`, 없으면 `{LP}/rules`)로, 나머지 슬라이드는 응모 LP 로 간다.
규칙 슬라이드 헤드라인은 고정(`☝️応募規約はこちら`), LP 슬라이드는 어드민의 `cardTitle`.
규약 페이지는 jwin-web `/c/{campaign}/{brand}/rules` 로 템플릿화 — 브랜드명·기간(JST)·경품
목록·@핸들을 캠페인 데이터로 치환해 렌더한다 (참고 구조: sonboda.neo-atatter.com/rules).
카드 게시 본문에는 LP·규칙 링크를 자동으로 붙이지 않는다 — 둘 다 카드가 갖는다.

**✅ 브랜드 계정 교차 게시 확인 (2026-09-15 실측).** 광고 계정과 **다른 유저**(@pyoh55)의
OAuth 2.0 토큰(운영 게시와 동일한 인증 경로)으로 devsure5 광고 계정의 card_uri 를 붙인
트윗이 201 로 게시되고 캐러셀 렌더·슬라이드별 링크까지 눈으로 확인했다. 브랜드 계정을 광고 계정의 account user 로 추가할 필요 없이,
어떤 브랜드 계정이든 우리 카드로 게시할 수 있다.

### 5-1. 게시 파이프라인

```
R2 이미지 URL (어드민이 업로드한 슬라이드 이미지)
  → ① POST accounts/:id/media_library   → media_key
  → ② POST accounts/:id/cards           → card_uri  (SWIPEABLE_MEDIA + DETAILS)
  → ③ POST /2/tweets { text, card_uri } → 게시
```

### 5-2. 붙여야 할 코드

- **OAuth 1.0a 서명 유틸** — `spikes/spike-ads-accounts.ts` 의 서명 로직을
  `src/lib/ads-api.ts` 로 옮겨 재사용한다(RFC 3986 인코딩 → 파라미터 정렬 → base string → HMAC-SHA1).
- **자격증명 보관** — 광고 계정 ID + OAuth 1.0a 토큰. 브랜드별로 다르면 `BrandXAccount` 에,
  자사 계정 하나만 쓰면 환경변수로 충분하다.
- **media_key 캐싱** — 같은 이미지를 매일 재업로드하지 않도록 URL→media_key 매핑을 저장한다.
- **카드 캐싱** — 슬라이드 구성이 그대로면 `card_uri` 를 재사용한다.
- **스케줄러 분기** — `publishDuePosts()` 에서 카드가 있으면 `card_uri` 로, 없으면 지금처럼 미디어 첨부로.
- **어드민 UI** — 슬라이드 편집(이미지 + 헤드라인 + 목적지 URL, 2~6장).

### 5-3. 지금 코드에서 그대로 재사용되는 것

되돌릴 필요 없다. 승인 후 **게시 시점 조립 로직만** 교체하면 된다.

| 현재 | 카드 방식에서의 역할 |
|---|---|
| `PostTemplate.mediaUrls` (최대 4장) | 캐러셀 슬라이드 이미지 목록 (카드는 2~6장) |
| `BrandCampaign.rulesUrl` | 슬라이드 2의 목적지 URL |
| `BrandCampaign.cardImageUrl` | 슬라이드 1 이미지로 흡수하거나 제거 |
| LP 의 OG 태그 (`jwin-web`) | 카드에는 불필요하나 일반 공유에 유용 — 유지 |
| `buildPostText()` (`scheduler.ts`) | 본문만 만들고 URL 조립은 카드로 이관 |

### 5-4. 디자인 발주 규격

- 슬라이드 이미지 **1:1 정사각형** (참고 서비스 DOM 의 `padding-bottom: 100%` 로 확인)
- 슬라이드 2~6장, 헤드라인은 슬라이드마다 별도 (본문 카피는 전 슬라이드 공통)

---

## 6. 관련 스파이크

| 스크립트 | 용도 |
|---|---|
| `spikes/spike-ads-accounts.ts` | Ads API 접근 여부 확인 (`GET /12/accounts`) |
| `spikes/spike-card-post.ts` | 오가닉 링크 카드 실측 (본문 URL 순서에 따른 카드 대상 확인) |

`spike-card-post.ts` 로 확인한 것: 카드 메타데이터가 없는 URL(`google.com`)이 본문에 있으면
카드가 아예 생성되지 않는다. X 가 URL 여러 개 중 어느 것으로 카드를 만드는지는 공개 규정이 없어,
**본문에 URL 을 하나만 두는 것이 유일하게 안전한 방법**이다.
