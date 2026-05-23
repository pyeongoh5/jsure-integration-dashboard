# 배포 가이드 — Railway(API) + Vercel(Web) + Neon(DB)

작성일: 2026-05-23
작성자: pyoh (with Claude)
상태: 진행 중 — 1~2단계 부분 완료, 3단계부터 재개 예정

## 배경

- 단일 작업자 (혼자) + 신규 프로젝트 (사용자 0명) 상황
- 개발용 인프라를 그대로 운영 인프라로 활용 (규모 작아서 분리 불필요)
- 결제 카드 등록은 회사 명의 확보 후 진행 예정 → 일단 무료 한도 내에서 셋업

## 인프라 구성

| 컴포넌트                | 서비스  | 결제 주체(예정)    | 무료 한도                                  |
| ----------------------- | ------- | ------------------ | ------------------------------------------ |
| API (NestJS)            | Railway | 회사 명의          | $5 크레딧 1회, 소진 시 정지                |
| admin-web (Vite/React)  | Vercel  | 회사 명의          | Hobby 플랜 (상업적 사용은 약관상 Pro 권장) |
| client-web (Vite/React) | Vercel  | 회사 명의          | 동일                                       |
| PostgreSQL              | Neon    | 회사 명의          | 0.5GB, 컴퓨트 191시간/월, ap-southeast-1   |
| 소스코드                | GitHub  | 개인 (`pyeongoh5`) | 무료 무제한                                |

> **GitHub 계정과 결제는 분리됨.** Railway/Vercel/Neon은 자체 결제 시스템을 가지며, GitHub은 단순 소스 연결용. 추후 회사 GitHub Org를 받으면 repo transfer만 진행하면 됨.

## 현재 상태 (체크포인트)

### ✅ 완료

- [x] Neon Postgres 프로비저닝 완료 (`ep-holy-star-ao249jp4`, ap-southeast-1)
- [x] 로컬 `.env` 설정 (DATABASE_URL, DIRECT_URL pooled/direct 분리)
- [x] `.env` gitignore 확인됨
- [x] GitHub remote 연결 (`pyeongoh5/jsure-integration-dashboard`)
- [x] `apps/api/main.ts`의 `PORT` 환경변수 + `0.0.0.0` 바인딩 확인
- [x] **Railpack 마이그레이션** 커밋 (`3f65c5b`)
  - `nixpacks.toml` 삭제 (Nixpacks deprecated)
  - `railway.json` builder를 `RAILPACK`으로 변경
  - startCommand에서 불필요한 `cd apps/api` 제거
- [x] Railway 프로젝트 생성 + 첫 배포 시도 (Root Directory 미설정으로 빌더 오인식)

### ⏳ 진행 필요

- [ ] **`feature/influence-client` 브랜치 push** (인증 이슈로 사용자 직접 실행 필요)
- [ ] GitHub에서 PR 생성 → main 머지 (사용자 직접)
- [ ] Railway 서비스 설정: Root Directory = `apps/api`
- [ ] Railway 환경변수 등록
- [ ] Railway 도메인 발급 + 헬스체크
- [ ] Vercel admin-web 프로젝트 생성 + 배포
- [ ] Vercel client-web 프로젝트 생성 + 배포
- [ ] CORS_ORIGIN 업데이트 (Vercel 도메인 반영)
- [ ] 초기 관리자 계정 seed
- [ ] 운영 점검 체크리스트 통과

## 재개 시 진행 순서

### Step 1: 코드 푸시 & 머지 (사용자 작업)

```bash
# 인증이 안 되면 SSH로 전환
# git remote set-url origin git@github.com:pyeongoh5/jsure-integration-dashboard.git
git push -u origin feature/influence-client
```

GitHub에서 `feature/influence-client` → `main` PR 생성 후 머지.

### Step 2: Railway 서비스 설정

대시보드 → 생성된 서비스 → **Settings**:

1. **Source** 섹션
   - **Root Directory**: `apps/api` ← 가장 중요
   - **Branch**: `main`
   - **Watch Paths** (선택):
     ```
     apps/api/**
     packages/shared/**
     package.json
     pnpm-lock.yaml
     pnpm-workspace.yaml
     turbo.json
     ```

2. **Build** 섹션
   - Builder: `Railpack` (railway.json이 명시함, 자동)
   - Build/Start Command: 비워둠 (railway.json 우선)

### Step 3: Railway 환경변수 등록

**Variables** 탭 → **Raw Editor**:

```
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
REFRESH_EXPIRES_DAYS=
NODE_ENV=
CORS_ORIGIN=
```

**주의**:

- `PORT`는 등록하지 말 것 (Railway가 동적 주입)
- `JWT_SECRET`은 로컬 `.env`의 placeholder가 아닌 새로 생성한 값 사용
  ```bash
  openssl rand -hex 32
  ```
- `CORS_ORIGIN`은 Step 5 후 Vercel 도메인으로 갱신

### Step 4: Railway 도메인 발급 & 검증

1. **Settings → Networking** → **Generate Domain**
2. **Target Port**: `3000`
3. 발급된 도메인 (`xxx.up.railway.app`) 기록
4. **Deployments** 탭에서 Redeploy 트리거
5. 빌드 로그 기대 형태:
   ```
   ↳ Detected Node, Using pnpm
   ↳ Running build command:
       cd ../.. && pnpm install --frozen-lockfile && pnpm turbo build --filter=@jsure/api && cd apps/api && pnpm prisma generate
   ↳ Build successful
   ↳ Starting: pnpm prisma migrate deploy && pnpm start:prod
   ```
6. 헬스체크: `https://<도메인>/api/health` → 200 확인

### Step 5: Vercel admin-web 배포

https://vercel.com → **Add New Project → Import Git Repository**:

1. `pyeongoh5/jsure-integration-dashboard` 선택
2. 설정:
   - **Root Directory**: `apps/admin-web`
   - **Framework Preset**: Vite
   - **Build Command**: `cd ../.. && pnpm turbo build --filter=@jsure/admin-web`
   - **Install Command**: `cd ../.. && pnpm install --frozen-lockfile`
   - **Output Directory**: `dist`
3. **Environment Variables**:
   - `VITE_API_BASE_URL=https://<Railway 도메인>`
4. Deploy → Vercel 도메인 기록 (`admin-xxx.vercel.app`)

### Step 6: Vercel client-web 배포

Step 5와 동일, **Root Directory만 `apps/client-web`**으로 변경. 별도 Vercel Project 생성.

### Step 7: CORS 연결 마무리

Railway Variables의 `CORS_ORIGIN` 갱신:

```
CORS_ORIGIN=https://admin-xxx.vercel.app,https://client-xxx.vercel.app
```

Railway 자동 재배포 후 admin-web/client-web에서 로그인 시도 → 네트워크 탭에서 `/api/...` 200 확인.

### Step 8: 초기 관리자 계정 seed

`apps/api/prisma`에 seed 스크립트가 있는지 먼저 확인 필요. 방법:

- **로컬에서 실행**: `.env`를 임시로 Neon으로 두고 seed 실행 (또는 prisma studio로 직접 row 삽입)
- **Railway one-off**: `railway run pnpm --filter @jsure/api exec ts-node prisma/seed.ts`

## 운영 점검 체크리스트

- [ ] `JWT_SECRET`이 placeholder가 아닌 실제 랜덤값
- [ ] `.env` 파일이 git에 추적 안 됨 (확인 완료)
- [ ] Railway/Vercel 모두 `main` 브랜치 push 시 자동 배포 동작
- [ ] Neon auto-suspend 인지 (Free 플랜은 5분 idle 후 cold start)
- [ ] Vercel Hobby 플랜의 비상업적 사용 약관 인지 (실 사용자 받기 시작하면 Pro 전환 검토)
- [ ] Railway $5 크레딧 소진 모니터링 (소진 시 서비스 정지)
- [ ] Custom Domain 연결 (선택, 회사 도메인 받으면)

## 운영 진입 시 결제 전환

회사 인프라 받으면 다음 진행:

1. **GitHub Organization 생성** (회사 측) → 현재 repo `pyeongoh5/jsure-integration-dashboard`을 **Transfer**
2. **Railway**: 회사 명의 새 계정 가입 → 카드 등록 → 기존 프로젝트 새 계정으로 이전 (또는 회사 계정으로 신규 프로젝트 생성 후 환경변수 복사)
3. **Vercel**: 동일하게 회사 명의 가입 후 프로젝트 이전 (Vercel은 Team transfer 기능 제공)
4. **Neon**: 회사 명의 가입 후 프로젝트 transfer 또는 새 프로젝트로 데이터 마이그레이션

**예상 월 운영비** (사용자 적은 초기 기준):

- Railway Hobby: $5
- Vercel Pro: $20 (Hobby 유지 가능 시 $0)
- Neon Launch: $19 (Free 유지 가능 시 $0)
- **최소 $5 ~ 최대 $44/월**

## 참고 — 주요 파일

- `apps/api/railway.json` — Railway 빌드/배포 설정 (Railpack)
- `apps/api/.env.example` — 환경변수 템플릿
- `apps/api/src/main.ts` — PORT/CORS 처리 (Railway 호환 확인됨)
- `apps/api/src/health/health.controller.ts` — `/api/health` 엔드포인트
- `apps/api/src/auth/sessions.service.ts` — Refresh token 처리 (별도 secret 불필요, DB 기반 rotation)

## 알려진 이슈 / 주의사항

1. **Nixpacks deprecated**: 2025년 후반부터 Railway가 Railpack을 기본으로. 이미 마이그레이션 완료(`3f65c5b`).
2. **모노레포 빌드 컨텍스트**: Root Directory를 `apps/api`로 두되, `buildCommand`에서 `cd ../..`로 루트 올라가서 workspace install 필수.
3. **Neon Free cold start**: 운영 초기엔 1-2초 첫 요청 지연 발생 가능. 사용자 늘면 Launch 플랜으로 전환.
4. **Vercel 모노레포 Build Command**: `cd ../..`로 루트에서 pnpm/turbo 실행해야 workspace 의존성 해결됨.
