# 단순리뷰 복수 URL 제출 설계

작성일: 2026-09-06

## 배경

1개 캠페인에서 2종 이상의 상품을 리뷰하는 경우(예: `Mary&May 스피큘 PDRN 크림 2종`), 인플루언서는 LIPS 에 리뷰를 2개 작성하고도 시스템에는 1개만 등록할 수 있다. `SubmittedPost` 가 `@@unique([applicationId, subType])` 로 서브타입당 1행만 허용하고 `url` 이 단일 문자열이기 때문이다. 나머지 리뷰는 시스템 밖에 남아 어드민 검수·리포트에서 누락된다.

## 목표

- 인플루언서가 단순리뷰 제출 화면에서 채널당 URL 을 2개 이상 등록할 수 있다.
- 어드민 검수 화면과 리포트·정산 산출물에 제출된 모든 URL 이 누락 없이 노출되고, 각 URL 이 새 창으로 열린다.

## 범위

**대상은 단순리뷰 경로만이다.** 즉 `campaignCategory === "SIMPLE_REVIEW"` 캠페인의
`SimpleReviewSubmitForm` → `POST /influencer/applications/:id/simple-review` → `SubmittedPost` 경로.

범위 밖:

- QOO10 등 다른 카테고리에서 LIPS/@cosme 리뷰를 받는 경로 (`ReviewSubmitForm` → `submitReview` → `SubmittedPost.submissionData.reviewUrls` JSON). 채널당 1개 제약이 동일하게 있으나 이번에는 손대지 않는다.
- 인스타그램·틱톡 등 SNS 게시물 URL. 인사이트 지표가 게시물 단위로 매달려 있어 복수화하려면 지표 집계·정산까지 재설계가 필요하다.
- 캠페인별 "리뷰 N개 필수" 강제. 검증은 기존과 동일하게 **참여 채널당 최소 1개**만 요구하고, 개수 미달은 어드민이 검수에서 반려로 처리한다.
- 어드민의 URL 편집(`InsightEditForm`). `canEdit = activePost.insightSubmitted` 조건이라 리뷰 카테고리에서는 노출되지 않는다.

## 데이터 모델

`SubmittedPost` 에 컬럼 하나를 더한다.

```prisma
model SubmittedPost {
  ...
  url        String?
  extraUrls  String[] @default([])
  ...
  @@unique([applicationId, subType])
}
```

`url` 은 대표(첫 번째) URL 로 그대로 두고 2번째부터를 `extraUrls` 에 순서대로 담는다.

이 선택의 이유:

- 마이그레이션이 컬럼 추가 한 줄이고 백필이 없다. 기존 행은 `extraUrls = []` 로 지금과 동일하게 동작한다.
- `@@unique([applicationId, subType])` 를 유지하므로 제출 시 `upsert` 키가 그대로다. 첨부·인사이트·정산이 전부 `SubmittedPost` 행 단위로 매달려 있어 이 제약을 풀면 파급이 크다.
- `post.url` 을 읽는 기존 코드가 전부 그대로 동작한다. 복수 URL 을 보여줘야 하는 지점만 골라서 고친다.

대가는 "대표 URL + 나머지"라는 인위적 구분이다. 읽기를 헬퍼 하나로 단일화해 호출부에서는 이 구분이 드러나지 않게 한다.

### 읽기 헬퍼

`packages/shared` 에 함수 하나를 추가한다.

```ts
/** 제출된 URL 전체를 제출 순서대로 반환한다. */
export function postUrls(post: { url: string | null; extraUrls?: string[] }): string[] {
  return [post.url, ...(post.extraUrls ?? [])].filter(
    (url): url is string => typeof url === "string" && url.length > 0,
  );
}
```

`url === null` 인 미제출 행은 빈 배열을 돌려준다. 기존 `post.url !== null` 필터는 `postUrls(post).length > 0` 으로 대체된다.

## 계약 (packages/shared)

`extraUrls: z.array(z.string().url()).default([])` 를 게시물을 실어 나르는 세 스키마 모두에 추가한다. `.default([])` 라 구버전 API 응답도 파싱에 실패하지 않는다.

| 스키마 | 위치 | 소비처 |
| --- | --- | --- |
| `SubmittedPostSchema` | `types/application.ts:51` | 인플루언서 앱 (client-web) |
| `AdminSubmissionPostSchema` | `types/adminInfluencer.ts:155` | 어드민 검수 화면 (drafts) |
| 정산 행의 `posts[]` | `types/adminInfluencer.ts:326` | 어드민 정산 CSV (Payouts) |

`AdminUpdateInsightRequestSchema`(`adminInfluencer.ts:261`)의 `url` 은 건드리지 않는다. 인사이트 보정 폼은 리뷰 카테고리에 노출되지 않으므로 범위 밖이다.

`types/application.ts` 의 요청 스키마도 바꾼다:

- `SubmitSimpleReviewRequestSchema` 의 `reviews[]` 를 `{ subType, url: string }` 에서 `{ subType, urls: string[] }` 로.

```ts
reviews: z
  .array(
    z.object({
      subType: CampaignSubTypeSchema,
      urls: z
        .array(z.string().url().startsWith("https://"))
        .min(1, "レビューURLを入力してください")
        .max(MAX_REVIEW_URLS),
    }),
  )
  .min(1, "レビューURLを入力してください")
  .refine((arr) => new Set(arr.map((r) => r.subType)).size === arr.length, "レビュー先が重複しています"),
```

- `MAX_REVIEW_URLS = 10` 상수를 shared 에 둔다. 스크린샷 상한(10)과 맞춘다.

이 요청 스키마는 어드민이 아니라 인플루언서 앱만 호출하는 비공개 계약이므로, 하위호환 필드 없이 한 번에 바꾼다.

## API (apps/api)

`influencer-applications.service.ts`:

- `submitSimpleReview` 의 `upsert` 에서 배열을 분해해 저장한다.

```ts
create: { applicationId, subType: post.subType, url: post.urls[0], extraUrls: post.urls.slice(1) },
update: { url: post.urls[0], extraUrls: post.urls.slice(1), submittedAt: now },
```

- 기존 "참여한 모든 SNS 제출" 검증(`missing` / `extra` → `SNS_NOT_SELECTED`)은 그대로 둔다. `urls.min(1)` 이 채널당 최소 1개를 보장하므로 추가 검증은 없다.
- `toPost` 반환값에 `extraUrls: row.extraUrls` 추가. 같은 파일 상단의 손으로 적은 `PostRow` 타입(`:45` 부근)에도 `extraUrls: string[]` 를 더한다.

`admin-applications.service.ts` 는 게시물을 손으로 매핑하는 곳이 세 군데다. 어드민 화면이 복수 URL 을 받으려면 아래 두 곳에 `extraUrls: post.extraUrls` 를 더해야 한다.

- `:1577` — 어드민 검수 목록·상세(`AdminSubmission`) 응답.
- `:1755` — 정산(Payouts) 응답.

`:582` 의 `InsightSnapshot` 은 인사이트 보정 이력용이라 범위 밖이므로 그대로 둔다.

Prisma 쿼리 쪽은 대부분 손댈 게 없다. `SUBMISSION_INCLUDE`(`:1409`)와 리포트 쿼리(`admin-reports.service.ts:187`)는 `posts` 를 `include` / `posts: true` 로 통째 가져오므로 새 컬럼이 자동으로 실린다. 예외는 정산 목록 쿼리(`:991`)로, `posts` 에 명시적 `select` 를 쓰고 있어 `extraUrls: true` 를 추가해야 한다.

`admin-reports.service.ts:214` 의 `postUrl` 은 리포트 산출물 항목이므로 아래 "리포트·정산" 절에서 다룬다.

## 인플루언서 화면 (apps/client-web)

`SimpleReviewSubmitForm.tsx` 를 채널당 URL 배열 폼으로 바꾼다.

- 폼 값 타입을 `Record<CampaignSubType, string>` 에서 `{ reviews: { subType, urls: { value: string }[] }[] }` 로 바꾸고 `useFieldArray` 를 쓴다. `react-hook-form` 의 `useFieldArray` 는 객체 배열을 요구하므로 `{ value: string }` 으로 감싼다.
- 채널마다 URL 입력 행을 렌더링하고, 그 아래 `[＋ URL 추가]` 버튼을 둔다. 2번째 행부터 오른쪽에 `×` 삭제 버튼.
- `fields.length >= MAX_REVIEW_URLS` 이면 추가 버튼을 `disabled` 처리한다.
- 스크린샷 업로드 영역은 지금처럼 응모 단위 1묶음(최대 10장)으로 유지한다. URL 별로 나누지 않는다.

같은 UI 패턴이 `CrossPostSection.tsx` 에 이미 있다(`useFieldArray` + `styles.add` / `styles.remove` 버튼). 마크업과 CSS 클래스 구성을 그대로 따라가고, 필요한 스타일은 `ReviewSubmitForm.module.css` 에 `.add` / `.remove` 로 옮겨 적는다.

`Detail.tsx` 의 `initial` 조립 두 곳(최초 제출 `initial={{}}`, 반려 후 재제출)을 배열로 바꾼다.

```ts
initial={Object.fromEntries(
  data.posts.map((post) => [post.subType, postUrls(post)]),
)}
```

`api.ts` 의 `submitSimpleReview` 시그니처를 `{ subType, urls: string[] }[]` 로 바꾼다.

### i18n

`i18n/client/messages.ts` 의 `application.simpleReviewForm` 에 키를 추가한다. 이 파일은 `jp` / `kr` 두 로케일을 가진다.

```ts
addUrl: { jp: "＋ URLを追加", kr: "＋ URL 추가" },
removeUrlAriaLabel: { jp: "削除", kr: "삭제" },
```

client-web 규칙에 따라 신규·수정 property 에는 `// new` 주석을 단다.

## 어드민 화면 (apps/admin-web)

`draftTransform.ts` 의 `posts[]` 매핑에 `urls: postUrls(post)` 를 추가한다(`url` 은 남겨둔다 — 다른 소비처가 있다). `drafts/types.ts` 의 해당 타입에도 `urls: string[]` 를 더한다.

`InsightDetailDialog.tsx`:

- `submittedUrls` 필터를 `visiblePosts.filter((post) => post.urls.length > 0)` 로 바꾼다.
- 제출 URL 섹션에서 채널 라벨 하나에 URL 을 줄바꿈으로 나열한다. 각 링크는 지금과 동일하게 `target="_blank" rel="noopener noreferrer"`.

```tsx
{submittedUrls.map((post) => (
  <div key={post.id}>
    <span className={styles.reviewChannelLabel}>{SUB_TYPE_LABEL[post.subType]}</span>
    {post.urls.map((url) => (
      <a key={url} className={styles.url} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    ))}
  </div>
))}
```

`styles.url` 이 인라인 표시라면 각 URL 이 한 줄을 차지하도록 `display: block` 을 준다.

`DraftApproveDialog.tsx` 의 확인 목록도 `draft.posts.flatMap((post) => post.urls)` 로 바꿔 전부 나열한다.

목록 화면(`DraftTable.tsx`)은 URL 을 직접 찍지 않고 모달 버튼만 두므로 변경이 없다.

## 리포트·정산 산출물

복수 URL 은 **줄바꿈(`\n`)** 으로 잇는다. URL 자체에 쉼표가 들어갈 수 있고, 두 산출물 모두 줄바꿈을 안전하게 담기 때문이다. CSV 는 `csvEscape` 가 값을 따옴표로 감싸므로 RFC 4180 상 정상이고, 엑셀은 `exceljs` 가 셀 문자열의 줄바꿈을 그대로 기록한다.

- **정산 CSV** (`pages/Payouts/index.tsx:202`): `post?.url ?? ""` → `post ? postUrls(post).join("\n") : ""`.
- **리포트 엑셀** (`admin-reports.service.ts:214`): `postUrl: post?.url ?? null` → `postUrl: post ? postUrls(post).join("\n") || null : null`. 어드민 `Reports/index.tsx` 의 `postUrl` 컬럼은 값을 그대로 쓰므로 수정이 필요 없다. `packages/shared/src/types/adminReport.ts` 의 `postUrl: z.string().nullable()` 도 그대로 둔다 — 여전히 문자열 하나다.

엑셀 셀에서 줄바꿈이 시각적으로 접히도록 리포트의 `postUrl` 컬럼에 `alignment: { wrapText: true }` 를 준다.

## 테스트

- `influencer-applications.service.spec.ts`
  - URL 2개 제출 → `upsert` 에 `url = urls[0]`, `extraUrls = urls[1:]` 로 분해되어 전달된다.
  - 참여 채널 중 하나를 빠뜨리고 제출 → `SNS_NOT_SELECTED`.
- `postUrls` 헬퍼 단위 테스트: `url` 이 `null` 이면 빈 배열, `extraUrls` 가 없으면 `[url]`, 둘 다 있으면 제출 순서 유지.

## 마이그레이션·배포

`prisma migrate dev` 로 `extraUrls` 컬럼 추가 마이그레이션 1건을 만든다. 기존 데이터 변환이 없고 컬럼이 `@default([])` 라 무중단이며, 롤백은 컬럼 드롭으로 끝난다.

API 를 먼저 배포하면 새 컬럼을 읽고 쓸 수 있으나 요청 스키마가 `urls` 로 바뀌므로 구버전 client-web 의 제출이 실패한다. **API 와 client-web 을 같은 릴리스로 함께 배포한다.**
