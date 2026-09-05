# J-WIN 배포 가이드 (Vercel + Railway + Neon)

> J-WIN은 jsure-integration-dashboard 모노레포의 `apps/jwin-api`, `apps/jwin-web`,
> `packages/jwin-db`, `packages/jwin-shared` 워크스페이스로 구성된다.
> 기존 대시보드 서비스와 배포·DB·시크릿을 완전히 분리해 운영한다.

## 1. Neon (Postgres) — J-WIN 전용 DB

1. 기존 대시보드 DB와 **별도의** Neon 프로젝트(또는 별도 데이터베이스) 생성. 리전은 Railway 리전과 맞출 것
2. `DATABASE_URL`(pooled), `DIRECT_DATABASE_URL`(direct) 두 개를 복사
3. 로컬 `.env` 배치 — Prisma CLI는 `apps/jwin-api/.env`를 읽지 않는다. `packages/jwin-db/.env`에 `DATABASE_URL`/`DIRECT_DATABASE_URL`을 같은 값으로 한 벌 더 둔다
4. **첫 배포 전 초기 마이그레이션 생성 필수** — `packages/jwin-db/prisma/migrations/`가 비어 있으면 컨테이너 기동 시 `prisma migrate deploy`가 실패한다. `migrate dev`는 기존 DB에 잘못 붙었을 때 리셋을 제안하므로, DB에 접속하지 않는 방식으로 만들고 커밋할 것:

```bash
cd packages/jwin-db
mkdir -p prisma/migrations/0_init
printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml
DATABASE_URL=postgresql://dummy DIRECT_DATABASE_URL=postgresql://dummy \
  pnpm exec prisma migrate diff --from-empty \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/0_init/migration.sql
```

적용은 빈 J-WIN DB에 `pnpm db:jwin:deploy`로 한다 (Railway 컨테이너가 기동 시 돌리는 것과 동일 경로).

## 2. Railway (API 서버) — 기존 프로젝트에 서비스 추가

1. 기존 Railway 프로젝트에 새 서비스 생성, 같은 리포 연결
2. 서비스 설정에서 Config File Path = `apps/jwin-api/railway.json` (Dockerfile 빌드)
3. 환경변수: `apps/jwin-api/.env.example`의 키 전부 (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `X_CLIENT_ID/SECRET`, `WEB_BASE_URL`, `ADMIN_WEB_ORIGIN`, `SCHEDULER_ENABLED=true`).
   - **`JWT_SECRET`은 대시보드 API(`@jsure/api`) 서비스의 값과 반드시 동일해야 한다 (D-10).** 어드민 인증이 대시보드 발급 토큰의 서명 검증으로 이뤄지므로, 값이 어긋나면 어드민 API가 전부 401이 된다. 로테이션 시 두 서비스를 함께 배포할 것
   - `ADMIN_WEB_ORIGIN`은 admin-web 운영 도메인. CORS 허용 목록에 들어간다
   - `TZ`는 설정하든 안 하든 무관하다. 당일분 생성 잡이 `timezone: 'Asia/Tokyo'`를 명시하므로 프로세스 TZ에 영향받지 않는다 (2026-09-05 수정). 다만 로그 시각이 헷갈리지 않도록 굳이 바꾸지 않는 쪽을 권한다
4. 배포 시 `prisma migrate deploy`가 선행됨 (Dockerfile CMD)
5. **단일 replica 유지** — 스케줄러가 인프로세스라 다중 인스턴스 시 중복 게시 위험 (v2에서 잡 잠금 도입 전까지)
6. Watch Paths를 `apps/jwin-api/**`, `packages/jwin-*/**`로 좁혀 기존 서비스와 배포 트리거 분리
7. 커스텀 도메인 연결 → `API_BASE_URL`

## 3. Vercel (웹) — 새 프로젝트

1. 같은 리포로 Vercel 프로젝트 추가, Root Directory = `apps/jwin-web`
2. 환경변수: `NEXT_PUBLIC_API_BASE_URL` = Railway API 도메인
3. 커스텀 도메인 연결 → API의 `WEB_BASE_URL`에 반영

## 4. URL 구조 (D-8 — 캠페인 기간 단위)

Round(회차) 기반 `/r/{roundSlug}` 복합 LP는 폐지됐다. 공개 진입점은 캠페인 단독 LP 하나뿐이고, 목록 페이지는 외부에 링크를 걸기 위한 보조 수단이다.

### 웹 (`WEB_BASE_URL`, Vercel)

| 경로 | 용도 |
|------|------|
| `/c/{slug}` | 캠페인 단독 LP — 응모·결과·당첨 히스토리. 자동 포스트의 `{{LP_URL}}`이 치환되는 대상 |
| `/campaigns` | 진행 중 캠페인 목록 (카드 나열, 외부 링크용) |
| `/winners/{winnerId}/shipping` | 현물 경품 배송지 입력 (캠페인 `endsAt` 이후 잠금) |
| `/connect/done`, `/connect/failed` | 브랜드 OAuth 연동 결과 |
| `/login/failed` | 유저 X 로그인 실패 |

### API (`API_BASE_URL`, Railway)

| 경로 | 용도 |
|------|------|
| `GET /health` | Railway 헬스체크 (`railway.json`의 `healthcheckPath`) |
| `GET /campaigns`, `GET /campaigns/:slug` | 목록·단독 LP 데이터 |
| `POST /campaigns/:campaignId/enter` | 응모 + 즉시 추첨 |
| `POST /winners/:winnerId/verify` | 검증 재시도 (당일 응모 화면 전용) |
| `GET /me`, `GET /me/wins` | 로그인 유저 정보·당첨 확정 히스토리 |
| `POST /winners/:winnerId/shipping` | 배송지 저장 |
| `GET /oauth/brand/*`, `GET /oauth/user/*` | OAuth2 + PKCE 시작·콜백 |
| `/admin/*` | 캠페인·소재·경품 CRUD, 코드 등록, 통계, 당첨자 목록. **로그인 엔드포인트는 없다 (D-10)** — 대시보드 access token을 `Authorization: Bearer`로 전달. `GET /admin/me`로 토큰 유효성 확인 가능 |

### 어드민 UI (`ADMIN_WEB_ORIGIN`, `@jsure/admin-web`)

J-WIN 어드민 화면은 대시보드 admin-web 안에 들어간다. 로그인·토큰 갱신은 대시보드 API가 담당하고, J-WIN 호출만 jwin-api로 나간다.

| 환경 | J-WIN API 접근 경로 |
|------|--------------------|
| 로컬 | vite 프록시 `/jwin-api` → `http://localhost:8080` (CORS 불필요) |
| 운영 | `VITE_JWIN_API_BASE_URL` = Railway 도메인 (jwin-api의 `ADMIN_WEB_ORIGIN`에 admin-web 도메인 등록 필요) |

`WEB_BASE_URL` / `API_BASE_URL`은 커스텀 도메인 연결 후 반드시 갱신한다. 자동 포스트 본문의 LP 링크가 `{WEB_BASE_URL}/c/{slug}`로 만들어지므로, 값이 틀리면 게시된 포스트가 잘못된 URL을 가리킨 채 남는다.

## 5. X Developer Console (종량제)

1. 앱 생성 → OAuth 2.0 설정:
   - Callback URLs: `{API_BASE_URL}/oauth/brand/callback`, `{API_BASE_URL}/oauth/user/callback`
   - Type: Web App (confidential client)
2. 크레딧 충전 + 지출 한도(spending limit) 설정 — 폭주 방지
3. `X_CLIENT_ID`, `X_CLIENT_SECRET`을 Railway에 설정

## 6. 운영 체크리스트 (캠페인 시작 전)

- [ ] G0 스파이크 5종 통과 기록 (spikes/README.md — 미디어 업로드 포함)
- [ ] 초기 마이그레이션 적용 확인 (`prisma migrate deploy` 로그)
- [ ] 대시보드 로그인 후 `GET /admin/me` 200 확인 (두 서비스의 `JWT_SECRET` 일치 검증), 캠페인 등록 (slug·`startsAt`/`endsAt`·`dailyPostTime`)
- [ ] 경품 등록 + 기프트코드 붙여넣기 — 입력 개수와 수량 일치 확인
- [ ] 포스트 소재(`PostTemplate`) 등록 — 캠페인 기간을 `activeFrom`~`activeTo`가 빈틈없이 덮는지 확인 (유효 소재가 없는 날은 게시가 건너뛰어짐)
- [ ] 결과 화면 소재(`winMediaUrl`/`loseMediaUrl`)와 PR 전환 URL(`prUrl`) 등록
- [ ] 브랜드 연동 링크 발송 → 전 브랜드 `needsReconnect=false` 확인
- [ ] 캠페인 상태를 `ACTIVE`로 전환 (`SETUP` 상태면 게시·응모 모두 동작하지 않음)
- [ ] 테스트 캠페인 1건으로 응모→당첨→DM 발송 E2E 리허설
- [ ] X 크레딧 잔액·지출 한도 확인
