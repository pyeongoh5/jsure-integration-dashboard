import "./MonthlyCampaignChart.css";
import { useMonthlyApplicationCounts } from "./useMonthlyApplicationCounts";

export function MonthlyCampaignChart() {
  const state = useMonthlyApplicationCounts();

  return (
    <section className="ov-card">
      <header className="ov-card__head">
        <h2>월별 캠페인 응모 추이</h2>
        <span className="ov-card__meta">최근 12개월</span>
      </header>
      {state.kind === "loading" && (
        <div className="mc-chart__empty">불러오는 중…</div>
      )}
      {state.kind === "error" && (
        <div className="mc-chart__empty mc-chart__empty--error">
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
    <div className="mc-chart">
      {points.map((point, index) => (
        <div key={`${point.label}-${index}`} className="mc-chart__col">
          <div className="mc-chart__bar-wrap">
            <div
              className="mc-chart__bar"
              style={{ height: `${(point.count / max) * 100}%` }}
              title={`${point.label}: ${point.count}건`}
            >
              <span className="mc-chart__value">{point.count}</span>
            </div>
          </div>
          <div className="mc-chart__label">{point.label}</div>
        </div>
      ))}
    </div>
  );
}
