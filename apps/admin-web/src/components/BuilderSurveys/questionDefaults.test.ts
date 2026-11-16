import { describe, expect, it } from "vitest";
import { changeQuestionType, duplicateQuestion, newQuestion } from "./questionDefaults";

describe("newQuestion", () => {
  it("선택형은 빈 선택지 2개로 시작한다", () => {
    expect(newQuestion("SINGLE")).toMatchObject({ type: "SINGLE", options: ["", ""] });
  });

  it("리커트는 AGREEMENT 프리셋으로 시작한다", () => {
    expect(newQuestion("LIKERT")).toMatchObject({ scale: { preset: "AGREEMENT" } });
  });

  it("주관식은 여러 줄로 시작한다", () => {
    expect(newQuestion("TEXT")).toMatchObject({ type: "TEXT", multiline: true });
  });

  it("매번 다른 id 를 발급한다", () => {
    expect(newQuestion("TEXT").id).not.toBe(newQuestion("TEXT").id);
  });
});

describe("changeQuestionType", () => {
  it("선택형 → 주관식이면 options 가 사라지고 multiline 이 생긴다", () => {
    const changed = changeQuestionType(newQuestion("SINGLE"), "TEXT");
    expect(changed).not.toHaveProperty("options");
    expect(changed).toMatchObject({ type: "TEXT", multiline: true });
  });

  it("주관식 → 리커트면 multiline 이 사라지고 scale 이 생긴다", () => {
    const changed = changeQuestionType(newQuestion("TEXT"), "LIKERT");
    expect(changed).not.toHaveProperty("multiline");
    expect(changed).toMatchObject({ scale: { preset: "AGREEMENT" } });
  });

  it("단일 → 다중은 선택지와 id, 제목, 필수여부를 유지한다", () => {
    const single = { ...newQuestion("SINGLE"), title: "질문", required: true,
      options: ["가", "나", "다"] };
    const changed = changeQuestionType(single, "MULTI");
    expect(changed).toMatchObject({ id: single.id, title: "질문", required: true,
      type: "MULTI", options: ["가", "나", "다"] });
  });
});

describe("duplicateQuestion", () => {
  it("내용은 같고 id 만 새로 발급한다", () => {
    const original = { ...newQuestion("SINGLE"), title: "원본" };
    const copy = duplicateQuestion(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.title).toBe("원본");
  });
});
