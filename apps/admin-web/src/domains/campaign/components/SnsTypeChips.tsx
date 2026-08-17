import type { AdminTranslationKey } from "@i18n/admin";
import { isEnabledSnsType, type SnsAccountSubType } from "@jsure/shared";
import { useT } from "@/lib/i18n";
import styles from "./CampaignForm.module.css";

const OPTIONS: readonly { value: SnsAccountSubType; label: AdminTranslationKey }[] = [
  { value: "INSTAGRAM", label: "domains.campaign.snsName.instagram" },
  { value: "TIKTOK", label: "domains.campaign.snsName.tiktok" },
  { value: "X", label: "domains.campaign.snsName.x" },
  { value: "YOUTUBE", label: "domains.campaign.snsName.youtube" },
];

const VISIBLE_OPTIONS = OPTIONS.filter((opt) => isEnabledSnsType(opt.value));

type Props = {
  value: SnsAccountSubType[];
  onChange: (next: SnsAccountSubType[]) => void;
  disabled?: boolean;
};

export function SnsTypeChips({ value, onChange, disabled }: Props) {
  const t = useT();
  const toggle = (target: SnsAccountSubType) => {
    if (value.includes(target)) onChange(value.filter((current) => current !== target));
    else onChange([...value, target]);
  };
  return (
    <div className={styles.chips} role="group" aria-label={t("domains.campaign.snsTypeChips.groupAria")}>
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
            {t(opt.label)}
          </button>
        );
      })}
    </div>
  );
}
