import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApplicantFilters,
  DraftDialogs,
  DraftTable,
  DraftTabs,
  InsightDetailDialog,
  REVIEW_STATUS_TO_TAB,
  useCampaignOptions,
  useDraftMutations,
  useDraftReviewsData,
  type ApplicantMedia as Media,
  type DraftReview,
  type DraftReviewTab,
} from "@/domains/application";
import { InfluencerNotesDialog } from "@/domains/influencer";
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
  const campaignId = params.get("campaignId");
  const setCampaignId = (id: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("campaignId", id);
      else next.delete("campaignId");
      return next;
    });
  };
  const [mediaFilter, setMediaFilter] = useState<Set<Media>>(() => new Set());
  const [insightView, setInsightView] = useState<DraftReview | null>(null);
  const [notesTarget, setNotesTarget] = useState<DraftReview | null>(null);
  const { state, drafts, counts, reload } = useDraftReviewsData();
  const {
    campaignOptions,
    campaignTitleById,
    loaded: campaignsLoaded,
  } = useCampaignOptions();
  const mutations = useDraftMutations(reload);

  const visible = useMemo(
    () =>
      drafts.filter((draft) => {
        if (REVIEW_STATUS_TO_TAB[draft.reviewStatus] !== tab) return false;
        if (campaignId && draft.campaignId !== campaignId) return false;
        if (mediaFilter.size > 0 && !mediaFilter.has(draft.media)) return false;
        return true;
      }),
    [drafts, tab, campaignId, mediaFilter],
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

      <ApplicantFilters
        campaignId={campaignId}
        campaignLabel={
          campaignId ? (campaignTitleById.get(campaignId) ?? null) : null
        }
        campaignsLoaded={campaignsLoaded}
        campaignOptions={campaignOptions}
        onCampaignChange={setCampaignId}
        mediaFilter={mediaFilter}
        onMediaChange={setMediaFilter}
        showStageFilter={false}
        stageFilter={new Set()}
        onStageChange={() => {}}
      />

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
          onMemo={setNotesTarget}
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

      {notesTarget && (
        <InfluencerNotesDialog
          influencerId={notesTarget.influencerId}
          influencerName={notesTarget.influencerName}
          onClose={() => setNotesTarget(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
