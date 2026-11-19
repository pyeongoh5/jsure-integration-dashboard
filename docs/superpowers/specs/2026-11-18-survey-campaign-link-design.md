# 앙케이트 2차 — 캠페인 연결 + 인사이트 제출 시 응답 수집

작성일: 2026-11-18
선행: [2026-11-16-builder-survey-design.md](2026-11-16-builder-survey-design.md) (빌더 1차)

## 1. 의도와 배경

1차에서 앙케이트를 만들고 관리하는 빌더를 만들었다. 하지만 만든 설문이 아직 아무데도
쓰이지 않는다 — 캠페인에 붙일 수 없고, 인플루언서에게 보이지도 않는다.

2차는 그 고리를 잇는다. 운영자가 캠페인에 앙케이트를 연결하면, 그 캠페인에 참여한
인플루언서가 **인사이트를 제출할 때 설문에 함께 답하고**, 운영자는 그 응답을
**인사이트 검수 팝업**과 **캠페인 리포트 엑셀**에서 본다.

엑셀 쪽이 이 작업의 실질적 목적이다. 설문 문항이 리포트 우측 컬럼(`Q1. 질문내용`,
`Q2. 질문내용` …)으로 자동으로 붙어, **클라이언트 보고용 Raw Data 로 그대로 추출**된다.

## 2. 목표 / 비목표 / 실패 조건

### 목표

- 캠페인 생성·수정 화면에서 앙케이트를 **하나** 연결한다.
- 연결된 캠페인의 인플루언서는 인사이트 제출 마법사의 **마지막 단계**에서 설문에 답한다.
  응답은 지표와 **같은 요청으로 한 번에** 저장된다.
- 운영자는 인사이트 검수 팝업에서 지표 아래에 그 사람의 응답을 본다.
- 캠페인 리포트 엑셀을 받으면 설문 문항이 우측 컬럼으로 자동 추가된다.

### 비목표

- 서브타입(recruit)별로 다른 설문 연결. **캠페인당 설문 하나**로 간다(사용자 결정).
  나중에 필요해지면 recruit 단위로 내리는 것은 additive 변경이고, 반대는 데이터 이관이 필요하다.
- 설문별 응답 목록 화면(빌더의 "응답" 탭), 응답 집계·통계·차트. 엑셀이 Raw Data 를 주므로
  분석은 그쪽에서 한다.
- 응답 수정. 인플루언서가 한 번 제출하면 끝이다(인사이트 지표와 같은 정책).
- 설문 응답만 따로 내는 별도 제출 화면·API.
- client-web 외의 응답 경로(이메일, LINE 등).

### 실패 조건 (동작해도 실패로 본다)

- **인플루언서가 인사이트를 못 낸다.** 설문 때문에 기존 제출 흐름이 막히면 캠페인 운영이
  멈춘다. 연결되지 않은 캠페인은 **지금과 완전히 동일하게** 동작해야 한다.
- **과거 응답의 뜻이 바뀐다.** 설문을 수정한 뒤 과거 응답이 새 문항으로 해석되는 것.
- **엑셀이 깨진다.** 문항 제목에 쉼표·줄바꿈이 있거나, 응답이 없는 참가자가 섞였을 때
  컬럼이 밀리는 것.
- **1차의 분리 대비가 무너진다.** 응답 테이블이 기존 테이블과 FK 로 얽히는 것.

## 3. 접근 방식

### 축 1 — 응답을 어디에 저장하나

| | 내용 | 트레이드오프 |
|---|---|---|
| **A. `builder_survey_responses` 별도 테이블** | 1차 설계 §8 이 그려둔 모양 | 빌더 데이터가 `builder_` 네임스페이스 안에 머문다. 테이블이 하나 는다 |
| **B. `campaign_applications` 에 `surveyAnswers` JSONB 컬럼** | 테이블을 안 늘린다 | 빌더 데이터가 기존 핵심 테이블에 섞여, "나중에 빌더를 떼어낸다"는 1차의 전제가 깨진다 |

**선택: A.** 1차 §7 의 격리 규칙(빌더 테이블은 `builder_` prefix, 기존 테이블과 FK 없음)을
그대로 잇는다. 스냅샷 컬럼이 들어갈 자리도 자연스럽다.

### 축 2 — 운영자가 응답을 어디서 보나

사용자가 원래 요건으로 제시한 두 지점을 **둘 다** 한다.

- **인사이트 검수 팝업**(`InsightDetailDialog`)의 지표 하단에 응답 표기
- **캠페인 리포트 엑셀**에 문항별 컬럼 자동 추가

빌더에 별도 "응답" 화면을 만드는 선택지는 버렸다 — 엑셀이 Raw Data 를 전부 주므로
화면을 또 만들 이유가 약하고, 필요해지면 나중에 추가하는 것이 additive 다.

### 축 3 — 엑셀 헤더를 무엇으로 만드나

설문을 수정하면 응답마다 박힌 문항 스냅샷이 서로 다를 수 있는데, 시트 헤더는 한 벌뿐이다.

| | 내용 | 트레이드오프 |
|---|---|---|
| **C. 현재 설문 문항으로 헤더** | `questionId` 로 답을 맞춘다 | 그 사이 지워진 문항은 컬럼이 없고, 새로 생긴 문항은 과거 응답자 칸이 빈다 |
| **D. 모든 스냅샷의 합집합으로 헤더** | 완전한 Raw Data | 지워진 문항까지 컬럼으로 나와 보고서가 지저분해진다 |

**선택: C** (사용자 결정). 운영자와 클라이언트가 보는 것은 "지금의 설문"이다.

## 4. 데이터 모델

### 캠페인 연결

```prisma
model Campaign {
  // … 기존 필드 유지
  /// 연결된 앙케이트(builder_surveys.id). FK 를 걸지 않는다 — 1차 §7 격리 규칙.
  /// null 이면 이 캠페인은 설문을 받지 않는다(기존 캠페인 전부가 여기 해당).
  surveyId String?
}
```

`@@index` 는 두지 않는다. 캠페인에서 설문을 찾는 조회(1건)만 있고, 역방향("이 설문을 쓰는
캠페인 목록")은 이번 범위에 없다.

### 응답

```prisma
/// 인플루언서가 인사이트와 함께 제출한 앙케이트 응답.
/// 격리 규칙(1차 §7): surveyId·applicationId 는 String 일 뿐 FK 가 아니다.
model BuilderSurveyResponse {
  id            String   @id @default(cuid())
  surveyId      String
  applicationId String   @unique
  /// 응답 당시의 questions 배열 통째 — 설문이 수정돼도 이 응답의 해석이 고정된다.
  questionsSnapshot Json
  /// { "<questionId>": <답> }. 답의 모양은 문항 타입에 따라 다르다(§5).
  answers       Json
  schemaVersion Int      @default(1)
  submittedAt   DateTime @default(now())

  @@index([surveyId])
  @@map("builder_survey_responses")
}
```

**`applicationId` 가 `@unique` 인 이유**: 설문은 캠페인당 하나이고 응모 하나당 응답도
하나다. 유니크 제약이 중복 제출을 DB 레벨에서 막는다. 인사이트 재제출(수정) 시에는
이 행을 `upsert` 한다 — 아래 §6 참조.

### 응답 값의 모양 (`packages/shared`)

`packages/shared/src/types/builderSurvey.ts` 에 추가한다. 문항 스키마와 같은 파일에 두어야
타입이 갈라지지 않는다.

```ts
/** 문항 타입별 답의 모양. SINGLE/TEXT 는 문자열, MULTI 는 문자열 배열, LIKERT 는 1-based 정수. */
export const SurveyAnswerSchema = z.union([
  z.string().max(2000),            // SINGLE: 선택한 선택지 문자열 / TEXT: 자유 입력
  z.array(z.string().max(200)),    // MULTI: 선택한 선택지들
  z.number().int().positive(),     // LIKERT: 1-based 단계 번호
]);

/** { questionId: answer }. 필수 문항 누락 검증은 questions 와 함께 봐야 하므로 별도 함수로. */
export const SurveyAnswersSchema = z.record(z.string().min(1), SurveyAnswerSchema);
```

**LIKERT 는 라벨이 아니라 단계 번호(1~5)를 저장한다.** 라벨은 i18n 에 있고 언어마다 다르다
(1차 §5). 번호를 저장해야 운영자가 엑셀을 일본어로 받든 한국어로 받든 같은 데이터가 된다.
엑셀·검수 팝업에서 표시할 때 그 시점 언어의 라벨로 바꾼다.

**SINGLE/MULTI 는 선택지 인덱스가 아니라 문자열을 저장한다.** 선택지는 운영자가 자유
입력한 문자열이라 순서가 바뀔 수 있고, 스냅샷이 있어도 인덱스는 읽는 사람이 해석해야
한다. 문자열이면 엑셀 셀에 그대로 쓰면 된다.

### 검증 규칙은 shared 의 순수 함수 하나로

응답이 문항에 맞는지("필수인데 비었다", "선택지에 없는 값", "리커트 범위 밖")는 **서버와
화면이 같은 규칙을 봐야 한다**(CODE_RULES §2). 판정만 하는 순수 함수를 둔다.

```ts
export type SurveyAnswerIssue =
  | { questionId: string; kind: "REQUIRED_MISSING" }
  | { questionId: string; kind: "UNKNOWN_OPTION" }
  | { questionId: string; kind: "OUT_OF_RANGE" }
  | { questionId: string; kind: "WRONG_SHAPE" };

export function surveyAnswerIssues(
  questions: SurveyQuestion[],
  answers: Record<string, SurveyAnswer>,
): SurveyAnswerIssue[];
```

서버는 이 함수로 거르고 한국어 고정 문구를 붙이고, client-web 은 같은 함수로 거르고
i18n 문구를 붙인다. 문구는 함수가 만들지 않는다.

## 5. 캠페인 연결 (어드민)

### API 계약

- `CampaignFormSchema`(= `CreateCampaignRequestSchema`)와 `UpdateCampaignRequestSchema` 에
  `surveyId: z.string().nullable().default(null)` 추가.
- `CampaignResponseSchema` 에 `surveyId: z.string().nullable()` 과, 표시용으로
  `surveyTitle: z.string().nullable()` 추가. 제목을 함께 내리지 않으면 어드민이 캠페인
  목록·상세를 그릴 때마다 설문을 따로 조회해야 한다. **FK 가 없으므로 서버가
  `builderSurvey.findUnique` 로 직접 읽어 채운다**(relation include 불가).
- 연결된 설문이 soft delete 된 경우 `surveyTitle` 은 그 설문의 제목을 그대로 내린다
  (행은 남아 있다). 어드민 화면이 "삭제된 설문" 표시를 덧붙인다.

### 화면

`CampaignForm` 에 설문 선택 필드를 하나 추가한다. recruit 행이 아니라 **캠페인 단위
필드 영역**에 둔다 — 설문이 캠페인당 하나이기 때문이다.

```
┌─ 캠페인 기본 정보 ─────────────────────────────┐
│ 제목     [ ... ]                               │
│ 카테고리 [ SNS ▾ ]                             │
│ …                                              │
│ 앙케이트 [ 선택 안 함 ▾ ]   ← 추가              │
│          연결하면 인플루언서가 인사이트 제출 시  │
│          이 설문에 답합니다.                    │
└────────────────────────────────────────────────┘
```

- 선택지는 빌더 목록 API(`GET /admin/builder/surveys`)에서 가져온다. **`builderApi` 로
  호출한다** — 1차 §7 규칙 ⑤. 1차의 목록은 30건 커서 페이지네이션이고 **검색이 없다.**
  드롭다운이 31번째 설문을 못 고르면 안 되므로, **목록 API 에 `q` 파라미터(제목 부분
  일치, 대소문자 무시)를 추가한다.** 서버 쿼리로 거른다 — 클라이언트 전량 로드 금지.
  드롭다운은 첫 페이지 30건을 띄우고 입력에 따라 재조회한다.
- 기본값은 "선택 안 함"(`null`).
- **수정 화면에서 설문을 바꾸거나 떼는 것을 막지 않는다.** 이미 응답이 쌓였어도 과거
  응답은 스냅샷으로 자족적이다. 다만 응답이 1건 이상이면 **경고 문구**를 띄운다:
  "이미 N명이 응답했습니다. 설문을 바꾸면 이후 응답만 새 설문으로 쌓입니다."

## 6. 응답 수집 (client-web + API)

### 제출 흐름

`InsightSubmitForm`(`apps/client-web/src/domains/application/components/InsightSubmitForm.tsx:63`)은
참여 서브타입마다 한 단계씩 밟는 마법사다. **그 뒤에 설문 단계를 하나 더 붙인다.**

```
[1단계] Instagram 지표  →  [2단계] TikTok 지표  →  [3단계] 앙케이트  →  제출
```

- 설문 단계는 캠페인에 설문이 연결됐을 때만 나타난다. 없으면 **지금과 완전히 동일**하다.
- 마지막 단계에서 지표와 응답을 **한 요청으로** 보낸다. 쪼개면 "지표는 냈는데 설문은
  안 낸" 중간 상태가 생기고 정산 차단 조건이 복잡해진다.
- **연결된 설문의 응답은 필수다**(사용자 결정). 필수 문항을 비우면 다음으로 못 넘어간다.
  `surveyAnswerIssues` 로 판정한다.
- 단계 표시(현재 n/총 m)에 설문 단계가 포함된다.

### API 계약

`SubmitInsightsRequestSchema` 에 필드를 **추가**한다. 기존 필드는 건드리지 않는다.

```ts
export const SubmitInsightsRequestSchema = z.object({
  insights: /* 기존 그대로 */,
  /** 캠페인에 설문이 연결된 경우에만 보낸다. { questionId: answer } */
  surveyAnswers: SurveyAnswersSchema.optional(),
});
```

`submitInsights`(`apps/api/src/influencer-applications/influencer-applications.service.ts:846`)의
동작을 이렇게 늘린다. 기존 검증 순서는 유지한다.

1. 기존 검증(SNS 카테고리, 참여 서브타입 전부 제출, 게시물 선제출) — 그대로.
2. 캠페인의 `surveyId` 를 읽는다.
   - `surveyId` 가 있는데 `surveyAnswers` 가 없으면
     `BadRequestException({ code: "SURVEY_ANSWERS_REQUIRED", message: "앙케이트에 응답해주세요" })`.
   - `surveyId` 가 없는데 `surveyAnswers` 가 왔으면 **조용히 무시한다**(400 으로 막지 않는다 —
     운영자가 방금 설문을 뗀 타이밍에 제출이 들어올 수 있다).
3. 설문을 읽어 `surveyAnswerIssues(questions, surveyAnswers)` 로 검증. 위반이 있으면
   `BadRequestException({ code: "SURVEY_ANSWERS_INVALID", message: "앙케이트 응답을 확인해주세요" })`.
4. 지표 저장(기존) + **응답 `upsert`** — `where: { applicationId }`, `create`/`update` 모두
   `questionsSnapshot` 을 **그 시점 설문의 questions 로 다시 박는다**. 인사이트 재제출은
   기존에도 허용되므로, 재제출 시 응답도 최신으로 갱신되는 것이 일관적이다.
5. 정산·메시지 발송(기존) — 그대로.

**`ensure-settlement.ts` 는 건드리지 않는다.** 설문은 인사이트와 같은 트랜잭션으로
들어오므로, "인사이트 제출됨 = 설문도 제출됨"이 성립한다. 새 차단 조건이 필요 없다.

### 응답 화면에 필요한 데이터

`InfluencerApplication` 응답에 연결된 설문을 실어야 화면이 문항을 그린다.

```ts
/** 캠페인에 연결된 앙케이트. 없으면 null — 설문 단계를 건너뛴다. */
survey: z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  questions: z.array(SurveyQuestionSchema),
}).nullable(),
```

`INCLUDE`(같은 파일 `:244`)의 `campaign.select` 에 `surveyId` 를 더하고, 설문 본문은
`builderSurvey.findUnique` 로 별도 조회해 채운다(FK 없음).

### 화면 스케치

```
┌──────────────────────────────────────────┐
│  인사이트 제출            3 / 3 단계      │
├──────────────────────────────────────────┤
│  7월 캠페인 사후 설문                      │
│  솔직하게 답해주세요.                      │
│                                          │
│  1. 제품을 어떻게 알게 되셨나요? *         │
│     ○ Instagram                          │
│     ○ 지인 추천                           │
│     ○ 검색                                │
│                                          │
│  2. 재구매 의향이 있다 *                   │
│     ○ 전혀 그렇지 않다  ○ 그렇지 않다      │
│     ○ 보통이다  ○ 그렇다  ○ 매우 그렇다    │
│                                          │
│  3. 개선할 점                             │
│     ┌────────────────────────────────┐   │
│     │                                │   │
│     └────────────────────────────────┘   │
│                                          │
│        [ 이전 ]        [ 제출하기 ]       │
└──────────────────────────────────────────┘
```

- 문구는 전부 `i18n/client/messages.ts` 키 + `t()`. **단, 문항 제목·설명·선택지는 운영자가
  입력한 값이라 번역하지 않는다.** 리커트 프리셋 라벨만 i18n 에서 읽는다.
- 필수 문항에 `*` 표기. 리커트는 라디오 가로 배열, 좁은 화면에서 줄바꿈.
- `NUMERIC` 프리셋은 단계마다 점수(`1점` … `5점`)로 표기한다.

## 7. 응답 조회 (어드민)

### 7-1. 인사이트 검수 팝업

`InsightDetailDialog`(`apps/admin-web/src/domains/application/components/drafts/`)의 지표
섹션 **아래**에 응답 섹션을 덧붙인다. 설문이 없거나 응답이 없으면 섹션 자체를 그리지 않는다.

```
┌─ 인사이트 ────────────────────────────┐
│  좋아요 1,234   댓글 56   저장 78      │
│  …                                    │
│  [스크린샷]                            │
├─ 앙케이트 응답 ───────────────────────┤
│  Q1. 제품을 어떻게 알게 되셨나요?       │
│      지인 추천                         │
│  Q2. 재구매 의향이 있다                 │
│      그렇다 (4/5)                      │
│  Q3. 개선할 점                         │
│      포장이 조금 아쉬웠어요             │
└───────────────────────────────────────┘
```

- **문항·순서는 그 응답의 `questionsSnapshot` 에서 읽는다.** 한 사람의 응답을 그 사람이
  답한 그대로 보여주는 자리이므로 스냅샷이 맞다(엑셀과 다른 선택이다 — §3 축 3).
- 리커트는 `그렇다 (4/5)` 처럼 라벨과 단계를 함께 보여준다. 라벨은 현재 어드민 언어의
  i18n 에서 읽는다.
- 응답 데이터는 이 팝업이 이미 쓰는 `AdminSubmissionSchema`
  (`packages/shared/src/types/adminInfluencer.ts:246`, `fetchSubmission` 이 파싱)에 실어
  내린다. **별도 호출을 추가하지 않는다.**

```ts
// AdminSubmissionSchema 에 추가
/** 이 응모의 앙케이트 응답. 설문 미연결이거나 미응답이면 null. */
surveyResponse: z.object({
  questionsSnapshot: z.array(SurveyQuestionSchema),
  answers: SurveyAnswersSchema,
  submittedAt: z.string().datetime(),
}).nullable(),
```

### 7-2. 캠페인 리포트 엑셀

여기가 이 작업의 핵심 산출물이다.

**지금 구조**(`apps/admin-web/src/pages/Reports/index.tsx:478-540`): 선택한 캠페인마다
시트를 하나 만들고, 컬럼은 정적 상수(`PARTICIPANT_COLUMNS` + `EXCEL_ONLY_COLUMNS`) **뒤에
동적 컬럼을 덧붙이는** 방식이다. 이미 `recruitPeriodColumns` 가 `{ key, label, value }`
모양으로 그렇게 붙고 있고, 캠페인 단위 값이라 행마다 반복 기록된다.

**설문 컬럼이 정확히 같은 모양이다.** 캠페인 단위(설문이 캠페인당 하나), 헤더가 동적,
값은 참가자별. `recruitPeriodColumns` 뒤에 이어 붙인다.

```ts
// 헤더: 현재 설문 문항 순서대로 Q1, Q2, …
const surveyColumns = survey.questions.map((question, index) => ({
  key: `survey_${question.id}`,
  label: `Q${index + 1}. ${question.title}`,
  // 값은 참가자마다 다르므로 recruitPeriodColumns 와 달리 value 가 아니라 함수를 쓴다
  value: (participant) => formatSurveyAnswer(question, participant.surveyAnswers),
}));
```

- **헤더는 현재 설문 문항**(§3 축 3 선택 C). 답은 `questionId` 로 맞춘다. 그 사이 지워진
  문항은 컬럼이 없고, 새로 생긴 문항은 과거 응답자 칸이 빈다.
- **한 사람이 여러 SNS 에 참여하면 행이 여러 개다**(참가자 행은 `subTypes` 별로 쪼개진다,
  `admin-reports.service.ts:198`). 응답은 신청 단위이므로 **그 행들에 같은 답이 반복된다.**
  `recruitStartDate` 가 이미 그렇게 반복되고 있고, Raw Data 용도에는 이것이 맞다(사용자 결정).
- 설문이 연결되지 않은 캠페인의 시트는 **지금과 완전히 동일**하다(컬럼이 안 붙는다).
- `formatSurveyAnswer` 는 `packages/shared` 가 아니라 admin-web 쪽에 둔다 — 리커트 라벨
  i18n 과 엑셀 표현(배열을 쉼표로 잇기)이 섞이기 때문이다. **ExcelJS 가 셀 값을 이스케이프
  하므로 쉼표·줄바꿈은 그대로 넣어도 안전하다**(기존 `postUrl` 이 줄바꿈으로 잇는 선례).
- 미응답 참가자는 빈 문자열.

**데이터 공급**: `CampaignReportParticipantSchema` 에 `surveyAnswers: SurveyAnswersSchema.nullable()`
를 추가하고, 설문 자체(`questions`)는 참가자 응답과 별개로 필요하므로
`GET /admin/reports/campaigns/:campaignId/participants` 응답에 캠페인 단위 필드로 같이 내린다.

```ts
export const CampaignParticipantsResponseSchema = z.object({
  participants: z.array(CampaignReportParticipantSchema),
  total: z.number().int(),
  /** 캠페인에 연결된 설문. 없으면 null — 엑셀에 설문 컬럼이 붙지 않는다. */
  survey: z.object({ id: z.string(), questions: z.array(SurveyQuestionSchema) }).nullable(),
});
```

페이지마다 같은 `survey` 가 반복해서 내려오지만 문항 수십 개 수준이라 비용이 작고,
별도 호출을 추가하지 않는 편이 단순하다.

## 8. 분리 대비 — 1차 §7 규칙을 그대로 잇는다

2차가 기존 도메인과 빌더를 잇는 작업이라, 경계가 흐려지기 가장 쉬운 지점이다.

1. **`campaigns.surveyId` 와 `builder_survey_responses.applicationId` 는 FK 가 아니다.**
   String 컬럼일 뿐이다. 설문 제목·문항은 `builderSurvey.findUnique` 로 애플리케이션에서
   합친다. relation `include` 를 쓰는 순간 분리가 막힌다.
2. **응답 테이블은 `builder_` prefix.**
3. **빌더 서비스는 기존 서비스를 import 하지 않는다.** 반대 방향(기존 서비스가 빌더
   테이블을 Prisma 로 직접 읽는 것)은 **이번에 허용한다** — `campaigns`,
   `influencer-applications`, `admin-reports`, `admin-applications` **네 곳**이 그렇게
   한다. 서버를 분리하는 날 이 네 지점이 "빌더 API 호출"로 바뀐다. **어느 네 곳인지,
   각각 무엇을 읽는지 이 문서가 기록이다.**
   - `campaigns` — `builder_surveys` 의 설문 **제목**(목록·상세에 `surveyTitle` 로 노출).
   - `influencer-applications` — `builder_surveys` 의 설문 **본문**(문항) +
     `builder_survey_responses` 의 **응답**(제출·재제출 프리필).
   - `admin-reports` — `builder_surveys` 의 **문항** + `builder_survey_responses` 의
     **응답**(참가자 리포트·엑셀).
   - `admin-applications` — `builder_survey_responses` 의 **응답**(검수 팝업이 설문
     섹션을 직접 그린다).
4. **프런트의 설문 선택 드롭다운은 `builderApi` 로 호출한다.** 기존 `api` 를 쓰면
   분리 시 놓친다.

## 9. 손대는 곳 요약

| 영역 | 파일 | 변경 |
|---|---|---|
| shared | `types/builderSurvey.ts` | 답 스키마 + `surveyAnswerIssues` 순수 함수 |
| shared | `types/campaign.ts` | 요청·응답에 `surveyId`/`surveyTitle` |
| shared | `types/application.ts` | `SubmitInsightsRequest.surveyAnswers`, `InfluencerApplication.survey` |
| shared | `types/adminReport.ts` | `CampaignReportParticipantSchema` 에 `surveyAnswers`, `CampaignParticipantsResponseSchema` 에 `survey` |
| shared | `types/adminInfluencer.ts` | `AdminSubmissionSchema` 에 `surveyResponse` |
| shared | `types/builderSurvey.ts` | 목록 조회에 `q` 파라미터 |
| api | `builder-surveys/*` | 목록 `q` 검색(제목 부분 일치) |
| api | `prisma/schema.prisma` + 마이그레이션 | `campaigns.surveyId`, `builder_survey_responses` |
| api | `campaigns/*` | `surveyId` 저장·조회, `surveyTitle` 채우기 |
| api | `influencer-applications/*` | 설문 동봉 검증 + 응답 upsert, 응답에 `survey` |
| api | `admin-reports/*` | 참가자 응답 + 캠페인 설문 내리기 |
| admin-web | `CampaignForm` | 설문 선택 필드 |
| admin-web | `InsightDetailDialog` | 응답 섹션 |
| admin-web | `pages/Reports/index.tsx` | 동적 설문 컬럼 |
| client-web | `InsightSubmitForm` + 새 `SurveyStepForm` | 설문 단계 |

## 10. 구현자에게 맡기는 것

- 설문 선택 드롭다운의 검색 UI 형태(인라인 검색 vs 모달). 기존 어드민 관례를 따른다.
- 설문 단계의 CSS 세부. client-web 기존 폼 토큰을 따른다.
- `formatSurveyAnswer` 의 MULTI 구분자(쉼표 vs 줄바꿈). 엑셀에서 읽기 쉬운 쪽.
- 검수 팝업 응답 섹션의 접기/펼치기 여부.

## 11. 배포 대상 / 사이드이펙트

**배포 대상**
- `packages/shared` → 빌드 후 `api` 재배포(Railway).
- `apps/api` — 마이그레이션 2건(컬럼 추가 + 테이블 추가). **적용과 재시작은 사용자가 직접.**
- `apps/admin-web`, `apps/client-web` — Vercel 재배포. **client-web 이 이번에 처음 포함된다.**

**사이드이펙트**
- `SubmitInsightsRequestSchema` 는 **API 계약 변경**이다. `surveyAnswers` 가 optional 이라
  하위 호환이지만, **client-web 배포 전에 api 를 먼저 배포해야 한다**(새 필드를 모르는
  서버가 거부하지 않도록).
- `campaigns.surveyId` 는 nullable 이라 기존 캠페인 전부가 `null` — 동작 변화 없음.
- `InsightSubmitForm` 은 모든 SNS 캠페인 인플루언서가 지나는 경로다. 설문이 없을 때
  기존과 동일하게 동작하는지가 최우선 확인 항목이다.
- `pages/Reports/index.tsx` 의 엑셀 생성은 모든 캠페인 리포트가 공유한다. 설문 미연결
  캠페인의 시트가 변하지 않아야 한다.
