import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
import styles from "@/pages/Applicants/Applicants.module.css";
import type { Applicant } from "./types";

type Props = {
  applicant: Applicant;
  mutating: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ApplicantDeliverDialog({ applicant, mutating, error, onConfirm, onCancel }: Props) {
  const t = useT();

  return (
    <ConfirmDialog
      open
      title={t("domains.application.applicants.deliverDialog.title")}
      subtitle={
        <>
          {applicant.trackingNumber && (
            <div className={styles.dialogHint}>
              {t("domains.application.applicants.deliverDialog.trackingInfo", {
                tracking: applicant.trackingCarrier
                  ? `${applicant.trackingCarrier} · ${applicant.trackingNumber}`
                  : applicant.trackingNumber,
              })}
            </div>
          )}
          {error && <div className={styles.mutationError}>{error}</div>}
        </>
      }
      confirmLabel={
        mutating
          ? t("components.confirmDialog.processing")
          : t("domains.application.applicants.actions.deliver")
      }
      cancelLabel={t("common.cancel")}
      tone="primary"
      busy={mutating}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
