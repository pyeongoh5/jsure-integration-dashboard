import { t } from "@/i18n";
import styles from "./WizardFooter.module.css";

interface Props {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function WizardFooter({
  onBack,
  onNext,
  nextLabel = t("components.wizardFooter.next"),
  backLabel = t("components.wizardFooter.back"),
  disabled,
  loading,
}: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        {onBack && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnBack}`}
            onClick={onBack}
            disabled={loading}
          >
            {backLabel}
          </button>
        )}
        <button
          type="button"
          className={`${styles.btn} ${styles.btnNext}`}
          onClick={onNext}
          disabled={disabled || loading}
        >
          {loading ? t("components.wizardFooter.submitting") : nextLabel}
        </button>
      </div>
    </div>
  );
}
