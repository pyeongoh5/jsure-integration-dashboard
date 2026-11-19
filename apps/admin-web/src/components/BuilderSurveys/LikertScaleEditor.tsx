import { useId, type ReactNode } from "react";
import { LIKERT_PRESETS, type LikertPreset, type SurveyQuestion } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { Radio } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { QuestionOptionsEditor } from "./QuestionOptionsEditor";
import styles from "./LikertScaleEditor.module.css";

/** 스키마에 손으로 다시 정의하지 않고, LIKERT 문항의 scale 모양을 그대로 끌어온다. */
type LikertScale = Extract<SurveyQuestion, { type: "LIKERT" }>["scale"];

type FullLabelPreset = Exclude<LikertPreset, "NUMERIC">;

const PRESET_CHOICES: readonly (LikertPreset | "CUSTOM")[] = [...LIKERT_PRESETS, "CUSTOM"];

const PRESET_LABEL_KEYS: Record<LikertPreset | "CUSTOM", AdminTranslationKey> = {
  AGREEMENT: "pages.builderSurveys.editor.likert.presetAgreement",
  SATISFACTION: "pages.builderSurveys.editor.likert.presetSatisfaction",
  FREQUENCY: "pages.builderSurveys.editor.likert.presetFrequency",
  NUMERIC: "pages.builderSurveys.editor.likert.presetNumeric",
  CUSTOM: "pages.builderSurveys.editor.likert.presetCustom",
};

const PRESET_STEP_KEYS: Record<FullLabelPreset, readonly AdminTranslationKey[]> = {
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

const NUMERIC_POINT_KEY: AdminTranslationKey = "builderSurveys.likert.NUMERIC.point";
const NUMERIC_STEPS = [1, 2, 3, 4, 5] as const;

const CUSTOM_LABELS_MAX = 10;

type Props = {
  value: LikertScale;
  onChange: (next: LikertScale) => void;
  disabled?: boolean;
};

/** 리커트 척도 편집 — 프리셋 5종 선택 + CUSTOM 라벨 입력. 순수 value/onChange. */
export function LikertScaleEditor({ value, onChange, disabled = false }: Props) {
  const t = useT();
  const groupName = useId();

  function selectPreset(preset: LikertPreset | "CUSTOM") {
    if (preset === "CUSTOM") {
      onChange({ preset: "CUSTOM", labels: ["", ""] });
      return;
    }
    onChange({ preset });
  }

  function renderBody(): ReactNode {
    switch (value.preset) {
      case "AGREEMENT":
      case "SATISFACTION":
      case "FREQUENCY":
        return (
          <ol className={styles.preview}>
            {PRESET_STEP_KEYS[value.preset].map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        );
      case "NUMERIC":
        return (
          <div className={styles.numericPreview}>
            {NUMERIC_STEPS.map((step) => (
              <span key={step}>{t(NUMERIC_POINT_KEY, { step })}</span>
            ))}
          </div>
        );
      case "CUSTOM":
        return (
          <QuestionOptionsEditor
            value={value.labels}
            onChange={(labels) => onChange({ preset: "CUSTOM", labels })}
            disabled={disabled}
            maxCount={CUSTOM_LABELS_MAX}
            addButtonLabel={t("pages.builderSurveys.editor.likert.customAddButton")}
            itemPlaceholder={(index) =>
              t("pages.builderSurveys.editor.likert.customItemPlaceholder", { index: index + 1 })
            }
            removeButtonAria={(index) =>
              t("pages.builderSurveys.editor.likert.customRemoveAria", { index: index + 1 })
            }
          />
        );
    }
  }

  return (
    <div className={styles.root}>
      <span className={styles.label}>{t("pages.builderSurveys.editor.likert.presetLabel")}</span>
      <div className={styles.presetGroup}>
        {PRESET_CHOICES.map((preset) => (
          <Radio
            key={preset}
            name={groupName}
            checked={value.preset === preset}
            onChange={() => selectPreset(preset)}
            disabled={disabled}
            label={t(PRESET_LABEL_KEYS[preset])}
          />
        ))}
      </div>
      {renderBody()}
    </div>
  );
}
