import { useEffect, useState } from "react";
import type { Attachment } from "@jsure/shared";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
import { fetchApplicationAttachments } from "@/domains/application/draftsApi";
import type { DraftReview } from "./types";
import styles from "@/pages/Drafts/Drafts.module.css";

type Props = {
  draft: DraftReview;
  mutating: boolean;
  error: string | null;
  /** 가구매는 확정 환급액(엔), 그 외 카테고리는 undefined. */
  onConfirm: (productRefundJpy?: number) => void;
  onCancel: () => void;
};

/** 입력란 초기값 — 인플루언서 제출값이 있으면 그것을, 없으면 빈 칸(운영자가 직접 입력). */
function initialRefundInput(draft: DraftReview): string {
  if (draft.actualPaymentJpy === null) return "";
  return String(draft.actualPaymentJpy);
}

export function DraftApproveDialog({
  draft,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const isFakePurchase = draft.category === "FAKE_PURCHASE";
  const [refundInput, setRefundInput] = useState(() =>
    isFakePurchase ? initialRefundInput(draft) : "",
  );
  const [receipts, setReceipts] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!isFakePurchase) return;
    let cancelled = false;
    fetchApplicationAttachments(draft.id)
      .then((items) => {
        if (cancelled) return;
        setReceipts(items.filter((item) => item.kind === "ORDER_RECEIPT"));
      })
      // 영수증 썸네일은 보조 정보 — 로드 실패로 승인 자체를 막지 않는다.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [draft.id, isFakePurchase]);

  const parsedRefund = /^[0-9]+$/.test(refundInput.trim())
    ? Number(refundInput.trim())
    : null;
  const refundChanged =
    draft.actualPaymentJpy !== null &&
    parsedRefund !== null &&
    parsedRefund !== draft.actualPaymentJpy;
  const blocked = isFakePurchase && parsedRefund === null;

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
            .flatMap((post) => post.urls)
            .map((url) => (
              <div key={url} className={styles.dialogHint}>
                {url}
              </div>
            ))}

          {isFakePurchase && (
            <>
              {receipts.length > 0 && (
                <div className={styles.grid}>
                  {receipts.map((receipt) => (
                    <a
                      key={receipt.id}
                      className={styles.tile}
                      href={receipt.viewUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {receipt.viewUrl && <img src={receipt.viewUrl} alt="" />}
                    </a>
                  ))}
                </div>
              )}
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
                {draft.actualPaymentJpy === null
                  ? t("domains.application.drafts.approveDialog.refundMissing")
                  : `${t("domains.application.drafts.approveDialog.refundSubmitted")} ¥${draft.actualPaymentJpy.toLocaleString()}`}
              </div>
              {refundChanged && (
                <div className={styles.refundDiff}>
                  {t("domains.application.drafts.approveDialog.refundChanged")}
                </div>
              )}
            </>
          )}

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
      confirmDisabled={blocked}
      onConfirm={() => onConfirm(parsedRefund ?? undefined)}
      onCancel={onCancel}
    />
  );
}
