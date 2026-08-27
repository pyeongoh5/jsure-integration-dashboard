# G0 스파이크 — X API 종량제 실측

착수 조건(G0 게이트) 검증용 스크립트. 종량제(pay-per-use) 앱의 크레딧을 소액($10 내외) 충전한 뒤 실행한다.

## 사전 준비

1. https://developer.x.com Developer Console에서 앱 생성, OAuth2 설정
   - 콜백 URI에 `http://localhost:8787/callback` 추가 (스파이크 스크립트 전용 임시 서버)
   - 앱 본체가 쓰는 `http://localhost:8080/oauth/brand/callback`, `.../user/callback` 은 그대로 둔다
2. `.env`에 X_CLIENT_ID / X_CLIENT_SECRET 설정
3. 토큰 발급 — 브라우저에서 출력된 URL을 열고 승인하면 토큰이 콘솔에 찍힌다
   (테스트용 개인 계정 + 브랜드 테스트 계정 각각 1회)

   ```bash
   cd apps/jwin-api
   npx tsx spikes/get-tokens.ts
   ```

   승인 화면에서 거부되면 `SCOPES`를 줄여 앱 권한 부족인지 가려낸다.
   (예: `SCOPES='tweet.read users.read follows.read offline.access'`)

   스파이크 1·2는 **참여자 역할 개인 계정**, 3·4·5는 **브랜드 계정**의 토큰이 필요하다.
   토큰 주인과 조회 대상이 같으면 `connection_status`가 반환되지 않으니 반드시 다른 계정으로 받는다.

## 실측 항목과 판정 기준

| # | 스크립트 | 확인 내용 | 통과 기준 |
|---|---|---|---|
| 1 | `spike-connection-status.ts` | 유저 토큰으로 타 계정 조회 시 connection_status 반환 여부 | "following" 배열 확인 가능 |
| 2 | `spike-repost-check.ts` | 유저 자신의 tweets에서 특정 포스트의 리트윗 검출 | referenced_tweets로 매칭 성공 |
| 3 | `spike-dm.ts` | 브랜드 토큰 → 유저 DM 발송 | 발송 성공 + 콘솔 차감액 $0.015 |
| 4 | `spike-post.ts` | URL 포함 포스트 게시 | 성공 + 차감액 $0.20 확인 |
| 5 | `spike-media-upload.ts` | v2 chunked 미디어 업로드 + 첨부 게시 (F-2.3) | initialize/append/finalize 성공 + 업로드 무과금 확인 |
| 6 | (수동) | Developer Console 크레딧 차감 내역 | 1·2번 호출이 owned read($0.001)로 잡히는지 |

## 실행 예시

스크립트가 `apps/jwin-api/.env`를 자동으로 읽으므로, 2번에서 받은 값을 `.env`에 넣어두면 된다.

```
USER_TOKEN=<개인 계정 access_token>
BRAND_TOKEN=<브랜드 계정 access_token>
TARGET_USER_ID=<브랜드 계정 numeric id>
USER_ID=<개인 계정 numeric id>
TARGET_POST_ID=<검증 대상 포스트 id>
RECIPIENT_ID=<DM 수신 유저 id>
MEDIA_URL=<업로드할 이미지 URL>
```

```bash
cd apps/jwin-api

npx tsx spikes/spike-connection-status.ts
npx tsx spikes/spike-repost-check.ts
npx tsx spikes/spike-dm.ts
npx tsx spikes/spike-post.ts
POST_TEXT='테스트' npx tsx spikes/spike-media-upload.ts
```

셸에 직접 준 값이 `.env`보다 우선하므로 `USER_TOKEN=... npx tsx ...` 로 덮어쓸 수도 있다.
numeric id는 아래로 확인한다.

```bash
curl -H "Authorization: Bearer $USER_TOKEN" https://api.x.com/2/users/by/username/<핸들>
```

모든 항목 통과 시 G0 게이트 통과로 기록하고 §부록 B 결정 로그에 반영한다.

3번(DM 발송)이 막히면 D-4(기프트코드 DM 자동 발송)를 재설계해야 하므로 가장 먼저 확인한다.
