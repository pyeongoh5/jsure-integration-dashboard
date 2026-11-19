import { useState } from "react";
import type { FormEvent } from "react";
import type {
  InfluencerApplication,
  SurveyAnswer,
  SurveyAnswerIssue,
  SurveyAnswers,
  SurveyQuestion,
} from "@jsure/shared";
import { likertStepCount, surveyAnswerIssues } from "@jsure/shared";
import { Checkbox, Input, Radio, Textarea } from "@/components/ui";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t, type TranslationKey } from "@i18n";
import insightFormStyles from "./InsightSubmitForm.module.css";
import styles from "./SurveyStepForm.module.css";

type Survey = NonNullable<InfluencerApplication["survey"]>;
type LikertScale = Extract<SurveyQuestion, { type: "LIKERT" }>["scale"];
type LikertFullLabelPreset = Exclude<LikertScale["preset"], "NUMERIC" | "CUSTOM">;

const LIKERT_PRESET_STEP_KEYS: Record<LikertFullLabelPreset, readonly TranslationKey[]> = {
  AGREEMENT: [
    "builderSurveys.likert.AGREEMENT.step1",
    "builderSurveys.likert.AGREEMENT.step2",
    "builderSurveys.likert.AGREEMENT.step3",
    "builderSurveys.likert.AGREEMENT.step4",
    "builderSurveys.likert.AGREEMENT.step5",
  ],
  SATISFACTION: [
    "builderSurveys.likert.SATISFACTION.step1",
    "builderSurveys.likert.SATISFACTION.step2",
    "builderSurveys.likert.SATISFACTION.step3",
    "builderSurveys.likert.SATISFACTION.step4",
    "builderSurveys.likert.SATISFACTION.step5",
  ],
  FREQUENCY: [
    "builderSurveys.likert.FREQUENCY.step1",
    "builderSurveys.likert.FREQUENCY.step2",
    "builderSurveys.likert.FREQUENCY.step3",
    "builderSurveys.likert.FREQUENCY.step4",
    "builderSurveys.likert.FREQUENCY.step5",
  ],
};

const LIKERT_NUMERIC_POINT_SUFFIX_KEY: TranslationKey =
  "builderSurveys.likert.NUMERIC.pointSuffix";

/** 리커트 단계(1-based)의 라벨. 프리셋만 i18n 에서 읽고, CUSTOM 라벨은 운영자 입력 그대로 쓴다. */
function likertStepLabel(scale: LikertScale, step: number): string {
  if (scale.preset === "CUSTOM") {
    return scale.labels[step - 1] ?? "";
  }
  if (scale.preset === "NUMERIC") {
    return `${step}${t(LIKERT_NUMERIC_POINT_SUFFIX_KEY)}`;
  }
  const key = LIKERT_PRESET_STEP_KEYS[scale.preset][step - 1];
  return key ? t(key) : "";
}

/**
 * 숫자형은 라벨 자체가 `3점` 이라 단계 번호를 따로 띄우면 `3` 과 `3점` 이 겹친다.
 * 나머지 척도는 번호 + 라벨을 함께 보여줘 척도상 위치를 알 수 있게 한다.
 */
function showsStepNumber(scale: LikertScale): boolean {
  return scale.preset !== "NUMERIC";
}

function optionRowClass(checked: boolean): string {
  return [styles.optionRow, checked ? styles.optionRowChecked : ""]
    .filter(Boolean)
    .join(" ");
}

function likertCellClass(checked: boolean): string {
  return [styles.likertCell, checked ? styles.likertCellChecked : ""]
    .filter(Boolean)
    .join(" ");
}

function issueMessage(kind: SurveyAnswerIssue["kind"]): string {
  switch (kind) {
    case "REQUIRED_MISSING":
      return t("application.surveyForm.requiredMissing");
    case "UNKNOWN_OPTION":
      return t("application.surveyForm.unknownOption");
    case "OUT_OF_RANGE":
      return t("application.surveyForm.outOfRange");
    case "WRONG_SHAPE":
      return t("application.surveyForm.wrongShape");
  }
}

interface Props {
  survey: Survey;
  initialAnswers: SurveyAnswers;
  /** 이전 단계로 — 현재 입력값을 넘겨 저장한다(검증 없음). */
  onBack: (currentAnswers: SurveyAnswers) => void;
  /** 검증 통과 시 — 지표와 함께 최종 제출. */
  onSubmit: (answers: SurveyAnswers) => void | Promise<void>;
  submitting: boolean;
}

function renderQuestionInput(
  question: SurveyQuestion,
  answer: SurveyAnswer | undefined,
  onAnswerChange: (next: SurveyAnswer) => void,
) {
  switch (question.type) {
    case "SINGLE":
      return (
        <div className={styles.optionList}>
          {question.options.map((option) => (
            <Radio
              key={option}
              name={question.id}
              checked={answer === option}
              onChange={() => onAnswerChange(option)}
              label={option}
              className={optionRowClass(answer === option)}
            />
          ))}
        </div>
      );
    case "MULTI": {
      const selected = Array.isArray(answer) ? answer : [];
      return (
        <div className={styles.optionList}>
          {question.options.map((option) => (
            <Checkbox
              key={option}
              checked={selected.includes(option)}
              onChange={(checked) =>
                onAnswerChange(
                  checked
                    ? [...selected, option]
                    : selected.filter((selectedOption) => selectedOption !== option),
                )
              }
              label={option}
              className={optionRowClass(selected.includes(option))}
            />
          ))}
        </div>
      );
    }
    case "LIKERT": {
      const scale = question.scale;
      const stepCount = likertStepCount(scale);
      const steps = Array.from({ length: stepCount }, (_, index) => index + 1);
      const withStepNumber = showsStepNumber(scale);
      return (
        <div className={styles.likertScale}>
          {steps.map((step) => (
            <Radio
              key={step}
              name={question.id}
              checked={answer === step}
              onChange={() => onAnswerChange(step)}
              label={
                <span className={styles.likertCellLabel}>
                  {withStepNumber && <span className={styles.likertStep}>{step}</span>}
                  <span className={withStepNumber ? styles.likertText : styles.likertStep}>
                    {likertStepLabel(scale, step)}
                  </span>
                </span>
              }
              className={likertCellClass(answer === step)}
            />
          ))}
        </div>
      );
    }
    case "TEXT": {
      const value = typeof answer === "string" ? answer : "";
      if (question.multiline) {
        return <Textarea value={value} onChange={(next) => onAnswerChange(next)} />;
      }
      return <Input type="text" value={value} onChange={(next) => onAnswerChange(next)} />;
    }
  }
}

/**
 * 인사이트 제출 마법사의 마지막 단계 — 캠페인에 연결된 앙케이트에 답한다.
 * 입력 상태(답변·검증 결과)는 이 컴포넌트가 직접 소유한다.
 */
export function SurveyStepForm({
  survey,
  initialAnswers,
  onBack,
  onSubmit,
  submitting,
}: Props) {
  const [answers, setAnswers] = useState<SurveyAnswers>(initialAnswers);
  const [issueKindByQuestionId, setIssueKindByQuestionId] = useState<
    Partial<Record<string, SurveyAnswerIssue["kind"]>>
  >({});

  function setAnswer(questionId: string, answer: SurveyAnswer) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const issues = surveyAnswerIssues(survey.questions, answers);
    if (issues.length > 0) {
      setIssueKindByQuestionId(
        Object.fromEntries(issues.map((issue) => [issue.questionId, issue.kind])),
      );
      return;
    }
    setIssueKindByQuestionId({});
    onSubmit(answers);
  }

  return (
    <form onSubmit={handleSubmit}>
      {survey.description && (
        <p className={styles.surveyDescription}>{survey.description}</p>
      )}
      {survey.questions.map((question, index) => {
        const issueKind = issueKindByQuestionId[question.id];
        const questionClass = [styles.question, issueKind ? styles.questionInvalid : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={question.id} className={questionClass}>
            <div className={styles.questionHead}>
              <span className={styles.questionNumber}>Q{index + 1}</span>
              <span className={styles.questionTitle}>
                {question.title}
                {question.required && <span className={styles.required}>*</span>}
              </span>
            </div>
            {question.description && (
              <p className={styles.questionDescription}>{question.description}</p>
            )}
            {renderQuestionInput(question, answers[question.id], (next) =>
              setAnswer(question.id, next),
            )}
            {issueKind && <p className={styles.issue}>{issueMessage(issueKind)}</p>}
          </div>
        );
      })}
      <div className={insightFormStyles.stepNav}>
        <PrimaryButton
          type="button"
          variant="ghost"
          onClick={() => onBack(answers)}
          disabled={submitting}
        >
          {t("application.insightForm.prevStep")}
        </PrimaryButton>
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting
            ? t("application.insightForm.submitting")
            : t("application.insightForm.submit")}
        </PrimaryButton>
      </div>
    </form>
  );
}
