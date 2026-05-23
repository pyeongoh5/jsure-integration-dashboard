# Campaign Form (Create/Edit) — Design Spec

작성일: 2026-05-19
스코프: admin-web 캠페인 생성/수정 폼 페이지 + shared zod 스키마 + apps/api 최소 CRUD.

---

## 1. 목표

관리자가 신규 캠페인을 등록하고 기존 캠페인을 수정할 수 있는 폼 페이지를 제공한다. 폼은 shared zod 스키마를 단일 소스로 검증되며, 동일 컴포넌트가 생성/수정 두 페이지에서 재사용된다.

## 2. 라우트

`apps/admin-web/src/App.tsx` 의 `AdminLayout` 보호 라우트 아래에 다음을 추가한다.

- `/campaigns/new` → `pages/Campaigns/New.tsx`
- `/campaigns/:id/edit` → `pages/Campaigns/Edit.tsx`

기존 `/campaigns` 목록 페이지에는 "캠페인 만들기" 버튼을 추가하여 `/campaigns/new`로 이동시킨다(목록 자체의 API 연동은 본 spec 범위 외).

## 3. 데이터 모델

### 3.1 shared zod (`packages/shared/src/types/campaign.ts`)

```ts
import { z } from "zod";

export const SnsTypeSchema = z.enum(["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"]);
export type SnsType = z.infer<typeof SnsTypeSchema>;

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

export const CampaignFormSchema = z.object({
  title: z.string().min(1, "필수 입력").max(100),
  rewardJpy: z.number().int("정수만 입력").nonnegative(),
  snsTypes: z.array(SnsTypeSchema).min(1, "1개 이상 선택"),
  condition: z.string().max(500),
  recruitCount: z.number().int().positive("1 이상"),
  recruitStartDate: DateOnly,
  recruitEndDate: DateOnly,
  productSummary: z.string().max(1000),
  productDetailUrl: z.string().url("URL 형식이어야 합니다"),
  guideline: z.string().max(2000),
  referenceMediaUrls: z.array(z.string().url()).max(10),
  ngItems: z.string().max(2000),
  cautions: z.string().max(2000),
}).refine((d) => d.recruitStartDate <= d.recruitEndDate, {
  path: ["recruitEndDate"],
  message: "종료일은 시작일 이후여야 합니다",
});
export type CampaignForm = z.infer<typeof CampaignFormSchema>;

export const CreateCampaignRequestSchema = CampaignFormSchema;
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

export const UpdateCampaignRequestSchema = CampaignFormSchema.partial();
export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequestSchema>;

export const CampaignResponseSchema = CampaignFormSchema.extend({
  id: z.string(),
  recruitStartAt: z.string().datetime(),
  recruitEndAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;
```

`packages/shared/src/index.ts` 에서 위 항목들을 export한다.

### 3.2 시간대 정책 (JST)

- 폼은 날짜만 입력받는다 (`YYYY-MM-DD`).
- 서버는 다음과 같이 변환하여 DB에 저장한다:
  - `recruitStartAt = <startDate>T00:00:00+09:00` → UTC `DateTime` 으로 정규화
  - `recruitEndAt   = <endDate>T23:59:59+09:00` → UTC `DateTime` 으로 정규화
- 응답의 `recruitStartAt/EndAt`은 UTC ISO 문자열(`Z`).
- 폼 초기값 채우기(수정 페이지): 응답의 `recruitStartAt/EndAt`을 **JST**로 변환한 뒤 날짜 부분만 추출하여 `recruitStartDate/EndDate`에 채운다.

### 3.3 Prisma 모델 (apps/api/prisma/schema.prisma)

```prisma
model Campaign {
  id                 String    @id @default(cuid())
  title              String
  rewardJpy          Int
  snsTypes           String[]
  condition          String
  recruitCount       Int
  recruitStartAt     DateTime
  recruitEndAt       DateTime
  productSummary     String
  productDetailUrl   String
  guideline          String
  referenceMediaUrls String[]
  ngItems            String
  cautions           String
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

마이그레이션 1건 추가.

## 4. API (apps/api/src/campaigns)

NestJS 도메인 모듈 신규.

- `POST   /campaigns`      `JwtAuthGuard` + `ZodValidationPipe(CreateCampaignRequestSchema)` → `CampaignResponse`
- `GET    /campaigns/:id`  `JwtAuthGuard` → `CampaignResponse` (없으면 404)
- `PATCH  /campaigns/:id`  `JwtAuthGuard` + `ZodValidationPipe(UpdateCampaignRequestSchema)` → `CampaignResponse`

(목록 `GET /campaigns`는 후속 작업.)

서비스 레이어는 Prisma를 통해 CRUD를 수행하며, **요청의 `recruitStartDate/EndDate` ↔ DB의 `recruitStartAt/EndAt` 변환을 책임진다**. 응답 매핑 시 `CampaignResponseSchema` 모양으로 정규화(Prisma 객체를 그대로 반환하지 않음).

## 5. UI 구성

### 5.1 컴포넌트 구조

- `pages/Campaigns/New.tsx` — 빈 초기값으로 `CampaignForm` 렌더, submit → `POST /campaigns` → 성공 시 `/campaigns` 로 이동.
- `pages/Campaigns/Edit.tsx` — `:id` 로 `GET`하여 초기값 로드, `CampaignForm` 렌더, submit → `PATCH /campaigns/:id` → `/campaigns`.
- `components/Campaign/CampaignForm.tsx` — 폼 본체. Props: `initialValue: CampaignForm`, `onSubmit: (v: CampaignForm) => Promise<void>`, `submitLabel: string`.
- `components/Campaign/SnsTypeChips.tsx` — 멀티 선택 칩 (재사용 가능 단위로 분리).
- `components/Campaign/ReferenceMediaUrlList.tsx` — URL 항목 추가/삭제 리스트.

### 5.2 섹션 레이아웃 (세로 단일 컬럼)

1. **기본 정보** — 캠페인 제목 / 보수 금액 (¥ 접두, 円 접미, 숫자만) / SNS 종류 (멀티 칩) / 조건
2. **모집** — 모집 인원 / 모집 시작일 / 모집 종료일 (`<input type="date">`)
3. **상품** — 상품 개요(textarea) / 상품 상세 URL (qoo10)
4. **가이드라인** — 안건 개요(textarea) / 투고 참고 URL 리스트 / NG 사항(textarea) / 주의사항(textarea)
5. **하단 액션** — 취소 / 저장

### 5.3 상태 관리 및 검증

- React `useState` 로 폼 값을 보관. 라이브러리 의존성 추가 없음 (CODE_RULES §0).
- 제출 시 `CampaignFormSchema.safeParse(values)` 실행. 실패 시 `error.issues` 를 `{ [path]: message }` 맵으로 변환하여 필드별 에러를 표시.
- 보수 금액/모집 인원 입력은 string → number 변환 후 검증 (빈 문자열은 `NaN` 처리하여 zod에서 `required`로 잡음).
- 서버 응답 파싱은 `CampaignResponseSchema.parse(res.data)` 경유 (CODE_RULES §2).

### 5.4 에러/로딩 UX

- 수정 페이지 초기 GET 실패 → 페이지 중앙 에러 메시지 + "다시 시도" 버튼.
- 제출 중 → 저장 버튼 disabled + 라벨 "저장 중…".
- 제출 실패(서버 4xx/5xx) → 폼 상단에 빨간 배너 + 메시지.

## 6. API 클라이언트 (apps/admin-web)

`src/lib/api/campaigns.ts` 추가:

```ts
export async function getCampaign(id: string): Promise<CampaignResponse>
export async function createCampaign(input: CreateCampaignRequest): Promise<CampaignResponse>
export async function updateCampaign(id: string, input: UpdateCampaignRequest): Promise<CampaignResponse>
```

각 함수는 기존 axios 인스턴스를 사용하며 응답을 `CampaignResponseSchema.parse()` 한다. (기존 axios 인스턴스 위치를 구현 단계에서 확인.)

## 7. 테스트

- `packages/shared`: `CampaignFormSchema` 유효/무효 케이스 단위 테스트 (필수 누락, URL 형식, 종료일 < 시작일, SNS 미선택).
- `apps/api`: `CampaignsController` 의 POST/GET/PATCH 에 대해 ZodValidationPipe 통과/실패 + service mock 단위 테스트. (e2e는 본 spec 범위 외)
- `apps/admin-web`: 폼 컴포넌트 수동 검수 (자동화 테스트 인프라가 현재 없음 — 있으면 구현 단계에서 확인 후 추가).

## 8. YAGNI — 본 spec 제외 항목

- 임시저장 / 자동저장 / 미리보기 / 복제 / 삭제 / 상태 전이 (recruit → progress 등).
- 파일 업로드 (이미지/영상 업로드는 추후 — 본 MVP는 URL 입력만).
- 캠페인 목록 API 연동 (mock 유지).
- 다국어 / i18n.

## 9. 미해결 / 후속

- 보수 금액 천단위 콤마 표기 — 구현 단계에서 기본 적용 여부 결정.
- 캠페인 상태 필드 (`recruit | review | progress | done`) — 본 spec에는 미포함. 목록 페이지 연동 시 추가.
- 자동화 테스트 인프라 부재 시 `apps/admin-web` 폼 테스트 보류.
