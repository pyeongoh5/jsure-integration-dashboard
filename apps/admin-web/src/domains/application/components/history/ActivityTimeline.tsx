import type { AdminActivityLog } from "@jsure/shared";
import {
  ACTIVITY_ACTION_LABEL,
  ACTIVITY_ORIGIN_BADGE,
} from "./activityLabels";
import { formatElapsedSince } from "./elapsed";
import { METADATA_KEY_LABEL } from "./metadataLabels";
import type { ActivityState } from "./useApplicationActivity";
import styles from "./ActivityTimeline.module.css";

type Props = {
  state: ActivityState;
};

export function ActivityTimeline({ state }: Props) {
  if (state.kind === "loading") {
    return <div className={styles.empty}>불러오는 중…</div>;
  }
  if (state.kind === "error") {
    return <div className={styles.empty}>{state.message}</div>;
  }
  if (state.items.length === 0) {
    return (
      <div className={styles.empty}>
        이 응모에 기록된 작업 이력이 없습니다. 감사 로그 도입 이전 처리 건일 수
        있습니다.
      </div>
    );
  }
  return (
    <ol className={styles.list}>
      {state.items.map((entry, index) => (
        <li key={entry.id} className={styles.item}>
          <div className={styles.head}>
            <span className={styles.action}>
              {ACTIVITY_ACTION_LABEL[entry.action]}
            </span>
            <OriginBadge log={entry} />
            <ElapsedSincePrevious items={state.items} index={index} />
            <span className={styles.at}>{formatJst(entry.createdAt)}</span>
          </div>
          <div className={styles.actor}>{actorLabel(entry)}</div>
          <MetadataLine log={entry} />
        </li>
      ))}
    </ol>
  );
}

/** 목록은 최신순이라 직전 액션은 바로 다음 인덱스다. 가장 오래된 항목은 표시 없음. */
function ElapsedSincePrevious({
  items,
  index,
}: {
  items: AdminActivityLog[];
  index: number;
}) {
  const previous = items[index + 1];
  if (!previous) return null;
  const elapsed = formatElapsedSince(previous.createdAt, items[index]!.createdAt);
  if (!elapsed) return null;
  return <span className={styles.elapsed}>{elapsed}</span>;
}

function OriginBadge({ log }: { log: AdminActivityLog }) {
  const badge = ACTIVITY_ORIGIN_BADGE[log.origin];
  if (!badge) return null;
  return <span className={styles.badge}>{badge}</span>;
}

function MetadataLine({ log }: { log: AdminActivityLog }) {
  const summary = metadataSummary(log.metadata);
  if (!summary) return null;
  return <div className={styles.meta}>{summary}</div>;
}

function actorLabel(log: AdminActivityLog): string {
  if (!log.actor) return "시스템";
  return log.actor.name ?? log.actor.id;
}

/** 사람이 읽을 값만 골라 한 줄로. 객체/중첩은 표시하지 않는다. */
function metadataSummary(
  metadata: Record<string, unknown> | null,
): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    const rendered = renderMetadataValue(value);
    if (rendered === null) continue;
    parts.push(`${METADATA_KEY_LABEL[key] ?? key}: ${rendered}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function renderMetadataValue(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (Array.isArray(value)) {
    const items = value.filter((item) => typeof item === "string");
    return items.length > 0 ? items.join(", ") : null;
  }
  return null;
}

function formatJst(isoString: string): string {
  return new Date(isoString).toLocaleString("ko-KR", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
