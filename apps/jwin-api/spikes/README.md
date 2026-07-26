# G0 스파이크 — X API 종량제 실측

착수 조건(G0 게이트) 검증용 스크립트. 종량제(pay-per-use) 앱의 크레딧을 소액($10 내외) 충전한 뒤 실행한다.

## 사전 준비

1. https://developer.x.com Developer Console에서 앱 생성, OAuth2 설정 (redirect: http://localhost:8787/callback)
2. `.env`에 X_CLIENT_ID / X_CLIENT_SECRET 설정
3. `npx tsx spikes/get-tokens.ts` — 브라우저가 열리고 로그인하면 토큰이 출력됨 (테스트용 개인 계정 + 브랜드 테스트 계정 각각 1회)

## 실측 항목과 판정 기준

| # | 스크립트 | 확인 내용 | 통과 기준 |
|---|---|---|---|
| 1 | `spike-connection-status.ts` | 유저 토큰으로 타 계정 조회 시 connection_status 반환 여부 | "following" 배열 확인 가능 |
| 2 | `spike-repost-check.ts` | 유저 자신의 tweets에서 특정 포스트의 리트윗 검출 | referenced_tweets로 매칭 성공 |
| 3 | `spike-dm.ts` | 브랜드 토큰 → 유저 DM 발송 | 발송 성공 + 콘솔 차감액 $0.015 |
| 4 | `spike-post.ts` | URL 포함 포스트 게시 | 성공 + 차감액 $0.20 확인 |
| 5 | `spike-media-upload.ts` | v2 chunked 미디어 업로드 + 첨부 게시 (F-2.3) | initialize/append/finalize 성공 + 업로드 무과금 확인 |
| 6 | (수동) | Developer Console 크레딧 차감 내역 | 1·2번 호출이 owned read($0.001)로 잡히는지 |

모든 항목 통과 시 G0 게이트 통과로 기록하고 §부록 B 결정 로그에 반영한다.
