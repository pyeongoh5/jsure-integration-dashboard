import { useState } from "react";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
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
  const [reason, setReason] = useState("");

  return (
    <ConfirmDialog
      open
      title="응모를 반려할까요?"
      subtitle={
        <>
          <div>
            {applicant.name}
            {applicant.handle ? `(@${applicant.handle})` : ""} —{" "}
            {applicant.campaign}
          </div>
          <textarea
            className="apl-reject-reason"
            placeholder="반려 사유를 입력하세요"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={mutating}
            autoFocus
          />
          {error && <div className="apl-mutation-error">{error}</div>}
        </>
      }
      confirmLabel={mutating ? "처리 중…" : "반려"}
      cancelLabel="취소"
      tone="danger"
      busy={mutating}
      onConfirm={() => onConfirm(reason)}
      onCancel={onCancel}
    />
  );
}
