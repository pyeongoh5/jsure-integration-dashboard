import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  APPLICANT_EXPORT_MAX_ROWS,
  type ApplicantFilter,
  type CampaignCategory,
} from "@jsure/shared";
import {
  ApplicantFilters,
  ApplicantStatusFilter,
  ApplicantTable,
  ApplicantDialogs,
  ApplicationHistoryDialog,
  APPLICANT_STATUS_LABEL,
  applicantsCsvFilename,
  buildApplicantsCsv,
  exportApplicants,
  triggerCsvDownload,
  useApplicantsData,
  useCampaignOptions,
  useApplicantMutations,
  type Applicant,
  type ApplicantStatus,
  type MediaFilterKey,
  type HistoryTarget,
} from "@/domains/application";
import { InfluencerNotesDialog } from "@/domains/influencer";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
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
  const [mediaFilter, setMediaFilter] = useState<Set<MediaFilterKey>>(
    () => new Set(),
  );
  const [minFollowers, setMinFollowers] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<ApplicantStatus>>(
    () => new Set(),
  );
  const [categoryFilter, setCategoryFilter] =
    useState<CampaignCategory | null>(null);
  const [detailTarget, setDetailTarget] = useState<Applicant | null>(null);
  const [query, setQuery] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [csvPending, setCsvPending] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  const qc = useQueryClient();
  const debouncedQuery = useDebouncedValue(query, 300);

  // 서버 필터 조건. 목록과 CSV 가 같은 값을 쓰므로 둘의 결과가 어긋날 수 없다.
  // Set 은 정렬해서 담는다 — 선택 순서가 달라도 같은 쿼리로 취급하기 위해.
  const filter = useMemo<ApplicantFilter>(
    () => ({
      campaignId,
      mediaKeys: [...mediaFilter].sort(),
      viewStatuses: [...statusFilter].sort(),
      category: categoryFilter,
      minFollowers,
      query: debouncedQuery.trim(),
    }),
    [
      campaignId,
      mediaFilter,
      statusFilter,
      categoryFilter,
      minFollowers,
      debouncedQuery,
    ],
  );

  const { state, applicants, total, hasMore, loadingMore, loadMore, reload } =
    useApplicantsData(filter);
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

  // 목록 끝 감시자가 보이면 다음 페이지를 이어 붙인다.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleCsvDownload = useCallback(async () => {
    setCsvPending(true);
    setCsvMessage(null);
    try {
      // 화면에 불러온 페이지가 아니라 필터에 걸린 응모 전체를 받아온다.
      const response = await exportApplicants(filter);
      if (response.rows.length === 0) {
        setCsvMessage(t("pages.applicants.csvEmpty"));
        return;
      }
      triggerCsvDownload(
        applicantsCsvFilename(),
        buildApplicantsCsv(response.rows),
      );
      if (response.truncated) {
        setCsvMessage(
          t("pages.applicants.csvTruncated", {
            count: APPLICANT_EXPORT_MAX_ROWS,
          }),
        );
      }
    } catch (cause) {
      setCsvMessage(
        cause instanceof Error
          ? cause.message
          : t("pages.applicants.csvFailed"),
      );
    } finally {
      setCsvPending(false);
    }
  }, [filter, t]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{t("pages.applicants.title")}</h1>
          <p className={styles.subtitle}>
            {state.kind === "ready"
              ? t("common.itemCount", { count: total })
              : t("common.loading")}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            size="md"
            onClick={handleCsvDownload}
            disabled={csvPending || state.kind !== "ready" || total === 0}
            iconLeft={<i className="fa-solid fa-file-csv" aria-hidden="true" />}
          >
            {csvPending
              ? t("pages.applicants.csvDownloading")
              : t("pages.applicants.csvDownload")}
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={() => setDownloadOpen(true)}
            iconLeft={<i className="fa-solid fa-list" aria-hidden="true" />}
          >
            {t("pages.applicants.viewApprovedList")}
          </Button>
        </div>
      </div>

      {csvMessage && <div className={styles.mutationError}>{csvMessage}</div>}

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
        <>
          <ApplicantTable
            items={applicants}
            selected={selected}
            onToggleAll={(checked) =>
              setSelected(
                checked
                  ? new Set(applicants.map((applicant) => applicant.id))
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
          {hasMore && (
            <div ref={sentinelRef} className={styles.loadMore}>
              {loadingMore ? t("pages.applicants.loadingMore") : ""}
            </div>
          )}
        </>
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
