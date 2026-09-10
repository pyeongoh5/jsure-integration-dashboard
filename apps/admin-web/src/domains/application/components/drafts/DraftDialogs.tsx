import { DraftApproveDialog } from "./DraftApproveDialog";
import { DraftRejectDialog } from "./DraftRejectDialog";
import { DraftUndoDialog } from "./DraftUndoDialog";
import { ForceCancelDialog } from "../ForceCancelDialog";
import { useT } from "@/lib/i18n";
import { DRAFT_STATUS_LABEL } from "./types";
import type { PendingDraftAction } from "./useDraftMutations";

type Props = {
  pending: PendingDraftAction | null;
  mutating: boolean;
  error: string | null;
  onConfirm: (input?: string) => void;
  onCancel: () => void;
};

export function DraftDialogs({
  pending,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  if (!pending) return null;
  const common = { draft: pending.draft, mutating, error, onCancel };

  switch (pending.type) {
    case "approve":
      return <DraftApproveDialog {...common} onConfirm={() => onConfirm()} />;
    case "reject":
      return (
        <DraftRejectDialog
          {...common}
          onConfirm={(comment) => onConfirm(comment)}
        />
      );
    case "undo":
      return <DraftUndoDialog {...common} onConfirm={() => onConfirm()} />;
    case "forceCancel":
      return (
        <ForceCancelDialog
          influencerName={pending.draft.influencerName}
          handle={pending.draft.influencerHandle}
          campaignTitle={pending.draft.campaignTitle}
          statusLabel={t(DRAFT_STATUS_LABEL[pending.draft.status])}
          mutating={mutating}
          error={error}
          onConfirm={(reason) => onConfirm(reason)}
          onCancel={onCancel}
        />
      );
  }
}
