# J-WIN 전체 요구사항 정리 (v1.0)

> 최종 갱신: 2026-07-26
> 이 문서는 요건정의서 v0.9 + 대화에서 확정된 결정(D-1~D-9, `DECISIONS.md`) + Atatter 레퍼런스 대조 결과를 통합한 v1 기준 문서다.
> 기존 라운드(Round) 기반 설계를 **캠페인 기간 단위**로 개편하는 내용을 포함한다 (D-8).

---

## 1. 프로젝트 개요

- **프로젝트명**: J-WIN — X(Twitter) 인스턴트윈 캠페인 플랫폼
- **발주**: 株式会社J-sure (담당: 조한샘) / **개발**: 평이 (개인사업자)
- **운영 모델**: 브로커형 단일 테넌트. 어드민은 J-sure(운영자)뿐이고, 브랜드는 X 계정 OAuth 연동 링크만 받는다. 수주·계약·정산은 시스템 밖(오프라인).
- **목표**: 2026년 10~11월 첫 자체 운영 캠페인 실시
- **대상 시장**: 일본 (LP·DM 등 유저 대면 텍스트는 일본어)

### 핵심 플로우

1. J-sure가 브랜드와 계약 후 어드민에서 캠페인 등록 → 브랜드용 OAuth 연동 링크 발급
2. 브랜드 담당자가 링크 클릭 → X 계정 승인 → 토큰 서버 보관
3. 캠페인 기간 중 매일 지정 시각에 브랜드 계정으로 캠페인 포스트 자동 발행 (LP 링크 + 이미지/동영상 포함)
4. 유저가 LP 접속 → X 로그인(OAuth) → 응모 → 즉시 추첨
5. 당첨 후보에 한해 팔로우 + 리포스트를 검증 (lazy 검증)
6. 검증 통과 시 당첨 확정 → 기프트코드 DM 자동 발송 또는 배송지 입력

---

## 2. v1 범위

### 포함

| # | 기능 | 비고 |
|---|------|------|
| 1 | 브랜드 X 계정 OAuth 연동 (토큰 대리 취득·암호화 보관·자동 갱신) | |
| 2 | 캠페인 기간 중 매일 자동 포스팅 | **이미지/동영상 미디어 업로드 포함 (v1 필수 승격)** |
| 3 | 캠페인별 단독 LP (`/c/{slug}`) | 응모는 항상 단독 페이지 |
| 4 | 진행 중 캠페인 목록 페이지 | 별도 페이지. 필요한 곳에 링크 걸어 쓰는 용도 |
| 5 | 유저 X 로그인 + 응모 + 즉시 추첨 (확률 + 원자적 재고 차감) | 캠페인당 1일 1회 (JST) |
| 6 | 당첨 후보 lazy 검증 (팔로우 + 당일 포스트 리포스트) | **홀드/재고 회수 없음. 당첨자는 당첨자로 유지, 재시도 가능** |
| 7 | 당첨 확정 처리: 기프트코드 DM 자동 발송 / 실물 경품 배송지 수집 | **DM 문구 캠페인별 커스텀. 배송지는 캠페인 종료 시점까지 입력 가능, 이후 잠금** |
| 8 | 당첨/낙첨 결과 화면 미디어 (캠페인별 이미지·동영상) | Atatter 갭 반영 |
| 9 | PR 전환 URL (결과 화면 → 브랜드 사이트 유도 버튼) | Atatter 갭 반영 |
| 10 | **LP 당첨 히스토리**: 본인 당첨 확정 내역 조회 + 그 자리에서 배송지 입력 | 낙첨·검증 실패 건 미표시, 검증 재시도 기능 없음 |
| 11 | 어드민 API: 캠페인 CRUD, 경품/**코드 직접 입력(엑셀 붙여넣기)**, 통계, 당첨자 목록, 감사 로그 | |
| 12 | 운영 자동화: 포스트 발행, DM 재시도, 토큰 갱신 실패 알림 플래그 | 단일 레플리카 인프로세스 스케줄러 |

### 제외 (v1 이후 또는 스코프 밖)

- 브랜드 셀프서비스 포털 (가입·플랜 선택·직접 등록) — 브로커형이므로 불필요
- 어드민 웹 UI — v1은 API-first. 필요 시 기존 `@jsure/admin-web`에 도메인 모듈로 추가 (Atatter 5-step 폼 구조를 레퍼런스로: 기본정보 → 상품 → 포스트 → 결과 화면 → 확인)
- 캠페인별 하위 도메인 — 경로 방식(`/c/{slug}`)으로 대체
- X 광고 출고 관리 — 영업 정보, 시스템 밖
- 수주/견적/청구 관리

---

## 3. 도메인 모델 (캠페인 기간 단위 개편)

### 3.1 구조 변경: Round 폐지

기존 설계의 `Round`(회차) 엔티티를 제거하고, 기간·URL slug·상태를 `BrandCampaign`으로 이동한다 (D-8).

| 항목 | 기존 (Round 기반) | 변경 (캠페인 기간 단위) |
|------|------------------|---------------------|
| 기간 | Round.startDate/endDate | **BrandCampaign.startsAt/endsAt** (JST 입력, UTC 저장) |
| LP URL | `/r/{roundSlug}` 복합 LP + `/r/{slug}/c/{id}` | **`/c/{slug}` 단독 LP** |
| 상태 | RoundStatus + CampaignStatus 이중 | **CampaignStatus 단일** |
| 목록 | 라운드 = 복합 LP | 별도 목록 페이지 (`/campaigns`) |

#### CampaignStatus 상태값

| 값 | 의미 | 게시·응모 |
|----|------|----------|
| `SETUP` | 기본값. 브랜드 계정 연동·경품·소재 등록 등 준비 중 | 둘 다 정지 |
| `ACTIVE` | 운영 중. 실제 동작은 `startsAt`~`endsAt` 구간 안에서만 | 기간 내에서 동작 |
| `PAUSED` | 운영 도중 중지. LP 비노출, 데이터는 보존 | 둘 다 정지 |
| `ENDED` | 종료 처리 완료 | 둘 다 정지 |

배송지 입력 마감(F-6.3)은 상태가 아니라 `endsAt` 시각을 기준으로 판정한다 — 상태를 `ENDED`로 바꾸는 것을 잊어도 마감은 정확히 걸린다.

`SETUP → ACTIVE` 전환은 어드민 수동 조작이다. 기간이 시작·종료됐다고 상태가 자동으로 바뀌지는 않으며, 게시·응모 판정은 항상 `status = ACTIVE` **그리고** 현재 시각이 `startsAt`~`endsAt` 안일 것을 함께 요구한다.

### 3.2 엔티티

- **BrandCampaign**: brandName, slug(고유), startsAt/endsAt, status(CampaignStatus), X 계정(xUserId/xUsername), 매일 포스팅 시각(dailyPostTime, "HH:mm" JST), 일일 당첨 상한(dailyWinCap, null=무제한), **prUrl**(PR 전환 URL), **winMediaUrl / loseMediaUrl**(결과 화면 미디어), **dmTemplate**(당첨 DM 문구 — 플레이스홀더 `{{CODE}}` `{{PRIZE_NAME}}` `{{USERNAME}}` `{{BRAND_NAME}}`)
- **BrandXCredential**: 캠페인별 브랜드 토큰(AES-256-GCM 암호화), refresh 실패 추적(재연동 알림용)
- **PostTemplate**: 주 단위 교체 가능(activeFrom/activeTo), 본문(`{{LP_URL}}` 치환), **mediaUrl(이미지/동영상) — 발행 시 X media upload 후 첨부**
- **CampaignPost**: 캠페인 × 날짜(JST) 유니크. 상태(SCHEDULED/POSTED/FAILED/SKIPPED — SKIPPED는 게시 시점에 캠페인이 비활성이거나 기간 밖인 경우), xPostId, 시도 횟수
- **Prize / PrizeCode**: 유형(PHYSICAL/CODE), 티어, 총수량/잔여수량, 당첨 확률. **CODE 경품은 캠페인 생성 시 수량과 함께 코드를 직접 입력 (엑셀 열 복사 붙여넣기 지원 — 줄바꿈/탭 구분 파싱, 입력 개수 = 수량 자동 검증)**. 코드는 암호화 보관, 상태(AVAILABLE/ASSIGNED/SENT/REVOKED), 끝 4자리만 평문(codeLast4)
- **User**: X 유저 + 유저 토큰(암호화, 검증용)
- **Entry**: 캠페인 × 유저 × 날짜(JST) 유니크. 결과(LOSE/WIN_PENDING/WIN_CONFIRMED) — WIN_FORFEITED(몰수)는 폐지
- **Winner**: 검증 상태(PENDING/FOLLOW_FAILED/REPOST_FAILED/PASSED), 이행 상태(NOT_READY/AWAITING_INFO/READY/DM_SENT/SHIPPED/FAILED), 배송지(암호화, **`endsAt`까지 입력 가능**), DM 발송 기록. **verifyDeadlineAt은 D-2 개정으로 폐지**
- **AdminUser / AuditLog / OAuthState**: 어드민 인증, 감사 로그, PKCE 임시 저장

---

## 4. 기능 요구사항

### F-1. 브랜드 연동

- F-1.1 어드민이 캠페인 생성 시 브랜드용 OAuth 연동 URL 발급
- F-1.2 OAuth2 Authorization Code + PKCE. 스코프: tweet.read, tweet.write, users.read, dm.write, offline.access
- F-1.3 토큰은 AES-256-GCM 암호화 저장, 만료 5분 전 마진으로 자동 refresh
- F-1.4 refresh 실패 시 실패 시각·횟수 기록 → 어드민 통계에 재연동 필요 플래그 노출

### F-2. 자동 포스팅

- F-2.1 매일 00:05 JST에 당일 발행분 구체화(materialize), 지정 시각 도래 시 발행 (분 단위 폴링)
- F-2.2 포스트 본문은 활성 PostTemplate 기준, `{{LP_URL}}` → `{WEB_BASE_URL}/c/{slug}` 치환
- F-2.3 **미디어 첨부: PostTemplate.mediaUrl의 이미지(JPG/PNG/GIF, ≤5MB)·동영상(MP4/MOV)을 X media upload API로 업로드 후 media_ids로 첨부** (v1 필수)
- F-2.4 발행 실패 시 최대 3회 재시도, 최종 실패는 FAILED로 기록
- F-2.5 발행은 캠페인 기간(`startsAt`~`endsAt`) 내 + `status = ACTIVE`일 때만. 벗어난 예약 건은 SKIPPED 처리

### F-3. LP / 응모

- F-3.1 캠페인별 단독 LP `/c/{slug}`. 기간 외 접속 시 종료/예정 안내
- F-3.2 진행 중 캠페인 목록 페이지 `/campaigns` (카드 나열, 외부 링크용)
- F-3.3 유저 X 로그인 (OAuth2 + PKCE, 스코프: tweet.read, users.read, follows.read, offline.access)
- F-3.4 응모는 캠페인당 1일 1회 (JST 기준, DB 유니크 제약으로 보장)
- F-3.5 응모 조건 안내(팔로우 + 당일 캠페인 포스트 리포스트)를 응모 전 화면에 명시
- F-3.6 **당첨 히스토리**: 캠페인 참여 화면에서 로그인 유저 본인의 당첨 확정(WIN_CONFIRMED) 내역을 목록으로 제공. 각 건에서 배송지 입력(기간 내)·DM 발송 상태 확인 가능. 낙첨·검증 미완료 건은 표시하지 않으며, 검증 재시도 기능도 두지 않음

### F-4. 추첨 (D-3)

- F-4.1 응모 즉시 추첨. 티어 순으로 확률 판정, 당첨 시 원자적 재고 차감(잔여 > 0 조건부 갱신)
- F-4.2 일일 당첨 상한(dailyWinCap) 초과 시 그날은 전원 낙첨
- F-4.3 당일 POSTED 상태의 캠페인 포스트가 없으면 응모 불가

### F-5. 검증 (D-1, D-2, D-5)

- F-5.1 당첨 후보(WIN_PENDING)만 검증하는 lazy 방식
- F-5.2 유저 본인 토큰으로 검증: 팔로우는 `connection_status` 1콜, 리포스트는 본인 타임라인의 referenced_tweets 대조 (당일 포스트만 인정)
- F-5.3 검증 실패 시 사유(follow/repost)를 안내하고 재시도 버튼 제공. **재시도는 당일 응모 결과 화면에서만 가능** (당일 리포스트만 인정하므로 당일 내 완료가 전제. 히스토리에서는 재시도 불가)
- F-5.4 **홀드·재고 회수 폐지**: 당첨은 추첨 시점에 확정된 재고 차감을 유지한다. 검증 미완료여도 몰수하지 않으며, 당일 내 검증을 완료하지 못한 건은 그대로 미이행 종료(어드민 통계에 표시)

### F-6. 당첨 이행 (D-4)

- F-6.1 CODE 경품: 코드 원자적 할당(AVAILABLE→ASSIGNED) 후 DM 자동 발송. **DM 문구는 캠페인별 dmTemplate** (플레이스홀더: 코드, 유저명 등)
- F-6.2 DM 실패 시 5분 주기 재시도, 실패 사유 기록
- F-6.3 PHYSICAL 경품: 배송지 입력 폼(우편번호/도도부현/주소/이름/전화), 암호화 저장. **입력은 당첨 직후 결과 화면 또는 당첨 히스토리(F-3.6)에서, 캠페인 종료 시점까지 가능. 종료 후에는 입력 불가(잠금)**
- F-6.4 CODE 경품은 마감 예외: 검증 통과 즉시 DM 자동 발송이므로 배송지 마감 개념 없음
- F-6.5 결과 화면: 당첨 시 winMediaUrl, 낙첨 시 loseMediaUrl 표시 + PR 전환 URL 버튼

### F-7. 어드민

- F-7.1 어드민 로그인 (env 부트스트랩 + bcrypt)
- F-7.2 캠페인 CRUD (생성 시 connectUrl 반환), 포스트 템플릿, 경품/확률/재고 관리
- F-7.3 기프트코드 등록: 캠페인 생성(경품 등록) 시 수량과 함께 코드를 직접 입력. **엑셀에서 열을 복사해 붙여넣는 멀티라인 텍스트를 그대로 수용** (줄바꿈/탭/쉼표 구분 파싱, 공백 줄 무시, 중복 검출, 입력 개수와 수량 불일치 시 에러). 암호화 저장, 끝 4자리만 평문 노출
- F-7.4 캠페인 통계 (응모/당첨/재고/DM 현황, 재연동 필요 여부), 당첨자 목록·배송지 열람
- F-7.5 모든 변경 조작은 AuditLog 기록

---

## 5. 비기능 요구사항

- **보안**: 토큰·기프트코드·배송지 AES-256-GCM 암호화 (`base64(iv).base64(tag).base64(ct)`), 세션은 JWT 쿠키, 암호화 키 롤링 불가 전제(분실 시 재연동)
- **개인정보**: 일본 APPI 준수 필요. 배송지 보관 기간·삭제 정책은 미결(§8)
- **동시성**: 재고 차감·코드 할당은 조건부 updateMany로 원자성 보장. 응모 중복은 DB 유니크 제약(P2002)
- **가용성**: API 단일 레플리카(스케줄러 중복 실행 방지). 포스트 발행·DM은 재시도로 보완
- **날짜 기준**: 모든 "하루" 판정은 JST (`dateJst()` 헬퍼)

---

## 6. X API 전제 (G0 게이트, 2026-02 종량제 기준)

| 항목 | 단가/제한 | 용도 |
|------|----------|------|
| 포스트 작성 (URL 포함) | $0.20/건 | 매일 캠페인 포스트 (미디어 업로드 자체는 무과금, 포스트 과금에 포함) |
| DM 발송 | $0.015/건 | 기프트코드 전달 |
| owned read | $0.001/리소스 | 유저 본인 토큰 검증 (팔로우·리포스트) |
| 유저 조회 | $0.010/건 | OAuth 프로필 취득 |
| 읽기 캡 | 2M posts/월 | 여유 충분 |

- 2026-04-20 변경: 팔로우/좋아요 **쓰기** 엔드포인트 셀프서브 제거 — 우리는 읽기만 사용하므로 영향 없음. `quote_tweet_id` 제거 — 미사용.
- 비용 모델: 브랜드당 포스팅 약 $6/월 (30일 × $0.20), 검증 비용은 당첨 후보 수 × $0.002 수준으로 무시 가능
- **G0 실측 필요 (배포 전)**: `apps/jwin-api/spikes/` 4종 — connection_status 팔로우 체크, 리포스트 확인, DM 발송, URL 포함 포스트 + **미디어 업로드 스파이크 추가** — 콘솔에서 owned read $0.001 과금 실측 확인

---

## 7. 기술 스택 / 인프라

- **모노레포**: jsure-integration-dashboard (pnpm + Turborepo, `@jsure/*` 스코프)
  - `packages/jwin-db` (Prisma 6 + Neon), `packages/jwin-shared`, `apps/jwin-api` (Fastify), `apps/jwin-web` (Next.js 15)
- **인프라**: Vercel (web) + Neon PostgreSQL (별도 DB) + Railway (api, Dockerfile 배포, 레플리카 1)
- **스케줄러**: node-cron 인프로세스 (00:05 JST 구체화, 분 단위 발행, 5분 DM 재시도) — 슬롯 회수 잡은 폐지

---

## 8. 미결 사항

| # | 항목 | 상태 |
|---|------|------|
| 1 | ~~미디어 업로드 포스팅~~ | **해결 — v1 필수로 승격 (D-9, 본 문서 F-2.3). 구현·스파이크 완료** |
| 2 | 어드민 웹 UI | v1은 API-first. Atatter 5-step 폼을 레퍼런스로 추후 `@jsure/admin-web`에 추가 검토 |
| 3 | 배송지 개인정보 보관 기간·삭제 정책 (APPI) | 첫 캠페인 전 J-sure와 합의 필요 |
| 4 | LP 디자인 에셋 | 브랜드/J-sure 제공 대기 |
| 5 | 리포스트 취소 어뷰징 (검증 통과 후 리포스트 삭제) | 정책 미정 — 재검증 시점 추가 여부 |
| 6 | 요건정의서 §5.2 이후, §6 결정표, §7 원문 | 미수령 — 수령 시 본 문서와 대조 |

---

## 9. 기존 구현 대비 변경 작업 목록

> 상태: 아래 1~9 전부 반영 완료 (2026-07-26). `pnpm typecheck` 통과, `@jsure/jwin-api` 테스트 3/3 통과.
> 남은 배포 선행 작업은 초기 Prisma 마이그레이션 생성(`pnpm db:jwin:migrate`)과 G0 스파이크 5종 실측이다.

1. **스키마 개편**: Round 삭제, Campaign에 slug/startDate/endDate/status 통합, prUrl·winMediaUrl·loseMediaUrl·dmTemplate 필드 추가. Winner.verifyDeadlineAt 제거, EntryResult에서 WIN_FORFEITED 제거 → 마이그레이션
2. **검증/이행 개편**: 60분 홀드·슬롯 회수 로직 제거 (reclaimExpiredSlots 잡 삭제, VERIFY_HOLD_MINUTES 폐기), 검증 재시도·배송지 입력을 캠페인 종료 시점 기준으로 잠금
3. **미디어 업로드**: X media upload API 클라이언트 (chunked upload, 이미지/동영상) + 발행 로직에 media_ids 첨부 + 스파이크 스크립트 추가
4. **라우트 개편**: `/r/{slug}` 복합 LP 제거 → `/c/{slug}` 단독 LP + `/campaigns` 목록 페이지. API도 rounds 라우트 제거, campaigns 중심으로
5. **당첨 히스토리**: 본인 당첨 확정 내역 API (`GET /me/wins` 등) + LP 참여 화면 히스토리 UI (배송지 입력 진입, DM 상태 표시)
6. **결과 화면**: 당첨/낙첨 미디어 렌더 + PR 전환 URL 버튼
7. **DM 발송**: 하드코딩 문구 → dmTemplate 렌더링 (플레이스홀더 치환)
8. **어드민 API**: rounds CRUD 제거, campaign CRUD에 신규 필드 반영, 경품 등록 시 코드 동시 입력(멀티라인 파싱·수량 검증), 통계를 캠페인 단위로 (미이행 종료 건 포함)
9. **문서 갱신**: DECISIONS.md (D-2 개정: 홀드/회수 폐지, D-8 캠페인 기간 단위 전환, D-9 미디어 업로드 승격), DEPLOY.md (URL 구조 §4, 운영 체크리스트), 본 문서 §3 상태값 정합
