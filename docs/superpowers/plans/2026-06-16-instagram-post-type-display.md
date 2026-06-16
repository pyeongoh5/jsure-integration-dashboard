# Instagram 피드/릴스 표시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin-web 응모관리·검토 페이지와 client-web 응모내역 카드에 Instagram 응모의 피드/릴스 구분을 표시한다.

**Architecture:** `instagramPostType` 필드는 `CampaignApplication`에 이미 저장되고 `AdminApplicationSchema`·`InfluencerApplicationSchema`에는 이미 노출되어 있다. `AdminSubmittedPostSchema`에만 필드를 신규 추가하고 API 매핑을 보완한 뒤, 세 UI 화면에서 조건부로 라벨/태그를 출력한다. 데이터 모델·캠페인 모델·응모 생성 로직은 변경하지 않는다.

**Tech Stack:** TypeScript, zod, NestJS/Prisma, React (Vite), CSS Modules, pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-06-16-instagram-post-type-display-design.md`

---

## File Structure

**Modify:**

- `packages/shared/src/types/adminInfluencer.ts` — `AdminSubmittedPostSchema`에 `instagramPostType` 필드 추가.
- `apps/api/src/admin-applications/admin-applications.service.ts` — `SUBMITTED_POST_INCLUDE.application.select`에 `instagramPostType` 추가, `SubmittedPostRow` 타입과 `toSubmittedPostResponse` 매핑에 필드 전파.
- `apps/admin-web/src/domains/application/components/applicants/types.ts` — `Applicant` 타입에 `instagramPostType` 필드 추가.
- `apps/admin-web/src/domains/application/components/applicants/applicantTransform.ts` — row에 필드 전파.
- `apps/admin-web/src/domains/application/components/applicants/ApplicantTable.tsx` — 미디어 셀에서 INSTAGRAM·instagramPostType일 때 라벨 출력.
- `apps/admin-web/src/pages/Applicants/Applicants.module.css` — `.mediaItem`(컬럼 wrapper)·`.mediaLabel` 스타일 추가.
- `apps/admin-web/src/domains/application/components/drafts/types.ts` — `DraftReview` 타입에 `instagramPostType` 필드 추가.
- `apps/admin-web/src/domains/application/components/drafts/draftTransform.ts` — row에 필드 전파.
- `apps/admin-web/src/domains/application/components/drafts/DraftTable.tsx` — 미디어 셀에서 INSTAGRAM·instagramPostType일 때 라벨 출력.
- `apps/admin-web/src/pages/Drafts/Drafts.module.css` — `.mediaItem`·`.mediaLabel` 스타일 추가.
- `apps/client-web/src/domains/application/components/ApplicationCard.tsx` — SNS 태그 옆에 영문 `FEED`/`REELS` 태그 조건부 출력.

**No change:** Prisma 스키마, DB, `AdminApplicationSchema`, `InfluencerApplicationSchema`, `apps/admin-web/src/domains/campaign/types.ts` 의 `INSTAGRAM_POST_TYPE_LABEL`(재사용만).

**Note (테스트 인프라):** `packages/shared`·`apps/admin-web`·`apps/client-web`에는 단위 테스트 인프라가 없다. 본 계획은 `pnpm typecheck`·`pnpm build`·수동 UI 확인을 검증 수단으로 사용한다.

---

## Task 1: shared 스키마에 AdminSubmittedPost.instagramPostType 추가

**Files:**
- Modify: `packages/shared/src/types/adminInfluencer.ts`

- [ ] **Step 1: import에 `InstagramPostTypeSchema` 추가 확인**

파일 상단 import를 확인. 이미 `import { InstagramPostTypeSchema } from "./campaign.js";`가 있다(line 3). 없다면 추가한다.

- [ ] **Step 2: `AdminSubmittedPostSchema`에 필드 추가**

`AdminSubmittedPostSchema`(line 112 부근) 정의에서 `snsType: SnsTypeSchema,`(line 114) 바로 아래에 다음 한 줄을 삽입한다.

```ts
  instagramPostType: InstagramPostTypeSchema.nullable(),
```

수정 후 해당 영역은 다음과 같다:

```ts
export const AdminSubmittedPostSchema = z.object({
  id: z.string(),
  snsType: SnsTypeSchema,
  instagramPostType: InstagramPostTypeSchema.nullable(),
  url: z.string().url(),
  // ... 이하 기존 필드
```

- [ ] **Step 3: shared 빌드·typecheck**

```bash
pnpm --filter @jsure/shared build
pnpm --filter @jsure/shared typecheck
```

Expected: 모두 성공. 이 시점에 `apps/api`·`apps/admin-web`의 `AdminSubmittedPost` 타입을 사용하는 곳에서 새 필드 누락 타입 에러가 발생할 수 있는데, 후속 Task에서 채운다. 일단 shared만 빌드 통과 확인.

- [ ] **Step 4: 커밋**

```bash
git add packages/shared/src/types/adminInfluencer.ts
git commit -m "feat(shared): AdminSubmittedPost에 instagramPostType 필드 추가"
```

---

## Task 2: API에서 application.instagramPostType 전파

**Files:**
- Modify: `apps/api/src/admin-applications/admin-applications.service.ts`

- [ ] **Step 1: `SUBMITTED_POST_INCLUDE.application.select`에 `instagramPostType` 추가**

`SUBMITTED_POST_INCLUDE`(line 621 부근)의 `application.select` 객체에서 `id: true, status: true,` 다음 줄에 `instagramPostType: true,`를 추가한다. 결과:

```ts
  application: {
    select: {
      id: true,
      status: true,
      instagramPostType: true,
      campaign: {
        select: { id: true, title: true, thumbnailUrl: true, rewardJpy: true },
      },
      influencer: { ... },
    },
  },
```

- [ ] **Step 2: `SubmittedPostRow.application` 타입에 필드 추가**

`SubmittedPostRow`(line 671 부근)의 `application` 객체 타입에서 `id: string; status: ApplicationStatus;` 다음 줄에 `instagramPostType: InstagramPostType | null;`를 추가한다. `InstagramPostType`은 이미 파일 상단(line 8)에 import되어 있다. 결과:

```ts
  application: {
    id: string;
    status: ApplicationStatus;
    instagramPostType: InstagramPostType | null;
    campaign: { id: string; title: string; thumbnailUrl: string | null; rewardJpy: number };
    influencer: { ... };
  };
```

- [ ] **Step 3: `toSubmittedPostResponse` 매핑에 필드 추가**

`toSubmittedPostResponse`(line 727 부근) 반환 객체에서 `snsType: row.snsType,`(line 748) 다음 줄에 `instagramPostType: row.application.instagramPostType,`를 삽입한다. 결과:

```ts
  return {
    id: row.id,
    snsType: row.snsType,
    instagramPostType: row.application.instagramPostType,
    url: row.url,
    // ... 이하 기존 필드
```

- [ ] **Step 4: api typecheck**

```bash
pnpm --filter @jsure/api typecheck
```

Expected: 성공. zod 응답 스키마와 매핑 객체 모양이 일치하므로 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/admin-applications/admin-applications.service.ts
git commit -m "feat(api): 검토 페이지 응답에 instagramPostType 전파"
```

---

## Task 3: admin-web 응모관리 페이지에 라벨 표시

**Files:**
- Modify: `apps/admin-web/src/domains/application/components/applicants/types.ts`
- Modify: `apps/admin-web/src/domains/application/components/applicants/applicantTransform.ts`
- Modify: `apps/admin-web/src/domains/application/components/applicants/ApplicantTable.tsx`
- Modify: `apps/admin-web/src/pages/Applicants/Applicants.module.css`

- [ ] **Step 1: `types.ts`에 `instagramPostType` 필드 추가**

`Applicant` 타입(line 16)에서 `media: Media[];` 다음 줄에 `instagramPostType: InstagramPostType | null;`를 추가한다. 파일 상단 import에 `InstagramPostType`을 추가한다.

```ts
import type { ApplicationStatus, InstagramPostType } from "@jsure/shared";

// ... 중략

export type Applicant = {
  id: string;
  influencerId: string;
  name: string;
  handle: string;
  flagged: boolean;
  campaignId: string;
  campaign: string;
  media: Media[];
  instagramPostType: InstagramPostType | null;
  followers: number;
  // ... 이하 기존
};
```

- [ ] **Step 2: `applicantTransform.ts`에서 row에 필드 전파**

`toApplicant`(line 62) 반환 객체에서 `media: pickMedia(application.snsType),` 다음 줄에 `instagramPostType: application.instagramPostType,`를 추가한다.

```ts
  return {
    // ... 기존
    media: pickMedia(application.snsType),
    instagramPostType: application.instagramPostType,
    followers: appliedAccount?.followerCount ?? 0,
    // ... 이하 기존
  };
```

- [ ] **Step 3: `ApplicantTable.tsx` 미디어 셀 라벨 출력**

상단 import에 `INSTAGRAM_POST_TYPE_LABEL` 추가:

```ts
import { INSTAGRAM_POST_TYPE_LABEL } from "@/domains/campaign/types";
```

(이미 다른 곳에서 `@/domains/campaign/types`를 import하고 있으면 거기에 합쳐도 된다.)

미디어 셀(line 246–260)을 다음과 같이 교체:

```tsx
<td>
  <div className={styles.mediaList}>
    {applicant.media.map((media) => {
      const meta = MEDIA_META[media];
      const showPostType =
        media === "ig" && applicant.instagramPostType !== null;
      return (
        <span key={media} className={styles.mediaItem}>
          <span
            className={`${styles.media} ${styles[meta.cls]}`}
            title={meta.label}
            aria-label={meta.label}
          >
            <i className={meta.icon} />
          </span>
          {showPostType && (
            <span className={styles.mediaLabel}>
              {INSTAGRAM_POST_TYPE_LABEL[applicant.instagramPostType!]}
            </span>
          )}
        </span>
      );
    })}
  </div>
</td>
```

- [ ] **Step 4: `Applicants.module.css`에 `.mediaItem`·`.mediaLabel` 추가**

`.mediaList`·`.media` 정의 인근(`.mediaList` 정의 line 477 부근) 뒤에 다음을 추가한다.

```css
.mediaItem {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.mediaLabel {
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-muted);
}
```

기존 `.media`(28x28 아이콘 박스)는 그대로 두고, `.mediaItem`이 아이콘과 라벨을 세로 정렬로 감싼다.

- [ ] **Step 5: admin-web typecheck**

```bash
pnpm --filter admin-web typecheck
```

Expected: 사전 존재 오류 `Drafts/index.tsx:85` (showStageFilter) 1건만 발생. 본 작업으로 인한 신규 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/admin-web/src/domains/application/components/applicants/types.ts \
        apps/admin-web/src/domains/application/components/applicants/applicantTransform.ts \
        apps/admin-web/src/domains/application/components/applicants/ApplicantTable.tsx \
        apps/admin-web/src/pages/Applicants/Applicants.module.css
git commit -m "feat(admin): 응모관리 페이지 인스타 응모에 피드/릴스 라벨 표시"
```

---

## Task 4: admin-web 검토 페이지에 라벨 표시

**Files:**
- Modify: `apps/admin-web/src/domains/application/components/drafts/types.ts`
- Modify: `apps/admin-web/src/domains/application/components/drafts/draftTransform.ts`
- Modify: `apps/admin-web/src/domains/application/components/drafts/DraftTable.tsx`
- Modify: `apps/admin-web/src/pages/Drafts/Drafts.module.css`

- [ ] **Step 1: `types.ts`에 `instagramPostType` 필드 추가**

`DraftReview`(line 37)에서 `media: Media;` 다음 줄에 `instagramPostType: InstagramPostType | null;`를 추가한다. 파일 상단 import 보강:

```ts
import type {
  ApplicationStatus,
  InstagramPostType,
  PostReviewStatus,
  SnsType,
  SubmittedPostAttachment,
} from "@jsure/shared";

// ... 중략

export type DraftReview = {
  // ... 기존
  snsType: SnsType;
  media: Media;
  instagramPostType: InstagramPostType | null;
  url: string;
  // ... 이하 기존
};
```

- [ ] **Step 2: `draftTransform.ts`에서 row에 필드 전파**

`toDraftReview`(line 37) 반환 객체에서 `media: SNS_TO_MEDIA[post.snsType],` 다음 줄에 `instagramPostType: post.instagramPostType,`를 추가한다.

```ts
  return {
    // ... 기존
    snsType: post.snsType,
    media: SNS_TO_MEDIA[post.snsType],
    instagramPostType: post.instagramPostType,
    url: post.url,
    // ... 이하 기존
  };
```

- [ ] **Step 3: `DraftTable.tsx` 미디어 셀 라벨 출력**

상단 import에 `INSTAGRAM_POST_TYPE_LABEL` 추가:

```ts
import { INSTAGRAM_POST_TYPE_LABEL } from "@/domains/campaign/types";
```

미디어 셀(line 258–266)을 다음과 같이 교체:

```tsx
<td>
  <span className={styles.mediaItem}>
    <span
      className={`${styles.media} ${MEDIA_CLASS[draft.media]}`}
      title={media.label}
      aria-label={media.label}
    >
      <i className={media.icon} />
    </span>
    {draft.media === "ig" && draft.instagramPostType !== null && (
      <span className={styles.mediaLabel}>
        {INSTAGRAM_POST_TYPE_LABEL[draft.instagramPostType]}
      </span>
    )}
  </span>
</td>
```

- [ ] **Step 4: `Drafts.module.css`에 `.mediaItem`·`.mediaLabel` 추가**

`.media` 정의 인근(line 96–106 부근) 뒤에 다음을 추가한다.

```css
.mediaItem {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.mediaLabel {
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-muted);
}
```

- [ ] **Step 5: admin-web typecheck**

```bash
pnpm --filter admin-web typecheck
```

Expected: 사전 존재 오류 `Drafts/index.tsx:85`만. 신규 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/admin-web/src/domains/application/components/drafts/types.ts \
        apps/admin-web/src/domains/application/components/drafts/draftTransform.ts \
        apps/admin-web/src/domains/application/components/drafts/DraftTable.tsx \
        apps/admin-web/src/pages/Drafts/Drafts.module.css
git commit -m "feat(admin): 검토 페이지 인스타 응모에 피드/릴스 라벨 표시"
```

---

## Task 5: client-web 응모내역 카드에 FEED/REELS 태그 추가

**Files:**
- Modify: `apps/client-web/src/domains/application/components/ApplicationCard.tsx`

- [ ] **Step 1: SNS 태그 옆에 추가 태그 출력**

`<span className={styles.sns}>{app.snsType}</span>`(line 41) 다음 줄에 인스타 응모일 때 두 번째 태그를 출력한다.

```tsx
        <div className={styles.title}>
          {app.campaignTitle}
          <span className={styles.sns}>{app.snsType}</span>
          {app.snsType === "INSTAGRAM" && app.instagramPostType && (
            <span className={styles.sns}>{app.instagramPostType}</span>
          )}
        </div>
```

기존 `.sns` 스타일(`margin-left: 6px`)을 재사용하므로 별도 CSS 변경은 필요 없다.

- [ ] **Step 2: client-web typecheck**

```bash
pnpm --filter client-web typecheck
```

Expected: 성공. `InfluencerApplication.instagramPostType`은 이미 타입에 존재한다(`packages/shared/src/types/application.ts:140`).

- [ ] **Step 3: 커밋**

```bash
git add apps/client-web/src/domains/application/components/ApplicationCard.tsx
git commit -m "feat(client): 응모내역 카드에 인스타 피드/릴스 태그 추가"
```

---

## Task 6: 동작 검증

- [ ] **Step 1: 모노레포 전체 typecheck + build**

```bash
pnpm typecheck
pnpm build
```

Expected: `apps/admin-web`의 사전 존재 오류 `Drafts/index.tsx:85` 1건만 남고, 본 작업으로 인한 신규 오류 없음. 빌드는 모두 성공.

- [ ] **Step 2: 응답 스키마 일치 확인**

API가 응답에 `instagramPostType`을 채워 보내는지, admin-web의 `AdminSubmittedPostSchema.parse`가 통과하는지 런타임 점검을 위해 가능하다면 admin-web 검토 페이지를 dev 서버에서 열어 콘솔 에러가 없는지 확인한다.

```bash
pnpm --filter @jsure/api dev   # 별도 터미널
pnpm --filter admin-web dev    # 별도 터미널
```

브라우저에서 검토 페이지 진입 → 콘솔에 zod parse 에러 없음 확인.

- [ ] **Step 3: UI 수동 점검 (가능 시)**

| 화면 | 기대 결과 |
|---|---|
| admin 응모관리 — 인스타 FEED 응모 행 | 인스타 아이콘 아래 "피드" |
| admin 응모관리 — 인스타 REELS 응모 행 | 인스타 아이콘 아래 "릴스" |
| admin 응모관리 — X 응모 행 | X 아이콘만 (라벨 없음) |
| admin 검토 — 인스타 FEED 게시물 | 인스타 아이콘 아래 "피드" |
| admin 검토 — 인스타 REELS 게시물 | 인스타 아이콘 아래 "릴스" |
| client 응모내역 — 인스타 FEED 카드 | `INSTAGRAM` 태그 옆 `FEED` 태그 |
| client 응모내역 — 인스타 REELS 카드 | `INSTAGRAM` 태그 옆 `REELS` 태그 |
| client 응모내역 — X 카드 | `X` 태그만 |

UI 환경 접근이 불가능하면 본 단계는 사용자에게 수동 확인을 요청한다.

- [ ] **Step 4: git 상태 확인 후 마무리**

```bash
git status
git log --oneline -10
```

작업 외 파일 변경이 없는지 확인 후 사용자에게 완료 보고.

---

## 자체 검토 체크리스트

- ✅ spec 1: 검토 페이지 데이터 채널 — Task 1·2
- ✅ spec 2: 응모관리 페이지 UI — Task 3
- ✅ spec 3: 검토 페이지 UI — Task 4
- ✅ spec 4: client-web 응모내역 카드 — Task 5
- ✅ spec 5: 표시 규칙(인스타·null·비인스타) — 각 Task의 조건부 렌더에서 처리
- ✅ 라벨 매핑 재사용 — admin에서 `INSTAGRAM_POST_TYPE_LABEL` 임포트, client는 enum 값 그대로 노출
- ✅ Prisma·DB·캠페인·응모 생성 무변경 — 해당 파일 영역 외 변경 없음
- ✅ 검증 — Task 6 (typecheck, build, 수동 UI)
