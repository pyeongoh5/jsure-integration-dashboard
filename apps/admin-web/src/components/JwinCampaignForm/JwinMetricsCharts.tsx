import { useT } from "@/lib/i18n";
import type { AdminMetricSnapshot } from "@/domains/jwin";
import styles from "./JwinMetricsCharts.module.css";

/**
 * 성과 지표 차트 — 추세는 차트로, 정밀값은 테이블로 분담한다.
 * 라이브러리 없이 SVG (Overview 월별 차트와 같은 방식), 색은 검증된
 * 기본 팔레트의 고정 슬롯 순서.
 */

/** "YYYY-MM-DD" → "M/D" */
function shortDate(dateJst: string): string {
  const [, month = "", day = ""] = dateJst.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** 팔로워 추이 — 단일 계열 라인. 마지막 점에 값·순증 직접 라벨. */
export function FollowerTrendChart({ snapshots }: { snapshots: AdminMetricSnapshot[] }) {
  const t = useT();
  if (snapshots.length < 2) return null;

  const width = 1120;
  const height = 200;
  const padding = { top: 16, right: 96, bottom: 24, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const values = snapshots.map((snapshot) => snapshot.followerCount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const x = (index: number) =>
    padding.left + (snapshots.length === 1 ? 0 : (index / (snapshots.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + (1 - (value - min) / span) * innerHeight;

  const last = snapshots[snapshots.length - 1] as AdminMetricSnapshot;
  const first = snapshots[0] as AdminMetricSnapshot;
  const delta = last.followerCount - first.followerCount;

  return (
    <figure className={styles.figure}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.lineChart}
        role="img"
        aria-label={t("jwin.stats.chartFollowers")}
      >
        {/* 은은한 가이드 라인 2개 */}
        {[0.25, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerHeight * ratio}
            y2={padding.top + innerHeight * ratio}
            className={styles.grid}
          />
        ))}
        <polyline
          className={styles.line}
          points={snapshots
            .map((snapshot, index) => `${x(index)},${y(snapshot.followerCount)}`)
            .join(" ")}
        />
        {snapshots.map((snapshot, index) => (
          <g key={`${snapshot.dateJst}-${snapshot.kind}`}>
            <circle cx={x(index)} cy={y(snapshot.followerCount)} r={4} className={styles.dot} />
            {/* 히트 타깃은 마크보다 크게 — 네이티브 툴팁 */}
            <circle cx={x(index)} cy={y(snapshot.followerCount)} r={12} fill="transparent">
              <title>
                {shortDate(snapshot.dateJst)} · {snapshot.followerCount.toLocaleString()}
              </title>
            </circle>
          </g>
        ))}
        {/* 마지막 값 직접 라벨 */}
        <text
          x={x(snapshots.length - 1) + 10}
          y={y(last.followerCount) + 4}
          className={styles.lastLabel}
        >
          {last.followerCount.toLocaleString()}
          {delta !== 0 && ` (${delta > 0 ? "+" : ""}${delta.toLocaleString()})`}
        </text>
        {/* 양 끝 날짜 */}
        <text x={padding.left} y={height - 6} className={styles.axisLabel}>
          {shortDate(first.dateJst)}
        </text>
        <text
          x={x(snapshots.length - 1)}
          y={height - 6}
          textAnchor="middle"
          className={styles.axisLabel}
        >
          {shortDate(last.dateJst)}
        </text>
      </svg>
    </figure>
  );
}
