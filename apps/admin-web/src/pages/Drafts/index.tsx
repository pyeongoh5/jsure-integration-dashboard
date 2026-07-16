import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { CampaignCategory } from "@jsure/shared";
import {
  ApplicantFilters,
  DraftDialogs,
  DraftStatusFilter,
  DraftTable,
  InsightDetailDialog,
  useCampaignOptions,
  useDraftMutations,
  useDraftReviewsData,
  type ApplicantMedia as Media,
  type DraftReview,
  type DraftStatus,
} from "@/domains/application";
import { InfluencerNotesDialog } from "@/domains/influencer";
import styles from "./Drafts.module.css";

export function Drafts() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
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
  const [statusFilter, setStatusFilter] = useState<Set<DraftStatus>>(
    () => new Set(),
  );
  const [categoryFilter, setCategoryFilter] =
    useState<CampaignCategory | null>(null);
  const [insightView, setInsightView] = useState<DraftReview | null>(null);
  const [notesTarget, setNotesTarget] = useState<DraftReview | null>(null);
  const { state, drafts, reload } = useDraftReviewsData();
  const {
    campaignOptions,
    campaignTitleById,
    loaded: campaignsLoaded,
  } = useCampaignOptions();
  const mutations = useDraftMutations(() => {
    reload();
    qc.invalidateQueries({ queryKey: ["submitted-posts-pending-count"] });
  });

  const visible = useMemo(
    () =>
      drafts.filter((draft) => {
        // 정산 흐름에 들어간 항목은 정산 관리 페이지에서 다루므로 검토 페이지에서 제외.
        if (draft.status === "SETTLEMENT_PENDING" || draft.status === "SETTLED") {
          return false;
        }
        if (campaignId && draft.campaignId !== campaignId) return false;
        if (
          mediaFilter.size > 0 &&
          !draft.media.some((mediaKey) => mediaFilter.has(mediaKey))
        )
          return false;
        if (statusFilter.size > 0 && !statusFilter.has(draft.status)) return false;
        if (categoryFilter !== null && draft.category !== categoryFilter) return false;
        return true;
      }),
    [drafts, campaignId, mediaFilter, statusFilter, categoryFilter],
  );

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>검토</h1>
        <p className={styles.subtitle}>
          {state.kind === "ready"
            ? `${visible.length}건`
            : state.kind === "loading"
              ? "불러오는 중..."
              : ""}
        </p>
      </div>

      <div className={styles.filterBar}>
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
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />
        <DraftStatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

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
          showHistory={statusFilter.size === 0 || statusFilter.has("REVIEW_PENDING")}
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
          currentCampaignId={notesTarget.campaignId}
          onClose={() => setNotesTarget(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
