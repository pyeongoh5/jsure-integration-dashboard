import "./MonthlyCampaignChart.css";

type DataPoint = { m: string; v: number };

const MONTHLY: DataPoint[] = [
  { m: "5월", v: 38 },
  { m: "6월", v: 48 },
  { m: "7월", v: 36 },
  { m: "8월", v: 56 },
  { m: "9월", v: 50 },
  { m: "10월", v: 60 },
  { m: "11월", v: 70 },
  { m: "12월", v: 64 },
  { m: "1월", v: 76 },
  { m: "2월", v: 82 },
  { m: "3월", v: 90 },
  { m: "4월", v: 100 },
];

export function MonthlyCampaignChart() {
  const max = Math.max(...MONTHLY.map((d) => d.v));

  return (
    <section className="ov-card">
      <header className="ov-card__head">
        <h2>월별 캠페인 응모 추이</h2>
        <span className="ov-card__meta">최근 12개월</span>
      </header>
      <div className="mc-chart">
        {MONTHLY.map((d) => (
          <div key={d.m} className="mc-chart__col">
            <div className="mc-chart__bar-wrap">
              <div className="mc-chart__bar" style={{ height: `${(d.v / max) * 100}%` }} />
            </div>
            <div className="mc-chart__label">{d.m}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
