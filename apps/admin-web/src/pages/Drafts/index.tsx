import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DraftDialogs,
  DraftTable,
  DraftTabs,
  InsightDetailDialog,
  REVIEW_STATUS_TO_TAB,
  useDraftMutations,
  useDraftReviewsData,
  type DraftReview,
  type DraftReviewTab,
} from "@/domains/application";
import styles from "./Drafts.module.css";

const VALID_TABS: DraftReviewTab[] = ["pending", "approved", "rejected"];

function isDraftTab(value: string | null): value is DraftReviewTab {
  return value !== null && (VALID_TABS as string[]).includes(value);
}

export function Drafts() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab: DraftReviewTab = isDraftTab(params.get("tab"))
    ? (params.get("tab") as DraftReviewTab)
    : "pending";
  const setTab = (next: DraftReviewTab) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("tab", next);
      return np;
    });
  };
  const [insightView, setInsightView] = useState<DraftReview | null>(null);
  const { state, drafts, counts, reload } = useDraftReviewsData();
  const mutations = useDraftMutations(reload);

  const visible = useMemo(
    () => drafts.filter((draft) => REVIEW_STATUS_TO_TAB[draft.reviewStatus] === tab),
    [drafts, tab],
  );

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>검토</h1>
        <p className={styles.subtitle}>
          {state.kind === "ready"
            ? `현재 탭 ${visible.length}건`
            : state.kind === "loading"
              ? "불러오는 중..."
              : ""}
        </p>
      </div>

      <DraftTabs value={tab} counts={counts} onChange={setTab} />

      {state.kind === "loading" ? (
        <div className={styles.card}>
          <div className={styles.empty}>불러오는 중…</div>
        </div>
      ) : state.kind === "error" ? (
        <div className={styles.card}>
          <div className={styles.empty}>{state.message}</div>
        </div>
      ) : (
        <DraftTable
          items={visible}
          showHistory={tab === "pending"}
          onApprove={mutations.openApprove}
          onReject={mutations.openReject}
          onUndo={mutations.openUndo}
          onSettle={async (draft) => {
            const ok = await mutations.settle(draft);
            if (ok) {
              qc.invalidateQueries({ queryKey: ["settlements-pending-count"] });
            }
          }}
          onViewInsight={setInsightView}
        />
      )}

      <DraftDialogs
        pending={mutations.pending}
        mutating={mutations.mutating}
        error={mutations.error}
        onConfirm={mutations.confirm}
        onCancel={mutations.cancel}
      />

      {insightView && (
        <InsightDetailDialog
          draft={insightView}
          onClose={() => setInsightView(null)}
        />
      )}
    </div>
  );
}
