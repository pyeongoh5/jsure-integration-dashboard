import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import styles from "@/pages/Applicants/Applicants.module.css";
import type { Applicant } from "./types";

type Props = {
  applicant: Applicant;
  mutating: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ApplicantUndoDialog({
  applicant,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ConfirmDialog
      open
      title="심사를 되돌릴까요?"
      subtitle={
        <>
          <div>
            {applicant.name}
            {applicant.handle ? `(@${applicant.handle})` : ""} —{" "}
            {applicant.campaign}
          </div>
          <div className={styles.dialogHint}>
            대기 상태로 되돌립니다.
          </div>
          {error && <div className={styles.mutationError}>{error}</div>}
        </>
      }
      confirmLabel={mutating ? "처리 중…" : "되돌리기"}
      cancelLabel="취소"
      tone="danger"
      busy={mutating}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
