import { Link } from "react-router-dom";
import type {
  DailyActionAlertKind,
  DailyActionAlertsResponse,
} from "@jsure/shared";
import { useT } from "@/lib/i18n";
import styles from "./OverviewBoard.module.css";

type Props = {
  counts: DailyActionAlertsResponse;
  /** 리마인드 대상 목록 다이얼로그를 연다. */
  onOpenTargets: (kind: DailyActionAlertKind) => void;
  /** 탈퇴 신청 대기는 발송이 아니라 인플루언서 관리 화면으로 이동한다. */
  withdrawalTo: string;
};

function cardClass(count: number): string {
  return `${styles.alertCard} ${count === 0 ? styles.alertCardIdle : ""}`;
}

export function DailyActionAlerts({
  counts,
  onOpenTargets,
  withdrawalTo,
}: Props) {
  const t = useT();

  return (
    <div className={styles.alerts}>
      <button
        type="button"
        className={cardClass(counts.postOverdueCount)}
        onClick={() => onOpenTargets("POST_OVERDUE")}
      >
        <i className={`fa-solid fa-clock ${styles.alertIcon}`} aria-hidden="true" />
        <span className={styles.alertBody}>
          <span className={styles.alertLabel}>
            {t("pages.overview.alerts.postOverdue")}
          </span>
          <span className={styles.alertCount}>
            {t("pages.overview.alerts.personCount", {
              count: counts.postOverdueCount,
            })}
          </span>
        </span>
      </button>

      <button
        type="button"
        className={cardClass(counts.deliveryUnconfirmedCount)}
        onClick={() => onOpenTargets("DELIVERY_UNCONFIRMED")}
      >
        <i className={`fa-solid fa-truck ${styles.alertIcon}`} aria-hidden="true" />
        <span className={styles.alertBody}>
          <span className={styles.alertLabel}>
            {t("pages.overview.alerts.deliveryUnconfirmed")}
          </span>
          <span className={styles.alertCount}>
            {t("common.itemCount", { count: counts.deliveryUnconfirmedCount })}
          </span>
        </span>
      </button>

      <Link to={withdrawalTo} className={cardClass(counts.withdrawalPendingCount)}>
        <i
          className={`fa-solid fa-user-minus ${styles.alertIcon}`}
          aria-hidden="true"
        />
        <span className={styles.alertBody}>
          <span className={styles.alertLabel}>
            {t("pages.overview.alerts.withdrawalPending")}
          </span>
          <span className={styles.alertCount}>
            {t("common.itemCount", { count: counts.withdrawalPendingCount })}
          </span>
        </span>
      </Link>
    </div>
  );
}
