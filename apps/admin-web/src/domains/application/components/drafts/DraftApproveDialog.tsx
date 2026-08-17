import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  return (
    <ConfirmDialog
      open
      title={t("domains.application.drafts.approveDialog.title")}
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
      confirmLabel={
        mutating
          ? t("components.confirmDialog.processing")
          : t("domains.application.applicants.actions.approve")
      }
      cancelLabel={t("common.cancel")}
      tone="primary"
      busy={mutating}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
