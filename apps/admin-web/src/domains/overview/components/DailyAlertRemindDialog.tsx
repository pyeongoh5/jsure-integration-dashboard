import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { DailyActionAlertKind, DailyActionAlertTarget } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { Button, Dialog } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { getDailyActionAlertTargets, sendDailyActionReminders } from "../api";
import styles from "./OverviewBoard.module.css";

/** 알림 종류별 문구. 두 종류가 같은 다이얼로그를 쓰고 라벨만 다르다. */
const TITLE_KEY: Record<DailyActionAlertKind, AdminTranslationKey> = {
  POST_OVERDUE: "pages.overview.alerts.postOverdue",
  DELIVERY_UNCONFIRMED: "pages.overview.alerts.deliveryUnconfirmed",
};

const ELAPSED_KEY: Record<DailyActionAlertKind, AdminTranslationKey> = {
  POST_OVERDUE: "pages.overview.remind.overdueDays",
  DELIVERY_UNCONFIRMED: "pages.overview.remind.shippedDaysAgo",
};

type TargetListProps = {
  kind: DailyActionAlertKind;
  targets: DailyActionAlertTarget[];
};

function RemindTargetList({ kind, targets }: TargetListProps) {
  const t = useT();
  return (
    <div className={styles.targetList}>
      {targets.map((target) => (
        <div key={target.applicationId} className={styles.targetRow}>
          <span className={styles.targetMain}>
            <span className={styles.targetName}>{target.influencerName}</span>
            <span className={styles.targetSub}>{target.campaignTitle}</span>
          </span>
          {!target.lineLinked && (
            <span className={styles.targetNoLine}>
              {t("pages.overview.remind.noLine")}
            </span>
          )}
          <span className={styles.targetElapsed}>
            {t(ELAPSED_KEY[kind], { days: target.elapsedDays })}
          </span>
        </div>
      ))}
    </div>
  );
}

type Props = {
  kind: DailyActionAlertKind;
  onClose: () => void;
  /** 발송 후 알림 카운트를 다시 읽기 위한 콜백. */
  onSent: () => void;
};

export function DailyAlertRemindDialog({ kind, onClose, onSent }: Props) {
  const t = useT();
  const [sentCount, setSentCount] = useState<number | null>(null);

  const targetsQuery = useQuery({
    queryKey: ["admin", "overview", "daily-alerts", kind, "targets"],
    queryFn: () => getDailyActionAlertTargets(kind),
  });
  const targets = targetsQuery.data?.targets ?? [];

  const sendMutation = useMutation({
    mutationFn: () =>
      sendDailyActionReminders(
        kind,
        targets.map((target) => target.applicationId),
      ),
    onSuccess: (response) => {
      setSentCount(response.requestedCount);
      onSent();
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(TITLE_KEY[kind])}
      footer={
        <div className={styles.dialogFooter}>
          <span className={styles.dialogMessage}>
            {sentCount === null
              ? t("pages.overview.remind.notice")
              : t("pages.overview.remind.sent", { count: sentCount })}
          </span>
          <span className={styles.dialogActions}>
            <Button variant="secondary" size="md" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={sendMutation.isPending}
              disabled={targets.length === 0}
              onClick={() => sendMutation.mutate()}
            >
              {t("pages.overview.remind.sendAll", { count: targets.length })}
            </Button>
          </span>
        </div>
      }
    >
      {targetsQuery.isPending && (
        <div className={styles.empty}>{t("common.loading")}</div>
      )}
      {targetsQuery.isError && (
        <div className={styles.empty}>{t("pages.overview.loadFailed")}</div>
      )}
      {targetsQuery.isSuccess && targets.length === 0 && (
        <div className={styles.empty}>{t("pages.overview.remind.empty")}</div>
      )}
      {targets.length > 0 && <RemindTargetList kind={kind} targets={targets} />}
    </Dialog>
  );
}
