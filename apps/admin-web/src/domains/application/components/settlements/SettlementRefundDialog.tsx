import { useState } from "react";
import type { AdminSettlement } from "@jsure/shared";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
import styles from "@/pages/Drafts/Drafts.module.css";

type Props = {
  settlement: AdminSettlement;
  mutating: boolean;
  error: string | null;
  onConfirm: (productRefundJpy: number) => void;
  onCancel: () => void;
};

/** 가구매 정산 건의 상품 환급액 수정. 합계는 보수 + 환급액으로 다시 계산된다. */
export function SettlementRefundDialog({
  settlement,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const [refundInput, setRefundInput] = useState(() =>
    String(settlement.productRefundJpy),
  );

  const trimmed = refundInput.trim();
  const parsedRefund = /^[0-9]+$/.test(trimmed) ? Number(trimmed) : null;

  return (
    <ConfirmDialog
      open
      title={t("pages.payouts.refundEdit.title")}
      subtitle={
        <>
          <div>
            {settlement.influencer.name} — {settlement.campaign.title}
          </div>
          <label className={styles.refundLabel}>
            {t("domains.application.drafts.approveDialog.refundLabel")}
            <input
              className={styles.refundInput}
              type="text"
              inputMode="numeric"
              value={refundInput}
              onChange={(event) => setRefundInput(event.target.value)}
              disabled={mutating}
              autoFocus
            />
          </label>
          <div className={styles.dialogHint}>
            {t("pages.payouts.refundEdit.current", {
              refund: settlement.productRefundJpy,
              reward: settlement.rewardAmountJpy,
            })}
          </div>
          {parsedRefund !== null && (
            <div className={styles.refundDiff}>
              {t("pages.payouts.refundEdit.nextTotal", {
                amount: settlement.rewardAmountJpy + parsedRefund,
              })}
            </div>
          )}
          {error && <div className={styles.mutationError}>{error}</div>}
        </>
      }
      tone="primary"
      busy={mutating}
      confirmDisabled={parsedRefund === null}
      onConfirm={() => parsedRefund !== null && onConfirm(parsedRefund)}
      onCancel={onCancel}
    />
  );
}
