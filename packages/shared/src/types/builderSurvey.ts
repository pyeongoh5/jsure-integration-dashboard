import { z } from "zod";

/**
 * 빌더 앙케이트(설문) 문항과 설문 자체의 요청/응답 모양. `builder_surveys.questions`
 * JSONB 컬럼에 저장되는 배열이 이 스키마 그대로다. API 검증·프런트 폼이 전부
 * 여기서 파생된 타입을 쓴다.
 */

export const LIKERT_PRESETS = [
  "AGREEMENT",
  "SATISFACTION",
  "FREQUENCY",
  "NUMERIC",
] as const;
export const LikertPresetSchema = z.enum(LIKERT_PRESETS);
export type LikertPreset = z.infer<typeof LikertPresetSchema>;

const LikertScaleSchema = z.discriminatedUnion("preset", [
  z.object({ preset: LikertPresetSchema }),
  z.object({
    preset: z.literal("CUSTOM"),
    labels: z.array(z.string().min(1).max(50)).min(2).max(10),
  }),
]);

const SurveyQuestionBaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  required: z.boolean(),
});

const ChoiceQuestionSchema = SurveyQuestionBaseSchema.extend({
  type: z.enum(["SINGLE", "MULTI"]),
  options: z.array(z.string().min(1).max(200)).min(2).max(30),
});

const LikertQuestionSchema = SurveyQuestionBaseSchema.extend({
  type: z.literal("LIKERT"),
  scale: LikertScaleSchema,
});

const TextQuestionSchema = SurveyQuestionBaseSchema.extend({
  type: z.literal("TEXT"),
  multiline: z.boolean(),
});

export const SurveyQuestionSchema = z.discriminatedUnion("type", [
  ChoiceQuestionSchema,
  LikertQuestionSchema,
  TextQuestionSchema,
]);
export type SurveyQuestion = z.infer<typeof SurveyQuestionSchema>;
export type SurveyQuestionType = SurveyQuestion["type"];

export const SurveyQuestionsSchema = z
  .array(SurveyQuestionSchema)
  .min(1)
  .superRefine((questions, context) => {
    const firstIndexByQuestionId = new Map<string, number>();
    questions.forEach((question, index) => {
      const firstIndex = firstIndexByQuestionId.get(question.id);
      if (firstIndex === undefined) {
        firstIndexByQuestionId.set(question.id, index);
        return;
      }
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [firstIndex, "id"],
        message: "문항 id가 중복되었습니다",
      });
    });
  });

export const BuilderSurveyListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdByName: z.string(),
  updatedByName: z.string(),
  /**
   * 이 설문에 제출된 응답자 수. 응답은 응모당 1건이라 사람 수와 같다.
   * 문항을 고쳐도 과거 응답은 스냅샷으로 보존되지만, 0 이 아니면 수정 시 주의가 필요하다.
   * default 는 이 필드를 아직 내려주지 않는 구 API 와의 배포 갭 대비.
   */
  responseCount: z.number().int().nonnegative().default(0),
});
export type BuilderSurveyListItem = z.infer<typeof BuilderSurveyListItemSchema>;

/** 목록 조회 쿼리 — q 는 제목 부분 일치 검색어. 공백만 있으면 검색 조건 없이 전체를 돌려준다. */
export const BuilderSurveyListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
});
export type BuilderSurveyListQuery = z.infer<typeof BuilderSurveyListQuerySchema>;

export const BuilderSurveyPageResponseSchema = z.object({
  items: z.array(BuilderSurveyListItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
});
export type BuilderSurveyPageResponse = z.infer<
  typeof BuilderSurveyPageResponseSchema
>;

export const BuilderSurveyResponseSchema = BuilderSurveyListItemSchema.extend({
  description: z.string().nullable(),
  questions: SurveyQuestionsSchema,
});
export type BuilderSurveyResponse = z.infer<typeof BuilderSurveyResponseSchema>;

export const CreateBuilderSurveyRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  questions: SurveyQuestionsSchema,
});
export type CreateBuilderSurveyRequest = z.infer<
  typeof CreateBuilderSurveyRequestSchema
>;

export const UpdateBuilderSurveyRequestSchema = CreateBuilderSurveyRequestSchema;
export type UpdateBuilderSurveyRequest = z.infer<
  typeof UpdateBuilderSurveyRequestSchema
>;

/**
 * 문항 하나에 대한 응답자의 답. SINGLE/MULTI 는 선택지 문자열(인덱스 아님),
 * LIKERT 는 1-based 단계 번호(라벨 문자열 아님)를 저장한다.
 */
export const SurveyAnswerSchema = z.union([
  z.string().max(2000),
  z.array(z.string().max(200)),
  z.number().int().positive(),
]);
export type SurveyAnswer = z.infer<typeof SurveyAnswerSchema>;

/** 문항 id -> 답. 설문의 questions 와 짝을 이루는 응답 전체 모양. */
export const SurveyAnswersSchema = z.record(z.string().min(1), SurveyAnswerSchema);
export type SurveyAnswers = z.infer<typeof SurveyAnswersSchema>;

/**
 * 답이 문항 규칙을 어긴 사실만 표현한다. 문구는 만들지 않는다 — 서버는 한국어,
 * client-web 은 일본어로 각자 메시지를 붙인다.
 */
export type SurveyAnswerIssue = {
  questionId: string;
  kind: "REQUIRED_MISSING" | "UNKNOWN_OPTION" | "OUT_OF_RANGE" | "WRONG_SHAPE";
};

/** 리커트 척도의 단계 수. 프리셋은 5단계 고정, CUSTOM 은 labels 길이. */
export function likertStepCount(
  scale: Extract<SurveyQuestion, { type: "LIKERT" }>["scale"],
): number {
  if (scale.preset === "CUSTOM") {
    return scale.labels.length;
  }
  return 5;
}

function isEmptyAnswer(answer: SurveyAnswer | undefined): boolean {
  if (answer === undefined || answer === null) {
    return true;
  }
  if (typeof answer === "string") {
    return answer.trim().length === 0;
  }
  if (Array.isArray(answer)) {
    return answer.length === 0;
  }
  return false;
}

function choiceQuestionIssue(
  question: Extract<SurveyQuestion, { type: "SINGLE" | "MULTI" }>,
  answer: SurveyAnswer | undefined,
): SurveyAnswerIssue["kind"] | undefined {
  if (question.type === "SINGLE") {
    if (typeof answer !== "string") {
      return "WRONG_SHAPE";
    }
    if (!question.options.includes(answer)) {
      return "UNKNOWN_OPTION";
    }
    return undefined;
  }
  if (!Array.isArray(answer)) {
    return "WRONG_SHAPE";
  }
  const hasUnknownOption = answer.some(
    (selectedOption) => !question.options.includes(selectedOption),
  );
  if (hasUnknownOption) {
    return "UNKNOWN_OPTION";
  }
  return undefined;
}

function likertQuestionIssue(
  question: Extract<SurveyQuestion, { type: "LIKERT" }>,
  answer: SurveyAnswer | undefined,
): SurveyAnswerIssue["kind"] | undefined {
  if (typeof answer !== "number") {
    return "WRONG_SHAPE";
  }
  if (answer < 1 || answer > likertStepCount(question.scale)) {
    return "OUT_OF_RANGE";
  }
  return undefined;
}

function textQuestionIssue(
  answer: SurveyAnswer | undefined,
): SurveyAnswerIssue["kind"] | undefined {
  if (typeof answer !== "string") {
    return "WRONG_SHAPE";
  }
  return undefined;
}

/**
 * 문항을 순서대로 순회하며 문항당 최대 한 건의 이슈를 낸다(먼저 걸리는 종류 하나).
 * 설문에 없는 questionId 가 답에 섞여 있어도 무시한다.
 */
export function surveyAnswerIssues(
  questions: SurveyQuestion[],
  answers: SurveyAnswers,
): SurveyAnswerIssue[] {
  const issues: SurveyAnswerIssue[] = [];

  for (const question of questions) {
    const answer = answers[question.id];

    if (question.required && isEmptyAnswer(answer)) {
      issues.push({ questionId: question.id, kind: "REQUIRED_MISSING" });
      continue;
    }
    if (isEmptyAnswer(answer)) {
      continue;
    }

    let issueKind: SurveyAnswerIssue["kind"] | undefined;
    switch (question.type) {
      case "SINGLE":
      case "MULTI":
        issueKind = choiceQuestionIssue(question, answer);
        break;
      case "LIKERT":
        issueKind = likertQuestionIssue(question, answer);
        break;
      case "TEXT":
        issueKind = textQuestionIssue(answer);
        break;
    }

    if (issueKind !== undefined) {
      issues.push({ questionId: question.id, kind: issueKind });
    }
  }

  return issues;
}
