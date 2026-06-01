import { ConfirmDialog } from "@/ui/ConfirmDialog";
import type { DraftReview } from "./types";

type Props = {
  draft: DraftReview;
  mutating: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DraftSettleDialog({
  draft,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ConfirmDialog
      open
      title="정산하기"
      subtitle={
        <>
          <div>
            {draft.influencerName}
            {draft.influencerHandle ? `(@${draft.influencerHandle})` : ""} —{" "}
            {draft.campaignTitle}
          </div>
          <div className="dr-settle-notice">
            실제 정산이 완료된 후에 확인 버튼을 눌러주세요.
          </div>
          {error && <div className="dr-mutation-error">{error}</div>}
        </>
      }
      confirmLabel={mutating ? "처리 중…" : "확인"}
      cancelLabel="취소"
      tone="primary"
      busy={mutating}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
