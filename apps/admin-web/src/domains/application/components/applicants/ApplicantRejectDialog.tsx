import { useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
import styles from "@/pages/Applicants/Applicants.module.css";
import type { Applicant } from "./types";

type Props = {
  applicant: Applicant;
  mutating: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function ApplicantRejectDialog({
  applicant,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const [reason, setReason] = useState("");

  return (
    <ConfirmDialog
      open
      title={t("domains.application.applicants.rejectDialog.title")}
      subtitle={
        <>
          <div>
            {applicant.name}
            {applicant.handle ? `(@${applicant.handle})` : ""} —{" "}
            {applicant.campaign}
          </div>
          <textarea
            className={styles.rejectReason}
            placeholder={t("domains.application.applicants.rejectDialog.reasonPlaceholder")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={mutating}
            autoFocus
          />
          {error && <div className={styles.mutationError}>{error}</div>}
        </>
      }
      confirmLabel={
        mutating
          ? t("components.confirmDialog.processing")
          : t("domains.application.applicants.actions.reject")
      }
      cancelLabel={t("common.cancel")}
      tone="danger"
      busy={mutating}
      onConfirm={() => onConfirm(reason)}
      onCancel={onCancel}
    />
  );
}
