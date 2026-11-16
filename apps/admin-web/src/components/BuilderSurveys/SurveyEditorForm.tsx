import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  CreateBuilderSurveyRequestSchema,
  type CreateBuilderSurveyRequest,
  type SurveyQuestion,
} from "@jsure/shared";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { duplicateQuestion, newQuestion } from "./questionDefaults";
import { QuestionCard } from "./QuestionCard";
import styles from "./SurveyEditorForm.module.css";

type Props = {
  initialValue: CreateBuilderSurveyRequest;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (value: CreateBuilderSurveyRequest) => void;
  onCancel: () => void;
};

/** 드래그 종료 위치로 문항 순서를 바꾼다. 떨어뜨린 자리가 없거나 제자리면 그대로 둔다. */
function reorderQuestions(questions: SurveyQuestion[], event: DragEndEvent): SurveyQuestion[] {
  const { active, over } = event;
  if (!over || active.id === over.id) return questions;
  const oldIndex = questions.findIndex((question) => question.id === active.id);
  const newIndex = questions.findIndex((question) => question.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return questions;
  return arrayMove(questions, oldIndex, newIndex);
}

/** 설문 제목·설명 + 문항 카드 스택(드래그 정렬) + 저장/취소. 조립은 상위 페이지가 한다. */
export function SurveyEditorForm({
  initialValue,
  submitLabel,
  busy = false,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const t = useT();
  const methods = useForm<CreateBuilderSurveyRequest>({
    resolver: zodResolver(CreateBuilderSurveyRequestSchema),
    defaultValues: initialValue,
  });
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const submitting = methods.formState.isSubmitting || busy;
  const titleError = methods.formState.errors.title?.message;

  function submit(value: CreateBuilderSurveyRequest) {
    setValidationError(null);
    onSubmit(value);
  }

  function onInvalid() {
    if (methods.getValues("questions").length === 0) {
      setValidationError(t("pages.builderSurveys.editor.questionsRequiredError"));
      return;
    }
    setValidationError(t("pages.builderSurveys.editor.validationError"));
  }

  return (
    <form className={styles.root} onSubmit={methods.handleSubmit(submit, onInvalid)} noValidate>
      {(error ?? validationError) && (
        <div className={styles.banner}>{error ?? validationError}</div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="survey-title">
          {t("pages.builderSurveys.editor.titleLabel")}
        </label>
        <input
          id="survey-title"
          className={styles.input}
          placeholder={t("pages.builderSurveys.editor.titlePlaceholder")}
          disabled={submitting}
          {...methods.register("title")}
        />
        {titleError && <div className={styles.error}>{titleError}</div>}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="survey-description">
          {t("pages.builderSurveys.editor.descriptionLabel")}
        </label>
        <textarea
          id="survey-description"
          className={styles.textarea}
          rows={3}
          placeholder={t("pages.builderSurveys.editor.descriptionPlaceholder")}
          disabled={submitting}
          {...methods.register("description")}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t("pages.builderSurveys.editor.questionsLabel")}</span>
        <Controller
          control={methods.control}
          name="questions"
          render={({ field }) => (
            <>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => field.onChange(reorderQuestions(field.value, event))}
              >
                <SortableContext
                  items={field.value.map((question) => question.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className={styles.questionList}>
                    {field.value.map((question) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        disabled={submitting}
                        onChange={(next) =>
                          field.onChange(
                            field.value.map((item) => (item.id === next.id ? next : item)),
                          )
                        }
                        onDuplicate={() => {
                          const index = field.value.findIndex(
                            (item) => item.id === question.id,
                          );
                          const next = field.value.slice();
                          next.splice(index + 1, 0, duplicateQuestion(question));
                          field.onChange(next);
                        }}
                        onDelete={() =>
                          field.onChange(field.value.filter((item) => item.id !== question.id))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <Button
                variant="secondary"
                size="md"
                onClick={() => field.onChange([...field.value, newQuestion("SINGLE")])}
                disabled={submitting}
              >
                {t("pages.builderSurveys.editor.addQuestionButton")}
              </Button>
            </>
          )}
        />
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" size="md" onClick={onCancel} disabled={submitting}>
          {t("pages.builderSurveys.editor.cancelButton")}
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={submitting} loading={submitting}>
          {submitting ? t("pages.builderSurveys.editor.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
