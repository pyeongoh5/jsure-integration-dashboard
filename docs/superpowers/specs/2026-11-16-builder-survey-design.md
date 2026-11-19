# 빌더 제품 신설 + 앙케이트(설문) 빌더

작성일: 2026-11-16

## 1. 의도와 배경

인플루언서가 캠페인 인사이트를 제출할 때, 캠페인 설정에 따라 **앙케이트(설문)** 를 함께
받으려 한다. 지금 인사이트 제출은 숫자 지표(좋아요·조회·리치 등)와 첨부 이미지뿐이고
(`apps/api/src/influencer-applications/influencer-applications.service.ts:846`), 정성 응답을
받을 자리가 없다.

최종 그림은 "캠페인에 앙케이트를 연결하고, 인사이트 제출 화면에서 응답을 받아 모은다"지만,
**1차 작업은 앙케이트를 만들고 관리하는 데까지**다. 캠페인 연결과 응답 수집은 2차.

앙케이트는 어드민의 새 제품 단위인 **빌더(Builder)** 에 속한다. 빌더 = 상단 제품 탭
(인플루언서 / J-WIN 과 같은 레벨), 앙케이트 = 그 사이드바의 첫 메뉴. 앞으로 다른
"무언가를 조립해서 만드는" 기능이 같은 탭 아래로 들어올 수 있다는 전제로 자리를 잡는다.

## 2. 목표 / 비목표 / 실패 조건

### 목표

- 어드민 상단에 **빌더** 탭이 생기고, 사이드바에 **앙케이트** 메뉴가 있다.
- 운영자가 구글폼 수준의 설문을 만든다: 단일 선택 / 다중 선택 / 리커트 척도 / 주관식.
- 리커트는 프리셋 4종(동의도·만족도·빈도·숫자형)을 고르거나 직접 라벨을 적는다.
- 만든 앙케이트를 목록에서 보고, 복사·수정·삭제한다.
- DB와 API 서버는 기존 것(`apps/api`, `apps/api/prisma/schema.prisma`)을 **그대로 공유**하되,
  나중에 전용 서버·DB로 떼어낼 때 **기존 도메인을 건드리지 않고** 떼어낼 수 있다.

### 비목표 (1차에서 안 한다)

- 응답 수집·저장·집계, 응답 조회 화면, CSV 내보내기 — 전부 2차.
- 캠페인·recruit 에 앙케이트를 연결하는 설정 UI — 2차. 단, 데이터 모델이 2차를 막지
  않는 것까지는 이 문서가 책임진다.
- 인플루언서(client-web) 쪽 설문 응답 화면 — 2차.
- 문항 조건부 분기(skip logic), 문항 그룹/섹션, 파일 업로드형 문항, 응답 수정 이력.
- 문항의 다국어 번역. 운영자가 인플루언서에게 보일 언어(일본어)로 직접 작성한다.
- 빌더 전용 권한 체계. 기존 `JwtAuthGuard` 로 로그인한 어드민이면 누구나 쓴다
  (`admin-notices` 와 동일).
- 동시 편집 제어. 두 운영자가 같은 앙케이트를 열면 나중에 저장한 쪽이 이긴다
  (last-write-wins). 레포에 낙관적 잠금 선례가 없고, 앙케이트는 동시 편집 가능성이
  낮다 — 구현자 판단이 아니라 이 문서의 결정이다.

### 실패 조건 (동작해도 실패로 본다)

- **2차가 1차를 깨야 한다.** 응답을 붙이려는 순간 `builder_surveys` 스키마나 API 계약을
  파괴적으로 바꿔야 하면 설계가 틀린 것이다.
- **설문을 고치면 과거 응답의 뜻이 바뀐다.** 2차에서 응답이 쌓인 뒤 운영자가 선택지
  문구를 고쳤을 때, 과거 응답이 새 문구로 해석되면 데이터가 조용히 오염된다.
- **분리가 불가능해진다.** 빌더 테이블이 기존 테이블과 FK로 얽히면 DB를 떼어낼 때
  외래키를 끊는 파괴적 마이그레이션이 필요해진다.
- **기존 화면에 회귀가 난다.** 제품 탭이 3개가 되면서 인플루언서·J-WIN 네비게이션이
  어긋나는 것.

## 3. 접근 방식

### 축 1 — 빌더 제품을 어디에 두나

| | 내용 | 트레이드오프 |
|---|---|---|
| **A. admin-web 안의 세 번째 제품** | `lib/navigation.ts` 에 `BUILDER_PRODUCT` 추가, `/builder` prefix | 인증·레이아웃·i18n·UI 컴포넌트를 그대로 쓴다. admin-web 번들이 커진다 |
| **B. `apps/builder-admin` 새 Vite 앱** | 별도 앱으로 분리 | 토큰·refresh·레이아웃·디자인시스템·i18n 로더를 전부 복제. 상단 탭이 앱 간 링크 이동이 되고 세션 공유가 도메인에 묶인다 |

**선택: A.** 레포의 선례가 정확히 A다 — J-WIN 은 API(`apps/jwin-api`)와 DB(`packages/jwin-db`)를
분리했지만 **어드민 UI는 admin-web 안에 남겼다**(`lib/navigation.ts:93`의 `JWIN_PRODUCT`,
상단 `ProductSwitcher`). 분리된 `apps/jwin-web` 은 어드민이 아니라 참가자용 공개 사이트다.
"나중에 분리"는 B로 미리 쪼개는 게 아니라, 아래 §7의 경계 규칙으로 확보한다.

### 축 2 — 문항을 어떻게 저장하나

| | 내용 | 트레이드오프 |
|---|---|---|
| **C. 정규화 3테이블** | Survey / Question / Option | 질문 단위 FK가 산다. 저장마다 delete/insert/update + `sortOrder` 재정렬 트랜잭션. 타입별로 모양이 달라(옵션 없는 주관식, 척도만 있는 리커트) 컬럼 대부분이 nullable |
| **D. Survey 1테이블 + `questions` JSONB** | 문항 배열을 한 컬럼에, zod 로 검증 | 저장이 `UPDATE … SET questions = $1` 한 번. 배열 순서가 곧 문항 순서라 `sortOrder` 컬럼 자체가 없다. 질문 단위 FK가 없어 복잡한 교차 집계 SQL 이 지저분해진다 |

**선택: D.** 타입마다 필요한 필드가 달라서 정규화 이득이 작고, 빌더 화면이 "문항 전체를
한 번에 저장"하는 모양이라 쓰기 경로가 그대로 맞아떨어진다. 응답 집계는 쓰기 한 번·읽기는
리포트성이라 `answers->>'q1'` 수준의 JSON 쿼리로 충분하다.

## 4. 제품 배치 (admin-web)

### 네비게이션

`apps/admin-web/src/lib/navigation.ts` 에 세 번째 제품을 추가한다.

```ts
export type ProductKey = "influencer" | "jwin" | "builder";

const BUILDER_PRODUCT: Product = {
  key: "builder",
  label: "nav.products.builder",
  description: "nav.products.builderDescription",
  icon: "fa-solid fa-screwdriver-wrench",
  pathPrefix: "/builder",
  homePath: "/builder/surveys",
  groups: [
    {
      title: "nav.groups.builder",
      items: [
        { to: "/builder/surveys", label: "nav.items.surveys", icon: "fa-solid fa-clipboard-question" },
      ],
    },
  ],
};

export const PRODUCTS: Product[] = [INFLUENCER_PRODUCT, JWIN_PRODUCT, BUILDER_PRODUCT];
```

`findProductByPath` 는 prefix 매칭이라 수정이 필요 없다. `Sidebar` 의
`isInfluencerProduct` 분기(뱃지 카운트 fetch)도 그대로 — 빌더에서는 꺼진다.

i18n 키는 `i18n/admin/messages.ts` 에 ko/en/ja 3종을 모두 채운다
(`nav.products.builder`, `nav.products.builderDescription`, `nav.groups.builder`,
`nav.items.surveys`, 그리고 §6 화면 문구 전부).

### 라우트 (`App.tsx`)

```
/builder            → /builder/surveys 로 redirect
/builder/surveys    → 목록
/builder/surveys/new      → 생성
/builder/surveys/:id/edit → 수정
```

### 파일 구조

CODE_RULES §7 의 `Applicants` 레퍼런스 구조를 따른다. **빌더 소스는 한 덩어리로 격리**해서,
나중에 별도 앱으로 떼어낼 때 폴더째 옮길 수 있게 한다.

```
apps/admin-web/src/
  domains/builderSurvey/
    api.ts                      // builderApi 호출 + Schema.parse
    types.ts                    // 화면 전용 타입 (문항 편집 상태 등)
  components/BuilderSurveys/
    surveyTransform.ts          // API 모델 → view 모델 (순수)
    useSurveyListData.ts        // useInfiniteQuery(30건/페이지) + loadMore + reload
    useSurveyMutations.ts       // 복사/삭제 + 다이얼로그 상태
    SurveyTable.tsx             // presentational (단일선택 + ... 액션)
    SurveyDeleteDialog.tsx
    SurveyEditorForm.tsx        // 문항 카드 스택 전체
    QuestionCard.tsx            // 문항 1개 (제목/설명/타입/필수/옵션)
    QuestionOptionsEditor.tsx   // 단일·다중 선택지 입력 빌더
    LikertScaleEditor.tsx       // 프리셋 선택 + 커스텀 라벨
  pages/Builder/
    Surveys.tsx                 // 목록 조립
    SurveyEdit.tsx              // 생성/수정 조립 (mode prop)
```

### API 클라이언트

`apps/admin-web/src/lib/api.ts` 에 `jwinApi` 와 같은 꼴로 인스턴스를 하나 더 둔다.
빌더 호출은 전부 이 인스턴스만 쓴다 — 서버를 떼는 날 env 하나로 전환된다.

```ts
/**
 * 빌더 API. 현재는 대시보드 API(@jsure/api)와 같은 서버·같은 인증을 쓴다.
 * 나중에 빌더 전용 서버로 떼어내면 VITE_BUILDER_API_BASE_URL 만 바꾸면 된다.
 */
export const builderApi = axios.create({
  baseURL: import.meta.env.VITE_BUILDER_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 10_000,
});
```

토큰 부착·401 refresh 는 같은 파일의 `attachAuthInterceptors(builderApi)` 한 줄로 붙인다
(`lib/api.ts:115` 가 `api` / `jwinApi` 에 쓰는 방식 그대로. 세 인스턴스가 `refreshInFlight`
를 공유하므로 동시 401 에도 갱신은 한 번만 나간다).

## 5. 데이터 모델

### Prisma

`apps/api/prisma/schema.prisma` 에 **테이블 하나만** 추가한다. additive 라 기존 데이터에
영향이 없다(CODE_RULES §9).

```prisma
/// 빌더 제품의 앙케이트. 문항은 questions(JSONB) 한 덩어리로 들고 있다.
/// 분리 대비: 기존 테이블과 FK를 걸지 않는다. createdBy/updatedBy 는 admin_users.id
/// 값이지만 relation 을 선언하지 않고, 작성자 이름은 애플리케이션에서 조인한다.
model BuilderSurvey {
  id            String    @id @default(cuid())
  title         String
  description   String?
  /// SurveyQuestion[] (packages/shared 의 zod 스키마). 배열 순서 = 문항 순서.
  questions     Json
  /// questions 의 포맷 버전. 포맷을 바꾸면 올리고 읽는 쪽에서 분기한다.
  schemaVersion Int       @default(1)
  createdBy     String
  updatedBy     String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  @@index([deletedAt, updatedAt, id])
  @@map("builder_surveys")
}
```

**왜 FK가 없나.** `createdBy` 를 `AdminUser` relation 으로 선언하면 DB를 떼어내는 날
외래키를 끊는 파괴적 마이그레이션이 필요하다. String 으로만 들고, 목록 응답을 만들 때
`adminUser.findMany({ where: { id: { in: ids } } })` 로 이름을 채운다. 서버가 분리되면
그 조회가 "사용자 조회 API 호출"로 바뀔 뿐 테이블은 그대로다.

**삭제는 soft delete.** 2차에서 캠페인이 `surveyId` 로 이 행을 참조하게 되는데, 참조가
생긴 뒤 하드 삭제하면 응답의 출처가 사라진다. `deletedAt` 컬럼 하나로 지금 막아둔다.
목록·조회는 항상 `deletedAt: null` 로 거른다.

**`schemaVersion` 의 역할.** 문항 *포맷*이 바뀔 때만 쓴다(예: `options: string[]` →
`options: {id,label}[]`, 새 문항 타입 추가). 운영자가 문항 *내용*을 고치는 것과는 무관하고,
과거 응답을 지키는 건 §8의 스냅샷이다. 지금 넣어두는 이유는 나중에 추가하면 기존 행을
전부 backfill 해야 하는데, 지금 `1` 로 박아두는 비용이 사실상 0이기 때문이다.

### 문항 스키마 (`packages/shared`)

`packages/shared/src/types/builderSurvey.ts` 에 zod 로 정의하고 `src/index.ts` 에서 export.
**API 입력 검증(서버)과 폼 타입(화면)이 같은 소스를 쓴다**(CODE_RULES §2).

```ts
export const LIKERT_PRESETS = ["AGREEMENT", "SATISFACTION", "FREQUENCY", "NUMERIC"] as const;

const QuestionBaseSchema = z.object({
  id: z.string().min(1),          // 응답 키가 된다. 생성 후 불변
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  required: z.boolean(),
});

const ChoiceOptionsSchema = z.array(z.string().min(1).max(200)).min(2).max(30);

export const SurveyQuestionSchema = z.discriminatedUnion("type", [
  QuestionBaseSchema.extend({ type: z.literal("SINGLE"), options: ChoiceOptionsSchema }),
  QuestionBaseSchema.extend({ type: z.literal("MULTI"),  options: ChoiceOptionsSchema }),
  QuestionBaseSchema.extend({
    type: z.literal("LIKERT"),
    scale: z.discriminatedUnion("preset", [
      z.object({ preset: z.enum(LIKERT_PRESETS) }),
      z.object({ preset: z.literal("CUSTOM"), labels: z.array(z.string().min(1).max(50)).min(2).max(10) }),
    ]),
  }),
  QuestionBaseSchema.extend({ type: z.literal("TEXT"), multiline: z.boolean() }),
]);

export const SurveyQuestionsSchema = z
  .array(SurveyQuestionSchema)
  .min(1)
  .superRefine(/* id 중복 금지 */);
```

저장된 모양 예시:

```json
[
  { "id": "a1b2…", "type": "SINGLE", "title": "製品をどこで知りましたか",
    "required": true, "options": ["Instagram", "知人の紹介", "検索"] },
  { "id": "c3d4…", "type": "LIKERT", "title": "また購入したい",
    "required": true, "scale": { "preset": "AGREEMENT" } },
  { "id": "e5f6…", "type": "LIKERT", "title": "満足度",
    "required": false, "scale": { "preset": "CUSTOM", "labels": ["悪い", "普通", "良い"] } },
  { "id": "g7h8…", "type": "TEXT", "title": "改善点", "required": false, "multiline": true }
]
```

**문항 `id`** 는 프런트에서 `crypto.randomUUID()` 로 만들고, 저장 후에는 절대 바뀌지 않는다
(2차 응답의 키). 서버는 중복만 검증한다. (`crypto.randomUUID` 는 secure context 전용이지만
admin-web 은 https 운영 + localhost 개발이라 둘 다 해당한다.)

**`schemaVersion` 은 요청 바디로 받지 않는다.** 서버가 현재 포맷 버전 상수를 박는다 —
클라이언트가 보낸 값을 믿으면 버전의 의미가 사라진다.

**리커트 프리셋 라벨은 DB에 저장하지 않는다.** DB에는 `"AGREEMENT"` 만 들어간다. 라벨 문구는
보여주는 쪽의 i18n 에 둔다 — 빌더 미리보기는 `i18n/admin/messages.ts`, 2차의 인플루언서
응답 화면은 `i18n/client/messages.ts`. 그래야 나중에 문구를 다듬어도 기존 설문이 따라온다.
프리셋 5단계는 아래로 고정한다.

| preset | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `AGREEMENT` | 전혀 그렇지 않다 | 그렇지 않다 | 보통이다 | 그렇다 | 매우 그렇다 |
| `SATISFACTION` | 매우 불만족 | 불만족 | 보통 | 만족 | 매우 만족 |
| `FREQUENCY` | 전혀 안 함 | 거의 안 함 | 가끔 | 자주 | 항상 함 |
| `NUMERIC` | 1점 | 2점 | 3점 | 4점 | 5점 |

`NUMERIC` 은 단계마다 점수로 표기한다(`{step}점` / `{step}点` / `{step} pt`). 처음에는
양끝에만 `매우 낮음`·`매우 높음` 라벨을 붙였으나, 중간 단계가 비어 칸 높이가 들쭉날쭉해지고
무엇을 고르는지도 모호해 2026-11-19 에 점수 표기로 바꿨다. `CUSTOM` 은 운영자가 입력한 문자열이
그대로 DB에 들어가므로 번역되지 않는다(비목표의 "문항 다국어" 와 같은 선).

## 6. API

`apps/api/src/builder-surveys/` 에 Nest 모듈 신설. 컨트롤러 prefix 는
`admin/builder/surveys` — **빌더의 모든 경로가 `admin/builder/` 아래 한 덩어리**라
서버를 떼어낼 때 라우팅 단위가 그대로 옮겨간다. 가드·파이프·에러 문구는 `admin-notices`
모듈을 그대로 따른다(`@UseGuards(JwtAuthGuard)`, `@Body(new ZodValidationPipe(...))`,
예외 `message` 는 한국어).

| 메서드 | 경로 | 비고 |
|---|---|---|
| `GET` | `/admin/builder/surveys?limit=&cursor=` | `deletedAt: null`, `updatedAt desc` 커서 페이지. 작성자/수정자 이름 포함 |
| `GET` | `/admin/builder/surveys/:id` | 문항 포함. 없거나 삭제됨 → 404 |
| `POST` | `/admin/builder/surveys` | 생성. `createdBy = updatedBy = 요청자` |
| `PUT` | `/admin/builder/surveys/:id` | 전체 교체. `updatedBy` 갱신 |
| `DELETE` | `/admin/builder/surveys/:id` | 204. `deletedAt = now()` |

요청/응답 스키마는 `packages/shared/src/types/builderSurvey.ts` 에 함께 둔다
(`BuilderSurveyListResponseSchema`, `BuilderSurveyResponseSchema`,
`CreateBuilderSurveyRequestSchema`, `UpdateBuilderSurveyRequestSchema`). Prisma 모델을
그대로 반환하지 않고 shared 모양으로 매핑한다(CODE_RULES §2).

**목록은 30개씩 커서 페이지네이션.** 인플루언서 목록이 쓰는 방식을 그대로 따른다
(`domains/influencer/api.ts:23` 의 `listInfluencersPage`, `useInfluencersData.ts:18` 의
`INFLUENCERS_PAGE_SIZE = 30`). 응답 모양도 같다:

```ts
export const BuilderSurveyPageResponseSchema = z.object({
  items: z.array(BuilderSurveyListItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number(),   // 전체 건수 — 불러온 페이지 수와 무관
});
```

커서는 `updatedAt desc, id desc` 복합 정렬의 마지막 행을 가리킨다(같은 `updatedAt` 이
여러 건이어도 행이 밀리거나 중복되지 않도록 `id` 를 타이브레이커로 둔다). 인덱스는
`@@index([deletedAt, updatedAt, id])`.

검색·필터가 생기면 **서버 쿼리에 추가한다.** 클라이언트에서 전량 로드해 거르는 방식으로는
가지 않는다.

**복사에 전용 엔드포인트를 두지 않는다.** 프런트가 `GET :id` → 제목에 접미사(i18n 문구)를
붙여 → `POST` 한다. 서버에 제목 생성 규칙을 심으면 언어가 고정되기 때문이다. 접미사는
i18n 키 하나(`builder.surveys.copySuffix` — ko "사본" / en "Copy" / ja "コピー")로 두고
`{제목} ({접미사})` 로 만든다. 같은 이름이 여러 개 생기는 것은 막지 않는다.

**작성자·수정자 이름.** `AdminUser.name` 은 nullable 이고(`schema.prisma:15`) 조회에 실패할
수도 있다. 정상이라면 비는 경우가 없어야 하므로, 비면 `email` 로 때우지 않고 `"unknown"`
으로 표기해 이상 상태가 눈에 띄게 한다. 매핑은 서버에서 하고 응답에는 정해진 표시
문자열을 담는다(이 문자열은 번역하지 않는다 — 데이터 이상 신호지 UI 문구가 아니다).

## 7. 분리 대비 — 지켜야 할 경계

지금은 `apps/api` + 기존 Postgres 를 공유한다. 나중에 `builder-api` / `builder-db` 로
떼어내는 것이 가능하도록, **1차부터 지키는 규칙**은 다음 다섯이다.

1. **빌더 테이블은 기존 테이블과 FK를 걸지 않는다.** 사용자·캠페인 참조는 전부 String id.
2. **빌더 테이블 이름은 `builder_` 로 시작한다.** 덤프/이관 대상이 이름으로 식별된다.
3. **빌더 API 경로는 전부 `admin/builder/` 아래.** 라우팅 단위가 그대로 옮겨간다.
4. **빌더 서비스는 기존 서비스를 import 하지 않는다.** 필요한 건 Prisma 로 직접 읽는다.
   (반대 방향 — 기존 서비스가 빌더를 읽는 것 — 도 2차에서 금지. §8 참조.)
5. **프런트는 `builderApi` 인스턴스만 쓴다.** 빌더 코드에서 `api` 를 직접 쓰지 않는다.

떼어내는 날의 순서(이 문서가 약속하는 것은 "가능하다"까지다):
`builder_*` 테이블 덤프 → `packages/builder-db` 로 스키마 이동 → `apps/builder-api` 로
모듈 이동 → `VITE_BUILDER_API_BASE_URL` 을 새 도메인으로 → (UI까지 떼면)
`domains/builderSurvey` + `components/BuilderSurveys` + `pages/Builder` 폴더 이동.
인증은 J-WIN 처럼 같은 `JWT_SECRET` 으로 서명만 검증하면 별도 로그인이 필요 없다.

## 8. 2차(캠페인 연결 + 응답)의 경계만 미리 긋기

**2차는 이 문서의 범위가 아니다.** 다만 1차 모델이 2차를 막지 않는다는 것만 확인해 둔다.

- 연결: `campaign_recruits.surveyId String?` (FK 없음, §7-1). `insightRequired` 와 같은
  자리에서 서브타입 단위로 설정한다. 캠페인 단위로 올릴지는 2차에서 정한다.
- 응답: `builder_survey_responses` 신설. `surveyId`, `applicationId`(String, FK 없음),
  `questionsSnapshot Json`, `answers Json`, `submittedAt`.
- **`questionsSnapshot` 이 "설문을 고치면 과거 응답의 뜻이 바뀐다"는 실패 조건을 막는다.**
  응답 저장 시점의 `questions` 배열을 통째로 복사해 두면, 응답 한 행만 읽어도 "무엇을
  물었고 뭐라 답했는지"가 자족적으로 복원된다. 집계는 `answers->>'<questionId>'`.
- 인사이트 제출과의 관계: `submitInsights` 는 SNS 캠페인 전용이고
  (`influencer-applications.service.ts:861`), 앙케이트도 그 경로에 붙는다. 정산 차단 조건
  (`ensure-settlement.ts`)에 앙케이트 제출 여부를 넣을지는 2차에서 결정한다.

## 9. 화면

문구는 전부 `i18n/admin/messages.ts` 키 + `useT()`. 색·간격·컴포넌트는 기존
`components/ui`, `components/composites` 를 쓴다 — 새 디자인 요소를 만들지 않는다.

### 9-1. 목록 (`/builder/surveys`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 앙케이트                                        [ 복사 ]  [ + 생성 ]      │
├───┬──────────────────┬──────────┬──────────┬────────┬────────┬──────────┤
│ ○ │ 제목             │ 생성일   │ 수정일   │ 생성자 │ 수정자 │          │
├───┼──────────────────┼──────────┼──────────┼────────┼────────┼──────────┤
│ ● │ 7월 캠페인 사후… │ 26-07-02 │ 26-07-11 │ 박유신 │ 박유신 │   [···]  │
│ ○ │ 신제품 체험 설문 │ 26-06-20 │ 26-06-20 │ 김영희 │ 김영희 │   [···]  │
└───┴──────────────────┴──────────┴──────────┴────────┴────────┴──────────┘
```

- 행 선택은 **단일 선택**. 좌측 라디오(`components/ui/Radio.tsx`) 또는 행 클릭.
- **복사** 버튼은 선택된 행이 있을 때만 활성. 누르면 `GET :id` → 제목에 접미사 → `POST`
  → 목록 리로드. 새로 만들어진 설문이 맨 위(수정일 desc)에 온다.
- **생성** 버튼 → `/builder/surveys/new`.
- `[···]` 는 `components/composites/ActionMenu` 재사용. 항목은 **수정**(편집으로 이동),
  **삭제**(`danger: true` → `ConfirmDialog`).
- 표는 `components/composites/ScrollTable` 사용.
- **무한 스크롤**: 30건씩 불러오고, 표 끝의 sentinel `<div>` 가 뷰포트에 들어오면 다음
  페이지를 요청한다. `useInfiniteQuery` + `IntersectionObserver` 조합은
  `pages/Influencers/index.tsx:160-175` 와 `domains/influencer/useInfluencersData.ts` 를
  그대로 따른다 — `loadMore` 를 ref 로 갈아끼워 observer 의존성에서 빼는 처리까지 포함.
- 삭제·복사 후에는 행 선택을 해제하고(사라진 행이 선택된 채로 남지 않도록) 목록 캐시를
  무효화한다. 복사본은 `updatedAt desc` 정렬상 첫 페이지 맨 위에 온다.
- 빈 상태: "아직 만든 앙케이트가 없습니다" + 생성 버튼.

### 9-2. 생성/수정 (`/builder/surveys/new`, `/builder/surveys/:id/edit`)

구글폼처럼 문항 카드를 세로로 쌓는다.

```
┌──────────────────────────────────────────────────────────┐
│ ← 앙케이트                              [ 취소 ] [ 저장 ] │
├──────────────────────────────────────────────────────────┤
│  제목   [ 7월 캠페인 사후 설문                         ]  │
│  설명   [ (선택) 응답자에게 보일 안내 문구             ]  │
├──────────────────────────────────────────────────────────┤
│ ┌─⠿ 문항 1 ─────────────────────────────     [⧉][🗑] ┐│
│ │ 제목  [ 제품을 어떻게 알게 되셨나요?               ]  ││
│ │ 설명  [ (선택)                                    ]  ││
│ │ 타입  [ 단일 선택 ▾ ]              필수  (  ●)       ││
│ │ ──────────────────────────────────────────────────── ││
│ │  ○ [ 인스타그램                              ]  [×]  ││
│ │  ○ [ 지인 추천                               ]  [×]  ││
│ │  [ + 선택지 추가 ]                                   ││
│ └──────────────────────────────────────────────────────┘│
│ ┌─⠿ 문항 2 ─────────────────────────────     [⧉][🗑] ┐│
│ │ 타입  [ 리커트 척도 ▾ ]            필수  (  ●)       ││
│ │ 척도  [ 동의도 ▾ ]   ← 동의도/만족도/빈도/숫자형/직접 ││
│ │  미리보기:  ○전혀 그렇지 않다 ○그렇지 않다 ○보통이다 ││
│ │             ○그렇다 ○매우 그렇다                     ││
│ └──────────────────────────────────────────────────────┘│
│                   [ + 문항 추가 ]                        │
└──────────────────────────────────────────────────────────┘
```

- **타입**: 단일 선택 / 다중 선택 / 리커트 척도 / 주관식. 타입을 바꾸면 그 타입에
  필요한 입력만 남는다(선택 → 리커트로 바꾸면 선택지 입력이 사라진다). 되돌렸을 때
  이전 입력을 복원하지는 않는다 — 복잡도 대비 이득이 없다.
- **선택지 빌더**: `+ 선택지 추가` 로 한 줄씩 늘리고 `×` 로 지운다. 최소 2개.
- **리커트**: 프리셋 4종 + `직접 입력`. 프리셋을 고르면 라벨은 읽기 전용 미리보기,
  `직접 입력`이면 선택지 빌더와 같은 방식으로 라벨을 2~10개 적는다.
- **주관식**: 한 줄 / 여러 줄 토글(`multiline`).
- **문항 순서**: 카드 좌상단 핸들(`⠿`)을 잡아 **드래그앤드롭**으로 바꾼다. 배열 순서가
  곧 문항 순서이므로 상태 변경은 `arrayMove` 한 번이다.
  - **`@dnd-kit` 을 쓴다.** 브라우저 기본 HTML5 Drag and Drop 은 드래그 이미지·드롭
    인디케이터를 손으로 그려야 해서 결과물이 조악하다. 추가할 의존성은 셋
    (`apps/admin-web/package.json` dependencies):

    | 패키지 | 버전 | 용도 |
    |---|---|---|
    | `@dnd-kit/core` | `^6.3.1` | 센서·충돌 감지·`DndContext` |
    | `@dnd-kit/sortable` | `^10.0.0` | 세로 리스트 정렬(`SortableContext`, `arrayMove`) |
    | `@dnd-kit/utilities` | `^3.2.2` | `CSS.Transform.toString()` 헬퍼 |

    왜 이것인가 — React 18 지원(peer `>=16.8`), `findDOMNode` 미사용(StrictMode 안전),
    **`KeyboardSensor` 로 키보드 재정렬과 스크린리더 안내가 기본 제공**된다. 대안인
    `react-beautiful-dnd` 는 아카이브됐고, 그 포크 `@hello-pangea/dnd` 는 더 무겁다.
  - **`↑` `↓` 버튼은 두지 않는다.** `@dnd-kit` 의 `KeyboardSensor` 가 핸들에 포커스를 두고
    Space → 방향키 → Space 로 순서를 바꾸는 경로를 제공하므로, 버튼은 중복이다.
    (HTML5 기본 드래그였다면 키보드 경로가 없어 버튼이 필수였다.)
  - 구성: `DndContext`(`PointerSensor` + `KeyboardSensor`, `closestCenter`) +
    `SortableContext`(`verticalListSortingStrategy`), 문항 카드가 `useSortable`.
    `restrictToVerticalAxis` 수정자로 가로 이탈을 막는다(`@dnd-kit/modifiers` 가 필요하면
    네 번째 의존성으로 추가해도 된다 — 없으면 CSS `transform` 의 x 를 0으로 고정).
  - 드래그 중인 카드는 반투명, 빈 자리는 `SortableContext` 가 밀어낸다.
  - `useSortable` 의 `id` 는 문항 `id`(UUID)를 그대로 쓴다 — 인덱스를 id 로 쓰면
    정렬 중 키가 바뀌어 애니메이션이 튄다.
- `⧉` 는 문항 복제(새 `id` 발급).
- **저장**은 화면 전체를 한 번에 `POST`/`PUT`. 자동 저장 없음.
- 검증은 shared 의 `SurveyQuestionsSchema` 를 `react-hook-form` + `zodResolver` 로
  그대로 쓴다(admin-web 이 이미 쓰는 조합). 서버도 같은 스키마로 다시 검증한다.
- 저장하지 않고 나가려 하면 확인(`ConfirmDialog`).

## 10. 구현자에게 맡기는 것

- CSS 모듈 세부(간격·색). 기존 `admin-web` 토큰을 따른다.
- 문항 카드의 접기/펼치기 여부. 문항이 많아지면 필요해 보이지만 1차 필수는 아니다.
- 성공/실패 토스트를 쓸지, 인라인 메시지로 끝낼지 — 기존 화면의 관례를 따른다.
- `SurveyEditorForm` 을 `mode: "create" | "edit"` 한 컴포넌트로 둘지 분리할지
  (`NoticeEdit` 가 `mode` prop 방식을 쓴다).
- 목록의 날짜 포맷 — 기존 목록 화면과 동일하게.

## 11. 배포 대상 / 사이드이펙트

**배포 대상**
- `apps/admin-web/package.json` 에 `@dnd-kit/*` 3종 추가 → `pnpm install` 필요(§9-2).
- `packages/shared` 변경 → 빌드 후 `api` 재배포 필요(Railway).
- `apps/api` — 모듈 신설 + 마이그레이션. **마이그레이션 적용(`prisma migrate deploy`)과
  API 재시작은 사용자가 직접 수행한다.**
- `apps/admin-web` — Vercel 재배포.
- `apps/client-web`, `apps/jwin-*` — 변경 없음.

**사이드이펙트**
- `lib/navigation.ts`, `App.tsx`, `i18n/admin/messages.ts` 는 기존 화면과 공유되는
  파일이다. 수정은 **추가만** 하고 기존 항목을 건드리지 않는다.
- `ProductSwitcher` 탭이 2개 → 3개. 레이아웃이 좁아지는지 확인 필요.
- DB 변경은 `CREATE TABLE` 하나뿐 — 기존 테이블·데이터에 영향 없음.
- `components/composites/ActionMenu`, `ScrollTable`, `ConfirmDialog`, `ui/*` 는 읽기만
  하고 수정하지 않는다(수정하면 기존 화면 전부에 회귀 위험).
