import { useCallback, useEffect, useRef, useState } from "react";
import type { BroadcastJob } from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { listBroadcastJobs } from "../api";
import { subscribeToBroadcastStarted } from "../broadcastEvents";
import { useT } from "@/lib/i18n";
import styles from "./BroadcastProgressDock.module.css";

const ACTIVE_POLL_MS = 1000;

/**
 * 화면 우하단에 떠 있는 발송 진행률 패널.
 * - 첫 마운트에 1회 조회. 활성 작업이 있으면 1초 폴링, 모두 끝나면 폴링 정지.
 * - "메시지 발송" 다이얼로그가 발송을 시작하면 broadcast-started 이벤트로 즉시 폴링 재개.
 * - 완료/실패 항목은 사용자가 닫기 전까지 패널에 남음.
 */
export function BroadcastProgressDock() {
  const t = useT();
  const [jobs, setJobs] = useState<BroadcastJob[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(async () => {
    let next: BroadcastJob[] = [];
    try {
      next = await listBroadcastJobs();
      if (!cancelledRef.current) setJobs(next);
    } catch {
      // 폴링 실패 무시 — 다음 tick 에서 다시 시도
    }
    if (cancelledRef.current) return;
    const hasActive = next.some(
      (job) => job.status === "QUEUED" || job.status === "RUNNING",
    );
    clearTimer();
    if (hasActive) {
      timerRef.current = setTimeout(tick, ACTIVE_POLL_MS);
    }
    // active 가 없으면 폴링을 멈춘다. 새 발송이 일어나면 broadcastStarted 이벤트가 재개시킴.
  }, [clearTimer]);

  useEffect(() => {
    cancelledRef.current = false;
    tick();
    const unsubscribe = subscribeToBroadcastStarted(() => {
      clearTimer();
      tick();
    });
    return () => {
      cancelledRef.current = true;
      clearTimer();
      unsubscribe();
    };
  }, [tick, clearTimer]);

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
          {t("domains.broadcast.dock.jobs", { count: visible.length })}
          {activeCount > 0
            ? ` · ${t("domains.broadcast.dock.active", { count: activeCount })}`
            : ""}
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
  const t = useT();
  const done = job.sent + job.failed + job.skipped;
  const pct = job.total > 0 ? Math.min(100, (done / job.total) * 100) : 0;
  const statusLabelKey: Record<BroadcastJob["status"], AdminTranslationKey> = {
    QUEUED: "domains.broadcast.dock.statusQueued",
    RUNNING: "domains.broadcast.dock.statusRunning",
    COMPLETED: "domains.broadcast.dock.statusCompleted",
    FAILED: "domains.broadcast.dock.statusFailed",
  };
  const label = t(statusLabelKey[job.status]);
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
            aria-label={t("domains.broadcast.dock.dismissAria")}
          >
            ✕
          </button>
        )}
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.sub}>
        {t("domains.broadcast.dock.summary", {
          sent: job.sent,
          failed: job.failed,
          skipped: job.skipped,
        })}
      </div>
      {job.errorMessage && (
        <div className={styles.error}>{job.errorMessage}</div>
      )}
    </li>
  );
}
