# 캠페인 게시(투고) 기간 — 설계

작성일: 2026-08-26

## 목적

브랜드사와 사전 조율한 공개 일정(엠바고)보다 인플루언서가 먼저 게시물을 올리고 URL 을 제출하는 일을 막는다. 어드민이 캠페인마다 "언제부터 ~ 언제까지" 게시 기간을 지정하고, 시작 시각 이전에는 투고 URL 제출을 차단한다.

## 결정 사항 (브레인스토밍 합의)

1. **적용 범위**: 세 카테고리의 URL 제출 경로 전부 — SNS 게시물(`PUT :id/submission`), 가구매 리뷰(`POST :id/review`), 단순 리뷰(`POST :id/simple-review`).
2. **차단 시점**: `publishStartAt` 이전만 차단. **종료 후에는 차단하지 않는다** — 늦은 제출을 막으면 이미 게시된 URL 을 수집할 길이 없고 정산도 막힌다. 기존 게시 마감(`postingPeriodDays`)도 원래 제출을 막지 않고 안내·리마인더 기준으로만 쓰였다.
3. **종료 시각**: 저장하고 안내에만 쓴다.
4. **노출 범위**: 인플루언서 캠페인 상세(응모 전) + 응모 상세(제출 화면).
5. **마감 일원화**: 게시 기간이 설정되면 `postingPeriodDays`(수령 후 N일)는 무시하고, 게시 마감·리마인더·화면 문구가 전부 게시 기간을 기준으로 동작한다.

## 데이터 모델

`Campaign` 에 nullable 컬럼 2개 추가. 기존 행은 NULL = 제약 없음이므로 마이그레이션은 무해하다.

```prisma
/// 게시(투고) 기간 시작. null 이면 투고 시점 제약이 없다.
publishStartAt DateTime?
/// 게시(투고) 기간 종료. 지난 뒤에도 제출은 허용하며, 안내·마감 계산에만 쓴다.
publishEndAt   DateTime?
```

두 값은 항상 함께 존재하거나 함께 NULL 이다 (한쪽만 설정 불가).

## API 계약 (`@jsure/shared`)

기존 모집 기간 관례를 그대로 따른다 — 어드민은 JST 로컬 문자열, 인플루언서는 ISO.

- **어드민 요청/응답**: `publishStartDateTime`, `publishEndDateTime` — `"2026-09-01T10:00"` 형식(JST 로컬), nullable. `CampaignFormSchema`(= Create), `UpdateCampaignRequestSchema`, `CampaignDraftRequestSchema`, `CampaignResponseSchema` 4곳.
  - 임시저장 스키마는 빈 문자열(`""`)도 허용한다 (기존 `recruitStartDate` 와 동일).
- **인플루언서 응답**: `publishStartAt`, `publishEndAt` — ISO 문자열, nullable. `InfluencerApplicationSchema`, `InfluencerCampaignDetailSchema` 에 추가. 캠페인 **카드**에는 추가하지 않는다.
- **검증**: 둘 다 입력이거나 둘 다 비움. 입력 시 `publishStartDateTime < publishEndDateTime`. 모집 기간과의 선후 관계는 강제하지 않는다(수령 지연 등 실무 변수).
- **변환 헬퍼**: `apps/api/src/campaigns/campaigns.service.ts` 의 `jstDayStartUtc` 옆에 `jstDateTimeToUtc(str)` / `utcToJstDateTimeStr(date)` 추가.

어드민 브라우저의 로컬 시간대가 JST/KST(둘 다 UTC+9)이므로 `<input type="datetime-local">` 값이 곧 JST 이고, 서버가 `+09:00` 을 붙여 저장한다.

## 마감 일원화

지금 "게시 마감" 계산이 4곳에 복제돼 있다.

| 위치 | 용도 |
|---|---|
| `influencer-applications.service.ts:154` | 응모 응답의 `postingDeadlineAt` |
| `line-reminders.service.ts:266` | 6-r 게시 마감 리마인더 |
| `trigger-meta.ts:209` | LINE 변수 `postingDeadline` |
| `trigger-meta.ts:393` | LINE 변수 `reviewDeadline` |

이를 `packages/shared/src/utils/postingDeadline.ts` 의 순수 함수 하나로 모은다.

```ts
/** 게시 마감. 게시 기간이 설정돼 있으면 그 종료 시각이 마감이고, 없으면 기존 상대 마감. */
export function resolvePostingDeadline(input: {
  publishEndAt: string | Date | null;
  /** SNS·단순 리뷰 = receivedAt, 가구매 = orderSubmittedAt */
  anchorAt: string | Date | null;
  postingPeriodDays: number;
}): Date | null;
```

- `publishEndAt` 이 있으면 그것을 반환.
- 없고 `anchorAt` 이 있으면 `anchorAt + postingPeriodDays`.
- 둘 다 없으면 `null`.

주문 마감(`orderPeriodDays` 기반)은 별개 개념이므로 기존 `deadlineFrom` 을 그대로 쓴다.

### 6-r 리마인더

`runDeadlineReminders` 에서 마감 시각을 구하는 부분만 위 함수 호출로 교체한다. 다음은 그대로 유지한다.

- 발송 시점: 마감 3일 전 · 1일 전 · 마감 다음 날
- 대상 조건: 수령(또는 주문) 완료 + 아직 제출물 없음
- 게시 기간 미설정 캠페인의 동작 — 기존과 완전히 동일

예: 게시 기간 9/1~9/10 캠페인에서 8/20 에 수령한 인플루언서는 리마인더가 9/7 · 9/9 · 9/11 에 나간다. 현재 로직이면 8/31 · 9/2 에 나가서 "제출도 못 하는데 독촉이 온다"가 된다.

### LINE 템플릿 변수

`postingDeadline`, `reviewDeadline` resolver 가 위 함수를 쓰므로 템플릿 본문의 마감일이 자동으로 게시 종료일을 가리킨다. 다만 `{postingPeriodDays}`(= "14") 변수를 본문에 직접 넣어둔 템플릿은 문구가 어색해질 수 있다. 템플릿 텍스트는 DB 에 있어 코드로 고칠 수 없으므로, **배포 후 운영자가 해당 템플릿을 점검**해야 한다 (릴리스 노트에 명시).

## 서버 차단 가드

`influencer-applications.service.ts` 에 private 헬퍼 하나를 두고 세 제출 메서드에서 호출한다.

```ts
private assertPublishStarted(publishStartAt: Date | null): void {
  if (publishStartAt && publishStartAt > new Date()) {
    throw new BadRequestException({
      code: "PUBLISH_NOT_STARTED",
      message: "게시 기간 시작 전에는 제출할 수 없습니다",
    });
  }
}
```

- 호출 위치: `submitSubmission`, `submitReview`, `submitSimpleReview` — 각각 기존 카테고리·상태 전이 검사 **직후**.
- `submitReview` / `submitSimpleReview` 의 Prisma 쿼리는 현재 `campaign.select` 에서 `category` 만 가져오므로 `publishStartAt` 을 추가한다.
- 종료 시각은 가드에서 보지 않는다.

## 어드민 UI

`apps/admin-web/src/domains/campaign/components/CampaignForm.tsx` — 모집 기간 필드 바로 아래에 **[게시 기간]** 블록을 둔다.

- `<input type="datetime-local">` 2개 (네이티브, 라이브러리 추가 없음).
- `EMPTY_CAMPAIGN_FORM` 에 `publishStartDateTime: null`, `publishEndDateTime: null`.
- `useCampaignFormInitial.ts` 의 `toFormValues` 에 매핑을 추가하고, `toCopyValues` 에서는 모집 기간과 동일하게 **비운다** — 복사한 캠페인이 과거 엠바고를 물려받지 않도록.
- 게시 기간이 입력되면 `postingPeriodDays` 입력을 비활성화하고 "게시 기간이 설정되어 이 값은 사용되지 않습니다" 힌트를 노출한다. 저장 값 자체는 유지하므로 게시 기간을 지우면 되살아난다.
- 문구는 `i18n/admin/messages.ts` 에 ko/en/ja 키로 추가한다.

## 인플루언서 UI

### 게시 기간 문구 헬퍼

`apps/client-web/src/domains/application/postingDeadlineText.ts` — 순수 함수 하나가 문구 분기를 전담한다. 각 컴포넌트는 결과만 받아 렌더링한다.

```ts
type PublishWindowState = "NONE" | "BEFORE" | "OPEN" | "AFTER";

export function postingWindowText(input: {
  publishStartAt: string | null;
  publishEndAt: string | null;
  anchorAt: string | null;
  postingPeriodDays: number;
  now: Date;
}): { state: PublishWindowState; startText: string; endText: string; remainingDays: number | null };
```

`state` 가 `NONE` 이면 게시 기간 미설정 — 화면은 기존 "수령 후 N일" 문구를 그대로 쓴다.

### 화면별 문구

| 위치 | 게시 기간 미설정 (현재와 동일) | 게시 기간 설정됨 |
|---|---|---|
| 응모 동의 체크 `DEADLINE` (`pages/Apply/index.tsx:47`) | "수령 후 14일 이내에 게시합니다" | "9월 1일 ~ 9월 10일 사이에 게시합니다" |
| 수령 확인 다이얼로그 (`ReceiptConfirmDialog.tsx`) | "수령 후 14일 이내 게시" | "게시 기간: 9월 1일 ~ 9월 10일" |
| 배송중 안내 (`pages/Applications/Detail.tsx:217`) | 현재 문구 | "게시 기간: 9월 1일 ~ 9월 10일" |
| 제출 폼 상단 (`PostSubmitForm` / `ReviewSubmitForm` / `SimpleReviewSubmitForm`) | "마감까지 N일" | 시작 전 → "9월 1일부터 제출 가능" / 기간 중 → "9월 10일까지 게시 (N일 남음)" / 종료 후 → "게시 기간이 종료되었습니다. 늦었지만 제출해주세요" |
| 캠페인 상세 (`pages/Campaigns/Detail`) | 표시 없음 | "게시 기간: 9월 1일 10:00 ~ 9월 10일 23:59" |

`ReviewSubmitForm` 의 `computeRemainingDays` 는 `resolvePostingDeadline` 기반으로 교체한다.

### 제출 차단 UI

`apps/client-web/src/domains/application/components/PublishWindowNotice.tsx` — 상태별 안내 문구를 렌더링하는 presentational 컴포넌트 하나. 세 제출 폼이 이를 렌더링하고, `state === "BEFORE"` 일 때 제출 버튼을 `disabled` 로 둔다. `AFTER` 에서는 안내만 띄우고 버튼은 활성이다.

모든 문자열은 `i18n/messages.ts` 에 키를 추가하고 `t("...")` 로 참조하며, 신규·수정된 메시지 라인에만 `// new` 주석을 붙인다.

## 테스트

- `apps/api/src/influencer-applications/influencer-applications.service.spec.ts`
  - 시작 전 제출 → `PUBLISH_NOT_STARTED` 로 차단 (세 경로 각각 1케이스)
  - 기간 중 · 종료 후 · 미설정 → 통과
- `apps/api/src/line-templates/line-reminders.service.spec.ts`
  - 기존 케이스가 그대로 통과하는지로 **미설정 캠페인 무회귀**를 보증
  - 게시 기간 설정 시 `publishEndAt` 기준으로 3일 전 · 1일 전 · 익일 발송
- `packages/shared` — `resolvePostingDeadline` 분기 3가지 단위 테스트
- `apps/api/src/campaigns/campaigns.service.spec.ts` — `jstDateTimeToUtc` / `utcToJstDateTimeStr` 왕복

## 배포 · 사이드이펙트

- **배포 순서**: `pnpm --filter @jsure/shared build` → **api (Railway, Prisma 마이그레이션 포함)** → **admin-web · client-web (Vercel)**. 마감 계산이 `@jsure/shared` 로 올라가므로 api 재배포는 필수다.
- **회귀 위험 1순위 — LINE 6-r 발송.** 마감 계산 통합이 기존 캠페인의 발송 시점을 흔들면 안 된다. 스펙의 기존 리마인더 테스트로 방어한다.
- **하위 호환**: 기존 캠페인은 `publishStartAt`/`publishEndAt` 이 NULL 이므로 차단·문구·리마인더 모두 현재와 동일하게 동작한다.
- **운영 후속**: `{postingPeriodDays}` 변수를 본문에 직접 쓰는 LINE 템플릿 점검.

## 범위 밖 (이번에 하지 않음)

- 인플루언서 캠페인 **목록 카드**에 게시 기간 노출
- 게시 시작 시각에 맞춘 신규 LINE 알림("오늘부터 게시 가능합니다")
- 어드민 캠페인 목록의 게시 기간 컬럼·필터
- 게시 종료 후 제출에 대한 별도 어드민 표식
