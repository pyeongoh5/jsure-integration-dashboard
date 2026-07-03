import { ENABLED_SNS_TYPES, type SnsAccountSubType } from "@jsure/shared";
import styles from "./SnsTabBar.module.css";

const SNS_TYPES = ENABLED_SNS_TYPES;
const LABEL: Record<SnsAccountSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
};

interface Props {
  value: SnsAccountSubType;
  onChange: (s: SnsAccountSubType) => void;
}

export function SnsTabBar({ value, onChange }: Props) {
  return (
    <div className={styles.bar}>
      {SNS_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          className={`${styles.pill} ${value === t ? styles.pillOn : ""}`}
          onClick={() => onChange(t)}
        >
          {LABEL[t]}
        </button>
      ))}
    </div>
  );
}
