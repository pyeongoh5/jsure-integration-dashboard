import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import type { DraftReview } from "./types";

type Props = {
  draft: DraftReview;
  mutating: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DraftApproveDialog({
  draft,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ConfirmDialog
      open
      title="초안을 승인할까요?"
      subtitle={
        <>
          <div>
            {draft.influencerName}
            {draft.influencerHandle ? `(@${draft.influencerHandle})` : ""} —{" "}
            {draft.campaignTitle}
          </div>
          <div className="dr-dialog-hint">{draft.url}</div>
          {error && <div className="dr-mutation-error">{error}</div>}
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
