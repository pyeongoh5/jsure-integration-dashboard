import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import type { Applicant } from "./types";

type Props = {
  applicant: Applicant;
  mutating: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ApplicantApproveDialog({
  applicant,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ConfirmDialog
      open
      title="응모를 승인할까요?"
      subtitle={
        <>
          <div>
            {applicant.name}
            {applicant.handle ? `(@${applicant.handle})` : ""} —{" "}
            {applicant.campaign}
          </div>
          {error && <div className="apl-mutation-error">{error}</div>}
        </>
      }
      confirmLabel={mutating ? "처리 중…" : "승인"}
      cancelLabel="취소"
      tone="primary"
      busy={mutating}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
