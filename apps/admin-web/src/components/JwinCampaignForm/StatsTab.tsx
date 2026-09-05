import type { AdminCampaignStats } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { utcIsoToJstLocal } from "./jwinDateTime";
import { useJwinCampaignStats } from "./useJwinCampaignStats";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  campaignId: string;
};

/** UTC ISO → "2026-09-01 00:00" (JST, 언어 중립) */
function jstDateTime(iso: string): string {
  return utcIsoToJstLocal(iso).replace("T", " ");
}

type StatCard = {
  labelKey: Parameters<ReturnType<typeof useT>>[0];
  value: number;
  /** 0보다 크면 주의를 끌어야 하는 값 */
  warnWhenPositive?: boolean;
};

function statCards(stats: AdminCampaignStats): StatCard[] {
  return [
    { labelKey: "jwin.stats.entries", value: stats.entries },
    { labelKey: "jwin.stats.winConfirmed", value: stats.winConfirmed },
    { labelKey: "jwin.stats.winPendingToday", value: stats.winPendingToday },
    { labelKey: "jwin.stats.unfulfilledWins", value: stats.unfulfilledWins, warnWhenPositive: true },
    { labelKey: "jwin.stats.failedPosts", value: stats.failedPosts, warnWhenPositive: true },
  ];
}

export function StatsTab({ campaignId }: Props) {
  const t = useT();
  const { loading, loadError, stats } = useJwinCampaignStats(campaignId);

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>{t("jwin.stats.title")}</h2>
      </div>

      {loadError ? <div className={styles.errorText}>{loadError}</div> : null}
      {loading && !stats ? <div className={styles.empty}>{t("jwin.winner.loading")}</div> : null}

      {stats ? (
        <>
          {stats.needsReconnect ? (
            <div className={styles.warning}>{t("jwin.stats.needsReconnect")}</div>
          ) : null}

          <div className={styles.statGrid}>
            {statCards(stats).map((card) => (
              <div key={card.labelKey} className={styles.statCard}>
                <span className={styles.statLabel}>{t(card.labelKey)}</span>
                <span
                  className={
                    card.warnWhenPositive && card.value > 0
                      ? `${styles.statValue} ${styles.statValueWarn}`
                      : styles.statValue
                  }
                >
                  {card.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <p className={styles.statHint}>{t("jwin.stats.unfulfilledHint")}</p>
          {stats.failedPosts > 0 ? (
            <p className={styles.statHint}>{t("jwin.stats.failedPostsHint")}</p>
          ) : null}

          <div className={styles.statPeriod}>
            {t("jwin.stats.period")}: {jstDateTime(stats.startsAt)} ~ {jstDateTime(stats.endsAt)}
          </div>

          <h3 className={styles.statSectionTitle}>{t("jwin.stats.stockTitle")}</h3>
          {stats.prizeStock.length === 0 ? (
            <div className={styles.empty}>{t("jwin.stats.stockEmpty")}</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("jwin.prize.columns.name")}</th>
                  <th className={styles.num}>{t("jwin.prize.columns.quantity")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.prizeStock.map((prize) => (
                  <tr key={prize.name}>
                    <td>{prize.name}</td>
                    <td className={styles.num}>
                      {t("jwin.stats.stockRemaining", {
                        remaining: prize.remaining,
                        total: prize.total,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </div>
  );
}
