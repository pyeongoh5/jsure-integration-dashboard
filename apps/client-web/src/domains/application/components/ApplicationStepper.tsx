import type {
  ApplicationDisplayStage,
  CampaignCategory,
} from "@jsure/shared";
import { t } from "@i18n";
import { stageProgressFor, stageTotalFor } from "../utils";
import styles from "./ApplicationStepper.module.css";

// 카테고리별 스텝 라벨 배열.
const STEPS_BY_CATEGORY: Record<CampaignCategory, readonly string[]> = {
  SNS: [
    t("application.stepper.step1"),
    t("application.stepper.step2"),
    t("application.stepper.step3"),
    t("application.stepper.step4"),
    t("application.stepper.step5"),
    t("application.stepper.step6"),
    t("application.stepper.step7"),
    t("application.stepper.step8"),
  ],
  FAKE_PURCHASE: [
    t("application.stepper.step1"),
    t("application.stepper.step2"),
    t("application.stepper.step3"),
    t("application.stepper.step4"),
    t("application.stepper.step5"),
    t("application.stepper.step6"),
    t("application.stepper.step7"),
    t("application.stepper.step8"),
  ],
  SIMPLE_REVIEW: [
    t("application.stepper.simpleReview.step1"),
    t("application.stepper.simpleReview.step2"),
    t("application.stepper.simpleReview.step3"),
    t("application.stepper.simpleReview.step4"),
    t("application.stepper.simpleReview.step5"),
    t("application.stepper.simpleReview.step6"),
    t("application.stepper.simpleReview.step7"),
    t("application.stepper.simpleReview.step8"),
  ],
};

interface Props {
  stage: ApplicationDisplayStage;
  category: CampaignCategory;
}

export function ApplicationStepper({ stage, category }: Props) {
  const current = stageProgressFor(category, stage);
  const total = stageTotalFor(category);
  const terminal = stage === "REJECTED" || stage === "CANCELLED";
  const steps = STEPS_BY_CATEGORY[category];

  return (
    <div className={styles.stepper}>
      {steps.map((label, idx) => {
        const step = idx + 1;
        const done = !terminal && step < current;
        const active = !terminal && step === current;
        return (
          <div
            key={label}
            className={`${styles.step} ${done ? styles.stepDone : ""} ${active ? styles.stepActive : ""}`}
          >
            <div className={styles.dot}>{done ? "✓" : step === current ? "●" : ""}</div>
            <div className={styles.label}>{label}</div>
          </div>
        );
      })}
      {terminal && (
        <div className={styles.terminal}>
          {stage === "REJECTED"
            ? t("application.stepper.terminalRejected")
            : t("application.stepper.terminalCancelled")}
        </div>
      )}
      <input type="hidden" value={total} />
    </div>
  );
}
