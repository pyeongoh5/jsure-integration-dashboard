import { describe, expect, it } from "vitest";
import type { SurveyQuestion } from "@jsure/shared";
import { translate, type AdminTranslationKey } from "@i18n/admin";
import { buildSurveyColumns } from "./surveyColumns";

const label = (key: AdminTranslationKey, params?: Record<string, string | number>) =>
  translate(key, "ko", params);

const questions: SurveyQuestion[] = [
  { id: "q1", type: "SINGLE", title: "어디서 알았나요", required: true, options: ["인스타", "검색"] },
  { id: "q2", type: "MULTI", title: "무엇을 샀나요", required: false, options: ["A", "B"] },
  { id: "q3", type: "LIKERT", title: "만족도", required: true, scale: { preset: "AGREEMENT" } },
  { id: "q4", type: "TEXT", title: "한마디", required: false, multiline: true },
];

describe("buildSurveyColumns", () => {
  it("key 는 survey_ 접두사 + 문항 id 다 — 고정 컬럼 key 와 네임스페이스가 겹치지 않는다", () => {
    expect(buildSurveyColumns(questions, label).map((column) => column.key)).toEqual([
      "survey_q1",
      "survey_q2",
      "survey_q3",
      "survey_q4",
    ]);
  });

  it("헤더가 Q번호. 문항제목 형식이다", () => {
    expect(buildSurveyColumns(questions, label).map((column) => column.label)).toEqual([
      "Q1. 어디서 알았나요",
      "Q2. 무엇을 샀나요",
      "Q3. 만족도",
      "Q4. 한마디",
    ]);
  });

  it("설문이 null 이면 빈 배열 — 시트에 컬럼이 붙지 않는다", () => {
    expect(buildSurveyColumns(null, label)).toEqual([]);
  });

  it("미응답 참가자는 빈 문자열", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns.map((column) => column.value({ surveyAnswers: null }))).toEqual([
      "",
      "",
      "",
      "",
    ]);
  });

  it("다중선택은 하나의 셀에 모아 쓴다", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns[1]!.value({ surveyAnswers: { q2: ["A", "B"] } })).toBe("A, B");
  });

  it("리커트는 라벨과 단계를 함께 쓴다", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns[2]!.value({ surveyAnswers: { q3: 4 } })).toBe("그렇다 (4/5)");
  });

  it("현재 설문에 없는 questionId 의 답은 버린다", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns).toHaveLength(4);
  });

  it("문항에 답이 없으면 그 칸만 빈다", () => {
    const columns = buildSurveyColumns(questions, label);
    expect(columns[3]!.value({ surveyAnswers: { q1: "검색" } })).toBe("");
  });
});
