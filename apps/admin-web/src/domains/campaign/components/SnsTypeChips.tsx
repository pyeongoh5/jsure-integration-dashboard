import { isEnabledSnsType, type SnsAccountSubType } from "@jsure/shared";
import styles from "./CampaignForm.module.css";

const OPTIONS: readonly { value: SnsAccountSubType; label: string }[] = [
  { value: "INSTAGRAM", label: "인스타그램" },
  { value: "TIKTOK", label: "틱톡" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "유튜브" },
];

const VISIBLE_OPTIONS = OPTIONS.filter((opt) => isEnabledSnsType(opt.value));

type Props = {
  value: SnsAccountSubType[];
  onChange: (next: SnsAccountSubType[]) => void;
  disabled?: boolean;
};

export function SnsTypeChips({ value, onChange, disabled }: Props) {
  const toggle = (target: SnsAccountSubType) => {
    if (value.includes(target)) onChange(value.filter((current) => current !== target));
    else onChange([...value, target]);
  };
  return (
    <div className={styles.chips} role="group" aria-label="SNS 종류">
      {VISIBLE_OPTIONS.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={`${styles.chip}${selected ? ` ${styles.chipOn}` : ""}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
