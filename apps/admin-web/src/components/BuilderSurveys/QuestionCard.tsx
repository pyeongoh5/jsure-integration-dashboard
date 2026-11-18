import { useState, type CSSProperties, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SurveyQuestion, SurveyQuestionType } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { IconButton, Input, Switch, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { changeQuestionType } from "./questionDefaults";
import { QuestionOptionsEditor } from "./QuestionOptionsEditor";
import { LikertScaleEditor } from "./LikertScaleEditor";
import styles from "./QuestionCard.module.css";

const QUESTION_TYPES: readonly SurveyQuestionType[] = ["SINGLE", "MULTI", "LIKERT", "TEXT"];

const QUESTION_TYPE_LABEL_KEYS: Record<SurveyQuestionType, AdminTranslationKey> = {
  SINGLE: "pages.builderSurveys.editor.question.typeOptions.SINGLE",
  MULTI: "pages.builderSurveys.editor.question.typeOptions.MULTI",
  LIKERT: "pages.builderSurveys.editor.question.typeOptions.LIKERT",
  TEXT: "pages.builderSurveys.editor.question.typeOptions.TEXT",
};

type Props = {
  question: SurveyQuestion;
  disabled?: boolean;
  onChange: (next: SurveyQuestion) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/**
 * 문항 카드 — 제목·설명·타입·필수여부와 타입별 입력을 한 장에 모은다.
 * 입력값은 이 컴포넌트 안의 state(`draft`)가 유일한 출처다. 부모가 넘기는
 * `question` prop 은 마운트 시 초기값으로만 쓰고 이후 변화는 반영하지 않는다 —
 * 드래그 중 형제 카드가 재렌더될 때마다 이 prop 이 새로 들어와도 입력 포커스·
 * 캐럿·IME 조합이 끊기지 않게 하기 위해서다. 상위로는 `onChange` 로만 알린다.
 */
export function QuestionCard({ question, disabled = false, onChange, onDuplicate, onDelete }: Props) {
  const t = useT();
  const [draft, setDraft] = useState<SurveyQuestion>(question);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style: CSSProperties = {
    transform: transform ? CSS.Transform.toString({ ...transform, x: 0 }) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function update(next: SurveyQuestion) {
    setDraft(next);
    onChange(next);
  }

  function renderTypeFields(): ReactNode {
    switch (draft.type) {
      case "SINGLE":
      case "MULTI":
        return (
          <QuestionOptionsEditor
            value={draft.options}
            onChange={(options) => update({ ...draft, options })}
            disabled={disabled}
            addButtonLabel={t("pages.builderSurveys.editor.options.addButton")}
            itemPlaceholder={(index) =>
              t("pages.builderSurveys.editor.options.itemPlaceholder", { index: index + 1 })
            }
            removeButtonAria={(index) =>
              t("pages.builderSurveys.editor.options.removeAria", { index: index + 1 })
            }
          />
        );
      case "LIKERT":
        return (
          <LikertScaleEditor
            value={draft.scale}
            onChange={(scale) => update({ ...draft, scale })}
            disabled={disabled}
          />
        );
      case "TEXT":
        return (
          <label className={styles.inlineToggle}>
            <Switch
              checked={draft.multiline}
              onChange={(multiline) => update({ ...draft, multiline })}
              disabled={disabled}
            />
            <span>{t("pages.builderSurveys.editor.question.multilineLabel")}</span>
          </label>
        );
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.card}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={t("pages.builderSurveys.editor.question.dragHandleAria")}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <i className="fa-solid fa-grip-vertical" aria-hidden="true" />
        </button>
        <div className={styles.headerActions}>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t("pages.builderSurveys.editor.question.duplicateAria")}
            onClick={onDuplicate}
            disabled={disabled}
          >
            <i className="fa-solid fa-clone" aria-hidden="true" />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t("pages.builderSurveys.editor.question.deleteAria")}
            onClick={onDelete}
            disabled={disabled}
          >
            <i className="fa-solid fa-trash" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <div className={styles.field}>
        <Input
          value={draft.title}
          onChange={(title) => update({ ...draft, title })}
          placeholder={t("pages.builderSurveys.editor.question.titlePlaceholder")}
          disabled={disabled}
        />
      </div>

      <div className={styles.field}>
        <Textarea
          value={draft.description ?? ""}
          onChange={(description) => update({ ...draft, description })}
          placeholder={t("pages.builderSurveys.editor.question.descriptionPlaceholder")}
          rows={2}
          disabled={disabled}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>{t("pages.builderSurveys.editor.question.typeLabel")}</span>
          <select
            className={styles.select}
            value={draft.type}
            disabled={disabled}
            onChange={(event) =>
              update(changeQuestionType(draft, event.target.value as SurveyQuestionType))
            }
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(QUESTION_TYPE_LABEL_KEYS[type])}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inlineToggle}>
          <Switch
            checked={draft.required}
            onChange={(required) => update({ ...draft, required })}
            disabled={disabled}
          />
          <span>{t("pages.builderSurveys.editor.question.requiredLabel")}</span>
        </label>
      </div>

      {renderTypeFields()}
    </div>
  );
}
