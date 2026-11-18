import { Fragment } from "react";
import type { SurveyAnswer, SurveyAnswers, SurveyQuestion } from "@jsure/shared";
import { likertStepCount } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { likertLabel } from "@/domains/builderSurvey";
import { useT } from "@/lib/i18n";
import styles from "./InsightDetailDialog.module.css";

type LikertQuestion = Extract<SurveyQuestion, { type: "LIKERT" }>;

/** 선택형(SINGLE/MULTI) 답 — 운영자가 입력한 선택지 문자열을 그대로 보여준다(번역 안 함). */
function choiceAnswerText(answer: SurveyAnswer | undefined, noAnswerLabel: string): string {
  if (typeof answer === "string" && answer.length > 0) return answer;
  if (Array.isArray(answer) && answer.length > 0) return answer.join(", ");
  return noAnswerLabel;
}

/** 주관식 답 — 운영자가 입력한 문구를 그대로 보여준다. */
function textAnswerText(answer: SurveyAnswer | undefined, noAnswerLabel: string): string {
  if (typeof answer === "string" && answer.trim().length > 0) return answer;
  return noAnswerLabel;
}

/** 리커트 답 — `라벨 (단계/전체)` 형태. 라벨 없는 단계(NUMERIC 중간)는 단계만 보여준다. */
function likertAnswerText(
  question: LikertQuestion,
  answer: SurveyAnswer | undefined,
  translateLabel: (key: AdminTranslationKey) => string,
  noAnswerLabel: string,
): string {
  const stepCount = likertStepCount(question.scale);
  if (typeof answer !== "number" || answer < 1 || answer > stepCount) {
    return noAnswerLabel;
  }
  const label = likertLabel(question.scale, answer, translateLabel);
  if (!label) return `(${answer}/${stepCount})`;
  return `${label} (${answer}/${stepCount})`;
}

function answerText(
  question: SurveyQuestion,
  answer: SurveyAnswer | undefined,
  translateLabel: (key: AdminTranslationKey) => string,
  noAnswerLabel: string,
): string {
  switch (question.type) {
    case "SINGLE":
    case "MULTI":
      return choiceAnswerText(answer, noAnswerLabel);
    case "LIKERT":
      return likertAnswerText(question, answer, translateLabel, noAnswerLabel);
    case "TEXT":
      return textAnswerText(answer, noAnswerLabel);
  }
}

type Props = {
  /** 응답 시점 설문 문항 스냅샷 — 현재 설문이 아니라 그 사람이 답한 그대로를 보여준다. */
  questionsSnapshot: SurveyQuestion[];
  answers: SurveyAnswers;
};

/** 검수 팝업에 붙는 앙케이트 응답 읽기 전용 표시. */
export function SurveyResponseSection({ questionsSnapshot, answers }: Props) {
  const t = useT();
  const noAnswerLabel = t(
    "domains.application.drafts.insightDialog.surveyResponse.noAnswer",
  );
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {t("domains.application.drafts.insightDialog.surveyResponse.title")}
      </h3>
      <div className={styles.fields}>
        {questionsSnapshot.map((question) => (
          <Fragment key={question.id}>
            <div className={styles.fieldLabel}>{question.title}</div>
            <div
              className={styles.fieldValue}
              style={question.type === "TEXT" ? { whiteSpace: "pre-wrap" } : undefined}
            >
              {answerText(question, answers[question.id], t, noAnswerLabel)}
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
