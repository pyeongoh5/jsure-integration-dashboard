# SNS 투고 시 추가 공유(크로스포스팅) 제출 설계

## 배경

SNS 캠페인 투고는 응모 시 확정된 참여 서브타입마다 URL 을 하나씩, 한 번에 제출한다
([`PostSubmitForm`](../../../apps/client-web/src/domains/application/components/PostSubmitForm.tsx),
[`submitSubmission`](../../../apps/api/src/influencer-applications/influencer-applications.service.ts)).
서버는 제출된 서브타입 집합이 참여 서브타입 집합과 정확히 일치하지 않으면 `SNS_NOT_SELECTED` 로 거부한다.

그런데 일부 인플루언서는 응모하지 않은 다른 플랫폼(LIPS, @cosme, TikTok, YouTube, X 등)에도 같은 내용을
자발적으로 공유한다. 현재는 이 사실을 제출할 경로가 없어 담당자가 개별적으로 파악하고 있다.
이 실적을 인플루언서가 투고와 함께 제출할 수 있게 하고, 다음 캠페인 선정 시 우대 판단 자료로 쓴다.

## 결정 사항

| 항목 | 결정 |
| --- | --- |
| 베네핏 성격 | 금전 보수와 무관. 다음 선정 우대용 이력으로만 축적 |
| 대상 플랫폼 | LIPS / @cosme / TikTok / YouTube / X / 기타(직접 입력) |
| 입력 방식 | 투고 폼 하단 접이식 섹션 + 행 추가형 (플랫폼 선택 + URL) |
| 어드민 검토 | 표시만. 인정/불인정 체크 없음, 승인·반려 대상 아님 |
| 재제출 | 기존 값 프리필 + 제출 내용으로 통째 교체 |
| 적용 카테고리 | SNS 만. FAKE_PURCHASE / SIMPLE_REVIEW 는 변경 없음 |

승인·반려는 `CampaignApplication` 단위 한 축뿐이고 서브타입별 반려는 존재하지 않는다.
따라서 추가 공유 URL 을 검토 대상에 넣으면 선택 입력 때문에 응모 전체가 반려될 수 있다.
이를 피하기 위해 검토 흐름은 전혀 건드리지 않는다.

## 데이터 모델

`SubmittedPost` 재사용은 하지 않는다. 그 테이블은 인사이트 집계·반려 판정·정산과 얽혀 있고,
`@@unique([applicationId, subType])` 때문에 같은 플랫폼에 여러 건을 올린 경우를 담을 수 없으며,
`CampaignSubType` 에는 "기타"에 해당하는 값이 없다.

```prisma
enum CrossPostPlatform {
  LIPS
  ATCOSME
  TIKTOK
  YOUTUBE
  X
  OTHER
}

/// 응모 시 선택하지 않은 플랫폼에 자발적으로 함께 공유한 기록.
/// 보수·검토와 무관하며, 다음 캠페인 선정 시 우대 판단 자료로만 쓴다.
model CrossPost {
  id            String            @id @default(cuid())
  applicationId String
  platform      CrossPostPlatform
  /// OTHER 일 때만 사용하는 사용자 입력 플랫폼명.
  platformName  String?
  url           String
  submittedAt   DateTime          @default(now())

  application CampaignApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
  @@map("cross_posts")
}
```

`CampaignApplication` 에 `crossPosts CrossPost[]` 역관계를 추가한다.

인플루언서별 누적 건수는 `CrossPost → CampaignApplication.influencerId` 조인 집계로 뽑는다.
비정규화 카운터 컬럼은 두지 않는다.

## API

### 요청 스키마

`packages/shared/src/types/application.ts` 의 `SubmitSubmissionRequestSchema` 에 필드를 추가한다.

```ts
export const CrossPostPlatformSchema = z.enum([
  "LIPS", "ATCOSME", "TIKTOK", "YOUTUBE", "X", "OTHER",
]);

const CrossPostInputSchema = z.object({
  platform: CrossPostPlatformSchema,
  platformName: z.string().trim().min(1).max(40).optional(),
  url: z.string().url(),
});
```

`SubmitSubmissionRequestSchema` 에 `crossPosts: z.array(CrossPostInputSchema).max(10).default([])` 를 추가하고,
`superRefine` 으로 다음을 검증한다.

- `platform === "OTHER"` 이면 `platformName` 필수
- `platform !== "OTHER"` 이면 `platformName` 이 있으면 안 됨

기존 `posts` 필드의 규칙(참여 서브타입 전체 일치)은 그대로 유지한다.

### 서버 처리

`InfluencerApplicationsService.submitSubmission` 에 `crossPosts` 인자를 추가한다.

1. 기존 검증(카테고리·상태·참여 서브타입 일치)은 변경 없음
2. `crossPosts` 의 `platform` 이 이 응모의 참여 서브타입과 겹치면
   `BadRequestException({ code: "CROSS_POST_DUPLICATE", message: "이미 참여 중인 플랫폼입니다" })`
3. 기존 트랜잭션 안에서 `crossPost.deleteMany({ where: { applicationId } })` 후
   `crossPost.createMany(...)` — 통째 교체. `crossPosts` 가 빈 배열이면 삭제만 수행된다
4. 상태 전이(`REVIEW_SUBMITTED`), 디스패치(`SNS_POST_SUBMITTED`)는 변경 없음

### 조회

- 인플루언서 응모 상세 응답에 `crossPosts` 배열 포함 (재제출 시 프리필에 사용)
- 어드민 응모 상세 응답에 `crossPosts` 배열 포함
- 어드민 인플루언서 상세 응답에 누적 크로스포스팅 건수 포함

## 화면

### client-web — 투고 폼

[`PostSubmitForm`](../../../apps/client-web/src/domains/application/components/PostSubmitForm.tsx) 하단에
기본 접힘 상태의 "다른 곳에도 공유하셨나요? (선택)" 섹션을 추가한다.

- 한 행 = `[플랫폼 선택 ▾] [URL] [삭제]`, `＋ 공유처 추가` 버튼으로 행 추가 (`useFieldArray`)
- 플랫폼 드롭다운 = 6종에서 이번 응모의 참여 서브타입을 제외한 목록
- `기타` 선택 시 같은 행에 플랫폼명 입력란이 나타남
- 최대 10행
- 섹션 안내문에 "해당 실적은 다음 캠페인 선정 시 우대됩니다" 표기
- 재제출 시 기존 `crossPosts` 로 프리필
- 비워둔 채 제출 가능 (선택 입력)

행이 하나라도 있으면 각 행의 URL 은 기존 `urlSchema` 와 동일한 형식 검증을 받고,
`기타` 행은 플랫폼명도 필수다.

응모 상세의 제출 완료 화면에는 제출된 추가 공유 목록을 링크로 표시한다.

문자열은 전부 i18n 처리하고, 신규·수정 property 에는 `// new` 주석을 단다.

### admin-web

- 제출물 상세: "추가 공유" 목록 — 플랫폼 라벨 + URL 링크. 승인/반려 조작 없음
- 인플루언서 상세: 누적 크로스포스팅 건수 표시

### 라벨

`SUB_TYPE_LABEL` 은 `OTHER` 를 담지 못하므로 shared 에 `CROSS_POST_PLATFORM_LABEL` 상수를 추가한다.
`OTHER` 행은 라벨 대신 사용자가 입력한 `platformName` 을 표시한다.

## 테스트

- shared 스키마: `OTHER` 일 때 `platformName` 필수, `OTHER` 가 아닐 때 `platformName` 거부, 11개 이상 거부, 빈 배열 통과
- `influencer-applications.service.spec.ts`:
  - 크로스포스팅 포함 제출 시 `cross_posts` 행 생성
  - 재제출 시 기존 행 삭제 후 새 내용으로 교체
  - 참여 서브타입과 겹치는 플랫폼 제출 시 `CROSS_POST_DUPLICATE`
  - `crossPosts` 미전달(빈 배열) 시 기존 투고 흐름 정상 동작

## 범위 밖

다음은 이번 작업에 포함하지 않는다. 필요해지면 별도로 다룬다.

- 스크린샷 첨부
- 어드민 인정/불인정 체크
- 정산 금액 반영
- URL 도메인 자동 검증 및 플랫폼 자동 판별
- 플랫폼 마스터 테이블 및 관리 화면
- SNS 외 카테고리(가구매·단순리뷰)로의 확대
