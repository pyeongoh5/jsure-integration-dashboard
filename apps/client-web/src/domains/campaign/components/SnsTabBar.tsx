import {
  ENABLED_SNS_TYPES,
  FAKE_PURCHASE_SUB_TYPES,
  SUB_TYPE_LABEL,
  type CampaignSubType,
} from "@jsure/shared";
import styles from "./SnsTabBar.module.css";

const TAB_SUB_TYPES: readonly CampaignSubType[] = [
  ...ENABLED_SNS_TYPES,
  ...FAKE_PURCHASE_SUB_TYPES,
];

interface Props {
  value: CampaignSubType;
  onChange: (subType: CampaignSubType) => void;
}

export function SnsTabBar({ value, onChange }: Props) {
  return (
    <div className={styles.bar}>
      {TAB_SUB_TYPES.map((subType) => (
        <button
          key={subType}
          type="button"
          className={`${styles.pill} ${value === subType ? styles.pillOn : ""}`}
          onClick={() => onChange(subType)}
        >
          {SUB_TYPE_LABEL[subType]}
        </button>
      ))}
    </div>
  );
}
