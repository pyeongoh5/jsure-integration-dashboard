import type { ApplicationDisplayStage } from "@jsure/shared";
import { t } from "@i18n";
import { STAGE_PROGRESS, STAGE_TOTAL } from "../utils";
import styles from "./ApplicationStepper.module.css";

const STEPS = [
  t("application.stepper.step1"),
  t("application.stepper.step2"),
  t("application.stepper.step3"),
  t("application.stepper.step4"),
  t("application.stepper.step5"),
  t("application.stepper.step6"),
  t("application.stepper.step7"),
];

export function ApplicationStepper({
  stage,
}: {
  stage: ApplicationDisplayStage;
}) {
  const current = STAGE_PROGRESS[stage];
  const terminal = stage === "REJECTED" || stage === "CANCELLED";

  return (
    <div className={styles.stepper}>
      {STEPS.map((label, idx) => {
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
      <input type="hidden" value={STAGE_TOTAL} />
    </div>
  );
}
