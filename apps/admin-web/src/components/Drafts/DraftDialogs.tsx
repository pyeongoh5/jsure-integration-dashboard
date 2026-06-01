import { DraftApproveDialog } from "./DraftApproveDialog";
import { DraftRejectDialog } from "./DraftRejectDialog";
import { DraftSettleDialog } from "./DraftSettleDialog";
import { DraftUndoDialog } from "./DraftUndoDialog";
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
    case "settle":
      return <DraftSettleDialog {...common} onConfirm={() => onConfirm()} />;
  }
}
