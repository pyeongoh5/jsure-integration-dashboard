# Influencer Mobile Web — Design Spec

작성일: 2026-05-23
스코프: `apps/client-web` 인플루언서용 모바일 웹의 전체 1차 MVP. 회원가입 마법사 → 캠페인 둘러보기/상세/신청 → 신청 라이프사이클 관리 → 마이페이지. 데스크탑 지원은 본 spec 범위 외(모바일 우선 설계, 추후 확장 여지 둠).

선행 spec:
- `2026-05-19-campaign-form-design.md` (Campaign 모델/CRUD)
- `2026-05-23-application-domain-design.md` (Influencer / CampaignApplication / SubmittedPost 모델 + 상태 전이)

본 spec은 위 두 spec이 정의한 도메인 위에 인플루언서 자체 가입·계좌·약관·인사이트 데이터를 얹고, 모바일 UI 전체를 추가한다.

---

## 1. 목표

1. 일본인 인플루언서가 자체 가입하여(이메일 + 비밀번호 + 약관 + SNS + 일본 은행 정보) 모바일 웹에서 캠페인을 신청·진행할 수 있게 한다.
2. 캠페인 둘러보기/상세/신청과 신청 라이프사이클(申請→承認→発送→受取→投稿→検査→完了)을 모바일 UI로 전부 표현한다.
3. 컨테이너/프레젠테이션 분리로 향후 가독성·재사용성·테스트 용이성을 확보한다.

### 비범위

- 데스크탑 레이아웃 (모바일 우선; 향후 확장 시 별도 spec).
- 즐겨찾기 기능 (요구에서 제외).
- 이미지 파일 업로드 인프라 (인사이트 스크린샷은 본 MVP에서 수치만 텍스트 입력).
- 푸시 알림 / 이메일 알림.
- 소셜 로그인 / 2FA.
- 정산(payout) 자동화. 어드민 수동 처리.
- 다국어 — UI는 일본어 only.

---

## 2. 기술 스택 / 의존성

기존 `apps/client-web` 의존성만 사용. 신규 패키지 도입 없음.

- React 18 + Vite + TypeScript
- `react-router-dom` v6 — 라우팅
- `@tanstack/react-query` v5 — 서버 상태 (캠페인/신청 fetch·mutation)
- `axios` — HTTP (admin-web과 동일한 인터셉터 패턴: `Authorization: Bearer <localStorage.accessToken>`)
- `@fortawesome/fontawesome-free` — 아이콘
- 스타일: 컴포넌트별 colocated CSS 파일 + BEM-ish 클래스명 (admin-web 패턴 일치). CSS 프레임워크/in-JS 스타일링 미도입.

---

## 3. 컴포넌트 설계 원칙 (Container / Presentational)

본 앱의 컴포넌트는 두 종류 중 하나다.

### 3.1 Container 컴포넌트

- 데이터·상태·핸들러를 알고 있는 컴포넌트.
- TanStack Query 훅, `useNavigate`, Context, 폼 상태(`useState` + zod) 등이 여기 들어간다.
- JSX는 Presentational 컴포넌트만 호출하고, 자체 마크업은 최소화.
- 파일명: 페이지는 `pages/<area>/<Name>.tsx`, 페이지가 아닌 컨테이너는 `containers/<Name>.tsx`.

### 3.2 Presentational 컴포넌트

- props만 받아 마크업·CSS를 렌더링. 외부 API 호출이나 라우터 hook 호출 금지.
- props는 원시값/배열/콜백만 — Container 내부 상태 객체를 통째로 넘기지 않는다.
- 파일명: `components/<Area>/<Name>.tsx` + colocated `<Name>.css`.

### 3.3 분할 단위 휴리스틱

- 한 컴포넌트가 ~150줄을 넘으면 분할 신호.
- 동일 화면에서 반복되는 요소(목록 항목, 진행 상태 스텝퍼 등)는 즉시 분리.
- 폼은 폼 컨테이너 + 필드 단위 Presentational(`LabeledInput`, `RadioGroup`, `Toggle` 등)로 분리.

### 3.4 예시 — 캠페인 카드

```
pages/Browse/index.tsx                  Container — query + filter state
  └ components/Campaign/CampaignGrid.tsx       Presentational — props: items, onSelect
       └ components/Campaign/CampaignCard.tsx  Presentational
              ├ CampaignCardThumbnail.tsx
              ├ CampaignCardMeta.tsx          (보수, 팔로워 조건, 모집 인원)
              └ CampaignCardBadge.tsx         ("NEW", 마감임박)
```

`pages/Browse/index.tsx`만 `useCampaignList()` 훅과 `useSnsFilter()` 훅을 호출한다. 카드 컴포넌트 어디에도 `useQuery`가 없다.

---

## 4. 라우트 / 앱 셸

### 4.1 라우트

```
PUBLIC
/login                          이메일·비밀번호 로그인
/signup                         /signup/terms 로 리다이렉트
/signup/terms                   STEP 1 — 약관 동의
/signup/account                 STEP 2 — 이메일·비밀번호
/signup/profile                 STEP 3 — 이름·전화·종별
/signup/sns                     STEP 4 — SNS 계정 선택·입력
/signup/bank                    STEP 5 — 은행 정보

PROTECTED (InfluencerJwtAuthGuard)
/                               둘러보기 (default)
/campaigns/:id                  캠페인 상세
/campaigns/:id/apply            신청 폼 (확인·약관 재동의 표시)
/applications                   신청내역 목록
/applications/:id               신청 상세 + 라이프사이클 액션
/me                             마이페이지
/me/profile                     프로필 수정
/me/sns                         SNS 계정 수정
/me/bank                        은행 정보 수정
```

`/signup` 마법사의 단계 간 데이터는 `SignupContext`(Provider)에 보관 — 새로고침 시 `sessionStorage`로 복구. 마지막 단계에서 한 번의 `POST /influencer-auth/signup` 호출로 전체 페이로드 전송 → 자동 로그인 → `/` 이동.

### 4.2 앱 셸 레이아웃

`AppShell` 레이아웃 컴포넌트가 다음을 감싼다(보호 라우트 전용):

- 상단 헤더 (현재 페이지 타이틀; 캠페인 상세는 뒤로가기 아이콘만)
- `<Outlet />`
- 하단 탭 네비게이션 (3탭: 둘러보기 / 신청내역 / 마이페이지)

`SignupShell` 레이아웃: 상단 진행률 바 + `<Outlet />` (하단 탭 없음).
`AuthShell`: 로그인/가입 입구. Reachly 로고만 노출.

### 4.3 인증 가드

- `InfluencerJwtAuthGuard` 컴포넌트가 `localStorage.influencerAccessToken` 존재 여부 + 만료시각을 검사. 미인증 시 `/login`으로 리다이렉트하고 `from` 쿼리에 원래 경로 저장.
- admin-web과 인증 토큰 키를 분리해야 한다 (같은 도메인 사용 시 충돌 방지) → 키명: `influencerAccessToken`.

---

## 5. 데이터 모델 변경 (Prisma)

### 5.1 Influencer 보강

선행 spec(`2026-05-23-application-domain-design.md`)의 `Influencer`에 인증·약관·계좌·종별·카나명을 추가한다.

```prisma
model Influencer {
  id            String   @id @default(cuid())
  email         String   @unique           // 가입 시 필수로 변경 (NOT NULL)
  passwordHash  String
  name          String                     // 한자/한글/영문 — 표시용
  nameKana      String?                    // カナ — 은행 송금용
  phone         String
  entityType    InfluencerEntityType       // INDIVIDUAL | CORPORATE
  memo          String?
  status        InfluencerStatus @default(ACTIVE)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  snsAccounts   InfluencerSnsAccount[]
  applications  CampaignApplication[]
  consents      InfluencerConsent[]
  bankAccount   InfluencerBankAccount?
  sessions      InfluencerSession[]

  @@map("influencers")
}

enum InfluencerEntityType {
  INDIVIDUAL
  CORPORATE
}

enum InfluencerStatus {
  ACTIVE
  SUSPENDED
}
```

`email`은 본 spec에서 NOT NULL로 마이그레이션(선행 spec의 NULL허용 상태에서 전환). 마이그레이션 시점에 기존 row가 있으면 사용자 확인 후 처리.

### 5.2 InfluencerSession

admin-web의 `UserSession` 패턴 그대로 별도 테이블로 분리.

```prisma
model InfluencerSession {
  id               String   @id @default(cuid())
  influencerId     String
  refreshTokenHash String   @unique
  userAgent        String?
  ip               String?
  createdAt        DateTime @default(now())
  lastSeenAt       DateTime @default(now())
  expiresAt        DateTime
  revokedAt        DateTime?

  influencer Influencer @relation(fields: [influencerId], references: [id], onDelete: Cascade)

  @@index([influencerId])
  @@map("influencer_sessions")
}
```

### 5.3 InfluencerConsent (약관 동의 이력)

```prisma
model InfluencerConsent {
  id              String   @id @default(cuid())
  influencerId    String
  termsVersion    String                  // "2026-05-23" 같은 버전 식별자
  agreedItems     String[]                // ["PR_LABEL","DEADLINE","INSIGHTS","SECONDARY_USE","YAKKIHO","GUIDELINE"]
  agreedAt        DateTime @default(now())
  ip              String?
  userAgent       String?

  influencer Influencer @relation(fields: [influencerId], references: [id], onDelete: Cascade)

  @@index([influencerId, termsVersion])
  @@map("influencer_consents")
}
```

`agreedItems` 의 항목 키는 zod enum으로 shared에 고정. 약관 버전이 바뀌면 기존 `Influencer`에 대해 재동의를 요구할지는 어드민에서 운영적으로 결정 (본 spec에서는 단순히 이력만 적재).

### 5.4 InfluencerBankAccount

```prisma
model InfluencerBankAccount {
  id              String   @id @default(cuid())
  influencerId    String   @unique
  ownerType       InfluencerEntityType
  bankCode        String                  // "0001"
  bankName        String                  // "みずほ銀行" — 캐시. 코드로도 충분하지만 표시 편의용
  branchName      String
  accountType     JpAccountType           // FUTSU(普通) | TOUZA(当座)
  accountNumber   String                  // 평문 7자리 등 — DB 저장 정책은 §10 보안 참조
  accountHolderKana String

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  influencer Influencer @relation(fields: [influencerId], references: [id], onDelete: Cascade)

  @@map("influencer_bank_accounts")
}

enum JpAccountType {
  FUTSU
  TOUZA
}
```

1 인플루언서 = 1 계좌. 수정은 row 통째 교체(혹은 update). 별도 이력 테이블은 두지 않음(YAGNI).

### 5.5 SubmittedPost 보강 — 인사이트 필드

```prisma
model SubmittedPost {
  id                 String   @id @default(cuid())
  applicationId      String
  snsType            SnsType
  url                String
  submittedAt        DateTime @default(now())

  // 인사이트 (투고 7일 후 제출)
  insightSaves       Int?
  insightReach       Int?
  insightProfileViews Int?
  insightSubmittedAt DateTime?

  updatedAt          DateTime @updatedAt

  application CampaignApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, snsType])
  @@index([applicationId])
  @@map("submitted_posts")
}
```

인사이트 이미지 업로드는 본 spec에서 범위 외. `insightImageUrl?: string`은 모델에 추가하지 않고 후속 spec에서 도입.

### 5.6 Campaign 보강

목록 카드 시각 표현을 위해 다음 필드 추가:

```prisma
model Campaign {
  // 기존 필드 그대로
  thumbnailUrl    String?      // 카드 썸네일 (어드민이 입력)
  brandName       String?      // "GREEN PROJECT"
  brandTagline    String?      // "잡화의 힘으로, 일상과 지구를 행복하게."
  minFollowers    Int?         // 신청 자격 (없으면 무제한)
}
```

이 4개 필드는 NULL 허용. 어드민 캠페인 폼에 칸을 추가하되 본 spec의 어드민 수정 작업은 §11에 추가 메모.

---

## 6. Shared zod 스키마

`packages/shared/src/types/` 아래에 다음 파일을 신규/확장:

### 6.1 `influencer.ts` (확장)

선행 spec의 `InfluencerSchema`, `InfluencerSnsAccountSchema`에 다음을 더한다:

```ts
export const InfluencerEntityTypeSchema = z.enum(["INDIVIDUAL","CORPORATE"]);
export type InfluencerEntityType = z.infer<typeof InfluencerEntityTypeSchema>;

export const JpAccountTypeSchema = z.enum(["FUTSU","TOUZA"]);
export type JpAccountType = z.infer<typeof JpAccountTypeSchema>;

export const ConsentItemSchema = z.enum([
  "PR_LABEL","DEADLINE","INSIGHTS","SECONDARY_USE","YAKKIHO","GUIDELINE",
]);
export type ConsentItem = z.infer<typeof ConsentItemSchema>;

export const InfluencerBankAccountSchema = z.object({
  ownerType: InfluencerEntityTypeSchema,
  bankCode: z.string().regex(/^\d{4}$/, "4桁の銀行コード"),
  bankName: z.string().min(1),
  branchName: z.string().min(1).max(50),
  accountType: JpAccountTypeSchema,
  accountNumber: z.string().regex(/^\d{6,8}$/, "口座番号は6~8桁"),
  accountHolderKana: z.string().regex(/^[゠-ヿ　\sー]+$/, "カナで入力"),
});
export type InfluencerBankAccount = z.infer<typeof InfluencerBankAccountSchema>;
```

### 6.2 `influencerAuth.ts` (신규)

```ts
export const InfluencerSnsAccountInputSchema = z.object({
  snsType: SnsTypeSchema,
  handle: z.string().min(1).max(64),
  followerCount: z.number().int().nonnegative(),
});

export const InfluencerSignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(50),
  nameKana: z.string().min(1).regex(/^[゠-ヿ　\sー]+$/),
  phone: z.string().min(10).max(20),
  entityType: InfluencerEntityTypeSchema,
  snsAccounts: z.array(InfluencerSnsAccountInputSchema).min(1, "1つ以上のSNS"),
  bankAccount: InfluencerBankAccountSchema,
  termsVersion: z.string(),
  agreedItems: z.array(ConsentItemSchema).length(6),
});
export type InfluencerSignupRequest = z.infer<typeof InfluencerSignupRequestSchema>;

export const InfluencerLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type InfluencerLoginRequest = z.infer<typeof InfluencerLoginRequestSchema>;

export const InfluencerAuthResponseSchema = z.object({
  accessToken: z.string(),
  influencer: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
});
export type InfluencerAuthResponse = z.infer<typeof InfluencerAuthResponseSchema>;
```

### 6.3 `submittedPost.ts` (신규 또는 application.ts 확장)

```ts
export const SubmitPostRequestSchema = z.object({
  url: z.string().url(),
});

export const SubmitInsightRequestSchema = z.object({
  saves: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  profileViews: z.number().int().nonnegative(),
});

export const SubmittedPostSchema = z.object({
  id: z.string(),
  snsType: SnsTypeSchema,
  url: z.string().url(),
  submittedAt: z.string().datetime(),
  insightSaves: z.number().int().nullable(),
  insightReach: z.number().int().nullable(),
  insightProfileViews: z.number().int().nullable(),
  insightSubmittedAt: z.string().datetime().nullable(),
});
```

### 6.4 인플루언서 시점의 응답 스키마

기존 admin용 `CampaignListItemSchema`와 별개로, 인플루언서 둘러보기용 응답 스키마를 노출 필드를 줄여 정의한다(어드민 전용 필드 노출 방지).

```ts
export const InfluencerCampaignCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  brandName: z.string().nullable(),
  brandTagline: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  rewardJpy: z.number().int().nonnegative(),
  snsTypes: z.array(SnsTypeSchema),
  minFollowers: z.number().int().nullable(),
  recruitCount: z.number().int().nonnegative(),
  appliedCount: z.number().int().nonnegative(),
  recruitStartAt: z.string().datetime(),
  recruitEndAt: z.string().datetime(),
  isNew: z.boolean(),                       // 생성 후 3일 이내
});

export const InfluencerCampaignDetailSchema = InfluencerCampaignCardSchema.extend({
  productSummary: z.string(),
  productDetailUrl: z.string().url(),
  guideline: z.string(),
  referenceMediaUrls: z.array(z.string().url()),
  cautions: z.string(),
  condition: z.string(),
});
```

### 6.5 약관 본문

`packages/shared/src/data/influencerTerms.ts`:

```ts
export const INFLUENCER_TERMS_VERSION = "2026-05-23";

export const INFLUENCER_TERMS = [
  {
    key: "PR_LABEL",
    title: "PR表記について",
    bodyJa: "投稿の冒頭に「#PR」または「ブランドから提供いただきました」という文言を必ず記載することに同意しますか？",
    bodyKo: "게시물 첫 부분에 「#PR」 또는 「브랜드로부터 제공받았습니다」 문구 기재에 동의하시나요？",
  },
  {
    key: "DEADLINE",
    title: "投稿期限について",
    bodyJa: "商品受け取り後、2週間以内の投稿を遵守いただけますか？",
    bodyKo: "상품 수령 후 2주 이내 게시 기한을 준수하실 수 있나요？",
  },
  {
    key: "INSIGHTS",
    title: "インサイトデータの提出について",
    bodyJa: "投稿から7日後に、インサイト画面のスクリーンショット（保存数・リーチ数・プロフィール表示数等）を提出いただけますか？",
    bodyKo: "게시 후 7일 뒤, 인사이트 화면 캡처（저장 수・도달 수・프로필 노출 수 등）를 제출해 주실 수 있나요？",
  },
  {
    key: "SECONDARY_USE",
    title: "二次利用・データ提供への同意について",
    bodyJa: "投稿いただいた写真や動画のブランドによる二次利用、およびデータ提供に同意いただけますか？",
    bodyKo: "게시하신 사진・영상의 브랜드 2차 활용 및 데이터 제공에 동의하시나요？",
  },
  {
    key: "YAKKIHO",
    title: "薬機法の遵守について",
    bodyJa: "薬機法を遵守し、断定的・誇張的な表現を控えることに同意いただけますか？",
    bodyKo: "약기법을 준수하고, 단정적・과장된 표현을 삼가는 것에 동의하시나요？",
  },
  {
    key: "GUIDELINE",
    title: "ガイドラインの確認・遵守について",
    bodyJa: "必須ハッシュタグ等のガイドラインをご確認いただき、遵守いただけますか？",
    bodyKo: "필수 해시태그 등 가이드라인을 확인하시고, 준수해 주실 수 있나요？",
  },
] as const satisfies ReadonlyArray<{ key: ConsentItem; title: string; bodyJa: string; bodyKo: string }>;
```

`bodyKo`는 기획 참고용(UI에서는 일본어 only로 노출, 한국어는 옵션 토글 — §8.1.1).

### 6.6 일본 은행 목록

`packages/shared/src/data/jpBanks.ts` (혹은 JSON):

```ts
export type JpBankCategory = "MEGA" | "TRUST" | "PUBLIC" | "INTERNET" | "REGIONAL_1" | "REGIONAL_2";

export interface JpBank {
  code: string;        // "0001"
  nameJa: string;      // "みずほ銀行"
  nameKo: string;      // 기획용 — UI 미사용
  category: JpBankCategory;
}

export const JP_BANKS: ReadonlyArray<JpBank> = [
  // docx의 120개 행을 그대로 임베드
];
```

docx 파일은 사람이 한 번에 변환 후 정적 import. 런타임 다운로드 없음.

---

## 7. API 엔드포인트

선행 spec의 엔드포인트에 다음을 **추가**한다. 기존 엔드포인트는 변경 없음.

| 메서드 | 경로 | 용도 | 가드 |
|---|---|---|---|
| POST | `/influencer-auth/signup` | 인플루언서 자체 가입 (전체 페이로드 1회 호출) | — |
| POST | `/influencer-auth/login` | 로그인 → JWT 발급 | — |
| POST | `/influencer-auth/logout` | 세션 폐기 | InfluencerJwt |
| GET  | `/influencer-auth/me` | 현재 인플루언서 + 프로필 + SNS + 은행 | InfluencerJwt |
| PATCH | `/influencer-me/profile` | 이름/카나/전화/종별 수정 | InfluencerJwt |
| PUT  | `/influencer-me/sns/:snsType` | SNS 계정 upsert | InfluencerJwt |
| DELETE | `/influencer-me/sns/:snsType` | SNS 계정 삭제 (단, 다른 SNS가 1개 이상 남아야 함) | InfluencerJwt |
| PUT  | `/influencer-me/bank` | 은행 정보 교체 | InfluencerJwt |
| GET  | `/influencer/campaigns` | 둘러보기 (SNS 필터, 페이지네이션) | InfluencerJwt |
| GET  | `/influencer/campaigns/:id` | 캠페인 상세 | InfluencerJwt |
| GET  | `/influencer/applications` | 본인의 신청 목록 | InfluencerJwt |
| GET  | `/influencer/applications/:id` | 본인 신청 상세 (posts 포함) | InfluencerJwt |
| POST | `/influencer/applications` | 신청 (campaignId) — 서버에서 자격 검증 | InfluencerJwt |
| POST | `/influencer/applications/:id/cancel` | 인플루언서 본인 취소 (상태가 SHIPPED 이전일 때만) | InfluencerJwt |
| POST | `/influencer/applications/:id/confirm-delivery` | 「受取完了」 보고 → `markDelivered` | InfluencerJwt |
| PUT  | `/influencer/applications/:id/posts/:snsType` | 투고 URL upsert (DELIVERED only) | InfluencerJwt |
| PUT  | `/influencer/applications/:id/posts/:snsType/insight` | 인사이트 수치 upsert | InfluencerJwt |

### 7.1 가드 / 토큰 분리

- `InfluencerJwtAuthGuard` 신규 — 토큰 페이로드의 `sub`가 `Influencer.id` 인지 검증. AdminUser 토큰과 서로 통하지 않는다.
- JWT secret은 admin과 동일 env 키 재사용 가능하나, payload에 `kind: "influencer" | "admin"` 클레임을 추가하여 각 가드가 검사.

### 7.2 신청 자격 검증

`POST /influencer/applications` 서비스 로직:

1. `Campaign` 로드. `recruitStartAt ≤ now ≤ recruitEndAt` 확인 (아니면 400).
2. `Campaign.snsTypes` 와 인플루언서의 SNS 계정 교집합 ≥ 1 (아니면 400).
3. `Campaign.minFollowers != null` 이면, 인플루언서가 등록한 SNS 계정 중 `Campaign.snsTypes`에 해당하는 것 중 1개라도 `followerCount ≥ minFollowers` 여야 함.
4. 중복 신청 차단 (`@@unique([campaignId, influencerId])`).

위반 시 `BadRequestException` + 메시지 코드(`OUT_OF_RECRUIT_PERIOD` / `SNS_MISMATCH` / `INSUFFICIENT_FOLLOWERS` / `ALREADY_APPLIED`) — 프런트가 메시지 매핑.

---

## 8. 화면 설계

### 8.1 회원가입 마법사 (5단계)

라우트는 §4.1 참조. `SignupContext`는 단계별 데이터 + `goNext()/goBack()` 메서드를 노출. 각 단계는 자체 zod 부분 스키마로 validate; 마지막 단계 완료 시 전체를 `InfluencerSignupRequestSchema`로 한 번 더 통합 검증 후 단일 POST.

#### 8.1.1 STEP 1 — 약관 (아코디언)

- `components/Signup/TermsAccordion.tsx` (Presentational) — props: `items: TermItem[]`, `agreed: Record<ConsentItem, boolean>`, `expanded: Record<ConsentItem, boolean>`, `onToggleAgree(key)`, `onToggleExpand(key)`, `onAgreeAll()`.
- 상단에 "すべての項目に同意します" 단축 토글 행 (눌리면 6개 모두 동기 토글).
- 각 항목: 체크박스 + `[必須]` 배지 + 제목 + caret. 펼치면 본문(일본어 원문 + 옵션 한국어).
- 한국어 보조 토글: 페이지 상단에 "한국어 설명 보기" 체크박스 (기본 OFF).
- 6개 모두 체크되어야 "次へ" 활성화. 미체크 시 비활성 + 클릭 시 첫 미체크 항목 자동 펼침.

#### 8.1.2 STEP 2 — 계정

이메일·비밀번호·비밀번호 확인. `InfluencerAccountSchema = InfluencerSignupRequestSchema.pick({email, password}).extend({passwordConfirm})` + `refine` 으로 일치 검증.

이메일 중복 검사는 별도 API 호출 없이 최종 POST에서 409로 받는다(불필요한 RTT 회피).

#### 8.1.3 STEP 3 — 프로필

이름 / 카나 / 전화 / 종별(라디오: 個人/法人).

#### 8.1.4 STEP 4 — SNS (선택형, 시퀀셜 X)

- `components/Signup/SnsAccountCard.tsx` — props: `snsType: SnsType`, `value: { handle, followerCount } | null`, `onToggle()`, `onChange(field, v)`.
- 4개 SNS 카드를 모두 노출. 토글 ON일 때만 핸들/팔로워 입력 필드 표시.
- 최소 1개 활성화 + 활성화된 항목은 핸들·팔로워수 모두 필수.
- 활성화된 항목들만 `InfluencerSnsAccountInputSchema` 배열로 모아 다음 단계로 전달.

#### 8.1.5 STEP 5 — 은행 정보

- 종별 라디오 (個人/法人 — 프로필과 별개. 실제 결제 명의가 다를 수 있음).
- 은행 select: 검색 가능. `components/Bank/BankSelect.tsx` (Presentational) + `containers/BankSelectContainer.tsx`. 옵션 데이터는 `JP_BANKS`. 검색은 `nameJa` 부분 일치 + `code` prefix 일치.
- 지점명 / 계좌종류(普通/当座 라디오) / 계좌번호 / 계좌명의(カナ).
- 모두 입력 시 "登録完了" 활성. 누르면 모든 단계 데이터를 모아 `POST /influencer-auth/signup`.

### 8.2 로그인 (`/login`)

이메일·비밀번호 입력 + "登録はこちら" 링크. 성공 시 토큰을 `localStorage.influencerAccessToken`에 저장 + `from` 쿼리 있으면 그쪽으로 이동, 없으면 `/`.

### 8.3 둘러보기 (`/`)

- `pages/Browse/index.tsx` (Container) — `useCampaignList({ sns })` + `useSnsFilter()`.
- 상단: SNS pill 필터 (Instagram / TikTok / YouTube / X). 인플루언서가 등록한 SNS만 활성화로 노출, 미등록 SNS는 비활성 (또는 회색 + 클릭 시 "등록하세요" 토스트).
- 2열 카드 그리드. 카드는 `CampaignCard` Presentational. 카드 메타: `¥{reward.toLocaleString()}円`, `{snsType 아이콘} {minFollowers}人以上`, `🎁 {recruitCount}名募集`, 좌상단 NEW 배지(isNew=true일 때).
- 빈 상태/로딩 스켈레톤/에러 표시.

정렬: 기본 = 모집 마감 임박 + NEW 우선. 본 spec에서는 정렬 옵션 토글 미제공.

### 8.4 캠페인 상세 (`/campaigns/:id`)

- 상단: 썸네일 / 브랜드명 / 슬로건 / 보수 / 모집 인원 진행률.
- 본문 섹션:
  - 商品 — `productSummary` + 상품상세 외부 링크 버튼.
  - ガイドライン — `guideline` + 참고 미디어 링크들.
  - 注意事項 — `cautions`.
  - 応募条件 — `condition` + 팔로워 조건.
- 하단 고정 CTA: 「応募する」 버튼.
  - 기간 외 / 정원 초과 → 비활성 + 사유 표시.
  - 이미 신청한 캠페인 → 「申請内訳を見る」 버튼으로 변환.

「応募する」 누르면 `/campaigns/:id/apply` 로 이동.

### 8.5 신청 폼 (`/campaigns/:id/apply`)

- 본 spec MVP에서는 추가 입력 없이 **확인 화면 + 약관 재확인 체크 + 제출**만.
- 표시: 캠페인 요약 / 인플루언서가 등록한 SNS 중 캠페인 `snsTypes`에 해당하는 항목 (이 신청에 사용될 계정) / 캠페인 필수 약관 ① ⑤ ⑥ 강조.
- 「申請を送信」 누르면 `POST /influencer/applications`. 성공 시 `/applications/:id` 로 이동.
- 실패: 자격 검증 코드별 한국어→일본어 메시지 매핑 표시 (§7.2).

### 8.6 신청내역 목록 (`/applications`)

- 카드 리스트 (단일 열). 각 카드:
  - 캠페인 제목 + 표시 단계 배지 (§9 매핑)
  - 보수 / 사용 SNS
  - 진행률 바 (단계 7개 중 N번째)
  - 다음 액션 prompt (예: "投稿URLを提出する") — 사용자가 액션을 즉시 인지할 수 있게.
- 빈 상태: "まだ応募していません" + 둘러보기 CTA.

### 8.7 신청 상세 (`/applications/:id`)

- 상단: 캠페인 요약 + 표시 단계 배지.
- `ApplicationStepper` (Presentational) — 7단계 스텝퍼 (申請·承認·発送·受取·投稿·検査·完了). 현재 단계 강조, 완료된 단계 체크.
- 본문은 표시 단계에 따라 동적으로 노출되는 섹션:
  - APPLIED — 「承認待ち」 안내 + キャンセル 버튼.
  - APPROVED — 「発送準備中」 안내 + キャンセル 버튼.
  - SHIPPED — `trackingNumber` 표시 + 「受取完了」 버튼.
  - DELIVERED (posts=0) — 投稿期限 D-N + 가이드라인 요약 + SNS별 「投稿URLを提出」 폼.
  - DELIVERED (posts≥1, insights=0, 투고 후 7일 경과) — 「インサイトを提出」 폼 (saves/reach/profileViews).
  - DELIVERED (insights≥1) — 「ブランド検査中」 안내.
  - COMPLETED — 振込予定 안내.
  - REJECTED / CANCELLED — 사유 표시.

`投稿期限` 은 `application.deliveredAt + 14일` (선행 spec 약관 ②와 일치). `application.deliveredAt`이 null이면 「投稿待機」 (受取보고 전).

### 8.8 마이페이지 (`/me`)

- 프로필 카드 (이름·이메일·종별) → /me/profile
- SNS 계정 카드 (등록된 SNS 목록) → /me/sns (개별 토글로 추가/삭제 + 핸들·팔로워 수정)
- 은행 정보 카드 → /me/bank
- 로그아웃 버튼

각 수정 페이지는 가입 마법사의 해당 단계 컴포넌트를 재사용 (Presentational 컴포넌트는 동일, Container만 별도).

---

## 9. 신청 라이프사이클 — 표시 단계 매핑

DB의 `ApplicationStatus` 7개와 SubmittedPost 상태를 인플루언서 UI 표시 단계로 derive:

| 표시 | 조건 |
|---|---|
| ① 申請済 | `status == APPLIED` |
| ② 承認 | `status == APPROVED` |
| ③ 発送中 | `status == SHIPPED` |
| ④ 投稿期間 | `status == DELIVERED` AND posts.length == 0 |
| ⑤ 投稿完了 | `status == DELIVERED` AND posts.length ≥ 1 AND posts.every(p => p.insightSubmittedAt == null) AND (가장 빠른 post.submittedAt + 7일 미경과) |
| ⑤′ インサイト提出待ち | `status == DELIVERED` AND posts.length ≥ 1 AND posts.some(p => p.insightSubmittedAt == null) AND (가장 빠른 post.submittedAt + 7일 경과) |
| ⑥ 検査中 | `status == DELIVERED` AND posts.every(p => p.insightSubmittedAt != null) |
| ⑦ 完了 | `status == COMPLETED` |
| ✗ 却下 | `status == REJECTED` |
| ✗ キャンセル | `status == CANCELLED` |

표시 단계는 클라이언트가 derive하지 않고 **서버가 응답에 `displayStage`로 동봉**한다 — 클라이언트 derive 분기 중복 방지. shared zod:

```ts
export const ApplicationDisplayStageSchema = z.enum([
  "APPLIED","APPROVED","SHIPPED",
  "POSTING","POSTED","INSIGHT_DUE","REVIEWING",
  "COMPLETED","REJECTED","CANCELLED",
]);
```

---

## 10. 보안 / 검증 / 응답 노출

- 모든 mutation에 `ZodValidationPipe`.
- 응답은 Prisma row 그대로 반환 금지 — 서비스에서 shared 응답 스키마로 매핑.
- 비밀번호: bcrypt 해시 저장. JWT 만료/리프레시는 admin과 동일 정책.
- 은행 계좌번호: **본 spec에서는 평문 저장**. 추후 컬럼 단위 암호화 도입은 후속 작업 (TODO §13). 응답에서는 마지막 4자리만 마스킹한 `accountNumberMasked` 도 함께 노출하여 UI 기본 표시에 사용; 전체값은 「수정」 진입 시에만 노출.
- IP/UA: 회원가입 동의 시 기록 (`InfluencerConsent`).
- 약관 동의 6개 모두 체크가 안 됐다면 서버에서 400 — 클라이언트만 신뢰 X.

---

## 11. 어드민 측 영향

본 spec은 인플루언서 앱이 메인이지만, 다음의 어드민 작업이 따라온다 (별 PR로 묶지는 않고 본 plan의 후반 task로 다룬다):

1. `Campaign` 폼에 `thumbnailUrl` / `brandName` / `brandTagline` / `minFollowers` 4 필드 추가 (선행 spec `2026-05-19-campaign-form-design.md` 의 폼 컴포넌트 확장).
2. 어드민 캠페인 목록·상세에서 인플루언서가 등록한 SNS 정보와 신청 자격 매칭 결과를 볼 수 있게는 후속 spec.
3. 신청 라이프사이클 액션(승인/거절/배송/완료) 어드민 UI는 기존 application-domain spec §5에서 정의된 엔드포인트를 호출하는 별 spec.

---

## 12. 테스트

- `packages/shared`: 새 스키마들 — `InfluencerSignupRequestSchema`, `InfluencerBankAccountSchema`, 약관 enum, 응답 스키마 유효/무효 케이스.
- `apps/api`:
  - `InfluencerAuthService.signup` — 트랜잭션 안에서 Influencer / SnsAccounts / BankAccount / Consent 모두 생성되는지, 이메일 중복 시 P2002 → 409 매핑되는지.
  - `InfluencerApplicationsService.create` — 자격 검증 4 케이스(기간 외 / SNS 불일치 / 팔로워 부족 / 중복) + 성공.
  - `displayStage` 계산 — 7가지 분기 단위 테스트.
- `apps/client-web`: 폼 수동 검수 + (테스트 인프라 도입 시) `TermsAccordion` 상호작용 / `SnsAccountCard` 토글 단위 테스트.

---

## 13. YAGNI / 본 spec 제외

- 이미지/파일 업로드 (인사이트 스크린샷 포함).
- 푸시·이메일 알림.
- 정산(payout) 자동 처리.
- 즐겨찾기 / 알림센터 / 검색 (제목 검색).
- SNS OAuth 로그인.
- 다국어 (UI는 일본어 only).
- 데스크탑 레이아웃.
- 계좌번호 컬럼 암호화.
- 약관 버전 변경 시 강제 재동의 플로우.

## 14. 미해결 / 후속

- 인사이트 이미지 업로드 인프라 (Cloudflare R2 / S3) — 별 spec.
- 약관 버전 갱신 시 운영 처리 흐름.
- 캠페인 SNS별 신청 매칭의 세분화 (한 인플루언서가 여러 SNS로 같은 캠페인 응모 시 정책).
- 둘러보기 정렬·검색·페이지네이션 UX.
- 어드민에서 인플루언서 가입자 상태 관리 (suspend) UI.

---

## 15. 파일 구조 요약 (참고)

```
apps/client-web/src/
  App.tsx                                 라우트 정의 + Providers
  main.tsx
  index.css
  layouts/
    AppShell.tsx                          하단탭+헤더
    SignupShell.tsx                       진행률
    AuthShell.tsx                         로고만
  pages/
    Auth/Login.tsx
    Signup/
      Terms.tsx       Account.tsx        Profile.tsx
      Sns.tsx         Bank.tsx
    Browse/index.tsx                      둘러보기 (Container)
    CampaignDetail/index.tsx
    Apply/index.tsx
    Applications/
      index.tsx                           목록
      Detail.tsx
    Me/
      index.tsx       Profile.tsx        Sns.tsx        Bank.tsx
  components/
    Signup/
      TermsAccordion.tsx (.css)
      SnsAccountCard.tsx (.css)
    Campaign/
      CampaignGrid.tsx (.css)
      CampaignCard.tsx (.css)
      CampaignCardThumbnail.tsx
      CampaignCardMeta.tsx
      CampaignCardBadge.tsx
    Application/
      ApplicationCard.tsx
      ApplicationStepper.tsx (.css)
      StageBadge.tsx
      PostSubmitForm.tsx
      InsightSubmitForm.tsx
    Bank/
      BankSelect.tsx (.css)
    layout/
      BottomTabBar.tsx (.css)
      PageHeader.tsx
    form/
      LabeledInput.tsx
      RadioGroup.tsx
      Toggle.tsx
      ErrorBanner.tsx
  containers/
    BankSelectContainer.tsx               (검색·필터 로직)
  context/
    InfluencerAuthContext.tsx
    SignupContext.tsx
  lib/
    api/
      influencerAuth.ts
      campaigns.ts
      applications.ts
      me.ts
    queryClient.ts                        TanStack Query 설정
    axios.ts                              인터셉터 (토큰)
    stage.ts                              displayStage 표시 라벨 매핑
```

`AdminLayout` / `RequireAuth` 패턴은 admin-web을 참고하되 토큰 키만 분리.
