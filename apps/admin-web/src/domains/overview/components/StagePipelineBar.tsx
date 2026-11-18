import { CAMPAIGN_STAGE_ORDER, type CampaignStage } from "@jsure/shared";
import { CAMPAIGN_STAGE_LABEL_KEY } from "@/components/composites";
import { useT } from "@/lib/i18n";
import styles from "./OverviewBoard.module.css";

type Props = {
  counts: Record<CampaignStage, number>;
  /** null 이면 전체. 같은 단계를 다시 누르면 해제된다. */
  selected: CampaignStage | null;
  onSelect: (stage: CampaignStage | null) => void;
};

export function StagePipelineBar({ counts, selected, onSelect }: Props) {
  const t = useT();

  return (
    <div className={styles.pipeline}>
      {CAMPAIGN_STAGE_ORDER.map((stage, index) => (
        <button
          key={stage}
          type="button"
          className={`${styles.stageCard} ${selected === stage ? styles.stageCardActive : ""}`}
          aria-pressed={selected === stage}
          onClick={() => onSelect(selected === stage ? null : stage)}
        >
          <span className={styles.stageIndex}>
            {t("pages.overview.pipeline.stepIndex", { index: index + 1 })}
          </span>
          <span>{t(CAMPAIGN_STAGE_LABEL_KEY[stage])}</span>
          <span className={styles.stageCount}>
            {t("common.itemCount", { count: counts[stage] })}
          </span>
        </button>
      ))}
    </div>
  );
}
