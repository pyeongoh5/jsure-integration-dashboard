import { LIKERT_PRESETS, type SurveyQuestion, type SurveyQuestionType } from "@jsure/shared";

/** 타입 전환·복제 사이에 그대로 옮겨지는 필드. */
type CommonFields = {
  id: string;
  title: string;
  description?: string;
  required: boolean;
};

function commonFieldsOf(question: SurveyQuestion): CommonFields {
  return {
    id: question.id,
    title: question.title,
    description: question.description,
    required: question.required,
  };
}

/** 공통 필드 + 새 타입의 기본값으로 문항을 새로 짠다. */
function buildQuestion(common: CommonFields, type: SurveyQuestionType): SurveyQuestion {
  switch (type) {
    case "SINGLE":
    case "MULTI":
      return { ...common, type, options: ["", ""] };
    case "LIKERT":
      return { ...common, type, scale: { preset: LIKERT_PRESETS[0] } };
    case "TEXT":
      return { ...common, type, multiline: true };
  }
}

export function newQuestion(type: SurveyQuestionType): SurveyQuestion {
  return buildQuestion({ id: crypto.randomUUID(), title: "", required: false }, type);
}

/**
 * 공통 필드(id, title, description, required)만 옮기고 나머지는 새 타입의 기본값으로
 * 다시 만든다 — 단, SINGLE ↔ MULTI 는 입력해 둔 선택지를 버리지 않도록 그대로 유지한다.
 */
export function changeQuestionType(
  question: SurveyQuestion,
  nextType: SurveyQuestionType,
): SurveyQuestion {
  const common = commonFieldsOf(question);
  if (nextType !== "SINGLE" && nextType !== "MULTI") {
    return buildQuestion(common, nextType);
  }
  if (question.type !== "SINGLE" && question.type !== "MULTI") {
    return buildQuestion(common, nextType);
  }
  return { ...common, type: nextType, options: question.options };
}

export function duplicateQuestion(question: SurveyQuestion): SurveyQuestion {
  return { ...question, id: crypto.randomUUID() };
}
