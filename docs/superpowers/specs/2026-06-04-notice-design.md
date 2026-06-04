# 공지사항 (Notice) 기능 설계

작성일: 2026-06-04
대상 앱: `apps/admin-web`, `apps/client-web`, `apps/api`, `packages/shared`

## 1. 목표

- 어드민이 리치 텍스트 기반 공지사항을 작성·예약 게시할 수 있다.
- 인플루언서(client-web)가 공지 목록과 상세를 볼 수 있고, 하단 탭 뱃지로 미확인 공지 개수를 본다.
- 읽음 상태는 **클라이언트 localStorage**로만 관리한다 (서버 미관리).

## 2. 데이터 모델

`apps/api/prisma/schema.prisma`에 단일 모델 추가:

```prisma
model Notice {
  id          String   @id @default(cuid())
  title       String
  contentHtml String   @db.Text          // sanitize 후 저장된 HTML
  publishedAt DateTime                   // 미래값이면 client에서 비공개
  authorId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  author AdminUser @relation(fields: [authorId], references: [id])

  @@index([publishedAt])
  @@map("notices")
}
```

`AdminUser`에 `notices Notice[]` 역참조 추가.

마이그레이션: `20260604000000_add_notices`.

## 3. shared 패키지 (API 계약)

`packages/shared/src/types/notice.ts` 신규.

zod 스키마:

- `NoticeSchema` — 공통 표현 (`id`, `title`, `contentHtml`, `publishedAt`, `createdAt`, `updatedAt`, `authorName?: string`).
- `AdminNoticeListResponseSchema` — `{ items: NoticeSchema[]; total: number }`.
- `AdminNoticeResponseSchema` — `NoticeSchema`.
- `CreateNoticeRequestSchema` — `{ title: string (1..200), contentHtml: string (1..50000), publishedAt: ISO datetime string }`.
- `UpdateNoticeRequestSchema` — Create와 동일 (PUT 의미).
- `InfluencerNoticeListItemSchema` — `{ id, title, publishedAt }` (목록은 본문 미포함, 경량화).
- `InfluencerNoticeListResponseSchema` — `{ items: InfluencerNoticeListItemSchema[] }`.
- `InfluencerNoticeDetailSchema` — `{ id, title, contentHtml, publishedAt }`.

`packages/shared/src/index.ts`에서 export. 빌드: `pnpm --filter @jsure/shared build`.

## 4. API 엔드포인트

### Admin (`apps/api/src/admin-notices/`)

가드: `JwtAuthGuard` + `AdminRoleGuard` (기존 admin-* 모듈 패턴 그대로).

- `GET /admin/notices?skip=&take=` — 모든 공지(예약 포함) 최신순. `publishedAt desc, createdAt desc`.
- `POST /admin/notices` — `Body(ZodValidationPipe(CreateNoticeRequestSchema))`.
- `GET /admin/notices/:id`
- `PUT /admin/notices/:id` — `Body(ZodValidationPipe(UpdateNoticeRequestSchema))`.
- `DELETE /admin/notices/:id`

서비스에서:
- 저장 전 `contentHtml`을 `sanitize-html`로 통과시킴.
- 응답은 항상 `NoticeSchema` 모양으로 매핑 (Prisma 모델 직접 반환 금지).

### Influencer (`apps/api/src/influencer-notices/`)

가드: 기존 influencer JWT 가드.

- `GET /influencer/notices` — `publishedAt <= now()` 조건만, 최신순. 본문 없는 목록.
- `GET /influencer/notices/:id` — 동일 조건 + id 일치. 본문 포함.

미공개 공지에 직접 접근 시 404.

### sanitize-html 정책

허용 태그: `p, br, h1, h2, h3, h4, ul, ol, li, strong, em, u, s, a, img, span, div, blockquote, code, pre, hr`.
허용 속성:
- 모든 태그: `style` (단, `color`, `background-color`, `font-size`, `font-family`, `text-align`만).
- `a`: `href`, `target`, `rel`.
- `img`: `src`, `alt`, `width`, `height`. src는 자사 R2 도메인 또는 `data:` 거부.

신규 의존성: `apps/api/package.json`에 `sanitize-html` + `@types/sanitize-html` 추가 필요 (사용자 확인 후).

## 5. admin-web

### 디렉토리 (`CODE_RULES §7` 컨벤션)

```
apps/admin-web/src/components/Notices/
  noticeTransform.ts         // API 모델 -> view 모델 (publishedAt 표시 포맷 등)
  useNoticesData.ts          // 목록 fetch + reload + pagination
  useNoticeMutations.ts      // create/update/delete + 다이얼로그 상태
  NoticeTable.tsx            // 목록 테이블 (presentational)
  NoticeEditor.tsx           // Tiptap 래퍼 + 이미지 업로드 핸들러
  NoticeForm.tsx             // 제목/게시일 input + NoticeEditor 조합
  NoticeDeleteDialog.tsx     // 삭제 확인 다이얼로그 (액션 분리 원칙)

apps/admin-web/src/pages/Notices/
  index.tsx                  // 목록 페이지 (조립)
  Edit.tsx                   // /notices/new + /notices/:id/edit 공용
```

### 라우트 (`App.tsx`)

- `/notices` → 목록
- `/notices/new` → 작성
- `/notices/:id/edit` → 수정

### 사이드바 (`components/Sidebar/index.tsx`)

기존 항목 옆에 "お知らせ" / "공지사항" 추가 (기존 라벨 언어 컨벤션 따름).

### Tiptap 구성

신규 의존성 (사용자 확인 후):
- `@tiptap/react`, `@tiptap/starter-kit`
- `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-font-family`, `@tiptap/extension-text-align`

이미지 업로드 흐름:
1. 사용자가 이미지 드래그/선택.
2. `useNoticeImageUpload` 훅이 기존 `/uploads/presign` (또는 동등 엔드포인트)으로 presigned PUT URL 요청.
3. 파일 PUT 후 최종 URL을 Tiptap `image` 노드에 삽입.

업로드 엔드포인트 확인 필요 — 기존 `apps/api/src/uploads/` 또는 `r2/` 모듈 그대로 재사용. 신규 엔드포인트 추가 없이 기존 것 사용을 우선.

## 6. client-web

### 디렉토리

```
apps/client-web/src/components/Notices/
  useNoticesData.ts          // 목록 fetch
  useNoticeDetail.ts         // 상세 fetch
  useReadNotices.ts          // localStorage 읽기/쓰기 (useSyncExternalStore)
  useUnreadNoticeCount.ts    // 목록 + 읽음 ID 결합 카운트
  NoticeListItem.tsx
  NoticeContent.tsx          // sanitize 검증된 HTML 렌더 (dangerouslySetInnerHTML)

apps/client-web/src/pages/Notices/
  index.tsx                  // 목록
  Detail.tsx                 // 상세 + 진입 시 markRead
```

### 라우트 (`App.tsx`)

`AppShell` 하위에:
- `/notices` → 목록
- `/notices/:id` → 상세

### 하단 탭 (`components/layout/BottomTabBar.tsx`)

기존 3개 탭 옆에 4번째 탭 추가:

```
{ to: "/notices", icon: "fa-bell", label: "お知らせ", end: false }
```

`useUnreadNoticeCount()` 결과를 받아 `> 0`일 때 `<span class="bottom-tab__badge">{count}</span>` 표시 (CSS는 `BottomTabBar.css`에 추가).

`TABS` 상수의 콜백 파라미터 `t`는 `CODE_RULES §4` 위반이므로 본 작업 중 `tab`으로 고친다 (해당 파일을 직접 수정하는 김에).

### localStorage 키와 형식

- 키: `client-web:readNoticeIds`
- 값: `string[]` (JSON 직렬화)
- 읽기 시 zod 스키마 `z.array(z.string())`로 안전 파싱; 실패 시 `[]`로 폴백.
- 쓰기 시 dedupe.

### 미확인 개수 계산

```
const readIds = useReadNotices()
const { notices } = useNoticesData()
const unreadCount = notices.filter(notice => !readIds.has(notice.id)).length
```

목록 데이터는 `AppShell` 마운트 시 한 번 + 페이지 진입 시 invalidate. polling 없음.

상세 진입 시: `useEffect(() => markRead(id), [id])`.

## 7. 보안

- 백엔드: `sanitize-html`로 입력 정화 (admin도 신뢰하지 않음 — XSS 차단 일관성).
- 프론트: `dangerouslySetInnerHTML`은 서버에서 sanitize된 값만 사용.
- 이미지 src 허용 도메인: 자사 R2 도메인 (sanitize-html `transformTags`로 검증).
- Admin API 라우트는 admin JWT 가드, Influencer 라우트는 influencer JWT 가드.

## 8. 구현 순서 (요약)

1. shared: `notice.ts` 스키마 + export + build.
2. api: prisma 모델/마이그레이션 → admin-notices 모듈 → influencer-notices 모듈 (sanitize-html 도입).
3. admin-web: 라우트/사이드바 → Notices 컴포넌트/페이지 (Tiptap 포함).
4. client-web: 라우트 → Notices 컴포넌트/페이지 → BottomTabBar 탭/뱃지.
5. 양쪽 typecheck.

각 단계 후 `pnpm typecheck`로 검증.

## 9. YAGNI / 범위 밖

- 공지 카테고리, 태그, 검색.
- 푸시 알림.
- 다국어 분기.
- 어드민의 미리보기 페이지(에디터 자체가 WYSIWYG이므로 불필요).
- 서버측 읽음 기록 / 통계.
