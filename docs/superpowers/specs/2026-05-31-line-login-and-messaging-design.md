# LINE 로그인 + 메시징 통합

## 목적

인플루언서 가입/로그인을 LINE 소셜 계정으로 처리하고, 비즈니스 통지(승인/배송/수령 요청/투고 반려 등)를 LINE 공식계정으로 발송한다.

## LINE 플랫폼 구성

LINE Developers Console에서 단일 **Provider** 아래 두 Channel을 생성한다.

1. **LINE Login Channel** — OAuth2 소셜 로그인
2. **Messaging API Channel** — 공식계정에서 push/reply 메시지 발송

같은 Provider 아래에 묶어야 LINE Login으로 얻은 `userId`를 Messaging API에서 그대로 사용할 수 있다.

공식계정은 무료 OA로 시작. 인증 OA(녹색 뱃지)는 차후 신청.

## 가입/로그인 흐름

1. 인플루언서가 client-web에서 `LINEで続行` 버튼 클릭
2. LINE Login 페이지로 리다이렉트 (scope: `profile openid`)
3. 콜백에서 access token + ID token 수신, ID token 검증
4. `userId`, `displayName`, `pictureUrl` 추출
5. 서버: `lineUserId`로 기존 Influencer 조회
   - 있으면 → 로그인 처리 (세션 발급)
   - 없으면 → 추가 정보(전화번호, 약관 동의 등) 입력 화면 → 신규 Influencer 생성
6. **공식계정 친구추가 강제** — 가입 완료 직후 친구추가 URL/QR 노출, 친구추가 안 한 상태에선 다음 단계로 진행 불가

기존 이메일/비밀번호 가입과 병행한다 (LINE 친구추가를 원치 않는 케이스 대비).

## DB 변경

### Influencer
- `lineUserId String? @unique` 추가 (LINE 가입자만 채움)
- `lineLinkedAt DateTime?` 추가 (라인 연동 시각)
- `lineFriendStatus` enum `{ UNKNOWN, ADDED, BLOCKED }` 추가, default `UNKNOWN`
- `passwordHash`를 `String?`로 완화 (LINE 단독 가입 시 비밀번호 없음)

마이그레이션: 기존 행은 `lineUserId = null`, `passwordHash`는 NOT NULL → NULL 허용으로 변경 (기존 값 유지).

## API

### `GET /influencer-auth/line/authorize`
- LINE Login URL 생성 후 302 리다이렉트
- state, nonce 발급(세션 쿠키 또는 단기 Redis)

### `GET /influencer-auth/line/callback`
- `code`, `state` 수신 → token 교환 → ID token 검증
- `lineUserId`로 기존 유저 조회 후 분기:
  - 기존 유저: 세션 발급 후 client-web 홈으로 리다이렉트
  - 신규: 단기 가입 세션(쿠키)에 LINE 프로필 저장 후 가입 마무리 화면으로 리다이렉트
- ID token 검증은 LINE 공식 JWKS 사용

### `POST /influencer-auth/line/complete-signup`
- 단기 가입 세션 + 추가 입력 정보로 신규 Influencer 생성

## 메시징

### 트리거 이벤트
다음 시점에 `lineUserId`가 있고 친구추가 상태인 유저에게 push:

| 이벤트 | 메시지 종류 | 비고 |
|---|---|---|
| 응모 승인 | text | 캠페인명 + 다음 단계 안내 |
| 응모 반려 | text | 사유 포함 |
| 배송 시작 | text | 운송장 번호 + 추적 링크 |
| 배송완료 → 수령확인 요청 | text + button | 수령 확인 페이지 딥링크 |
| 게시 기한 D-3 / D-1 | text | 기한 일자 |
| 투고 반려 | text | 코멘트 일부 + 재제출 페이지 링크 |
| 캠페인 완료 (입금 예정) | text | 금액 안내 |

전부 push message 사용. LINE 무료 200통/월 한도 초과 시 유료 플랜으로 전환.

### 친구추가 / 블록 추적
- LINE Messaging API의 webhook 엔드포인트(`POST /line/webhook`)를 추가
- `follow` 이벤트 → `lineFriendStatus = ADDED`, `lineLinkedAt` 업데이트
- `unfollow` 이벤트 → `lineFriendStatus = BLOCKED`
- 서명 검증 필수 (`x-line-signature`)

### 발송 실패 대응
- push API 403/410(blocked/unfollowed) → DB의 `lineFriendStatus = BLOCKED` 반영
- 차단된 유저는 이후 push 생략, 중요한 통지는 **이메일 fallback**으로 발송
- 이메일 fallback은 가입 시점에 수집된 이메일 사용 (LINE-only 가입자는 이메일 입력을 옵션 단계로 두지만 강력 권장)

## 환경 변수

- `LINE_LOGIN_CHANNEL_ID`
- `LINE_LOGIN_CHANNEL_SECRET`
- `LINE_LOGIN_REDIRECT_URI`
- `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` (long-lived)
- `LINE_MESSAGING_CHANNEL_SECRET` (webhook 서명 검증)
- `LINE_OA_ADD_FRIEND_URL` (가입 마무리 화면 노출용)

## 라이브러리

- 서버: `@line/bot-sdk` (Messaging API + webhook helpers)
- ID token 검증: `jose` (이미 NestJS 환경에 있을 가능성 높음, 없으면 추가)

## 보안

- ID token 검증: `iss`, `aud`(channelId), `exp`, `nonce` 모두 확인
- webhook 서명: HMAC-SHA256 raw body 비교
- `lineUserId` 노출 금지 (PII)
- 세션 발급은 기존 influencer-auth 흐름 재사용 (refresh token 등)

## 범위 외 (후속)

- LIFF (LINE 앱 안에서 동작하는 미니앱) — 현재 web flow로 충분
- 풍부한 메시지 템플릿 (Flex Message) — 1차는 text + button으로 단순화
- 인증 OA 신청 — OA 등록 후 별도 진행
- 광고/마케팅 broadcast — 명시적 동의 절차 별도 설계 필요

## 작업 분할 권장

1. **Phase 1 — Auth**: LINE Login Channel 발급, callback flow, lineUserId 저장, 친구추가 화면
2. **Phase 2 — Webhook**: Messaging API Channel 발급, webhook follow/unfollow 동기화
3. **Phase 3 — 통지**: 트리거 이벤트별 push 발송 + 이메일 fallback
4. **Phase 4 — 운영**: 발송 실패 로깅/재시도 큐, 유료 플랜 전환 판단 모니터링

각 phase는 독립적으로 배포 가능.
