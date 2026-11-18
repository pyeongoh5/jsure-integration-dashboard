import { describe, it, expect } from "vitest";
import {
  CreateBuilderSurveyRequestSchema,
  SurveyQuestionsSchema,
  surveyAnswerIssues,
  likertStepCount,
} from "./builderSurvey.js";

const single = {
  id: "q1",
  type: "SINGLE",
  title: "어디서 알았나요",
  required: true,
  options: ["인스타", "검색"],
};
const likertPreset = {
  id: "q2",
  type: "LIKERT",
  title: "재구매 의향",
  required: false,
  scale: { preset: "AGREEMENT" },
};
const text = {
  id: "q3",
  type: "TEXT",
  title: "개선점",
  required: false,
  multiline: true,
};

describe("SurveyQuestionsSchema", () => {
  it("네 타입을 모두 통과시킨다", () => {
    const multi = { ...single, id: "q4", type: "MULTI" };
    expect(
      SurveyQuestionsSchema.safeParse([single, multi, likertPreset, text])
        .success,
    ).toBe(true);
  });

  it("문항이 하나도 없으면 거부한다", () => {
    expect(SurveyQuestionsSchema.safeParse([]).success).toBe(false);
  });

  it("문항 id 가 중복되면 거부한다", () => {
    expect(
      SurveyQuestionsSchema.safeParse([single, { ...text, id: "q1" }])
        .success,
    ).toBe(false);
  });

  it("선택지가 2개 미만이면 거부한다", () => {
    expect(
      SurveyQuestionsSchema.safeParse([{ ...single, options: ["하나"] }])
        .success,
    ).toBe(false);
  });

  it("리커트 CUSTOM 라벨은 2~10개만 허용한다", () => {
    const custom = (labels: string[]) =>
      SurveyQuestionsSchema.safeParse([
        { ...likertPreset, scale: { preset: "CUSTOM", labels } },
      ]);
    expect(custom(["하나"]).success).toBe(false);
    expect(custom(["나쁨", "보통", "좋음"]).success).toBe(true);
    expect(
      custom(Array.from({ length: 11 }, (_, index) => `라벨${index}`))
        .success,
    ).toBe(false);
  });

  it("프리셋이 아닌 척도 이름을 거부한다", () => {
    expect(
      SurveyQuestionsSchema.safeParse([
        { ...likertPreset, scale: { preset: "WHATEVER" } },
      ]).success,
    ).toBe(false);
  });

  it("타입에 맞지 않는 필드는 걸러낸다", () => {
    const parsed = SurveyQuestionsSchema.parse([
      { ...text, options: ["남은 값"] },
    ]);
    expect(parsed[0]).not.toHaveProperty("options");
  });
});

describe("CreateBuilderSurveyRequestSchema", () => {
  it("설문 설명이 1000자를 넘으면 거부한다", () => {
    const base = {
      title: "제목",
      questions: [single],
    };
    expect(
      CreateBuilderSurveyRequestSchema.safeParse({
        ...base,
        description: "a".repeat(1000),
      }).success,
    ).toBe(true);
    expect(
      CreateBuilderSurveyRequestSchema.safeParse({
        ...base,
        description: "a".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

const singleChoiceQuestion = { id: "q1", type: "SINGLE" as const, title: "어디서", required: true,
  options: ["인스타", "검색"] };
const multiChoiceQuestion = { id: "q2", type: "MULTI" as const, title: "무엇을", required: false,
  options: ["A", "B", "C"] };
const likertQuestion = { id: "q3", type: "LIKERT" as const, title: "만족도", required: true,
  scale: { preset: "AGREEMENT" as const } };
const textQuestion = { id: "q4", type: "TEXT" as const, title: "한마디", required: false,
  multiline: true };
const allAnswerQuestions = [singleChoiceQuestion, multiChoiceQuestion, likertQuestion, textQuestion];

describe("surveyAnswerIssues", () => {
  it("전부 올바르면 빈 배열", () => {
    expect(surveyAnswerIssues(allAnswerQuestions, {
      q1: "검색", q2: ["A", "C"], q3: 4, q4: "좋았어요",
    })).toEqual([]);
  });

  it("선택 문항이 아니면 빈 답을 허용한다", () => {
    expect(surveyAnswerIssues(allAnswerQuestions, { q1: "검색", q3: 1 })).toEqual([]);
  });

  it("필수 문항이 비면 REQUIRED_MISSING", () => {
    expect(surveyAnswerIssues(allAnswerQuestions, { q3: 1 }))
      .toEqual([{ questionId: "q1", kind: "REQUIRED_MISSING" }]);
  });

  it("필수 주관식의 공백만 입력은 비어 있는 것으로 본다", () => {
    expect(surveyAnswerIssues([{ ...textQuestion, required: true }], { q4: "   " }))
      .toEqual([{ questionId: "q4", kind: "REQUIRED_MISSING" }]);
  });

  it("필수 다중선택의 빈 배열은 비어 있는 것으로 본다", () => {
    expect(surveyAnswerIssues([{ ...multiChoiceQuestion, required: true }], { q2: [] }))
      .toEqual([{ questionId: "q2", kind: "REQUIRED_MISSING" }]);
  });

  it("선택지에 없는 값이면 UNKNOWN_OPTION", () => {
    expect(surveyAnswerIssues([singleChoiceQuestion], { q1: "텔레비전" }))
      .toEqual([{ questionId: "q1", kind: "UNKNOWN_OPTION" }]);
    expect(surveyAnswerIssues([multiChoiceQuestion], { q2: ["A", "없는값"] }))
      .toEqual([{ questionId: "q2", kind: "UNKNOWN_OPTION" }]);
  });

  it("리커트 프리셋은 1~5 를 벗어나면 OUT_OF_RANGE", () => {
    expect(surveyAnswerIssues([likertQuestion], { q3: 0 }))
      .toEqual([{ questionId: "q3", kind: "OUT_OF_RANGE" }]);
    expect(surveyAnswerIssues([likertQuestion], { q3: 6 }))
      .toEqual([{ questionId: "q3", kind: "OUT_OF_RANGE" }]);
  });

  it("리커트 CUSTOM 은 labels 길이가 상한이다", () => {
    const customLikertQuestion = { ...likertQuestion, scale: { preset: "CUSTOM" as const, labels: ["나쁨", "좋음"] } };
    expect(surveyAnswerIssues([customLikertQuestion], { q3: 2 })).toEqual([]);
    expect(surveyAnswerIssues([customLikertQuestion], { q3: 3 }))
      .toEqual([{ questionId: "q3", kind: "OUT_OF_RANGE" }]);
  });

  it("타입에 맞지 않는 모양이면 WRONG_SHAPE", () => {
    expect(surveyAnswerIssues([singleChoiceQuestion], { q1: ["배열은 단일선택에 맞지 않는다"] }))
      .toEqual([{ questionId: "q1", kind: "WRONG_SHAPE" }]);
    expect(surveyAnswerIssues([likertQuestion], { q3: "문자열은 리커트에 맞지 않는다" }))
      .toEqual([{ questionId: "q3", kind: "WRONG_SHAPE" }]);
  });

  it("설문에 없는 questionId 는 무시한다", () => {
    expect(surveyAnswerIssues([singleChoiceQuestion], { q1: "검색", 유령: "값" })).toEqual([]);
  });

  it("문항 순서대로 이슈를 돌려준다", () => {
    expect(surveyAnswerIssues(allAnswerQuestions, {}).map((issue) => issue.questionId))
      .toEqual(["q1", "q3"]);
  });
});

describe("likertStepCount", () => {
  it("프리셋은 5단계", () => {
    expect(likertStepCount({ preset: "AGREEMENT" })).toBe(5);
    expect(likertStepCount({ preset: "NUMERIC" })).toBe(5);
  });
  it("CUSTOM 은 labels 길이", () => {
    expect(likertStepCount({ preset: "CUSTOM", labels: ["가", "나", "다"] })).toBe(3);
  });
});
