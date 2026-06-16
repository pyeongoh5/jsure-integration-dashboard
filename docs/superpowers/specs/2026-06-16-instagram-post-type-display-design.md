# 응모관리·검토 페이지 Instagram 피드/릴스 표시

## 배경

캠페인 응모 시 인플루언서는 Instagram에 한해 게시 형식(FEED/REELS)을 선택한다. 이 값은 `CampaignApplication.instagramPostType` 컬럼과 `InstagramPostType` enum(`FEED | REELS`)으로 이미 완비되어 있고, 응모 생성 API는 이를 저장한다.

그러나 다음 위치에서 Instagram 응모의 게시 형식을 시각적으로 확인할 수 없다.

- admin-web **응모관리(Applicants)** 페이지의 응모 목록 테이블
- admin-web **검토(Drafts)** 페이지의 게시물 검토 테이블
- client-web **응모내역(Applications)** 카드의 SNS 태그

## 목표

- admin-web 응모관리·검토 페이지: SNS 아이콘 **아래**에 Instagram 응모일 때만 "피드"/"릴스" 라벨을 작은 텍스트로 표시한다.
- client-web 응모내역 카드: 기존 SNS 태그(`{app.snsType}`) **옆**에 Instagram 응모일 때만 `FEED`/`REELS` 별도 태그를 동일 스타일로 추가 노출한다.
- 비-Instagram 응모와 `instagramPostType`이 `null`인 과거 데이터에는 라벨/태그를 표시하지 않는다.

## 비목표

- 데이터 모델·DB·응모 생성·캠페인 모델은 변경하지 않는다.
- client-web 다른 화면(Detail, PostSubmitForm 등)에서의 표시는 본 spec에 포함되지 않는다.

## 현황

- `AdminApplicationSchema`(`packages/shared/src/types/adminInfluencer.ts:56`)에 `instagramPostType: InstagramPostTypeSchema.nullable()` **이미 존재**. 응모관리 페이지는 API로 값을 받고 있지만 UI에서 미사용.
- `AdminSubmittedPostSchema`(같은 파일 line 112)에는 `instagramPostType` 필드 **없음**. 검토 페이지는 API 응답에 값 자체가 없다.
- `InfluencerApplicationSchema`(`packages/shared/src/types/application.ts:140`)에 `instagramPostType: InstagramPostTypeSchema.nullable()` **이미 존재**. client-web 응모내역은 값을 받고 있지만 UI에서 미사용.
- 한국어 라벨 매핑 `INSTAGRAM_POST_TYPE_LABEL: Record<InstagramPostType, string> = { FEED: "피드", REELS: "릴스" }`는 `apps/admin-web/src/domains/campaign/types.ts:20`에 이미 존재. admin-web 두 페이지에서 재사용한다.
- client-web은 영문 라벨(`FEED`/`REELS`)을 그대로 사용한다(enum 값 그대로 노출). 별도 매핑 불필요.

## 설계

### 1. 검토 페이지 데이터 채널 확보

응모관리 페이지는 이미 데이터를 받고 있으므로 별도 작업 불필요. 검토 페이지만 정비한다.

**스키마**: `packages/shared/src/types/adminInfluencer.ts`의 `AdminSubmittedPostSchema`에 다음을 추가한다.

```ts
instagramPostType: InstagramPostTypeSchema.nullable(),
```

import에 `InstagramPostTypeSchema` 추가.

**API 매핑**: `apps/api/src/admin-applications/admin-applications.service.ts`의 `AdminSubmittedPost` row 매핑에서 join된 application의 `instagramPostType`을 전파한다. SubmittedPost 모델에는 컬럼이 없으므로 `application.instagramPostType` 경로로 가져온다. Prisma include에 application의 해당 필드를 포함해야 하면 함께 추가한다(이미 포함되어 있으면 그대로).

### 2. 응모관리 페이지 UI

**Row 타입 확장** — `apps/admin-web/src/domains/application/components/applicants/types.ts`의 row 타입에 `instagramPostType: InstagramPostType | null` 추가.

**Transform 전파** — `applicantTransform.ts`에서 row 생성 시 `application.instagramPostType`을 그대로 넘긴다.

**테이블 표시** — `ApplicantTable.tsx`의 미디어 셀(line 247 부근, `applicant.media.map(...)`)에서 각 미디어 항목 렌더링 시:
- `media === "ig"`이고 `applicant.instagramPostType`이 truthy이면 아이콘 아래에 작은 라벨 `<span className={styles.mediaLabel}>{INSTAGRAM_POST_TYPE_LABEL[applicant.instagramPostType]}</span>`을 출력.
- 그 외에는 라벨 미출력(레이아웃 자리 차지 없음).

라벨 매핑은 `apps/admin-web/src/domains/campaign/types.ts:20`의 `INSTAGRAM_POST_TYPE_LABEL`을 import해 재사용.

**스타일** — `Applicants.module.css`(또는 미디어 표시가 정의된 인접 CSS)에 다음 클래스 추가.

```css
.media {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.mediaLabel {
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-subtle, #6b7280);
}
```

기존 `.media`가 inline 단일 아이콘 박스라면 column 방향 flex로 전환해 아이콘 아래 라벨이 자리잡도록 한다. 기존 사용처가 영향을 받지 않게 인접 셀 레이아웃을 한 번 확인하고, 필요 시 부모 컨테이너의 정렬/간격만 보정한다.

### 3. 검토 페이지 UI

`apps/admin-web/src/domains/application/components/drafts/`에서 동일 패턴 적용.

- `types.ts`: row 타입에 `instagramPostType: InstagramPostType | null` 추가.
- `draftTransform.ts`: API의 `post.instagramPostType`을 row에 전파.
- `DraftTable.tsx`: 미디어 셀(line 260 부근)에서 `draft.media === "ig"`이고 `draft.instagramPostType`이 있으면 아이콘 아래 라벨 출력. `INSTAGRAM_POST_TYPE_LABEL` 재사용.
- `Drafts.module.css`: `.media` 컬럼 정렬·`.mediaLabel` 클래스를 동일 모양으로 추가.

### 4. client-web 응모내역 카드

`apps/client-web/src/domains/application/components/ApplicationCard.tsx`의 SNS 태그 표시(line 41 부근):

```tsx
<span className={styles.sns}>{app.snsType}</span>
```

다음과 같이 인스타 응모이고 `instagramPostType`이 있을 때 추가 태그를 옆에 출력한다.

```tsx
<span className={styles.sns}>{app.snsType}</span>
{app.snsType === "INSTAGRAM" && app.instagramPostType && (
  <span className={styles.sns}>{app.instagramPostType}</span>
)}
```

- 라벨 값: enum 값 그대로(`FEED` / `REELS`, 대문자 영문). 별도 매핑 정의 없이 `app.instagramPostType`을 그대로 렌더.
- 스타일: 기존 `.sns` 클래스 재사용. 두 태그 사이 간격은 부모 `.title` 컨테이너의 flex `gap`이 이미 제어한다고 가정하고 확인 후 필요 시 보정.

### 5. 표시 규칙

| 위치 | SNS = Instagram, FEED | SNS = Instagram, REELS | SNS = Instagram, null | SNS ≠ Instagram |
|------|------------------------|------------------------|------------------------|-----------------|
| admin 응모관리·검토 | 인스타 아이콘 + "피드" | 인스타 아이콘 + "릴스" | 인스타 아이콘만 | 해당 아이콘만 |
| client 응모내역 카드 | `INSTAGRAM` 태그 + `FEED` 태그 | `INSTAGRAM` 태그 + `REELS` 태그 | `INSTAGRAM` 태그만 | 해당 SNS 태그만 |

## 영향 범위

| 영역 | 변경 |
|------|------|
| `packages/shared/src/types/adminInfluencer.ts` | `AdminSubmittedPostSchema`에 `instagramPostType` 필드 추가 |
| `apps/api/src/admin-applications/admin-applications.service.ts` | `AdminSubmittedPost` 매핑에서 `application.instagramPostType` 전파 |
| `apps/admin-web/src/domains/application/components/applicants/{types.ts,applicantTransform.ts,ApplicantTable.tsx}` | row 타입·transform·UI 라벨 |
| `apps/admin-web/src/domains/application/components/drafts/{types.ts,draftTransform.ts,DraftTable.tsx}` | 동일 |
| `apps/admin-web/src/pages/Applicants/Applicants.module.css` | `.media` flex column, `.mediaLabel` 스타일 |
| `apps/admin-web/src/pages/Drafts/Drafts.module.css` | 동일 스타일 |
| `apps/client-web/src/domains/application/components/ApplicationCard.tsx` | SNS 태그 옆에 `instagramPostType` 태그 조건부 출력 |
| Prisma 스키마·DB·캠페인·응모 생성·라벨 매핑 | 변경 없음 |

## 검증 기준

- 응모관리 페이지에서 Instagram FEED·REELS 응모는 각각 아이콘 아래 "피드"/"릴스" 라벨이 보인다.
- 검토 페이지에서도 동일한 표시 규칙이 적용된다.
- client-web 응모내역에서 Instagram FEED·REELS 응모는 SNS 태그 옆에 `FEED`/`REELS` 태그가 추가 노출된다.
- 비-Instagram 응모와 `instagramPostType`이 `null`인 인스타 응모는 추가 라벨/태그 없이 기존 표시만 유지된다.
- `pnpm typecheck`가 통과한다(기존 사전 존재 오류 `Drafts/index.tsx:85` showStageFilter 제외).
- 시각적으로 기존 행 높이/카드 높이가 라벨 없는 케이스에서는 변하지 않는다(라벨이 있을 때만 약간 늘어남 — 허용).
