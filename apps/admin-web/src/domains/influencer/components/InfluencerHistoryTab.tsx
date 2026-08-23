import { useEffect, useMemo, useState } from "react";
import {
  INFLUENCER_HISTORY_TAB,
  type AdminActivityLog,
  type ApplicationStatus,
  type CampaignSubType,
  type InfluencerActivityGroup,
  type InfluencerHistoryTab as HistoryStatusTab,
} from "@jsure/shared";
import type { AdminTranslationKey } from "@i18n/admin";
import { SegmentedTabs, SubTypePill } from "@/components/composites";
import { ACTIVITY_ACTION_LABEL } from "@/domains/application";
import { useT } from "@/lib/i18n";
import { fetchInfluencerActivity } from "../api";
import { formatDateTime } from "../formatDateTime";
import styles from "./InfluencerHistoryTab.module.css";

/** ALL 은 세부 탭 없이 전체 노출. 나머지는 응모의 현재 상태로 걸러낸다. */
type HistoryFilter = "ALL" | HistoryStatusTab;

type ActivityState =
  | { kind: "loading" }
  | { kind: "ready"; groups: InfluencerActivityGroup[] }
  | { kind: "error"; message: string };

/** 한 이벤트를 표시하는 데 필요한 값만 평탄화한 행. */
type HistoryRow = {
  key: string;
  campaignTitle: string;
  subTypes: CampaignSubType[];
  status: ApplicationStatus;
  event: AdminActivityLog;
  /** 반려 이벤트에만 채워진다. */
  rejectReason: string | null;
};

const FILTER_LABEL: Record<HistoryFilter, AdminTranslationKey> = {
  ALL: "domains.influencer.notesDialog.history.tabAll",
  APPLIED: "domains.influencer.notesDialog.history.tabApplied",
  COMPLETED: "domains.influencer.notesDialog.history.tabCompleted",
  REJECTED: "domains.influencer.notesDialog.history.tabRejected",
};

const FILTER_ORDER: HistoryFilter[] = [
  "ALL",
  "APPLIED",
  "COMPLETED",
  "REJECTED",
];

const STATUS_LABEL: Record<ApplicationStatus, AdminTranslationKey> = {
  APPLIED: "domains.influencer.notesDialog.history.status.applied",
  APPROVED: "domains.influencer.notesDialog.history.status.approved",
  SHIPPED: "domains.influencer.notesDialog.history.status.shipped",
  DELIVERED: "domains.influencer.notesDialog.history.status.delivered",
  ORDER_SUBMITTED: "domains.influencer.notesDialog.history.status.orderSubmitted",
  REVIEW_SUBMITTED:
    "domains.influencer.notesDialog.history.status.reviewSubmitted",
  COMPLETED: "domains.influencer.notesDialog.history.status.completed",
  REJECTED: "domains.influencer.notesDialog.history.status.rejected",
  CANCELLED: "domains.influencer.notesDialog.history.status.cancelled",
};

/** 뱃지 색은 세부 탭 그룹을 따라간다 — 진행 중은 중립, 완료는 초록, 반려는 빨강. */
const STATUS_BADGE_CLASS: Record<ApplicationStatus, string | undefined> = {
  APPLIED: styles.badgeOpen,
  APPROVED: styles.badgeOpen,
  SHIPPED: styles.badgeOpen,
  DELIVERED: styles.badgeOpen,
  ORDER_SUBMITTED: styles.badgeOpen,
  REVIEW_SUBMITTED: styles.badgeOpen,
  COMPLETED: styles.badgeCompleted,
  REJECTED: styles.badgeRejected,
  CANCELLED: styles.badgeCancelled,
};

/** 반려 사유를 붙일 이벤트. 응모 반려와 제출물 반려 모두 사유가 의미 있다. */
const REJECTION_ACTIONS: AdminActivityLog["action"][] = [
  "APPLICATION_REJECT",
  "SUBMISSION_REJECT",
];

function matchesFilter(
  group: InfluencerActivityGroup,
  filter: HistoryFilter,
): boolean {
  if (filter === "ALL") return true;
  return INFLUENCER_HISTORY_TAB[group.status] === filter;
}

function toRows(
  groups: InfluencerActivityGroup[],
  filter: HistoryFilter,
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const group of groups) {
    if (!matchesFilter(group, filter)) continue;
    for (const event of group.events) {
      rows.push({
        key: `${group.applicationId}-${event.id}`,
        campaignTitle: group.campaignTitle,
        subTypes: group.subTypes,
        status: group.status,
        event,
        rejectReason: REJECTION_ACTIONS.includes(event.action)
          ? group.rejectReason
          : null,
      });
    }
  }
  return rows.sort((left, right) =>
    left.event.createdAt < right.event.createdAt ? 1 : -1,
  );
}

type Props = {
  influencerId: string;
};

export function InfluencerHistoryTab({ influencerId }: Props) {
  const t = useT();
  const [state, setState] = useState<ActivityState>({ kind: "loading" });
  const [filter, setFilter] = useState<HistoryFilter>("ALL");

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchInfluencerActivity(influencerId)
      .then((groups) => {
        if (!cancelled) setState({ kind: "ready", groups });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            cause instanceof Error
              ? cause.message
              : t("domains.influencer.notesDialog.history.loadFailed"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  const rows = useMemo(
    () => (state.kind === "ready" ? toRows(state.groups, filter) : []),
    [state, filter],
  );

  return (
    <div>
      <SegmentedTabs
        className={styles.filterTabs}
        items={FILTER_ORDER.map((key) => ({ key, label: t(FILTER_LABEL[key]) }))}
        value={filter}
        onChange={setFilter}
      />
      <HistoryBody state={state} rows={rows} />
    </div>
  );
}

function HistoryBody({
  state,
  rows,
}: {
  state: ActivityState;
  rows: HistoryRow[];
}) {
  const t = useT();
  if (state.kind === "loading") {
    return <div className={styles.empty}>{t("common.loading")}</div>;
  }
  if (state.kind === "error") {
    return <div className={styles.error}>{state.message}</div>;
  }
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        {t("domains.influencer.notesDialog.history.empty")}
      </div>
    );
  }
  return (
    <div className={styles.list}>
      {rows.map((row) => (
        <HistoryEntry key={row.key} row={row} />
      ))}
    </div>
  );
}

function HistoryEntry({ row }: { row: HistoryRow }) {
  const t = useT();
  return (
    <article className={styles.entry}>
      <div className={styles.entryTop}>
        <span
          className={`${styles.badge} ${STATUS_BADGE_CLASS[row.status] ?? ""}`}
        >
          {t(STATUS_LABEL[row.status])}
        </span>
        <span className={styles.campaign}>{row.campaignTitle}</span>
        <span className={styles.subTypes}>
          {row.subTypes.map((subType) => (
            <SubTypePill key={subType} subType={subType} />
          ))}
        </span>
      </div>
      <div className={styles.entryMeta}>
        <span className={styles.action}>
          {t(ACTIVITY_ACTION_LABEL[row.event.action])}
        </span>
        <span>{formatDateTime(row.event.createdAt)}</span>
        <span className={styles.actor}>{actorLabel(row.event, t)}</span>
      </div>
      {row.rejectReason && (
        <div className={styles.reason}>
          <span className={styles.reasonLabel}>
            {t("domains.influencer.notesDialog.history.rejectReason")}
          </span>
          {row.rejectReason}
        </div>
      )}
    </article>
  );
}

/** 담당자. 이름이 없으면 id 를 노출한다 — 검수 시 계정 식별이 목적이다. */
function actorLabel(
  event: AdminActivityLog,
  t: ReturnType<typeof useT>,
): string {
  if (event.actor) return event.actor.name ?? event.actor.id;
  if (event.origin === "INFLUENCER") {
    return t("domains.application.applicants.table.influencer");
  }
  return t("domains.application.history.actorSystem");
}
