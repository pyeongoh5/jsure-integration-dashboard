import { useState } from "react";
import { SUB_TYPE_LABEL, type CampaignSubType } from "@jsure/shared";
import { t } from "@i18n";
import {
  EMPTY_METRIC_VALUES,
  InsightStepForm,
  type InsightMetricValues,
} from "./InsightStepForm";
import type {
  InsightAttachment,
  InsightImageContentType,
} from "./InsightAttachmentSection";
import styles from "./InsightSubmitForm.module.css";

type Metrics = Record<keyof InsightMetricValues, number>;

export interface InsightEntry extends Metrics {
  subType: CampaignSubType; // new
  attachments?: {
    objectKey: string;
    contentType: InsightImageContentType;
    sizeBytes: number;
  }[];
}

/** 인사이트 입력 대상 — 참여한 서브타입별 게시물. */
export interface InsightTarget {
  subType: CampaignSubType; // new
  initial: Metrics | null; // new
}

interface Props {
  applicationId: string;
  targets: InsightTarget[]; // new — 참여한 모든 서브타입의 인사이트를 한 폼에서 일괄 제출
  onSubmit: (insights: InsightEntry[]) => Promise<void>; // new
  submitting: boolean;
  postSubmittedAt: string;
}

function formatInsightDueDate(iso: string): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + 7);
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
  postSubmittedAt,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  // 단계를 오갈 때 입력값을 보존하기 위한 서브타입별 스냅샷.
  const [valuesBySubType, setValuesBySubType] = useState<
    Partial<Record<CampaignSubType, InsightMetricValues>>
  >({});
  const [attachmentsBySubType, setAttachmentsBySubType] = useState<
    Partial<Record<CampaignSubType, InsightAttachment[]>>
  >({});

  const currentTarget = targets[stepIndex] ?? targets[0]!;
  const isLastStep = stepIndex >= targets.length - 1;

  function saveValues(subType: CampaignSubType, values: InsightMetricValues) {
    setValuesBySubType((prev) => ({ ...prev, [subType]: values }));
  }

  async function handleNext(values: InsightMetricValues) {
    saveValues(currentTarget.subType, values);
    if (!isLastStep) {
      setStepIndex(stepIndex + 1);
      return;
    }
    const merged = { ...valuesBySubType, [currentTarget.subType]: values };
    await onSubmit(
      targets.map((target) => {
        const group = merged[target.subType] ?? EMPTY_METRIC_VALUES;
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
      }),
    );
  }

  function handleBack(values: InsightMetricValues) {
    saveValues(currentTarget.subType, values);
    setStepIndex(stepIndex - 1);
  }

  return (
    <div>
      <div className={styles.guidance}>
        {t("application.insightForm.guidance")}
        <div className={styles.guidanceDue}>
          {t("application.insightForm.dueLabelPrefix")}
          {formatInsightDueDate(postSubmittedAt)}
        </div>
      </div>

      {targets.length > 1 && (
        <div className={styles.progress}>
          {targets.map((target, index) => (
            <div
              key={target.subType}
              className={`${styles.progressSegment} ${
                index <= stepIndex ? styles.progressSegmentDone : ""
              }`}
            />
          ))}
        </div>
      )}

      <div className={styles.sectionTitle}>
        {SUB_TYPE_LABEL[currentTarget.subType]}
        {targets.length > 1 && (
          <span className={styles.stepCount}>
            {stepIndex + 1}/{targets.length}
          </span>
        )}
      </div>

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
    </div>
  );
}
