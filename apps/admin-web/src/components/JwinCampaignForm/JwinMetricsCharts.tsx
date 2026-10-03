import { useState } from "react";
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

/** 팔로워 추이 — 단일 계열 라인. 마지막 점 직접 라벨 + 포인트 호버 툴팁. */
export function FollowerTrendChart({ snapshots }: { snapshots: AdminMetricSnapshot[] }) {
  const t = useT();
  const [hovered, setHovered] = useState<number | null>(null);
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

  const hoveredSnapshot = hovered !== null ? snapshots[hovered] : null;
  const hoveredPrevious = hovered !== null && hovered > 0 ? snapshots[hovered - 1] : null;
  const hoveredDelta =
    hoveredSnapshot && hoveredPrevious
      ? hoveredSnapshot.followerCount - hoveredPrevious.followerCount
      : null;

  return (
    <figure className={`${styles.figure} ${styles.chartWrap}`}>
      {/* 포인트 호버 툴팁 — 즉시 표시, 날짜·값·전일比 */}
      {hoveredSnapshot && hovered !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: `${(x(hovered) / width) * 100}%`,
            top: `${(y(hoveredSnapshot.followerCount) / height) * 100}%`,
          }}
        >
          <strong>{shortDate(hoveredSnapshot.dateJst)}</strong>{" "}
          {hoveredSnapshot.followerCount.toLocaleString()}
          {hoveredDelta !== null && hoveredDelta !== 0 && (
            <span> ({hoveredDelta > 0 ? "+" : ""}{hoveredDelta.toLocaleString()})</span>
          )}
        </div>
      )}
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
            <circle
              cx={x(index)}
              cy={y(snapshot.followerCount)}
              r={hovered === index ? 6 : 4}
              className={styles.dot}
            />
            {/* 히트 타깃은 마크보다 크게 */}
            <circle
              cx={x(index)}
              cy={y(snapshot.followerCount)}
              r={14}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            />
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
