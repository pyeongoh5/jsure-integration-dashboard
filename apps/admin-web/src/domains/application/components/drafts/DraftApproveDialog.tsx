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
          {draft.posts
            .filter((post) => post.url !== null)
            .map((post) => (
              <div key={post.id} className={styles.dialogHint}>
                {post.url}
              </div>
            ))}
          {error && <div className={styles.mutationError}>{error}</div>}
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
