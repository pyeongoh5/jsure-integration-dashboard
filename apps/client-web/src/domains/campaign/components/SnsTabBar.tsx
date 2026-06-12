import { SnsTypeSchema, type SnsType } from "@jsure/shared";
import styles from "./SnsTabBar.module.css";

const SNS_TYPES = SnsTypeSchema.options;
const LABEL: Record<SnsType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
};

interface Props {
  value: SnsType;
  onChange: (s: SnsType) => void;
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
