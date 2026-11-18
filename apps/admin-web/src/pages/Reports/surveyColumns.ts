import type { CampaignReportParticipant, SurveyAnswer, SurveyQuestion } from "@jsure/shared";
import { likertStepCount } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { likertLabel } from "@/domains/builderSurvey";

type Translator = (
  key: AdminTranslationKey,
  params?: Record<string, string | number>,
) => string;

type LikertQuestion = Extract<SurveyQuestion, { type: "LIKERT" }>;

export type SurveyColumn = {
  key: string;
  label: string;
  value: (participant: Pick<CampaignReportParticipant, "surveyAnswers">) => string;
};

/** 선택형(SINGLE/MULTI) 답 — 운영자가 입력한 선택지 문자열을 그대로 쓴다(번역 안 함). */
function choiceCellText(answer: SurveyAnswer | undefined): string {
  if (typeof answer === "string") return answer;
  if (Array.isArray(answer)) return answer.join(", ");
  return "";
}

/** 주관식 답 — 운영자가 입력한 문구를 그대로 쓴다. */
function textCellText(answer: SurveyAnswer | undefined): string {
  return typeof answer === "string" ? answer : "";
}

/**
 * 리커트 답 — `라벨 (단계/전체)` 형태. 화면 검수 팝업(SurveyResponseSection)과 같은
 * `likertLabel` 을 써서 엑셀과 화면의 라벨이 갈라지지 않게 한다.
 */
function likertCellText(
  question: LikertQuestion,
  answer: SurveyAnswer | undefined,
  translateLabel: Translator,
): string {
  const stepCount = likertStepCount(question.scale);
  if (typeof answer !== "number" || answer < 1 || answer > stepCount) return "";
  const label = likertLabel(question.scale, answer, translateLabel);
  return label ? `${label} (${answer}/${stepCount})` : `(${answer}/${stepCount})`;
}

function surveyCellText(
  question: SurveyQuestion,
  answer: SurveyAnswer | undefined,
  translateLabel: Translator,
): string {
  switch (question.type) {
    case "SINGLE":
    case "MULTI":
      return choiceCellText(answer);
    case "LIKERT":
      return likertCellText(question, answer, translateLabel);
    case "TEXT":
      return textCellText(answer);
  }
}

/**
 * 캠페인 리포트 엑셀 우측에 붙는 설문 문항 컬럼. 헤더는 현재 설문 문항 기준이고 답은
 * questionId 로 맞춘다 — 그 사이 지워진 문항은 컬럼이 없고, 새로 생긴 문항은 과거
 * 응답자 칸이 빈다.
 *
 * `questions` 가 null(설문 미연결 캠페인)이면 빈 배열을 돌려준다 — 시트 구조가
 * 지금과 완전히 동일하게 유지되어야 한다.
 */
export function buildSurveyColumns(
  questions: SurveyQuestion[] | null,
  translateLabel: Translator,
): SurveyColumn[] {
  if (!questions) return [];
  return questions.map((question, index) => ({
    key: question.id,
    label: `Q${index + 1}. ${question.title}`,
    value: (participant) =>
      surveyCellText(question, participant.surveyAnswers?.[question.id], translateLabel),
  }));
}
