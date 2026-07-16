import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CampaignSubType } from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";
import {
  InsightAttachmentSection,
  type InsightAttachment,
} from "./InsightAttachmentSection";
import styles from "./InsightSubmitForm.module.css";

export const METRIC_FIELDS = [
  { key: "likes", label: t("application.insightForm.metricLikes") },
  { key: "comments", label: t("application.insightForm.metricComments") },
  { key: "shares", label: t("application.insightForm.metricShares") },
  { key: "reposts", label: t("application.insightForm.metricReposts") },
  { key: "saves", label: t("application.insightForm.metricSaves") },
  { key: "views", label: t("application.insightForm.metricViews") },
  { key: "reach", label: t("application.insightForm.metricReach") },
] as const;

export type MetricKey = (typeof METRIC_FIELDS)[number]["key"];

const metricSchema = z.string().regex(/^\d+$/, t("application.insightForm.metricInvalid"));

const metricGroupSchema = z.object({
  likes: metricSchema,
  comments: metricSchema,
  shares: metricSchema,
  reposts: metricSchema,
  saves: metricSchema,
  views: metricSchema,
  reach: metricSchema,
});

/** 서브타입 1개 분량의 지표 입력값(문자열 폼 상태). */
export type InsightMetricValues = z.infer<typeof metricGroupSchema>;

export const EMPTY_METRIC_VALUES: InsightMetricValues = {
  likes: "",
  comments: "",
  shares: "",
  reposts: "",
  saves: "",
  views: "",
  reach: "",
};

interface Props {
  applicationId: string; // new
  subType: CampaignSubType; // new
  defaultValues: InsightMetricValues; // new
  attachments: InsightAttachment[]; // new
  onAttachmentsChange: (next: InsightAttachment[]) => void; // new
  isFirstStep: boolean; // new
  isLastStep: boolean; // new
  submitting: boolean; // new
  /** 이전 단계로 — 현재 입력값을 넘겨 저장한다(검증 없음). */
  onBack: (currentValues: InsightMetricValues) => void; // new
  /** 현재 단계 검증 통과 시 — 다음 단계 이동 또는 최종 제출. */
  onNext: (values: InsightMetricValues) => void | Promise<void>; // new
}

/**
 * 퍼널 한 단계 = 서브타입 1개의 독립 폼.
 * 폼 상태(에러/터치/제출 여부)가 단계마다 격리되므로 다른 서브타입의 검증 흔적이 남지 않는다.
 */
export function InsightStepForm({
  applicationId,
  subType,
  defaultValues,
  attachments,
  onAttachmentsChange,
  isFirstStep,
  isLastStep,
  submitting,
  onBack,
  onNext,
}: Props) {
  const methods = useForm<InsightMetricValues>({
    resolver: zodResolver(metricGroupSchema),
    defaultValues,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((values) => onNext(values))}>
        {METRIC_FIELDS.map((metric) => (
          <div key={metric.key}>
            <FormField name={metric.key} label={metric.label}>
              {(field) => (
                <Input
                  id={field.id}
                  type="text"
                  inputMode="numeric"
                  value={field.value}
                  onChange={(value) => field.onChange(value.replace(/[^\d]/g, ""))}
                  onBlur={field.onBlur}
                  error={field.error}
                  aria-invalid={field["aria-invalid"]}
                />
              )}
            </FormField>
            {metric.key === "reach" && (
              <p className={styles.reachHint}>
                {t("application.insightForm.reachHint")}
              </p>
            )}
          </div>
        ))}

        <InsightAttachmentSection
          applicationId={applicationId}
          subType={subType}
          attachments={attachments}
          onChange={onAttachmentsChange}
          disabled={submitting}
        />

        <div className={styles.stepNav}>
          {!isFirstStep && (
            <PrimaryButton
              type="button"
              variant="ghost"
              onClick={() => onBack(methods.getValues())}
              disabled={submitting}
            >
              {t("application.insightForm.prevStep")}
            </PrimaryButton>
          )}
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting
              ? t("application.insightForm.submitting")
              : isLastStep
                ? t("application.insightForm.submit")
                : t("application.insightForm.nextStep")}
          </PrimaryButton>
        </div>
      </form>
    </FormProvider>
  );
}
