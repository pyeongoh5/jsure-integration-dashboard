import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type {
  CampaignCategory,
  DraftViewStatus,
  SubmissionFilter,
} from "@jsure/shared";
import {
  ApplicantFilters,
  ApplicationHistoryDialog,
  DraftDialogs,
  DraftStatusFilter,
  DraftTable,
  DRAFT_STATUS_LABEL,
  InsightDetailDialog,
  useCampaignOptions,
  useDraftMutations,
  useDraftReviewsData,
  type MediaFilterKey,
  type DraftReview,
  type HistoryTarget,
} from "@/domains/application";
import { InfluencerNotesDialog } from "@/domains/influencer";
import { useT } from "@/lib/i18n";
import styles from "./Drafts.module.css";

export function Drafts() {
  const t = useT();
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
  const [mediaFilter, setMediaFilter] = useState<Set<MediaFilterKey>>(
    () => new Set(),
  );
  const [statusFilter, setStatusFilter] = useState<Set<DraftViewStatus>>(
    () => new Set(),
  );
  const [categoryFilter, setCategoryFilter] =
    useState<CampaignCategory | null>(null);
  const [insightView, setInsightView] = useState<DraftReview | null>(null);
  const [notesTarget, setNotesTarget] = useState<DraftReview | null>(null);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  // 서버 필터 조건. Set 은 정렬해서 담는다 — 선택 순서가 달라도 같은 쿼리로 취급하기 위해.
  const filter = useMemo<SubmissionFilter>(
    () => ({
      campaignId,
      mediaKeys: [...mediaFilter].sort(),
      viewStatuses: [...statusFilter].sort(),
      category: categoryFilter,
    }),
    [campaignId, mediaFilter, statusFilter, categoryFilter],
  );

  const {
    state,
    drafts,
    total,
    hasMore,
    loadingMore,
    loadMore,
    reload,
    patchInfluencerTags,
  } = useDraftReviewsData(filter);
  const {
    campaignOptions,
    campaignTitleById,
    loaded: campaignsLoaded,
  } = useCampaignOptions();
  const mutations = useDraftMutations(() => {
    reload();
    qc.invalidateQueries({ queryKey: ["submitted-posts-pending-count"] });
  });

  // 목록 끝 감시자가 보이면 다음 페이지를 이어 붙인다. 감시자는 테이블의 스크롤
  // 컨테이너 안에 렌더되고(DraftTable footer), root 도 그 컨테이너로 잡는다.
  // 바깥에 두면 항상 화면에 보여 스크롤 없이도 계속 다음 페이지를 불러온다.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // 콜백은 ref 로 갈아끼운다. loadMore 를 의존성에 두면 페치 상태가 토글될 때마다
  // 감시자가 재등록되고, 이미 보이는 감시 영역에 대해 콜백이 즉시 다시 울려
  // 페이지가 연달아 요청된다.
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { root: node.closest("[data-scroll-root]"), rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, drafts.length]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("pages.drafts.title")}</h1>
        <p className={styles.subtitle}>
          {state.kind === "ready"
            ? t("common.itemCount", { count: total })
            : state.kind === "loading"
              ? t("common.loading")
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
          <div className={styles.empty}>{t("common.loading")}</div>
        </div>
      ) : state.kind === "error" ? (
        <div className={styles.card}>
          <div className={styles.empty}>{state.message}</div>
        </div>
      ) : (
        <DraftTable
          items={drafts}
          showHistory={statusFilter.size === 0 || statusFilter.has("REVIEW_PENDING")}
          onApprove={mutations.openApprove}
          onReject={mutations.openReject}
          onUndo={mutations.openUndo}
          onForceCancel={mutations.openForceCancel}
          onSettle={async (draft) => {
            const ok = await mutations.settle(draft);
            if (ok) {
              qc.invalidateQueries({ queryKey: ["settlements-pending-count"] });
            }
          }}
          onViewInsight={setInsightView}
          onMemo={setNotesTarget}
          onHistory={(draft) =>
            setHistoryTarget({
              applicationId: draft.id,
              campaignTitle: draft.campaignTitle,
              influencerName: draft.influencerName,
              statusLabel: t(DRAFT_STATUS_LABEL[draft.status]),
            })
          }
          footer={
            hasMore ? (
              <div ref={sentinelRef} className={styles.loadMore}>
                {loadingMore ? t("pages.applicants.loadingMore") : ""}
              </div>
            ) : null
          }
        />
      )}

      <DraftDialogs
        pending={mutations.pending}
        mutating={mutations.mutating}
        error={mutations.error}
        onConfirm={mutations.confirm}
        onCancel={mutations.cancel}
      />

      {historyTarget && (
        <ApplicationHistoryDialog
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {insightView && (
        <InsightDetailDialog
          draft={insightView}
          onClose={() => setInsightView(null)}
          onSaved={reload}
        />
      )}

      {notesTarget && (
        <InfluencerNotesDialog
          influencerId={notesTarget.influencerId}
          influencerName={notesTarget.influencerName}
          currentCampaignId={notesTarget.campaignId}
          onClose={() => setNotesTarget(null)}
          onChanged={reload}
          onTagsChanged={(tags) =>
            patchInfluencerTags(notesTarget.influencerId, tags)
          }
        />
      )}
    </div>
  );
}
