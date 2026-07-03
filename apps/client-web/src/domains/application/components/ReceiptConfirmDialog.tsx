import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";
import styles from "./ReceiptConfirmDialog.module.css";

interface Props {
  postingPeriodDays: number;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReceiptConfirmDialog({
  postingPeriodDays,
  submitting,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rcd-title"
    >
      <div className={styles.panel}>
        <h2 id="rcd-title" className={styles.title}>
          {t("application.receiptConfirm.title")}
        </h2>
        <p className={styles.body}>
          {t("application.receiptConfirm.bodyPrefix")}
          {postingPeriodDays}
          {t("application.receiptConfirm.bodySuffix")}
        </p>
        <p className={styles.warn}>{t("application.receiptConfirm.warn")}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={submitting}
          >
            {t("application.receiptConfirm.cancel")}
          </button>
          <PrimaryButton onClick={onConfirm} disabled={submitting}>
            {submitting
              ? t("application.receiptConfirm.submitting")
              : t("application.receiptConfirm.confirm")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
