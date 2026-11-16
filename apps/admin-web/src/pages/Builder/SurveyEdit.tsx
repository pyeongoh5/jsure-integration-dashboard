import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CreateBuilderSurveyRequest } from "@jsure/shared";
import { createSurvey, fetchSurvey, updateSurvey } from "@/domains/builderSurvey";
import { SurveyEditorForm } from "@/components/BuilderSurveys/SurveyEditorForm";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
import styles from "./Builder.module.css";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
};

const EMPTY_SURVEY: CreateBuilderSurveyRequest = {
  title: "",
  description: undefined,
  questions: [],
};

export function SurveyEdit({ mode }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const surveyId = params.id;

  const [initial, setInitial] = useState<CreateBuilderSurveyRequest | null>(
    mode === "create" ? EMPTY_SURVEY : null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

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
      } catch (caught) {
        if (cancelled) return;
        setLoadError(
          caught instanceof Error ? caught.message : t("pages.builderSurveys.editor.loadFailed"),
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
        caught instanceof Error ? caught.message : t("pages.builderSurveys.editor.saveFailed"),
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
