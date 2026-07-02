import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@/i18n";
import styles from "./ReceiptConfirmDialog.module.css";

interface Props {
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancelConfirmDialog({ submitting, onConfirm, onCancel }: Props) {
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ccd-title"
    >
      <div className={styles.panel}>
        <h2 id="ccd-title" className={styles.title}>
          {t("application.cancelConfirm.title")}
        </h2>
        <p className={styles.body}>
          {t("application.cancelConfirm.body")}
        </p>
        <div className={styles.actions}>
          <PrimaryButton onClick={onConfirm} disabled={submitting}>
            {submitting
              ? t("application.cancelConfirm.submitting")
              : t("application.cancelConfirm.confirm")}
          </PrimaryButton>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={submitting}
          >
            {t("application.cancelConfirm.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
