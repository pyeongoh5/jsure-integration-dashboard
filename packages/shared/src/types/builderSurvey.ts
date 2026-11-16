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
});
export type BuilderSurveyListItem = z.infer<typeof BuilderSurveyListItemSchema>;

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
