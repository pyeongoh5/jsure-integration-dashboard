import { useEffect, useState } from "react";
import type { BroadcastJob } from "@jsure/shared";
import { listBroadcastJobs } from "../api";
import styles from "./BroadcastProgressDock.module.css";

/**
 * 화면 우하단에 떠 있는 발송 진행률 패널.
 * - 활성 (QUEUED/RUNNING) 작업이 하나라도 있으면 1초 폴링, 모두 끝나면 5초로 늦춤
 * - 완료/실패 항목은 사용자가 닫기 전까지 패널에 남아 있음 (사용자가 결과 확인 후 닫음)
 * - 여러 broadcast 동시에 떠도 각각 row 로 표시
 */
export function BroadcastProgressDock() {
  const [jobs, setJobs] = useState<BroadcastJob[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      let next: BroadcastJob[] = [];
      try {
        next = await listBroadcastJobs();
        if (!cancelled) setJobs(next);
      } catch {
        // 폴링 실패 무시
      }
      if (cancelled) return;
      const hasActive = next.some(
        (j) => j.status === "QUEUED" || j.status === "RUNNING",
      );
      timer = setTimeout(tick, hasActive ? 1000 : 5000);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 활성이거나 최근 10분 안에 끝난 작업만 보여줌
  const RECENT_MS = 10 * 60 * 1000;
  const now = Date.now();
  const isRecent = (job: BroadcastJob) => {
    if (job.status === "QUEUED" || job.status === "RUNNING") return true;
    const finished = job.finishedAt ? new Date(job.finishedAt).getTime() : 0;
    return now - finished < RECENT_MS;
  };
  const visible = jobs.filter((j) => isRecent(j) && !dismissed.has(j.id));
  if (visible.length === 0) return null;

  const activeCount = visible.filter(
    (j) => j.status === "QUEUED" || j.status === "RUNNING",
  ).length;

  return (
    <div className={`${styles.dock} ${collapsed ? styles.isCollapsed : ""}`}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span>
          발송 작업 {visible.length}건
          {activeCount > 0 ? ` · 진행 ${activeCount}` : ""}
        </span>
        <span className={styles.toggle}>{collapsed ? "▴" : "▾"}</span>
      </button>
      {!collapsed && (
        <ul className={styles.list}>
          {visible.map((job) => (
            <BroadcastDockItem
              key={job.id}
              job={job}
              onDismiss={() =>
                setDismissed((prev) => new Set(prev).add(job.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BroadcastDockItem({
  job,
  onDismiss,
}: {
  job: BroadcastJob;
  onDismiss: () => void;
}) {
  const done = job.sent + job.failed + job.skipped;
  const pct = job.total > 0 ? Math.min(100, (done / job.total) * 100) : 0;
  const label =
    job.status === "QUEUED"
      ? "대기"
      : job.status === "RUNNING"
        ? "발송 중"
        : job.status === "COMPLETED"
          ? "완료"
          : "실패";
  const isDone = job.status === "COMPLETED" || job.status === "FAILED";
  const statusClass = {
    QUEUED: styles.statusQueued,
    RUNNING: styles.statusRunning,
    COMPLETED: styles.statusCompleted,
    FAILED: styles.statusFailed,
  }[job.status];

  return (
    <li className={styles.item}>
      <div className={styles.top}>
        <span className={`${styles.status} ${statusClass}`}>
          {label}
        </span>
        <span className={styles.counts}>
          {done}/{job.total}
        </span>
        {isDone && (
          <button
            type="button"
            className={styles.close}
            onClick={onDismiss}
            aria-label="알림 닫기"
          >
            ✕
          </button>
        )}
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.sub}>
        성공 {job.sent} · 실패 {job.failed} · 미연동 {job.skipped}
      </div>
      {job.errorMessage && (
        <div className={styles.error}>{job.errorMessage}</div>
      )}
    </li>
  );
}
