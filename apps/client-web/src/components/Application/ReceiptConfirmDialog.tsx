import { PrimaryButton } from "../composites/PrimaryButton";
import "./ReceiptConfirmDialog.css";

interface Props {
  postingPeriodDays: number;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReceiptConfirmDialog({
  postingPeriodDays,
  submitting,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="rcd__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rcd-title"
    >
      <div className="rcd__panel">
        <h2 id="rcd-title" className="rcd__title">
          受領を確認しますか？
        </h2>
        <p className="rcd__body">
          受領を確認すると、ここから投稿期間（{postingPeriodDays}日）が始まります。
        </p>
        <p className="rcd__warn">この操作は取り消せません。</p>
        <div className="rcd__actions">
          <button
            type="button"
            className="rcd__cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            キャンセル
          </button>
          <PrimaryButton onClick={onConfirm} disabled={submitting}>
            {submitting ? "送信中…" : "受領を確認する"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
