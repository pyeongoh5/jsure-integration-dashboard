import { useState } from "react";
import {
  SUB_TYPE_LABEL,
  type CampaignSubType,
  type InfluencerApplication,
  type SurveyAnswers,
} from "@jsure/shared";
import { t } from "@i18n";
import {
  EMPTY_METRIC_VALUES,
  InsightStepForm,
  type InsightMetricValues,
} from "./InsightStepForm";
import { SurveyStepForm } from "./SurveyStepForm";
import type {
  InsightAttachment,
  InsightImageContentType,
} from "./InsightAttachmentSection";
import styles from "./InsightSubmitForm.module.css";

type Metrics = Record<keyof InsightMetricValues, number>;

export interface InsightEntry extends Metrics {
  subType: CampaignSubType;
  attachments?: {
    objectKey: string;
    contentType: InsightImageContentType;
    sizeBytes: number;
  }[];
}

/** 인사이트 입력 대상 — 참여한 서브타입별 게시물. */
export interface InsightTarget {
  subType: CampaignSubType;
  initial: Metrics | null;
}

interface Props {
  applicationId: string;
  targets: InsightTarget[]; // 참여한 모든 서브타입의 인사이트를 한 폼에서 일괄 제출
  onSubmit: (insights: InsightEntry[], surveyAnswers?: SurveyAnswers) => Promise<void>;
  submitting: boolean;
  /** 인사이트 제출 기한 — 서버가 검토 완료일 기준으로 계산해 내려준다. */
  insightDueAt: string | null;
  /** 캠페인에 연결된 앙케이트. 없으면 null — 설문 단계를 건너뛴다. */
  survey: InfluencerApplication["survey"];
  /** 이미 제출한 앙케이트 답(재제출 프리필용). 없으면 null. */
  surveyAnswers: InfluencerApplication["surveyAnswers"];
}

function formatInsightDueDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}${t("application.dateFormat.monthSuffix")}${date.getDate()}${t("application.dateFormat.daySuffix")}`;
}

function fromInitial(initial: Metrics | null): InsightMetricValues {
  if (!initial) return EMPTY_METRIC_VALUES;
  return {
    likes: String(initial.likes),
    comments: String(initial.comments),
    shares: String(initial.shares),
    reposts: String(initial.reposts),
    saves: String(initial.saves),
    views: String(initial.views),
    reach: String(initial.reach),
  };
}

/**
 * 서브타입별 퍼널(단계) 셸 — 한 단계에 서브타입 1개씩 입력한다.
 * 각 단계는 독립된 폼(InsightStepForm)이라 검증 상태가 단계 간에 공유되지 않는다.
 */
export function InsightSubmitForm({
  applicationId,
  targets,
  onSubmit,
  submitting,
  insightDueAt,
  survey,
  surveyAnswers: initialSurveyAnswers,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  // 단계를 오갈 때 입력값을 보존하기 위한 서브타입별 스냅샷.
  const [valuesBySubType, setValuesBySubType] = useState<
    Partial<Record<CampaignSubType, InsightMetricValues>>
  >({});
  const [attachmentsBySubType, setAttachmentsBySubType] = useState<
    Partial<Record<CampaignSubType, InsightAttachment[]>>
  >({});
  // 재제출 시 기존 답으로 시작 — 운영자가 반려해 다시 제출하는 경우 설문까지
  // 처음부터 다시 입력하게 만들면 안 된다.
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswers>(
    initialSurveyAnswers ?? {},
  );

  const hasSurveyStep = survey !== null;
  const totalSteps = targets.length + (hasSurveyStep ? 1 : 0);
  const isSurveyStep = hasSurveyStep && stepIndex === targets.length;

  const currentTarget = targets[stepIndex] ?? targets[0]!;
  // 설문 단계가 붙으면 그 설문 단계가 마지막이 된다 — SNS 단계만으로는 더 이상 끝이 아니다.
  const isLastStep = stepIndex >= targets.length - 1 && !hasSurveyStep;

  function saveValues(subType: CampaignSubType, values: InsightMetricValues) {
    setValuesBySubType((prev) => ({ ...prev, [subType]: values }));
  }

  function buildEntries(
    valuesForCurrentSubType: Partial<Record<CampaignSubType, InsightMetricValues>>,
  ): InsightEntry[] {
    return targets.map((target) => {
      const group = valuesForCurrentSubType[target.subType] ?? EMPTY_METRIC_VALUES;
      return {
        subType: target.subType,
        likes: Number(group.likes),
        comments: Number(group.comments),
        shares: Number(group.shares),
        reposts: Number(group.reposts),
        saves: Number(group.saves),
        views: Number(group.views),
        reach: Number(group.reach),
        attachments: (attachmentsBySubType[target.subType] ?? []).map((attachment) => ({
          objectKey: attachment.objectKey,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
        })),
      };
    });
  }

  async function handleNext(values: InsightMetricValues) {
    saveValues(currentTarget.subType, values);
    if (!isLastStep) {
      setStepIndex(stepIndex + 1);
      return;
    }
    const merged = { ...valuesBySubType, [currentTarget.subType]: values };
    await onSubmit(buildEntries(merged));
  }

  function handleBack(values: InsightMetricValues) {
    saveValues(currentTarget.subType, values);
    setStepIndex(stepIndex - 1);
  }

  function handleSurveyBack(answers: SurveyAnswers) {
    setSurveyAnswers(answers);
    setStepIndex(stepIndex - 1);
  }

  async function handleSurveySubmit(answers: SurveyAnswers) {
    setSurveyAnswers(answers);
    await onSubmit(buildEntries(valuesBySubType), answers);
  }

  return (
    <div>
      <div className={styles.guidance}>
        {t("application.insightForm.guidance")}
        {insightDueAt && (
          <div className={styles.guidanceDue}>
            {t("application.insightForm.dueLabelPrefix")}
            {formatInsightDueDate(insightDueAt)}
          </div>
        )}
      </div>

      {totalSteps > 1 && (
        <div className={styles.progress}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <div
              key={index}
              className={`${styles.progressSegment} ${
                index <= stepIndex ? styles.progressSegmentDone : ""
              }`}
            />
          ))}
        </div>
      )}

      <div className={styles.sectionTitle}>
        {survey !== null && isSurveyStep ? survey.title : SUB_TYPE_LABEL[currentTarget.subType]}
        {totalSteps > 1 && (
          <span className={styles.stepCount}>
            {stepIndex + 1}/{totalSteps}
          </span>
        )}
      </div>

      {survey !== null && isSurveyStep ? (
        <SurveyStepForm
          survey={survey}
          initialAnswers={surveyAnswers}
          onBack={handleSurveyBack}
          onSubmit={handleSurveySubmit}
          submitting={submitting}
        />
      ) : (
        <InsightStepForm
          key={currentTarget.subType}
          applicationId={applicationId}
          subType={currentTarget.subType}
          defaultValues={
            valuesBySubType[currentTarget.subType] ?? fromInitial(currentTarget.initial)
          }
          attachments={attachmentsBySubType[currentTarget.subType] ?? []}
          onAttachmentsChange={(next) =>
            setAttachmentsBySubType((prev) => ({
              ...prev,
              [currentTarget.subType]: next,
            }))
          }
          isFirstStep={stepIndex === 0}
          isLastStep={isLastStep}
          submitting={submitting}
          onBack={handleBack}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
