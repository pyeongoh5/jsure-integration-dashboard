# JSure Integration Dashboard

Turborepo + pnpm 기반 모노레포.

## 구조

```
apps/
  admin-web/   대시보드 웹  (Vite + React + TS, Vercel)
  client-web/  모바일 웹    (Vite + React + TS, Vercel)
  api/         백엔드       (NestJS + Prisma + JWT, Railway)
packages/
  shared/      공유 타입/DTO
  tsconfig/    공유 tsconfig 프리셋
```

`admin-web`은 데스크톱 대시보드, `client-web`은 모바일 우선 사용자 앱입니다. 둘 다 같은 `@jsure/api`를 호출합니다.

## 기술 스택

- **Frontend**: Vite, React 18, TypeScript, React Router, TanStack Query, Axios → Vercel
- **Backend**: NestJS 10, Prisma, class-validator, Passport(JWT/Local) → Railway
- **DB**: PostgreSQL (Railway 또는 Neon)
- **Auth**: NestJS의 `@nestjs/jwt` + `@nestjs/passport` (Auth0/Clerk으로 위탁 가능)
- **Tooling**: Turborepo, pnpm workspaces, ESLint, Prettier

## 빠른 시작

```bash
# 1. 설치
pnpm install

# 2. 환경 변수
cp apps/api/.env.example apps/api/.env
cp apps/admin-web/.env.example apps/admin-web/.env
cp apps/client-web/.env.example apps/client-web/.env

# 3. DB 준비 (Postgres 인스턴스 필요)
cd apps/api
pnpm prisma migrate dev --name init
cd ../..

# 4. 개발 서버 — 어떤 조합으로 띄울지 선택
pnpm dev:admin     # 대시보드(admin-web) + api
pnpm dev:client    # 모바일(client-web) + api
pnpm dev:all       # 셋 다 동시에
```

`pnpm dev`는 `dev:admin`과 동일합니다 (기본).

기본 포트:
- admin-web : <http://localhost:5173>
- client-web: <http://localhost:5174>
- api       : <http://localhost:3000/api>

두 web 모두 Vite dev 서버에서 `/api` → `localhost:3000` 프록시가 걸려 있습니다.

## 자주 쓰는 명령

```bash
pnpm dev:admin                   # admin-web + api
pnpm dev:client                  # client-web + api
pnpm dev:api                     # api만
pnpm dev:admin-web               # admin-web만
pnpm dev:client-web              # client-web만
pnpm build                       # 전체 빌드
pnpm typecheck                   # 전체 타입 체크
pnpm --filter @jsure/api prisma:migrate
pnpm --filter @jsure/api prisma:studio
```

## 배포

### Vercel (admin-web / client-web)

각 앱을 별도 Vercel 프로젝트로 배포합니다 (도메인 분리).

- admin-web → Root Directory: `apps/admin-web`
- client-web → Root Directory: `apps/client-web`
- 각 폴더의 `vercel.json`이 모노레포 루트에서 `pnpm install` + `turbo build`를 실행합니다.
- 환경 변수: `VITE_API_BASE_URL` = `https://<railway-app>.up.railway.app/api`
- API의 `CORS_ORIGIN`에는 두 도메인을 콤마로 나열하세요. 예: `https://admin.jsure.app,https://m.jsure.app`

### Railway (api)

- Root Directory: `apps/api`
- `apps/api/railway.json` / `nixpacks.toml`에 빌드/시작 커맨드가 포함되어 있습니다.
- 환경 변수
  - `DATABASE_URL` (Railway Postgres 또는 Neon)
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN` (예: `1h`)
  - `CORS_ORIGIN` = Vercel 배포 도메인 (예: `https://jsure.vercel.app`)
  - `PORT` (Railway가 자동 주입)

### DB

Neon을 쓰면 별도 Postgres 플러그인 없이 `DATABASE_URL`만 Railway에 등록하면 됩니다. Prisma `migrate deploy`는 컨테이너 시작 시 자동 실행됩니다.

## 인증 흐름

1. `POST /api/auth/register` 또는 `POST /api/auth/login` → `{ accessToken, user }`
2. 클라이언트는 `localStorage.accessToken`에 보관 (Axios 인터셉터가 `Authorization: Bearer ...` 부착)
3. `GET /api/auth/me` → JWT 검증 후 사용자 반환

Auth0 / Clerk으로 전환하려면 `apps/api/src/auth/strategies/jwt.strategy.ts`의 검증 로직을 외부 발급자(JWKS)에 맞게 교체하면 됩니다.

## API 계약 (zod)

`packages/shared`가 **API 계약의 단일 소스**입니다. 모든 요청/응답 모양을 zod 스키마로 정의하고, 그 스키마에서 타입을 추론(`z.infer`)합니다.

### 어떻게 쓰는가

- **백엔드**(`apps/api`)는 `ZodValidationPipe`로 입력을 검증합니다.
  ```ts
  @Post("login")
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  login(@Body() dto: LoginRequest) { ... }
  ```
- **프론트엔드**(`apps/admin-web`, `apps/client-web`)는 응답을 `Schema.parse()`로 검증해 런타임 드리프트를 잡습니다.
  ```ts
  const res = await api.get("/health");
  return HealthResponseSchema.parse(res.data);
  ```

### 새 엔드포인트를 추가할 때

1. `packages/shared/src/types/<domain>.ts`에 zod 스키마 + `z.infer` 타입을 정의
2. `packages/shared/src/index.ts`에서 export
3. `pnpm --filter @jsure/shared build`
4. 백엔드 컨트롤러에서 `ZodValidationPipe(스키마)` 사용
5. 프론트엔드에서 `Schema.parse(res.data)`로 응답 파싱
6. `pnpm typecheck`로 양쪽 정합성 확인

### 절대 shared에 두면 안 되는 것

- Prisma 모델(`@prisma/client`) 그대로 — 브라우저 번들에 Node 코드/네이티브 바이너리 유입
- `passwordHash` 같은 내부 필드 — `PublicUser`처럼 외부 노출용 모양만 정의
- 비밀, 외부 시스템 자격 증명, 내부 시스템 ID
