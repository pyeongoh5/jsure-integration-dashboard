import type { ApplicationDisplayStage } from "@jsure/shared";
import { STAGE_PROGRESS, STAGE_TOTAL } from "../utils";
import styles from "./ApplicationStepper.module.css";

const STEPS = ["応募", "承認", "発送", "受取", "投稿", "検査", "完了"];

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
          {stage === "REJECTED" ? "未選定" : "キャンセル"}
        </div>
      )}
      <input type="hidden" value={STAGE_TOTAL} />
    </div>
  );
}
