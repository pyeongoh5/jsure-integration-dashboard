import type { AdminLanguage } from "@i18n/admin";
import type { AdminActivityLog } from "@jsure/shared";
import { useLanguage, useT } from "@/lib/i18n";
import {
  ACTIVITY_ACTION_LABEL,
  ACTIVITY_ORIGIN_BADGE,
} from "./activityLabels";
import { formatElapsedSince } from "./elapsed";
import { METADATA_KEY_LABEL } from "./metadataLabels";
import type { ActivityState } from "./useApplicationActivity";
import styles from "./ActivityTimeline.module.css";

type TranslateFunction = ReturnType<typeof useT>;

type Props = {
  state: ActivityState;
};

export function ActivityTimeline({ state }: Props) {
  const t = useT();
  const { language } = useLanguage();

  if (state.kind === "loading") {
    return <div className={styles.empty}>{t("common.loading")}</div>;
  }
  if (state.kind === "error") {
    return <div className={styles.empty}>{state.message}</div>;
  }
  if (state.items.length === 0) {
    return (
      <div className={styles.empty}>{t("domains.application.history.empty")}</div>
    );
  }
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("domains.application.history.table.action")}</th>
            <th>{t("domains.application.history.table.time")}</th>
            <th>{t("domains.application.history.table.actor")}</th>
            <th>{t("domains.application.history.table.detail")}</th>
          </tr>
        </thead>
        <tbody>
          {state.items.map((entry, index) => (
            <tr key={entry.id}>
              <td>
                <span className={styles.action}>
                  {t(ACTIVITY_ACTION_LABEL[entry.action])}
                </span>
                <OriginBadge log={entry} />
              </td>
              <td className={styles.atCell}>
                {formatJst(entry.createdAt, language)}
                <ElapsedSincePrevious items={state.items} index={index} />
              </td>
              <td className={styles.actor}>{actorLabel(entry, t)}</td>
              <td className={styles.meta}>
                {metadataSummary(entry.metadata, t) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  const t = useT();
  const previous = items[index + 1];
  if (!previous) return null;
  const elapsed = formatElapsedSince(
    previous.createdAt,
    items[index]!.createdAt,
    t,
  );
  if (!elapsed) return null;
  return (
    <div className={styles.elapsed}>
      {t("domains.application.history.elapsedSincePrevious", { elapsed })}
    </div>
  );
}

function OriginBadge({ log }: { log: AdminActivityLog }) {
  const t = useT();
  const badge = ACTIVITY_ORIGIN_BADGE[log.origin];
  if (!badge) return null;
  return <span className={styles.badge}>{t(badge)}</span>;
}

function actorLabel(log: AdminActivityLog, t: TranslateFunction): string {
  if (log.actor) return log.actor.name ?? log.actor.id;
  // 합성 항목은 그 응모의 인플루언서가 행위자다. 나머지 actor 없는 행은 자동 처리.
  return log.origin === "INFLUENCER"
    ? t("domains.application.applicants.table.influencer")
    : t("domains.application.history.actorSystem");
}

/** 사람이 읽을 값만 골라 한 줄로. 객체/중첩은 표시하지 않는다. */
function metadataSummary(
  metadata: Record<string, unknown> | null,
  t: TranslateFunction,
): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    const rendered = renderMetadataValue(value, t);
    if (rendered === null) continue;
    const labelKey = METADATA_KEY_LABEL[key];
    parts.push(`${labelKey ? t(labelKey) : key}: ${rendered}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function renderMetadataValue(
  value: unknown,
  t: TranslateFunction,
): string | null {
  if (typeof value === "string") return value || null;
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") {
    return value
      ? t("domains.application.history.booleanYes")
      : t("domains.application.history.booleanNo");
  }
  if (Array.isArray(value)) {
    const items = value.filter((item) => typeof item === "string");
    return items.length > 0 ? items.join(", ") : null;
  }
  return null;
}

/** MM/DD HH:mm (JST). 연도는 컬럼 폭을 잡아먹고 판단에 거의 쓰이지 않아 뺐다. */
function formatJst(isoString: string, language: AdminLanguage): string {
  return new Date(isoString).toLocaleString(language, {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
