import { useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const [comment, setComment] = useState("");

  return (
    <ConfirmDialog
      open
      title={t("domains.application.drafts.rejectDialog.title")}
      subtitle={
        <>
          <div>
            {draft.influencerName}
            {draft.influencerHandle ? `(@${draft.influencerHandle})` : ""} —{" "}
            {draft.campaignTitle}
          </div>
          <textarea
            className={styles.rejectComment}
            placeholder={t("domains.application.drafts.rejectDialog.reasonPlaceholder")}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
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
      onConfirm={() => onConfirm(comment)}
      onCancel={onCancel}
    />
  );
}
