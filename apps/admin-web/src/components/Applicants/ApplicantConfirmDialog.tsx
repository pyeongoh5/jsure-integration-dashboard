import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import type { PendingAction } from "./useApplicantMutations";

type Props = {
  pending: PendingAction | null;
  mutating: boolean;
  error: string | null;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
};

export function ApplicantConfirmDialog({
  pending,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!pending) setReason("");
  }, [pending]);

  const isReject = pending?.type === "reject";

  return (
    <ConfirmDialog
      open={pending !== null}
      title={
        pending?.type === "approve"
          ? "응모를 승인할까요?"
          : "응모를 반려할까요?"
      }
      subtitle={
        pending ? (
          <>
            <div>
              {pending.applicant.name}
              {pending.applicant.handle
                ? `(@${pending.applicant.handle})`
                : ""}{" "}
              — {pending.applicant.campaign}
            </div>
            {isReject && (
              <textarea
                className="apl-reject-reason"
                placeholder="반려 사유를 입력하세요"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={mutating}
                autoFocus
              />
            )}
            {error && <div className="apl-mutation-error">{error}</div>}
          </>
        ) : undefined
      }
      confirmLabel={
        mutating ? "처리 중…" : pending?.type === "approve" ? "승인" : "반려"
      }
      cancelLabel="취소"
      tone={pending?.type === "approve" ? "primary" : "danger"}
      busy={mutating}
      onConfirm={() => onConfirm(isReject ? reason : undefined)}
      onCancel={onCancel}
    />
  );
}
