import type { ApplicationDisplayStage } from "@jsure/shared";
import { STAGE_LABEL, STAGE_VARIANT } from "../utils";
import styles from "./StageBadge.module.css";

function variantClass(variant: string) {
  switch (variant) {
    case "neutral":
      return styles.neutral;
    case "info":
      return styles.info;
    case "warn":
      return styles.warn;
    case "ok":
      return styles.ok;
    case "danger":
      return styles.danger;
    default:
      return "";
  }
}

export function StageBadge({ stage }: { stage: ApplicationDisplayStage }) {
  return (
    <span className={`${styles.badge} ${variantClass(STAGE_VARIANT[stage])}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}
