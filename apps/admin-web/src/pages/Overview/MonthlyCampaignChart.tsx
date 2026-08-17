import overviewStyles from "./Overview.module.css";
import styles from "./MonthlyCampaignChart.module.css";
import { useMonthlyApplicationCounts } from "./useMonthlyApplicationCounts";
import { useT } from "@/lib/i18n";

export function MonthlyCampaignChart() {
  const t = useT();
  const state = useMonthlyApplicationCounts();

  return (
    <section className={overviewStyles.card}>
      <header className={overviewStyles.cardHead}>
        <h2>{t("pages.overview.chart.title")}</h2>
        <span className={overviewStyles.cardMeta}>{t("pages.overview.chart.meta")}</span>
      </header>
      {state.kind === "loading" && (
        <div className={styles.empty}>{t("common.loading")}</div>
      )}
      {state.kind === "error" && (
        <div className={`${styles.empty} ${styles.emptyError}`}>
          {state.message}
        </div>
      )}
      {state.kind === "ready" && <Chart points={state.points} />}
    </section>
  );
}

type ChartProps = {
  points: { label: string; count: number }[];
};

function Chart({ points }: ChartProps) {
  const t = useT();
  const max = Math.max(1, ...points.map((point) => point.count));

  return (
    <div className={styles.chart}>
      {points.map((point, index) => (
        <div key={`${point.label}-${index}`} className={styles.col}>
          <div className={styles.barWrap}>
            <div
              className={styles.bar}
              style={{ height: `${(point.count / max) * 100}%` }}
              title={t("pages.overview.chart.barTitle", {
                label: point.label,
                count: point.count,
              })}
            >
              <span className={styles.value}>{point.count}</span>
            </div>
          </div>
          <div className={styles.label}>{point.label}</div>
        </div>
      ))}
    </div>
  );
}
