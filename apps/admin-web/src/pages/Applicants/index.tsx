import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApplicantFilters,
  ApplicantStatusFilter,
  ApplicantTable,
  ApplicantDialogs,
  useApplicantsData,
  useCampaignOptions,
  useApplicantMutations,
  type Applicant,
  type ApplicantStatus,
  type ApplicantMedia as Media,
} from "@/domains/application";
import { InfluencerNotesDialog } from "@/domains/influencer";
import { ApprovedApplicantsDownloadDialog } from "./ApprovedApplicantsDownloadDialog";
import styles from "./Applicants.module.css";

export function Applicants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notesTarget, setNotesTarget] = useState<Applicant | null>(null);
  const [mediaFilter, setMediaFilter] = useState<Set<Media>>(() => new Set());
  const [minFollowers, setMinFollowers] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<ApplicantStatus>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);

  const qc = useQueryClient();
  const { state, applicants, reload } = useApplicantsData(campaignId);
  const {
    campaignOptions,
    campaignTitleById,
    loaded: campaignsLoaded,
  } = useCampaignOptions();
  const mutations = useApplicantMutations(() => {
    reload();
    qc.invalidateQueries({ queryKey: ["applications-applied-count"] });
  });

  const setCampaignId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("campaignId", id);
    else next.delete("campaignId");
    setSearchParams(next);
  };

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return applicants.filter((applicant) => {
      if (
        mediaFilter.size > 0 &&
        !applicant.media.some((media) => mediaFilter.has(media))
      ) {
        return false;
      }
      if (minFollowers !== null && applicant.followers < minFollowers)
        return false;
      if (statusFilter.size > 0 && !statusFilter.has(applicant.status))
        return false;
      if (normalizedQuery) {
        const haystack =
          `${applicant.name} ${applicant.influencerId} ${applicant.allHandles.join(" ")}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [applicants, mediaFilter, minFollowers, statusFilter, query]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>응모자 관리</h1>
          <p className={styles.subtitle}>
            {state.kind === "ready"
              ? `${visible.length}건`
              : "불러오는 중..."}
          </p>
        </div>
        <button
          type="button"
          className={styles.downloadBtn}
          onClick={() => setDownloadOpen(true)}
        >
          <i className="fa-solid fa-file-arrow-down" /> 승인자 명단 다운로드
        </button>
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
          minFollowers={minFollowers}
          onMinFollowersChange={setMinFollowers}
        />
        <ApplicantStatusFilter value={statusFilter} onChange={setStatusFilter} />
        <div className={styles.searchSpacer} />
        <div className={styles.search}>
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="이름·SNS 핸들·ID 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
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
        <ApplicantTable
          items={visible}
          selected={selected}
          onToggleAll={(checked) =>
            setSelected(
              checked
                ? new Set(visible.map((applicant) => applicant.id))
                : new Set(),
            )
          }
          onToggleOne={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onApprove={mutations.openApprove}
          onReject={mutations.openReject}
          onUndo={mutations.openUndo}
          onShip={mutations.openShip}
          onDeliver={mutations.openDeliver}
          onMemo={setNotesTarget}
        />
      )}

      <ApplicantDialogs
        pending={mutations.pending}
        mutating={mutations.mutating}
        error={mutations.error}
        onConfirm={mutations.confirm}
        onCancel={mutations.cancel}
      />

      {notesTarget && (
        <InfluencerNotesDialog
          influencerId={notesTarget.influencerId}
          influencerName={notesTarget.name}
          currentCampaignId={notesTarget.campaignId}
          onClose={() => setNotesTarget(null)}
          onChanged={reload}
        />
      )}

      {downloadOpen && (
        <ApprovedApplicantsDownloadDialog onClose={() => setDownloadOpen(false)} />
      )}
    </div>
  );
}
