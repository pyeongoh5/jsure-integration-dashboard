import { ConfirmDialog } from "@/ui/ConfirmDialog";
import type { Applicant } from "./types";

type Props = {
  applicant: Applicant;
  mutating: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ApplicantDeliverDialog({ applicant, mutating, error, onConfirm, onCancel }: Props) {
  return (
    <ConfirmDialog
      open
      title="배송 완료로 표시할까요?"
      subtitle={
        <>
          {applicant.trackingNumber && (
            <div className="apl-dialog-hint">
              운송장 번호:{" "}
              {applicant.trackingCarrier
                ? `${applicant.trackingCarrier} · ${applicant.trackingNumber}`
                : applicant.trackingNumber}
            </div>
          )}
          {error && <div className="apl-mutation-error">{error}</div>}
        </>
      }
      confirmLabel={mutating ? "처리 중…" : "배송 완료"}
      cancelLabel="취소"
      tone="primary"
      busy={mutating}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
