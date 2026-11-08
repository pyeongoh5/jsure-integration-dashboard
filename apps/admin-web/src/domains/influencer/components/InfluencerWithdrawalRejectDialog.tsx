import { useState } from "react";
import { WITHDRAWAL_REJECT_REASON_MAX } from "@jsure/shared";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
import { rejectInfluencerWithdrawal } from "../api";
import styles from "./InfluencerWithdrawalRejectDialog.module.css";

type Props = {
  influencerId: string;
  influencerName: string;
  /** 반려 성공 후 — 목록 갱신용. */
  onDone: () => void;
  onCancel: () => void;
};

/**
 * 탈퇴 신청 반려. 승인 다이얼로그와 분리해 둔 이유는 입력 상태(반려 사유)를
 * 자기 안에서만 들고 있기 위해서다 — 부모가 들고 있으면 re-render 마다
 * textarea 의 focus·IME 합성이 깨진다.
 */
export function InfluencerWithdrawalRejectDialog({
  influencerId,
  influencerName,
  onDone,
  onCancel,
}: Props) {
  const t = useT();
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    const trimmed = rejectReason.trim();
    if (busy || trimmed === "") return;
    setBusy(true);
    setError(null);
    try {
      await rejectInfluencerWithdrawal(influencerId, trimmed);
      onDone();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("domains.influencer.withdrawal.rejectFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open
      title={`${influencerName} — ${t("domains.influencer.withdrawal.rejectTitle")}`}
      subtitle={
        <>
          <span className={styles.line}>
            {t("domains.influencer.withdrawal.rejectDescription")}
          </span>
          <textarea
            className={styles.input}
            value={rejectReason}
            maxLength={WITHDRAWAL_REJECT_REASON_MAX}
            placeholder={t("domains.influencer.withdrawal.rejectPlaceholder")}
            onChange={(event) => setRejectReason(event.target.value)}
          />
          {error && <span className={`${styles.line} ${styles.warn}`}>{error}</span>}
        </>
      }
      confirmLabel={t("domains.influencer.withdrawal.rejectConfirm")}
      busy={busy}
      confirmDisabled={rejectReason.trim() === ""}
      onConfirm={handleConfirm}
      onCancel={() => {
        if (!busy) onCancel();
      }}
    />
  );
}
