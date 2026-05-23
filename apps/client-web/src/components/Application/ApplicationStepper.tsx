import type { ApplicationDisplayStage } from "@jsure/shared";
import { STAGE_PROGRESS, STAGE_TOTAL } from "../../lib/stage";
import "./ApplicationStepper.css";

const STEPS = ["申請", "承認", "発送", "受取", "投稿", "検査", "完了"];

export function ApplicationStepper({
  stage,
}: {
  stage: ApplicationDisplayStage;
}) {
  const current = STAGE_PROGRESS[stage];
  const terminal = stage === "REJECTED" || stage === "CANCELLED";

  return (
    <div className="stepper">
      {STEPS.map((label, idx) => {
        const step = idx + 1;
        const done = !terminal && step < current;
        const active = !terminal && step === current;
        return (
          <div
            key={label}
            className={`stepper__step ${done ? "stepper__step--done" : ""} ${active ? "stepper__step--active" : ""}`}
          >
            <div className="stepper__dot">{done ? "✓" : step === current ? "●" : ""}</div>
            <div className="stepper__label">{label}</div>
          </div>
        );
      })}
      {terminal && (
        <div className="stepper__terminal">
          {stage === "REJECTED" ? "却下" : "キャンセル"}
        </div>
      )}
      <input type="hidden" value={STAGE_TOTAL} />
    </div>
  );
}
