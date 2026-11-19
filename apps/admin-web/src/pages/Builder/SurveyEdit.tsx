import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CreateBuilderSurveyRequest } from "@jsure/shared";
import { createSurvey, fetchSurvey, updateSurvey } from "@/domains/builderSurvey";
import { SurveyEditorForm } from "@/components/BuilderSurveys/SurveyEditorForm";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { newQuestion } from "@/components/BuilderSurveys/questionDefaults";
import { extractApiErrorMessage } from "@/lib/api";
import { useT } from "@/lib/i18n";
import styles from "./Builder.module.css";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
};

function createEmptySurvey(): CreateBuilderSurveyRequest {
  return {
    title: "",
    description: undefined,
    questions: [newQuestion("SINGLE")],
  };
}

export function SurveyEdit({ mode }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const surveyId = params.id;

  const [initial, setInitial] = useState<CreateBuilderSurveyRequest | null>(
    () => (mode === "create" ? createEmptySurvey() : null),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  // 이미 답한 사람이 있으면 문항 수정 전에 알린다. 생성 모드는 항상 0.
  const [responseCount, setResponseCount] = useState(0);

  useEffect(() => {
    if (mode !== "edit" || !surveyId) return;
    let cancelled = false;
    (async () => {
      try {
        const survey = await fetchSurvey(surveyId);
        if (cancelled) return;
        setInitial({
          title: survey.title,
          description: survey.description ?? undefined,
          questions: survey.questions,
        });
        setResponseCount(survey.responseCount);
      } catch (caught) {
        if (cancelled) return;
        setLoadError(
          extractApiErrorMessage(caught, t("pages.builderSurveys.editor.loadFailed")),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, surveyId, t]);

  async function handleSubmit(value: CreateBuilderSurveyRequest) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createSurvey(value);
      } else if (surveyId) {
        await updateSurvey(surveyId, value);
      }
      navigate("/builder/surveys");
    } catch (caught) {
      setSubmitError(
        extractApiErrorMessage(caught, t("pages.builderSurveys.editor.saveFailed")),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const pageTitle =
    mode === "create"
      ? t("pages.builderSurveys.editor.createTitle")
      : t("pages.builderSurveys.editor.editTitle");

  if (loadError) {
    return (
      <div className={styles.edit}>
        <div className={styles.editTitle}>{pageTitle}</div>
        <div>{loadError}</div>
      </div>
    );
  }

  if (!initial) {
    return (
      <div className={styles.edit}>
        <div className={styles.editTitle}>{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className={styles.edit}>
      <div className={styles.editTitle}>{pageTitle}</div>
      {responseCount > 0 && (
        <p className={styles.usageWarning}>
          {t("pages.builderSurveys.editor.responsesExistWarning", {
            count: responseCount,
          })}
        </p>
      )}
      <SurveyEditorForm
        initialValue={initial}
        busy={submitting}
        error={submitError}
        submitLabel={
          mode === "create"
            ? t("pages.builderSurveys.editor.submitCreate")
            : t("pages.builderSurveys.editor.submitSave")
        }
        onSubmit={handleSubmit}
        onCancel={() => setLeaveConfirmOpen(true)}
      />
      <ConfirmDialog
        open={leaveConfirmOpen}
        title={t("pages.builderSurveys.editor.leaveDialog.title")}
        subtitle={t("pages.builderSurveys.editor.leaveDialog.subtitle")}
        confirmLabel={t("pages.builderSurveys.editor.leaveDialog.confirm")}
        onConfirm={() => navigate("/builder/surveys")}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </div>
  );
}
