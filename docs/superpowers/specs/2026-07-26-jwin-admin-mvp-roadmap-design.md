# J-WIN 어드민 MVP — 로드맵 재검토 & 결정 확정 (Design)

> 작성: 2026-07-26 · 브랜치 `j-win`
> 상위 문서: `docs/jwin/MVP_PLAN.md`(실행 계획) · `docs/jwin/DECISIONS.md`(D-1~D-10) · `docs/jwin/REQUIREMENTS.md`
>
> 이 문서는 MVP_PLAN을 다시 설계하지 않는다. MVP_PLAN에 **열려 있던 결정 2건을 닫고**,
> 페이즈 순서를 확정하고, **첫 구현 계획의 범위**를 정하기 위한 재검토 산출물이다.
> 화면·API의 상세 명세는 MVP_PLAN §3·§4를 정본으로 삼는다(여기서 반복하지 않는다).

---

## 1. 배경 (요약)

J-WIN MVP = 캠페인 1건을 등록→종료까지 어드민 화면만으로 완주하는 상태(MVP_PLAN §1).
백엔드·유저 LP·어드민 인증(D-10)·어드민 셸은 완성돼 있고, **남은 것은 어드민 화면 4종과
그 화면이 요구하는 API 보강**뿐이다.

MVP_PLAN에는 착수를 막는 미결정 2건이 박혀 있었다. 이 문서에서 둘 다 닫는다.

---

## 2. 닫은 결정

### D-11 — 어드민 API 계약 처리 방침 → **jwin-shared 공유 zod (권장안 채택)**

**결정**: `packages/jwin-shared`에 어드민 응답 zod 스키마를 추가한다. jwin-api는 그 모양으로
매핑해 반환하고, admin-web은 `Schema.parse()`로 받는다.

**근거**:
- 대시보드가 `@jsure/shared`(zod)를 계약의 단일 소스로 쓰는 기존 관례와 일치.
- `CODE_RULES.md` §2 "Prisma 모델 그대로 반환 금지"를 충족.
- jwin-api는 이미 `zod`를 요청 검증에 쓰고 있어(admin.ts 최상단 import) 의존 추가 부담이 낮다.
- §4 ①~⑦은 어차피 **새로 작성하는 엔드포인트**라 응답 모양을 처음부터 깨끗이 잡으면 되고,
  서버·프론트가 한 스키마를 공유해 드리프트를 원천 차단한다.

**부수 작업**:
- `packages/jwin-shared`에 `zod` 의존 추가, 어드민 응답 스키마 정의.
- `apps/admin-web/package.json`에 `@jsure/jwin-shared` 의존 추가(앱→패키지 방향, 경계 위반 아님).

**무조건 실행(결정과 독립)**: `GET /admin/campaigns/:id/winners` 응답에서 `encryptedShipping`
암호문을 제거한다. 복호화 배송지는 `GET /admin/winners/:id/shipping` 별도 엔드포인트로만
내리고 열람을 `AuditLog`에 남긴다(MVP_PLAN §3.4·§4-⑥).

### D-12 — 미디어(mediaUrl) 업로드 방식(MVP_PLAN §4-⑧) → **대시보드 R2 재사용 (권장안 채택)**

**결정**: 대시보드 R2 인프라를 재사용한다.
1. 대시보드 R2에 `R2_PUBLIC_BASE_URL`을 설정한다 → `r2.publicUrl()`이 **만료 없는 공개 URL**을 반환.
2. 대시보드 api(`apps/api`)에 J-WIN용 presign 엔드포인트 1개를 추가한다
   (`presignCampaignImageUpload` 패턴 복제, object key prefix만 `jwin/`).
3. admin-web이 이 엔드포인트로 업로드하고 **최종 공개 URL만** mediaUrl로 저장한다.

**근거**:
- 대시보드 R2에 presign/publicUrl 인프라가 이미 있다(`apps/api/src/uploads/uploads.service.ts`).
  새 스토리지를 운영할 이유가 없다.
- jwin-api는 게시 시각마다 mediaUrl을 fetch(`uploadMediaFromUrl`)한다. 공개 URL이 만료되면
  캠페인 후반 게시가 조용히 실패하므로, 만료 없는 URL(`R2_PUBLIC_BASE_URL`)이 필수 조건.
- 이 구조에서 **jwin-api는 R2를 전혀 건드리지 않는다**(admin-web ↔ 대시보드 api ↔ R2 만으로 닫힘).

**전제**: 배포 시 대시보드 R2 버킷에 `R2_PUBLIC_BASE_URL`(공개 CDN 도메인)이 반드시 설정돼야 한다.
`DEPLOY.md` 운영 체크리스트에 이 항목을 추가한다.

---

## 3. 페이즈 순서 — MVP_PLAN §5 그대로 유효

재검토 결과 순서 조정은 불필요하다.

- **Phase 0(환경)** 반드시 선행 — `/jwin-api/admin/me`가 200이 아니면 이후 전 화면이 401.
- **Phase 1(API 계약+보강)** 화면보다 선행 — 화면은 API 응답 모양에 의존.
- D-11·D-12가 닫혀 Phase 1·Phase 4의 진입 차단이 해제됨.

MVP_PLAN §5의 Phase 0~6 정의를 정본으로 유지한다.

---

## 4. 첫 구현 계획의 범위 → **Phase 0 + 1 + 2**

이 design 커밋 후 작성할 **첫 번째 구현 계획**은 화면 직전까지, 즉 아래 세 페이즈를 하나의
독립 커밋 가능 단위로 묶는다. Phase 3~5(실제 화면)는 각각 별도 spec→plan 사이클로 간다.

### 포함 범위

**Phase 0 — 환경 정상화**
- `pnpm install` 후 `pnpm-lock.yaml` 갱신분 별도 커밋(bcryptjs 제거분 반영).
- `apps/api/.env`·`apps/jwin-api/.env`의 `JWT_SECRET` 동일 확인(D-10).
- `pnpm dev:admin` + `pnpm dev:jwin-api` 기동 후 `/jwin-api/admin/me` 200 확인.

**Phase 1 — API 계약 정리 + 백엔드 보강** (`apps/jwin-api/src/routes/admin.ts`)
- D-11·D-12를 `DECISIONS.md`에 기록.
- `packages/jwin-shared`에 zod 도입 + 어드민 응답 스키마 정의.
- `winners` 응답에서 `encryptedShipping` 제거.
- §4 ①~⑦ 구현:
  - ① `GET /admin/campaigns/:id` (connectUrl·연동 상태 포함)
  - ② `GET /admin/campaigns/:id/prizes`
  - ③ `PATCH /admin/prizes/:id` (확률·수량 정정)
  - ④ `GET /admin/campaigns/:id/post-templates`
  - ⑤ `DELETE /admin/post-templates/:id` (게시에 사용된 소재는 거부)
  - ⑥ `GET /admin/winners/:id/shipping` (열람을 AuditLog 기록)
  - ⑦ `PATCH /admin/winners/:id/fulfillment` (허용 전이만: `READY→SHIPPED`, `AWAITING_INFO→READY`)
- D-12 presign 엔드포인트를 대시보드 api(`apps/api`)에 추가 + `R2_PUBLIC_BASE_URL` fallback 경고 확인.
- `draw.test.ts` 옆에 `admin.test.ts`로 권한·검증 테스트 추가.
- 완료 기준: `curl`로 7개 엔드포인트 200/401 확인.

**Phase 2 — 어드민 셸 정리**
- `navigation.ts`에서 `/jwin/prizes`, `/jwin/stats` 제거(캠페인 종속 개념이라 S2 탭으로 흡수).
- `App.tsx`에서 해당 라우트 제거, `pages/Jwin/Prizes.tsx`·`Stats.tsx` 삭제.
- `/jwin/campaigns/new`, `/jwin/campaigns/:id` 라우트 추가.
- `src/domains/jwin/` 신설(`api.ts`=jwinApi 래핑, `types.ts`=jwin-shared 스키마 재노출/보강).

### 제외 (별도 사이클)

- Phase 3~5: S1 목록, S2 편집 탭 6종, S3 당첨자 관리 — 각 페이즈별 spec→plan.
- Phase 6: 배포·G0 스파이크 실측(특히 DM 발송 개방 여부 — 미실측 시 D-4 재설계 위험).
- MVP_PLAN §1 "MVP에 넣지 않는 것"(감사로그 화면, 경품/소재 수정 일부, 캠페인 삭제, 통합 대시보드,
  응모자 원장, 어드민 다국어)은 계속 제외.

### 완료 기준

Phase 0+1+2 종료 시:
- `/jwin-api/admin/me` 200.
- §4 ①~⑦ 7개 엔드포인트가 zod 스키마 모양으로 200/401 응답, `encryptedShipping` 미노출.
- `pnpm typecheck` + `pnpm lint` 통과.
- 어드민 사이드바가 `캠페인 관리`·`당첨자 관리` 2개로 정리되고, `/jwin/campaigns/:id` 라우트가
  (플레이스홀더라도) 열림.

---

## 5. 제약 · 리스크 (MVP_PLAN §6에서 이 범위에 걸리는 것)

- **높음** — 스케줄러 TZ 결합(`scheduler.ts:29`): Railway에 `TZ=Asia/Tokyo` 설정 금지 규칙으로 우회 중.
  이번 범위에서 코드 수정은 안 하나, 배포 문서 경고를 유지한다.
- **높음** — `JWT_SECRET` 플레이스홀더: Phase 0에서 로컬 동일성만 확인. 운영 교체는 Phase 6.
- **낮음** — 어드민 무권한(`getAdminIdentity`는 토큰 유효성만 검사): GUEST도 캠페인 생성 가능.
  MVP 허용. 권한 분리 필요 시 `requireAdmin`에 `role` 검사 추가(이번 범위 밖).

---

## 6. 다음 단계

1. 이 문서를 커밋.
2. `writing-plans` 스킬로 **Phase 0+1+2** 구현 계획 작성.
3. 이후 Phase 3/4/5는 각각 별도 brainstorming(필요 시)→spec→plan.
