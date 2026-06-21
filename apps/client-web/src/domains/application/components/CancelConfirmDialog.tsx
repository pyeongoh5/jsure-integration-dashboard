import { PrimaryButton } from "@/components/composites/PrimaryButton";
import styles from "./ReceiptConfirmDialog.module.css";

interface Props {
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancelConfirmDialog({ submitting, onConfirm, onCancel }: Props) {
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ccd-title"
    >
      <div className={styles.panel}>
        <h2 id="ccd-title" className={styles.title}>
          【ご注意】 応募の取り消し確認
        </h2>
        <p className={styles.body}>
          一度取り消しを行うと、元の状態に戻すことはできません。
          また、本キャンペーンへの再応募も不可となります。
          本当に取り消しますか？
        </p>
        <div className={styles.actions}>
          <PrimaryButton onClick={onConfirm} disabled={submitting}>
            {submitting ? "処理中…" : "はい"}
          </PrimaryButton>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={submitting}
          >
            いいえ
          </button>
        </div>
      </div>
    </div>
  );
}
