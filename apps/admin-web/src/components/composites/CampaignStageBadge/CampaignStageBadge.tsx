import type { CampaignStage } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { useT } from "@/lib/i18n";
import styles from "./CampaignStageBadge.module.css";

/** 파이프라인 카운터·통합 테이블이 같은 라벨을 쓰도록 매핑은 여기 한 곳에만 둔다. */
export const CAMPAIGN_STAGE_LABEL_KEY: Record<
  CampaignStage,
  AdminTranslationKey
> = {
  OPEN_PENDING: "domains.overview.stage.openPending",
  IN_PROGRESS: "domains.overview.stage.inProgress",
  INSIGHT_COLLECTING: "domains.overview.stage.insightCollecting",
  SETTLEMENT_PENDING: "domains.overview.stage.settlementPending",
};

const BADGE_CLASS: Partial<Record<CampaignStage, string>> = {
  OPEN_PENDING: styles.openPending,
  IN_PROGRESS: styles.inProgress,
  INSIGHT_COLLECTING: styles.insightCollecting,
  SETTLEMENT_PENDING: styles.settlementPending,
};

type Props = {
  stage: CampaignStage;
};

export function CampaignStageBadge({ stage }: Props) {
  const t = useT();
  return (
    <span className={`${styles.badge} ${BADGE_CLASS[stage] ?? ""}`}>
      {t(CAMPAIGN_STAGE_LABEL_KEY[stage])}
    </span>
  );
}
