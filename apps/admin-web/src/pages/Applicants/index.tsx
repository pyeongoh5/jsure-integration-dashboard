import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { CampaignCategory } from "@jsure/shared";
import {
  ApplicantFilters,
  ApplicantStatusFilter,
  ApplicantTable,
  ApplicantDialogs,
  ApplicationHistoryDialog,
  APPLICANT_STATUS_LABEL,
  useApplicantsData,
  useCampaignOptions,
  useApplicantMutations,
  type Applicant,
  type ApplicantStatus,
  type ApplicantMedia as Media,
  type HistoryTarget,
} from "@/domains/application";
import { InfluencerNotesDialog } from "@/domains/influencer";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { ApplicantDetailDialog } from "./ApplicantDetailDialog";
import { ApprovedApplicantsDialog } from "./ApprovedApplicantsDialog";
import styles from "./Applicants.module.css";

export function Applicants() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notesTarget, setNotesTarget] = useState<Applicant | null>(null);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  const [mediaFilter, setMediaFilter] = useState<Set<Media>>(() => new Set());
  const [minFollowers, setMinFollowers] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<ApplicantStatus>>(
    () => new Set(),
  );
  const [categoryFilter, setCategoryFilter] =
    useState<CampaignCategory | null>(null);
  const [detailTarget, setDetailTarget] = useState<Applicant | null>(null);
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
      if (categoryFilter !== null && applicant.category !== categoryFilter)
        return false;
      if (normalizedQuery) {
        const haystack =
          `${applicant.name} ${applicant.influencerId} ${applicant.allHandles.join(" ")}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [applicants, mediaFilter, minFollowers, statusFilter, categoryFilter, query]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{t("pages.applicants.title")}</h1>
          <p className={styles.subtitle}>
            {state.kind === "ready"
              ? t("common.itemCount", { count: visible.length })
              : t("common.loading")}
          </p>
        </div>
        <Button
          variant="success"
          size="md"
          onClick={() => setDownloadOpen(true)}
          iconLeft={<i className="fa-solid fa-list" aria-hidden="true" />}
        >
          {t("pages.applicants.viewApprovedList")}
        </Button>
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
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />
        <ApplicantStatusFilter value={statusFilter} onChange={setStatusFilter} />
        <div className={styles.searchSpacer} />
        <div className={styles.search}>
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder={t("pages.applicants.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
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
          onDetail={setDetailTarget}
          onHistory={(applicant) =>
            setHistoryTarget({
              applicationId: applicant.id,
              campaignTitle: applicant.campaign,
              influencerName: applicant.name,
              statusLabel: t(APPLICANT_STATUS_LABEL[applicant.status]),
            })
          }
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
        <ApprovedApplicantsDialog onClose={() => setDownloadOpen(false)} />
      )}

      {detailTarget && (
        <ApplicantDetailDialog
          applicant={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {historyTarget && (
        <ApplicationHistoryDialog
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
