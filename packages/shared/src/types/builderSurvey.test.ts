import { describe, it, expect } from "vitest";
import { SurveyQuestionsSchema } from "./builderSurvey.js";

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
