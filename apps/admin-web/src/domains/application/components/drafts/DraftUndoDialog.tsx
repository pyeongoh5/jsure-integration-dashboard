import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import type { DraftReview } from "./types";
import styles from "@/pages/Drafts/Drafts.module.css";

type Props = {
  draft: DraftReview;
  mutating: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DraftUndoDialog({
  draft,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ConfirmDialog
      open
      title="검토를 되돌릴까요?"
      subtitle={
        <>
          <div>
            {draft.influencerName}
            {draft.influencerHandle ? `(@${draft.influencerHandle})` : ""} —{" "}
            {draft.campaignTitle}
          </div>
          <div className={styles.dialogHint}>검토 대기 상태로 되돌립니다.</div>
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
