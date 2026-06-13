import overviewStyles from "./Overview.module.css";
import styles from "./MonthlyCampaignChart.module.css";
import { useMonthlyApplicationCounts } from "./useMonthlyApplicationCounts";

export function MonthlyCampaignChart() {
  const state = useMonthlyApplicationCounts();

  return (
    <section className={overviewStyles.card}>
      <header className={overviewStyles.cardHead}>
        <h2>월별 캠페인 응모 추이</h2>
        <span className={overviewStyles.cardMeta}>최근 12개월</span>
      </header>
      {state.kind === "loading" && (
        <div className={styles.empty}>불러오는 중…</div>
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
  const max = Math.max(1, ...points.map((point) => point.count));

  return (
    <div className={styles.chart}>
      {points.map((point, index) => (
        <div key={`${point.label}-${index}`} className={styles.col}>
          <div className={styles.barWrap}>
            <div
              className={styles.bar}
              style={{ height: `${(point.count / max) * 100}%` }}
              title={`${point.label}: ${point.count}건`}
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
