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
import { SegmentedTabs, SubTypeIcon } from "@/components/composites";
import { Button, Switch } from "@/components/ui";
import {
  ACTIVITY_ACTION_LABEL,
  CANCEL_REASON_CATEGORY_LABELS,
  restoreCancelledApplication,
} from "@/domains/application";
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
  /** 사유가 있는 이벤트(반려·취소)에만 채워진다. */
  reason: EventReason | null;
  /** 되돌리기 대상 — 현재 취소 상태이고 이 행이 가장 최근 강제 취소일 때만 채워진다. */
  restorableApplicationId: string | null;
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
/** 사유를 보여줄 액션과, 그 사유에 붙일 라벨. 여기 없는 액션은 사유를 그리지 않는다. */
const REASON_LABEL: Partial<
  Record<AdminActivityLog["action"], AdminTranslationKey>
> = {
  APPLICATION_REJECT: "domains.influencer.notesDialog.history.rejectReason",
  SUBMISSION_REJECT: "domains.influencer.notesDialog.history.rejectReason",
  APPLICATION_FORCE_CANCEL:
    "domains.influencer.notesDialog.history.cancelReason",
};

/** 한 이벤트의 사유 — 라벨, 대분류(취소만), 상세 문구. */
type EventReason = {
  labelKey: AdminTranslationKey;
  /** 취소 사유 대분류. 반려에는 없다. */
  categoryKey: AdminTranslationKey | null;
  text: string;
};

/**
 * 이벤트 사유. 로그 metadata 의 reason 이 그 이벤트의 사유라 가장 정확하다 —
 * group.rejectReason 은 응모 반려 사유뿐이라 제출물 반려에는 맞지 않는다.
 * metadata 가 없는 옛 로그를 위해 응모 반려에 한해 컬럼으로 되돌아간다.
 *
 * 취소는 대분류를 함께 보여준다 — 인플루언서 귀책인지 브랜드·물류 귀책인지가
 * 차후 선정 검토의 핵심이라 상세 문구만으로는 판별할 수 없다.
 */
function eventReasonOf(
  event: AdminActivityLog,
  groupRejectReason: string | null,
): EventReason | null {
  const labelKey = REASON_LABEL[event.action];
  if (!labelKey) return null;

  const raw = event.metadata?.reason;
  const fallback =
    event.action === "APPLICATION_REJECT" ? groupRejectReason : null;
  const text = typeof raw === "string" && raw.trim() ? raw : (fallback ?? "");

  const categoryKey = cancelCategoryKeyOf(event);
  // 대분류만 있고 상세가 비어도 보여준다 — 귀책 구분이 상세보다 중요하다.
  if (!text && !categoryKey) return null;
  return { labelKey, categoryKey, text };
}

/** 취소 로그의 대분류 i18n 키. 대분류 도입 전 로그는 null. */
function cancelCategoryKeyOf(
  event: AdminActivityLog,
): AdminTranslationKey | null {
  if (event.action !== "APPLICATION_FORCE_CANCEL") return null;
  const category = event.metadata?.reasonCategory;
  if (typeof category !== "string") return null;
  return CANCEL_REASON_CATEGORY_LABELS[
    category as keyof typeof CANCEL_REASON_CATEGORY_LABELS
  ] ?? null;
}

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
    // 되돌리기는 "지금 취소 상태"인 응모의 가장 최근 강제 취소 기록에만 건다.
    // events 는 최신순이라 처음 만나는 강제 취소가 그 건이다.
    const latestCancelEventId =
      group.status === "CANCELLED"
        ? (group.events.find(
            (event) => event.action === "APPLICATION_FORCE_CANCEL",
          )?.id ?? null)
        : null;
    for (const event of group.events) {
      rows.push({
        key: `${group.applicationId}-${event.id}`,
        campaignTitle: group.campaignTitle,
        subTypes: group.subTypes,
        status: group.status,
        event,
        reason: eventReasonOf(event, group.rejectReason),
        restorableApplicationId:
          event.id === latestCancelEventId ? group.applicationId : null,
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
  // 기본은 최신 1건만. 대부분 "마지막에 무슨 일이 있었나"만 보므로 전체를 펼쳐
  // 모달을 길게 만들 이유가 없다. 탭을 바꾸면 다시 접는다.
  const [showAll, setShowAll] = useState(false);
  // 되돌리기 후 목록을 다시 읽는다 — 상태 뱃지와 버튼 노출이 함께 갱신돼야 한다
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [influencerId, reloadKey, t]);

  const rows = useMemo(
    () => (state.kind === "ready" ? toRows(state.groups, filter) : []),
    [state, filter],
  );

  return (
    <div>
      <div className={styles.filterRow}>
        <SegmentedTabs
          className={styles.filterTabs}
          items={FILTER_ORDER.map((key) => ({ key, label: t(FILTER_LABEL[key]) }))}
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setShowAll(false);
          }}
        />
        {rows.length > 1 && (
          <div className={styles.toggle}>
            <span className={styles.toggleLabel}>
              {t("domains.influencer.notesDialog.expandAll", {
                count: rows.length,
              })}
            </span>
            <Switch
              checked={showAll}
              onChange={setShowAll}
              ariaLabel={t("domains.influencer.notesDialog.expandAll", {
                count: rows.length,
              })}
            />
          </div>
        )}
      </div>
      <HistoryBody
        state={state}
        rows={showAll ? rows : rows.slice(0, 1)}
        onRestored={() => setReloadKey((current) => current + 1)}
      />
    </div>
  );
}

function HistoryBody({
  state,
  rows,
  onRestored,
}: {
  state: ActivityState;
  rows: HistoryRow[];
  onRestored: () => void;
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
        <HistoryEntry key={row.key} row={row} onRestored={onRestored} />
      ))}
    </div>
  );
}

function HistoryEntry({ row, onRestored }: { row: HistoryRow; onRestored: () => void }) {
  const t = useT();
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleRestore = async () => {
    if (!row.restorableApplicationId) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      await restoreCancelledApplication(row.restorableApplicationId);
      onRestored();
    } catch {
      setRestoreError(t("domains.influencer.notesDialog.history.restoreFailed"));
      setRestoring(false);
    }
  };

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
            <SubTypeIcon key={subType} subType={subType} size="sm" />
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
      {row.reason && (
        <div className={styles.reason}>
          <span className={styles.reasonLabel}>{t(row.reason.labelKey)}</span>
          {row.reason.categoryKey && (
            <span className={styles.reasonCategory}>
              {t(row.reason.categoryKey)}
            </span>
          )}
          {row.reason.text}
        </div>
      )}
      {row.restorableApplicationId && (
        <div className={styles.restoreRow}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleRestore()}
            disabled={restoring}
          >
            {restoring
              ? t("domains.influencer.notesDialog.history.restoring")
              : t("domains.influencer.notesDialog.history.restore")}
          </Button>
          <span className={styles.restoreHint}>
            {t("domains.influencer.notesDialog.history.restoreHint")}
          </span>
          {restoreError && <span className={styles.error}>{restoreError}</span>}
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
