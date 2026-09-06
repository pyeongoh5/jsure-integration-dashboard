# 캐러셀 카드 게시 (Ads API) — 설계 노트

> 2026-09-06 작성. Ads API 액세스 **승인 대기 중**이라 착수하지 못한 작업의 맥락을 남긴다.
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

## 3. 아직 확정되지 않은 것 (승인 후 실측 필요)

1. **multi-destination 을 API 로 만드는 정확한 요청 형태.**
   문서의 website carousel 예시는 `DETAILS` 컴포넌트가 **하나**(전 슬라이드 공통 목적지)다.
   그런데 참고 서비스는 슬라이드마다 URL 이 다르다. `DETAILS` 를 media_key 수만큼 넣는지,
   다른 컴포넌트를 쓰는지 확인해야 한다.
2. **오가닉(비프로모션) 트윗에서 캐러셀 카드가 렌더되는지.**
   `card_uri` 는 일반 트윗에 붙일 수 있지만, 광고 집행 없이도 카드가 보이는지는 문서에 없다.
   (`nullcast=true` 는 프로모션 전용 = 공개 타임라인 미노출)

> **승인 전에도 검증 가능**: Ads Manager UI(크리에이티브 → 작성 도구)에서 캐러셀을 수동으로
> 만들어 보면 위 두 가지를 확인할 수 있다. 광고 계정만 있으면 되고 API 승인은 필요 없다.

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

**승인 전 상태 확인** — `GET https://ads-api.x.com/12/accounts` 가
`403 UNAUTHORIZED_CLIENT_APPLICATION` 을 돌려준다(2026-09-06 실측).
`console.x.com` 에서 앱이 "Ads 프로젝트 연결됨" 으로 보이는 것과 Ads API 액세스는 **별개**다.

**승인 후 첫 행동**: OAuth 1.0a 액세스 토큰을 **재발급**해야 한다(문서 명시).
승인 전에 발급한 토큰으로는 계속 실패한다.

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

## 5. 승인 후 착수 순서

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
