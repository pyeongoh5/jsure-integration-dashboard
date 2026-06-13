import { useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import type { DraftReview } from "./types";
import styles from "@/pages/Drafts/Drafts.module.css";

type Props = {
  draft: DraftReview;
  mutating: boolean;
  error: string | null;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
};

export function DraftRejectDialog({
  draft,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const [comment, setComment] = useState("");

  return (
    <ConfirmDialog
      open
      title="초안을 반려할까요?"
      subtitle={
        <>
          <div>
            {draft.influencerName}
            {draft.influencerHandle ? `(@${draft.influencerHandle})` : ""} —{" "}
            {draft.campaignTitle}
          </div>
          <textarea
            className={styles.rejectComment}
            placeholder="반려 사유를 입력하세요 (재제출시 인플루언서에게 전달됩니다)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={mutating}
            autoFocus
          />
          {error && <div className={styles.mutationError}>{error}</div>}
        </>
      }
      confirmLabel={mutating ? "처리 중…" : "반려"}
      cancelLabel="취소"
      tone="danger"
      busy={mutating}
      onConfirm={() => onConfirm(comment)}
      onCancel={onCancel}
    />
  );
}
