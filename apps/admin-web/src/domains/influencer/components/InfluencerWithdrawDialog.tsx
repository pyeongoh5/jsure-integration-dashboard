import { useEffect, useState } from "react";
import {
  INFLUENCER_HISTORY_TAB,
  type InfluencerActivityGroup,
} from "@jsure/shared";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
import { fetchInfluencerActivity, withdrawInfluencer } from "../api";
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
  /** 탈퇴 성공 후 — 목록 갱신용. */
  onDone: () => void;
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
  onDone,
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
      subtitle={<DialogBody counts={counts} error={error} />}
      confirmLabel={t("domains.influencer.withdrawDialog.confirm")}
      busy={busy}
      confirmDisabled={counts.kind === "loading"}
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
}: {
  counts: CountsState;
  error: string | null;
}) {
  const t = useT();

  return (
    <>
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
