import { SUB_TYPE_LABEL, type CampaignSubType } from "@jsure/shared";
import styles from "./SubTypePill.module.css";

const PILL_CLASS: Partial<Record<CampaignSubType, string>> = {
  QOO10: styles.pillQoo10,
  ATCOSME: styles.pillAtcosme,
  LIPS: styles.pillLips,
};

type Props = {
  subType: CampaignSubType;
};

export function SubTypePill({ subType }: Props) {
  const label = SUB_TYPE_LABEL[subType];
  const cls = PILL_CLASS[subType] ?? "";
  return (
    <span
      className={`${styles.pill} ${cls}`}
      title={label}
      aria-label={label}
    >
      {label}
    </span>
  );
}
