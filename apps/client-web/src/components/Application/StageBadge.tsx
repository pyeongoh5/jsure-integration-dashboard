import type { ApplicationDisplayStage } from "@jsure/shared";
import { STAGE_LABEL, STAGE_VARIANT } from "../../lib/stage";
import "./StageBadge.css";

export function StageBadge({ stage }: { stage: ApplicationDisplayStage }) {
  return (
    <span className={`stage-badge stage-badge--${STAGE_VARIANT[stage]}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}
