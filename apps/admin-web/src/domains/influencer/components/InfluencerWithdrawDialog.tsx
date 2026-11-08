import { useEffect, useState } from "react";
import {
  INFLUENCER_HISTORY_TAB,
  type InfluencerActivityGroup,
  type InfluencerWithdrawal,
} from "@jsure/shared";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { fetchInfluencerActivity, withdrawInfluencer } from "../api";
import { WITHDRAWAL_REASON_LABEL_KEY } from "../withdrawalLabel";
import styles from "./InfluencerWithdrawDialog.module.css";

type CountsState =
  | { kind: "loading" }
  | { kind: "ready"; ongoingCount: number; totalCount: number }
  | { kind: "error"; message: string };

/** 탈퇴 경고 대상 — 승인 대기와 진행 중 모두 탈퇴하면 이어갈 수 없는 건이다. */
function isOngoing(group: InfluencerActivityGroup): boolean {
  const tab = INFLUENCER_HISTORY_TAB[group.displayStage];
  return tab === "APPLIED" || tab === "IN_PROGRESS";
}

type Props = {
  influencerId: string;
  influencerName: string;
  /** 본인이 낸 탈퇴 신청. 어드민이 직접 탈퇴시키는 경우에는 null. */
  withdrawal: InfluencerWithdrawal | null;
  /** 탈퇴 성공 후 — 목록 갱신용. */
  onDone: () => void;
  /** 대기 중인 신청을 반려하러 넘어갈 때. 신청이 없으면 호출되지 않는다. */
  onReject: () => void;
  onCancel: () => void;
};

/**
 * 탈퇴 확인 다이얼로그 — 진행 중/누적 캠페인 참여 현황을 보여주고
 * 되돌릴 수 없음을 경고한 뒤에만 실행한다. 참여 현황을 불러오기 전에는
 * 확인 버튼을 막는다.
 */
export function InfluencerWithdrawDialog({
  influencerId,
  influencerName,
  withdrawal,
  onDone,
  onReject,
  onCancel,
}: Props) {
  const t = useT();
  const [counts, setCounts] = useState<CountsState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCounts({ kind: "loading" });
    fetchInfluencerActivity(influencerId)
      .then((groups) => {
        if (cancelled) return;
        setCounts({
          kind: "ready",
          ongoingCount: groups.filter(isOngoing).length,
          totalCount: groups.length,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setCounts({
          kind: "error",
          message:
            cause instanceof Error
              ? cause.message
              : t("domains.influencer.withdrawDialog.loadFailed"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  async function handleConfirm() {
    if (busy || counts.kind === "loading") return;
    setBusy(true);
    setError(null);
    try {
      await withdrawInfluencer(influencerId);
      onDone();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("domains.influencer.withdrawDialog.failure"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open
      tone="danger"
      title={t("domains.influencer.withdrawDialog.title", {
        name: influencerName,
      })}
      subtitle={
        <DialogBody counts={counts} error={error} withdrawal={withdrawal} />
      }
      confirmLabel={t("domains.influencer.withdrawDialog.confirm")}
      busy={busy}
      confirmDisabled={counts.kind === "loading"}
      secondaryAction={
        withdrawal?.decision === "PENDING" ? (
          <Button variant="secondary" size="md" disabled={busy} onClick={onReject}>
            {t("domains.influencer.withdrawal.rejectConfirm")}
          </Button>
        ) : undefined
      }
      onConfirm={handleConfirm}
      onCancel={() => {
        if (!busy) onCancel();
      }}
    />
  );
}

function DialogBody({
  counts,
  error,
  withdrawal,
}: {
  counts: CountsState;
  error: string | null;
  withdrawal: InfluencerWithdrawal | null;
}) {
  const t = useT();

  return (
    <>
      {withdrawal?.decision === "PENDING" && (
        <WithdrawalRequestSummary withdrawal={withdrawal} />
      )}
      {counts.kind === "loading" && (
        <span className={styles.line}>{t("common.loading")}</span>
      )}
      {counts.kind === "error" && (
        <span className={styles.line}>
          {t("domains.influencer.withdrawDialog.loadFailed")}
        </span>
      )}
      {counts.kind === "ready" && (
        <>
          <span className={styles.line}>
            {t("domains.influencer.withdrawDialog.totalCount", {
              count: String(counts.totalCount),
            })}
          </span>
          <span
            className={
              counts.ongoingCount > 0
                ? `${styles.line} ${styles.warn}`
                : styles.line
            }
          >
            {counts.ongoingCount > 0
              ? t("domains.influencer.withdrawDialog.ongoingWarning", {
                  count: String(counts.ongoingCount),
                })
              : t("domains.influencer.withdrawDialog.ongoingNone")}
          </span>
        </>
      )}
      <span className={`${styles.line} ${styles.warn}`}>
        {t("domains.influencer.withdrawDialog.irreversible")}
      </span>
      {error && <span className={`${styles.line} ${styles.warn}`}>{error}</span>}
    </>
  );
}

/** 본인이 적어낸 신청 내용 — 승인 전에 사유와 신청 시점을 눈으로 확인하는 자리다. */
function WithdrawalRequestSummary({
  withdrawal,
}: {
  withdrawal: InfluencerWithdrawal;
}) {
  const t = useT();

  return (
    <span className={styles.request}>
      <span className={styles.requestTitle}>
        {t("domains.influencer.withdrawal.requestBoxTitle")}
      </span>
      <span className={styles.line}>
        <span className={styles.requestLabel}>
          {t("domains.influencer.withdrawal.requestedAt")}
        </span>
        {new Date(withdrawal.requestedAt).toLocaleString()}
      </span>
      <span className={styles.line}>
        <span className={styles.requestLabel}>
          {t("domains.influencer.withdrawal.reason")}
        </span>
        {t(WITHDRAWAL_REASON_LABEL_KEY[withdrawal.reason])}
      </span>
      {withdrawal.reasonDetail.trim() !== "" && (
        <span className={styles.line}>
          <span className={styles.requestLabel}>
            {t("domains.influencer.withdrawal.reasonDetail")}
          </span>
          {withdrawal.reasonDetail}
        </span>
      )}
    </span>
  );
}
