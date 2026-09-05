# J-WIN 배포 가이드

> 이 문서 하나만 위에서부터 순서대로 따라가면 배포가 끝나도록 썼다.
> 사전 지식을 전제하지 않는다. 각 값이 **무엇이고 왜 필요한지**를 그 자리에서 설명한다.
>
> 관련 문서: `REQUIREMENTS.md`(요구사항) · `DECISIONS.md`(결정 로그) · `MVP_PLAN.md`(어드민 설계)

---

## 0. 전체 그림 — 무엇을 어디에 올리는가

J-WIN은 기존 대시보드 모노레포 안에 있지만, **배포는 완전히 분리**한다.

| 배포 대상 | 코드 | 플랫폼 | 누가 쓰나 |
|---|---|---|---|
| **jwin-api** | `apps/jwin-api` | Railway (기존 프로젝트에 서비스 추가) | 서버. 브라우저가 직접 부른다 |
| **jwin-web** | `apps/jwin-web` | Vercel (새 프로젝트) | **참여자** — 응모·결과·배송지 입력 |
| **J-WIN DB** | `packages/jwin-db` | Neon (새 프로젝트) | jwin-api 전용 |
| 어드민 화면 | `apps/admin-web` 의 `/jwin/*` | **기존 Vercel 프로젝트** | **운영자** — 캠페인 관리 |

**웹이 둘이라는 점이 헷갈리기 쉽다.**

- `jwin-web` = 참여자가 보는 공개 사이트. X 포스트의 링크가 여기로 온다
- `admin-web` = 운영자가 캠페인을 만드는 대시보드. **이미 배포돼 있고 새로 만들 필요 없다.** J-WIN 화면이 그 안에 들어가 있어서 환경변수 하나만 추가하면 된다

```
   참여자 ──→ jwin-web (Vercel, 새로 만듦)  ──┐
                                             ├──→ jwin-api (Railway) ──→ Neon (J-WIN DB)
   운영자 ──→ admin-web (기존, 그대로 사용) ──┤
                                             └──→ jsure-api (기존)  ──→ 기존 Neon

   ※ 두 API는 서로 호출하지 않는다. JWT_SECRET만 공유해 토큰 서명을 검증한다 (D-10)
```

**왜 DB를 분리하나** — J-WIN 마이그레이션이 기존 대시보드 DB에 잘못 붙으면 `prisma migrate`가 리셋을 제안하는 사고가 난다. 데이터 성격도 완전히 다르다.

**왜 API를 분리하나** — jwin-api는 인프로세스 스케줄러를 돌린다(매일 자동 게시). 기존 API에 얹으면 배포·스케일 정책이 엮인다.

---

## 1. 준비물

- [ ] Neon 계정 (기존 대시보드용 계정 그대로 가능)
- [ ] Railway 계정 + 기존 프로젝트 접근 권한
- [ ] Vercel 계정 + 기존 프로젝트 접근 권한
- [ ] X Developer Console 계정 + **결제 수단** (종량제 크레딧 충전용)
- [ ] 도메인 2개 — 아래에서 정한다

### 1-1. 도메인을 먼저 정한다 — 순서 문제 해결

Railway는 Vercel 주소(`WEB_BASE_URL`)를 알아야 하고, Vercel은 Railway 주소(`NEXT_PUBLIC_API_BASE_URL`)를 알아야 한다. **서로를 필요로 해서 어느 쪽도 먼저 못 하는 것처럼 보인다.**

해법은 배포 전에 **쓸 도메인을 먼저 정해두는 것**이다. 커스텀 도메인은 우리가 정하는 값이라 배포를 기다릴 필요가 없다. 아래 표를 채우고 시작한다.

| 용도 | 값 | 상태 |
|---|---|---|
| 참여자 웹 (Vercel jwin-web) | `https://jsure-instance.com` | 확정 — 커스텀 도메인 |
| J-WIN API (Railway jwin-api) | `https://jsure-instance-win-production.up.railway.app` | 확정 — Railway 생성 도메인 |
| 어드민 (기존 Vercel admin-web) | ⬜ 기존 운영 도메인 | 이미 있음 |
| 대시보드 API (기존 Railway) | ⬜ 기존 운영 도메인 + `/api` | 이미 있음 |

**J-WIN API 는 Railway 생성 도메인(`*.up.railway.app`)을 그대로 쓴다.** 서비스가 살아 있는 한 유지되고, 재배포로는 바뀌지 않는다. 서비스를 지웠다 다시 만들거나 이름을 바꿀 때만 바뀌는데, 그때 깨지는 것(브랜드 연동 링크·X 콜백·Vercel 환경변수)은 전부 다시 설정하면 복구된다.

**참여자 웹만 커스텀 도메인을 쓰는 이유**는 그 주소가 X 포스트 본문에 박혀 되돌릴 수 없기 때문이다 (§5-3). 나중에 API 에도 커스텀 도메인을 붙이고 싶으면 Railway 에서 추가하고 `API_BASE_URL`·X 콜백·Vercel 두 곳을 고치면 된다.

이 값들을 처음부터 환경변수에 넣으면 §5(Railway) → §6(Vercel) 순서로 진행해도 문제가 없다. `WEB_BASE_URL`은 **형식만 검증하고 실제 접속을 시도하지 않으므로**, 아직 Vercel 배포 전이어도 jwin-api는 정상 기동한다. 나중에 도메인만 연결하면 값이 맞아떨어진다.

> **커스텀 도메인을 안 쓸 계획이라면** 순서를 바꾼다: §6(Vercel) 먼저 배포 → 받은 `xxx.vercel.app` 주소를 §5의 `WEB_BASE_URL`에 넣는다. 이때 Vercel의 `NEXT_PUBLIC_API_BASE_URL`은 Railway 배포 후에 채우고 재배포한다.
>
> 다만 **`xxx.vercel.app` 임시 주소로 캠페인을 시작하면 안 된다.** 그 URL이 X 포스트에 영구히 박힌다 (§5-3 참조).

---

## 2. 시크릿 미리 만들기

배포 도중에 만들면 창을 오가게 되니 먼저 뽑아 안전한 곳에 적어둔다.

```bash
openssl rand -hex 32   # ① TOKEN_ENCRYPTION_KEY
openssl rand -hex 32   # ② SESSION_SECRET
openssl rand -hex 32   # ③ JWT_SECRET
```

### ① `TOKEN_ENCRYPTION_KEY` — 가장 조심할 값

브랜드·참여자의 X OAuth 토큰, 기프트코드, 배송지를 DB에 AES-256-GCM으로 암호화하는 키다.

**한 번 정하면 절대 바꾸면 안 된다.** 바꾸는 순간 기존 암호문을 전부 못 읽는다 — 브랜드 전원 재연동, 등록된 기프트코드 전량 소실, 배송지 열람 불가. 운영 DB가 비어 있는 지금 정하고 그대로 둔다.

반드시 **64자 hex**여야 한다. 아니면 서버가 기동조차 하지 않는다.

### ② `SESSION_SECRET`

참여자 로그인 세션 쿠키의 서명 키. J-WIN 전용이고 대시보드와 무관하다. 바꾸면 참여자가 다시 로그인해야 하지만 데이터 손실은 없다.

### ③ `JWT_SECRET` — 대시보드와 같은 값이어야 함

운영자 인증용. J-WIN에는 로그인 기능이 아예 없다. 운영자는 대시보드에서 로그인하고, 그때 받은 토큰을 J-WIN API에 그대로 보낸다. jwin-api는 **같은 키로 서명만 검증**한다 (D-10).

따라서 이 값은 **jwin-api와 기존 jsure-api 양쪽에 똑같이** 들어가야 한다. 다르면 J-WIN 어드민 API가 전부 401이 된다.

> ⚠️ **기존 jsure-api의 Railway 환경변수에 이미 운영 `JWT_SECRET`이 있다면 그 값을 그대로 쓴다.** 새로 만들어 덮으면 대시보드 사용자가 전부 로그아웃된다. (로컬 `.env`는 두 서비스 모두 `replace-me-...` 플레이스홀더라 참고가 안 된다.)

로컬 `.env`는 건드리지 않는다. 개발 DB에 기존 키로 암호화된 데이터가 있어 바꾸면 로컬이 깨진다.

---

## 3. Neon — J-WIN 전용 DB

1. **기존 대시보드 DB와 별도의** Neon 프로젝트 생성. 리전은 Railway 리전과 맞춘다 (지연 시간)
2. 연결 문자열 두 개를 복사한다
   - **pooled** (호스트에 `-pooler` 포함) → `DATABASE_URL`. 런타임용
   - **direct** (`-pooler` 없음) → `DIRECT_DATABASE_URL`. 마이그레이션용

   Neon은 커넥션 풀러를 거치면 마이그레이션 같은 장기 트랜잭션이 끊긴다. 그래서 두 개가 필요하다.

3. **초기 마이그레이션이 커밋돼 있는지 확인**

   ```bash
   ls packages/jwin-db/prisma/migrations/
   ```

   `0_init` 같은 디렉터리가 보이면 넘어간다. **비어 있으면** Railway 컨테이너 기동 시 `prisma migrate deploy`가 실패한다. 아래로 만든다 (DB에 접속하지 않는 방식이라 안전하다):

   ```bash
   cd packages/jwin-db
   mkdir -p prisma/migrations/0_init
   printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml
   DATABASE_URL=postgresql://dummy DIRECT_DATABASE_URL=postgresql://dummy \
     pnpm exec prisma migrate diff --from-empty \
     --to-schema-datamodel prisma/schema.prisma --script \
     > prisma/migrations/0_init/migration.sql
   git add prisma/migrations && git commit -m "chore(jwin-db): 초기 마이그레이션"
   ```

4. 빈 J-WIN DB에 적용해 스키마가 제대로 서는지 미리 확인한다

   ```bash
   # 먼저 packages/jwin-db/.env 에 위 두 URL을 적는다
   pnpm db:jwin:deploy
   ```

   > **Prisma CLI는 `apps/jwin-api/.env`를 읽지 않는다.** `packages/jwin-db/.env`에 `DATABASE_URL`/`DIRECT_DATABASE_URL`을 같은 값으로 한 벌 더 둬야 한다.

---

## 4. X Developer Console

먼저 해두면 Railway 환경변수를 한 번에 채울 수 있다.

### 개발용 앱을 그대로 써도 되나 — 된다

X 앱 하나에 콜백 URI를 여러 개 등록할 수 있으므로, **기존 개발용 앱에 운영 콜백 2개만 추가**하면 개발·운영이 한 앱을 공유할 수 있다. 어느 것을 쓸지는 인가 요청의 `redirect_uri`(= `API_BASE_URL`에서 조립)로 갈리고, 토큰은 DB가 분리돼 있어 섞이지 않는다.

```
http://localhost:8080/oauth/brand/callback          ← 개발
http://localhost:8080/oauth/user/callback           ← 개발
https://jsure-instance-win-production.up.railway.app/oauth/brand/callback   ← 운영
https://jsure-instance-win-production.up.railway.app/oauth/user/callback    ← 운영
```

**다만 크레딧과 레이트리밋이 공유된다.** 개발 중 실수로 게시 한 번이 나가면 운영 크레딧에서 $0.20이 빠진다. 로컬 `.env`의 `SCHEDULER_ENABLED`는 반드시 `false`로 둔다 — `true`면 자동 게시가 실제로 돈다.

캠페인이 실제로 돌기 시작해 크레딧 규모가 커지면 그때 분리를 검토한다. 분리할 때는 **운영용을 새로 만들고 지금 앱을 개발용으로 남긴다** — 반대로 하면 기존 연동을 전부 다시 받아야 한다.

### 새로 만드는 경우

1. https://developer.x.com 에서 앱 생성
2. **앱이 Project 안에 있어야 한다.** 좌측 트리에서 `Standalone Apps` 아래 있으면 OAuth 2.0이 동작하지 않는다. 프로젝트로 옮기거나 프로젝트 안에 새로 만든다
3. **User authentication settings**

   | 항목 | 값 |
   |---|---|
   | App permissions | **`Read and write and Direct message`** |
   | Type of App | `Web App, Automated App or Bot` (Confidential client) |
   | Callback URI | `https://jsure-instance-win-production.up.railway.app/oauth/brand/callback`<br>`https://jsure-instance-win-production.up.railway.app/oauth/user/callback`<br>(개발도 같이 쓰면 `http://localhost:8080/...` 2개 추가) |
   | Website URL | 유효한 URL 아무거나 (필수 입력) |

   App permissions가 낮으면 브랜드가 승인 화면에서 **"You weren't able to give access to the App"** 을 보게 된다.

4. **Keys and tokens** → OAuth 2.0의 `Client ID`, `Client Secret` 복사
   - ⚠️ 같은 화면의 `Bearer Token`은 **다른 것**이다. 앱 전용 토큰이라 DM·게시에 쓸 수 없다 (`AAAA...`로 시작하면 그것)
5. 크레딧 충전 + **지출 한도(spending limit) 설정.** 폭주 방지용이라 반드시 건다

   실측 단가 (2026-08-28, `DECISIONS.md` §G0): 포스트 게시 **$0.20/건**, DM **$0.015/건**, 읽기 **$0.001/건**, 미디어 업로드 **무료**

   > 콘솔 잔액은 실시간이 아니라 수 분 지연 반영된다.

---

## 5. Railway — jwin-api

### 5-1. 서비스 추가

**새 프로젝트를 만들 필요 없다.** 기존 Railway 프로젝트에 **서비스를 하나 추가**한다. Railway는 `프로젝트 > 서비스` 구조라 `jsure-api`와 `jwin-api`가 나란히 뜨고 각자 환경변수·도메인·로그를 갖는다.

같은 프로젝트에 두면 요금·사용량이 한 곳에서 보이고 두 서비스 로그를 오가기 편하다(`JWT_SECRET` 불일치 디버깅 등). 클라이언트별 요금 분리나 접근 권한 분리가 필요한 게 아니면 나눌 이유가 없다. 두 API는 서로 네트워크 호출을 하지 않으므로 기술적 제약도 없다.

1. 기존 프로젝트 → `New Service` → `GitHub Repo` → 같은 리포 선택
2. **Settings → Config File Path** 에 `apps/jwin-api/railway.json` 입력

   이걸 지정해야 J-WIN 전용 Dockerfile로 빌드된다. 안 하면 루트 `railway.json`을 읽어 **기존 대시보드 API가 빌드된다.**

### 5-2. Watch Paths — 놓치면 사고 난다

같은 리포를 두 서비스가 보고 있으면 **아무 커밋이나 푸시할 때마다 둘 다 재배포**된다.

| 서비스 | Watch Paths |
|---|---|
| jwin-api (새로 만든 것) | `apps/jwin-api/**`, `packages/jwin-*/**` |
| jsure-api (기존) | `apps/api/**`, `packages/shared/**` |

**기존 서비스에도 설정해야 한다.** 안 하면 J-WIN 커밋마다 대시보드 API가 재배포된다.

### 5-3. 환경변수

§1-1에서 정한 도메인을 그대로 넣는다. **Vercel 배포가 아직 안 끝났어도 상관없다** — `WEB_BASE_URL`은 형식만 검증하므로 서버는 정상 기동한다.

| 변수 | 값 | 설명 |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `8080` | Railway가 자동 주입하기도 한다 |
| `DATABASE_URL` | Neon **pooled** | §3에서 복사 |
| `DIRECT_DATABASE_URL` | Neon **direct** | 마이그레이션용 |
| `API_BASE_URL` | `https://jsure-instance-win-production.up.railway.app` | **자기 자신의 공개 주소.** OAuth 콜백 URL을 이걸로 조립한다 |
| `WEB_BASE_URL` | `https://jsure-instance.com` | **참여자 웹(jwin-web) 주소.** 아래 설명 참조 |
| `CORS_ORIGIN` | `https://admin.example.com` | **어드민(admin-web) 주소.** 쉼표로 여러 개 가능 |
| `SESSION_SECRET` | §2의 ② | |
| `TOKEN_ENCRYPTION_KEY` | §2의 ① | 64자 hex |
| `JWT_SECRET` | §2의 ③ | **jsure-api와 동일해야 함** |
| `X_CLIENT_ID` | §4에서 복사 | |
| `X_CLIENT_SECRET` | §4에서 복사 | |
| `SCHEDULER_ENABLED` | `true` | `false`면 자동 게시가 안 돈다 |

#### `API_BASE_URL` — 서버가 자기 주소를 왜 알아야 하나

서버가 **자기 주소를 남에게 알려줘야 하는** 경우가 있어서다.

1. **OAuth `redirect_uri`** — 브랜드가 X 에서 승인을 누르면 X 가 브라우저를 어디로 돌려보낼지 알아야 한다. 그 주소를 인가 요청에 실어 X 에게 미리 알려주는데, **절대 URL 이어야 한다.** X 가 브라우저를 보내는 주체라 상대 경로로는 안 된다
2. **브랜드에 전달하는 연동 링크** — 어드민 응답에 `{API_BASE_URL}/oauth/brand/start?accountId=...` 형태로 담긴다

요청의 `Host` 헤더로 유추할 수도 있지만 OAuth 에서는 위험하다. `redirect_uri` 는 X 콘솔에 등록한 값과 **정확히 일치**해야 하는데, 프록시를 거치면 내부 주소로 바뀔 수 있고 `Host` 는 클라이언트가 조작할 수 있어 인가 코드를 빼돌리는 통로가 된다. 그래서 명시적으로 설정하고 콘솔 등록값과 눈으로 맞춘다.

정리하면 **`WEB_BASE_URL` 은 "브라우저를 어디로 보낼까", `API_BASE_URL` 은 "X 가 나를 어디로 부를까"** 다. 둘 다 서버가 스스로 알 수 없다.

#### `WEB_BASE_URL`이 왜 중요한가

세 군데서 쓰인다.

1. **매일 게시되는 포스트의 LP 링크** — 소재 본문의 `{{LP_URL}}`이 `{WEB_BASE_URL}/c/{slug}`로 치환된다. **값이 틀리면 X에 이미 올라간 포스트가 죽은 링크를 가리킨 채 영구히 남는다.** 나중에 고쳐도 지나간 포스트는 되돌릴 수 없다
2. **OAuth 콜백 후 리다이렉트** — 브랜드 연동 성공 시 `/connect/done`, 실패 시 `/connect/failed`
3. **CORS 허용** — 코드가 항상 허용 목록에 넣는다. `CORS_ORIGIN`에 다시 적지 않아도 된다

그래서 **Vercel 커스텀 도메인을 연결한 뒤 그 값으로 반드시 갱신**한다. `xxx.vercel.app` 임시 도메인으로 캠페인을 시작하면 그 URL이 포스트에 박힌다.

> 끝 슬래시는 코드가 자동으로 제거하므로(`config.ts`) `https://jsure-instance.com/` 로 넣어도 링크가 `//c/slug` 로 깨지지 않는다. `https://` 는 반드시 포함해야 한다 — 형식 검증에 걸려 서버가 기동하지 않는다.

#### `CORS_ORIGIN`

브라우저가 다른 도메인의 API를 부를 수 있게 허용하는 목록이다. 기존 jsure-api와 **같은 이름·같은 형식**(쉼표 구분)을 쓴다. 여기엔 어드민 도메인만 넣으면 된다 — 참여자 웹은 `WEB_BASE_URL`로 자동 허용된다.

### 5-4. 배포 후 확인

1. **replica가 1인지 확인.** `apps/jwin-api/railway.json`에 `numReplicas: 1`이 박혀 있지만 UI에서 한 번 더 본다. 스케줄러가 인프로세스라 **2대면 같은 포스트가 두 번 올라간다**
2. 배포 로그에서 `prisma migrate deploy` 성공 확인 (Dockerfile CMD가 자동 실행)
3. 헬스체크

   ```bash
   curl https://jsure-instance-win-production.up.railway.app/health
   ```

4. **도메인 확인.** 현재 구성은 Railway 생성 도메인(`https://jsure-instance-win-production.up.railway.app`)을 그대로 쓴다. Settings → Networking 에서 실제 값이 §1-1 표와 같은지 확인하고, 다르면 `API_BASE_URL`·X 콜백·Vercel 두 곳을 실제 값으로 맞춘다.

   나중에 커스텀 도메인을 붙일 때도 같은 네 곳을 고치면 된다.

5. `TZ`는 설정하든 안 하든 무관하다. 스케줄러가 `timezone: 'Asia/Tokyo'`를 명시한다 (2026-09-05 수정). 로그 시각이 헷갈리지 않게 굳이 바꾸지 않기를 권한다

---

## 6. Vercel — jwin-web (참여자 웹)

여기서 §5의 Railway 도메인이 필요하다. 앞 절을 끝내고 오면 값이 이미 있다.

1. 같은 리포로 **새 Vercel 프로젝트** 추가
2. **Root Directory = `apps/jwin-web`**
3. 환경변수

   | 변수 | 값 | 타입 |
   |---|---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://jsure-instance-win-production.up.railway.app` | **Config** |

   > Vercel 이 `NEXT_PUBLIC_` 접두사를 보고 *"Remove the public framework prefix to keep this value private"* 경고를 낸다. 에러가 아니라 **정말 공개해도 되는 값인지 묻는 것**이다. 이 주소는 참여자 브라우저가 직접 호출해야 해서 애초에 감출 수 없으므로, **이름은 그대로 두고 타입만 `Config`(Secret 아님)로 지정**한다. 접두사를 떼면 Next.js 가 브라우저 번들에 넣지 않아 API 호출이 전부 실패한다.

4. **커스텀 도메인 연결**

   §1-1에서 정한 주소를 연결한다. Railway의 `WEB_BASE_URL`에 이미 같은 값을 넣어뒀다면 여기서 끝이다.

   임시 `xxx.vercel.app` 주소로 §5를 진행했다면, **지금 Railway의 `WEB_BASE_URL`을 커스텀 도메인으로 바꾸고 재배포한다.** 캠페인을 시작하기 전에 반드시 끝내야 한다 — 시작 후에 바꾸면 이미 게시된 포스트의 링크는 되돌릴 수 없다

---

## 7. 기존 admin-web에 J-WIN 연결

**새로 배포하지 않는다.** 이미 떠 있는 대시보드 Vercel 프로젝트에 환경변수 하나만 추가한다.

| 변수 | 값 | 타입 |
|---|---|---|
| `VITE_JWIN_API_BASE_URL` | `https://jsure-instance-win-production.up.railway.app` | **Config** |

Vite 도 빌드 타임에 번들로 넣는 공개 값이라 Secret 이 아니다. **Vercel 두 프로젝트에는 비밀이 하나도 들어가지 않는다** — 시크릿은 전부 Railway 쪽이다.

비워두면 로컬 개발용 프록시(`/jwin-api` → `localhost:8080`)를 쓰기 때문에 운영에서 동작하지 않는다.

추가 후 **재배포해야 반영된다** — Vite는 빌드 타임에 값을 박는다.

그리고 이 admin-web 도메인이 jwin-api의 `CORS_ORIGIN`에 들어가 있어야 한다 (§5-3).

### 대시보드 API(`apps/api`) 쪽에 추가할 것

J-WIN 소재 이미지는 대시보드의 R2 업로드를 재사용한다 (D-12). 그 프록시가 만료 없는 공개 URL을 만들 때 자기 주소를 알아야 한다.

| 변수 | 값 |
|---|---|
| `API_PUBLIC_BASE_URL` | `https://api.example.com/api` (기존 대시보드 API의 공개 주소) |

**미설정이면 J-WIN 미디어 업로드가 500으로 실패한다.**

---

## 8. URL 구조 (D-8)

### 참여자 웹 (`WEB_BASE_URL`)

| 경로 | 용도 |
|---|---|
| `/c/{slug}` | 캠페인 단독 LP — 응모·결과·당첨 히스토리. `{{LP_URL}}`이 치환되는 대상 |
| `/campaigns` | 진행 중 캠페인 목록 (외부 링크용) |
| `/winners/{winnerId}/shipping` | 현물 배송지 입력 (캠페인 종료 후 잠김) |
| `/connect/done`, `/connect/failed` | 브랜드 OAuth 연동 결과 |
| `/login/failed` | 참여자 X 로그인 실패 |

### API (`API_BASE_URL`)

| 경로 | 용도 |
|---|---|
| `GET /health` | Railway 헬스체크 |
| `GET /campaigns`, `GET /campaigns/:slug` | 목록·LP 데이터 |
| `POST /campaigns/:campaignId/enter` | 응모 + 즉시 추첨 |
| `POST /winners/:winnerId/verify` | 검증 재시도 |
| `GET /me`, `GET /me/wins` | 참여자 정보·당첨 히스토리 |
| `POST /winners/:winnerId/shipping` | 배송지 저장 |
| `GET /oauth/brand/*`, `GET /oauth/user/*` | OAuth2 + PKCE |
| `/admin/*` | 캠페인·경품·소재 CRUD, 통계, 당첨자. **로그인 엔드포인트 없음 (D-10)** |

---

## 9. 배포 직후 점검

위에서 아래 순서로 확인한다. 앞이 실패하면 뒤는 볼 필요가 없다.

**API 가 떴나**

```bash
curl -i https://jsure-instance-win-production.up.railway.app/health
```

- [ ] `200` + `{"ok":true}`
- [ ] Railway 배포 로그에 `prisma migrate deploy` 성공
- [ ] Railway Settings 에서 **replica = 1**

**참여자 웹이 API 를 부르나**

```bash
curl -i https://jsure-instance.com/campaigns
```

- [ ] `200` (진행 중 캠페인이 없으면 빈 목록이 정상)
- [ ] 브라우저로 열어 개발자도구 Network 에서 `jsure-instance-win-production.up.railway.app` 호출이 **200** 인지 확인. `CORS` 에러면 §11 참조

**어드민이 J-WIN API 를 부르나**

- [ ] 대시보드에 로그인한 상태로 `J-WIN → 캠페인 관리` 진입 → 목록이 뜨면 **`JWT_SECRET` 이 양쪽 일치**한다는 뜻
  - `401` → 두 서비스의 `JWT_SECRET` 불일치
  - `CORS` 에러 → jwin-api 의 `CORS_ORIGIN` 에 admin-web 도메인 없음
  - 화면 자체가 안 뜸 → admin-web 에 `VITE_JWIN_API_BASE_URL` 미설정 또는 설정 후 재배포 안 함
- [ ] 캠페인을 하나 만들어 **소재 탭에서 이미지 업로드 1회** → 성공하면 대시보드 API 의 `API_PUBLIC_BASE_URL` 이 제대로 걸린 것 (`500` 이면 미설정)

**X 연동이 되나**

- [ ] `/jwin/accounts` 에서 브랜드 계정을 만들고 연동 링크를 **본인 브라우저에서 열어** 승인까지 진행
  - 승인 후 `https://jsure-instance.com/connect/done` 으로 돌아오면 `API_BASE_URL`·`WEB_BASE_URL`·X 콜백 세 값이 모두 맞다는 뜻
  - `You weren't able to give access to the App` → §11 참조
- [ ] **기존에 연동해 둔 브랜드 계정이 있으면 재연동.** 2026-08-28 이전에 받은 토큰에는 `media.write` 스코프가 없어 **소재 이미지가 붙은 게시가 403 으로 실패**한다. refresh 로는 스코프가 붙지 않으므로 연동을 새로 받아야 한다
- [ ] X 크레딧 잔액·지출 한도 확인

---

## 10. 캠페인 시작 전 체크리스트

여기부터는 인프라가 아니라 **캠페인 1건마다** 어드민 화면에서 하는 일이다.

- [ ] 캠페인 등록 — slug, 기간(`startsAt`/`endsAt`), 게시 시각
- [ ] 브랜드 연동 링크 발송 → 승인 확인 (`/jwin/accounts`에서 상태 확인)
- [ ] 경품 등록 + 기프트코드 붙여넣기 — **입력 개수와 수량이 일치**해야 저장된다
- [ ] 포스트 소재 등록 — 캠페인 기간을 **빈틈없이 덮는지** 확인. 유효 소재가 없는 날은 게시가 통째로 건너뛰어진다 (화면이 `⚠ 소재가 없는 날`로 알려준다)
- [ ] 결과 화면 소재(`winMediaUrl`/`loseMediaUrl`)와 PR URL 등록
- [ ] CODE 경품이 있으면 DM 문구에 `{{CODE}}` 포함 — 없으면 저장이 막힌다
- [ ] `ACTIVE`로 전환 — 위 항목이 모두 충족돼야 버튼이 활성화된다
- [ ] 테스트 캠페인 1건으로 응모 → 당첨 → DM 발송 리허설

### 캠페인 진행 중

- [ ] **통계 탭**에서 `게시 실패`와 `미이행 종료`를 주기적으로 확인
  - 게시 실패 > 0 → 브랜드 재연동부터 의심한다
  - 미이행 종료 → 당첨은 됐지만 당일 내 검증을 못 끝낸 건. **재고는 이미 빠졌으므로** 보충 여부를 판단해야 한다 (D-2)
- [ ] 현물 경품: **당첨자 화면**에서 이행 상태를 `발송 준비`로 걸러 배송지 열람 → 발송 후 **발송 완료 처리**. 이걸 해야 현물 프로세스가 닫힌다
- [ ] 배송 실무용 CSV는 당첨자 화면의 `CSV 내보내기`. 필터에 걸린 **전체**가 담긴다
  - ⚠️ 배송지가 포함되고, **열람·내보내기 모두 감사 로그에 기록된다** (D-15)

### 캠페인 종료

- [ ] `ENDED` 전환은 **되돌릴 수 없고 배송지 입력이 즉시 잠긴다.** 배송지 미입력 당첨자가 남아 있지 않은지 먼저 확인

---

## 11. 문제가 생기면

| 증상 | 원인 |
|---|---|
| 어드민 J-WIN 화면이 전부 401 | `JWT_SECRET`이 jwin-api와 jsure-api에서 다름 |
| 어드민 화면에서 CORS 에러 | jwin-api의 `CORS_ORIGIN`에 admin-web 도메인 없음 |
| 어드민 J-WIN 화면만 안 보임 (다른 메뉴는 정상) | admin-web에 `VITE_JWIN_API_BASE_URL` 미설정 또는 설정 후 재배포 안 함 |
| 소재 이미지 업로드가 500 | 대시보드 API에 `API_PUBLIC_BASE_URL` 미설정 |
| 브랜드 승인 화면에서 `You weren't able to give access to the App` | X 앱 권한이 `Read and write and Direct message` 미만이거나, 앱이 Project 밖에 있음 |
| 소재 이미지가 붙은 게시만 403 | 브랜드 토큰에 `media.write` 스코프 없음 → 재연동 |
| 게시가 하루 통째로 안 나감 | 그날을 덮는 소재(`PostTemplate`)가 없음. 소재 탭에서 확인 |
| 같은 포스트가 두 번 올라감 | replica가 2 이상 |
| 컨테이너 기동 실패 | `TOKEN_ENCRYPTION_KEY`가 64자 hex가 아니거나, 마이그레이션 디렉터리가 비어 있음 |
| 게시된 포스트의 링크가 잘못됨 | `WEB_BASE_URL`이 임시 도메인인 채로 캠페인을 시작함. **지나간 포스트는 복구 불가** |
