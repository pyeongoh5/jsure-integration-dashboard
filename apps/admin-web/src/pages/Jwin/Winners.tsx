import { useState } from "react";
import { Button } from "@/components/ui";
import { useJwinBrandCampaignsData, useJwinCampaignsData } from "@/components/JwinCampaigns";
import {
  buildJwinWinnersCsv,
  JwinWinnerFilters,
  JwinWinnerTable,
  jwinWinnersCsvFilename,
  MarkShippedDialog,
  ShippingDialog,
  useJwinWinnerMutations,
  useJwinWinnersData,
} from "@/components/JwinWinners";
import { triggerCsvDownload } from "@/domains/application";
import {
  fetchWinnersForExport,
  jwinErrorMessage,
  type AdminShipping,
  type AdminWinner,
  type AdminWinnerFilter,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "@/components/JwinWinners/JwinWinners.module.css";

/** 파일명용 오늘 날짜(로컬). CSV 내용의 일자는 서버가 준 JST 값을 그대로 쓴다. */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function JwinWinners() {
  const t = useT();
  const campaigns = useJwinCampaignsData();

  // 시즌 → 브랜드 2단 선택. 실제 조회 키는 참여(brandCampaignId) 다.
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [brandCampaignId, setBrandCampaignId] = useState<string | null>(null);
  const brandCampaigns = useJwinBrandCampaignsData(campaignId);
  const [filter, setFilter] = useState<AdminWinnerFilter>({});

  const winners = useJwinWinnersData(brandCampaignId, filter);
  const mutations = useJwinWinnerMutations();

  const [shippingOpen, setShippingOpen] = useState(false);
  const [shipping, setShipping] = useState<AdminShipping | null>(null);

  const [shipTarget, setShipTarget] = useState<AdminWinner | null>(null);
  const [shipPending, setShipPending] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const campaignRows = campaigns.state.kind === "ready" ? campaigns.rows : [];
  const campaignsError = campaigns.state.kind === "error" ? campaigns.state.message : null;
  const selectedCampaign = brandCampaigns.rows.find((brand) => brand.id === brandCampaignId);

  const handleViewShipping = async (winner: AdminWinner) => {
    setShipping(null);
    setShippingOpen(true);
    setShipping(await mutations.viewShipping(winner.id));
  };

  const handleMarkShipped = async () => {
    if (!shipTarget) return;
    setShipPending(true);
    setShipError(null);
    const result = await mutations.markShipped(shipTarget.id);
    setShipPending(false);
    if (typeof result === "string") {
      setShipError(result);
      return;
    }
    winners.applyWinnerUpdate(result);
    setShipTarget(null);
  };

  const handleExport = async () => {
    if (!brandCampaignId || !selectedCampaign) return;
    setExporting(true);
    setExportError(null);
    try {
      const data = await fetchWinnersForExport(brandCampaignId, filter);
      if (data.rows.length === 0) {
        setExportError(t("jwin.winner.export.emptyResult"));
        return;
      }
      triggerCsvDownload(
        jwinWinnersCsvFilename(selectedCampaign.brandSlug, todayIso()),
        buildJwinWinnersCsv(data),
      );
    } catch (error: unknown) {
      setExportError(jwinErrorMessage(error, t("jwin.winner.export.failed")));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("jwin.winner.title")}</h1>
        <Button onClick={handleExport} disabled={!brandCampaignId || exporting}>
          {exporting ? t("jwin.winner.export.running") : t("jwin.winner.export.button")}
        </Button>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.campaignField}>
          <span className={styles.filterLabel}>{t("jwin.winner.selectCampaign")}</span>
          <select
            className={styles.select}
            value={campaignId ?? ""}
            onChange={(event) => {
              setCampaignId(event.target.value || null);
              setBrandCampaignId(null);
            }}
          >
            <option value="">{t("jwin.winner.selectCampaign")}</option>
            {campaignRows.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} ({campaign.slug})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campaignField}>
          <span className={styles.filterLabel}>{t("jwin.winner.selectBrand")}</span>
          <select
            className={styles.select}
            value={brandCampaignId ?? ""}
            disabled={!campaignId}
            onChange={(event) => setBrandCampaignId(event.target.value || null)}
          >
            <option value="">{t("jwin.winner.selectBrand")}</option>
            {brandCampaigns.rows.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.brandName}
              </option>
            ))}
          </select>
        </label>

        <JwinWinnerFilters filter={filter} onChange={setFilter} disabled={!brandCampaignId} />
      </div>

      <p className={styles.exportNotice}>{t("jwin.winner.export.notice")}</p>

      {campaignsError ? <div className={styles.errorText}>{campaignsError}</div> : null}
      {brandCampaigns.loadError ? (
        <div className={styles.errorText}>{brandCampaigns.loadError}</div>
      ) : null}
      {winners.loadError ? <div className={styles.errorText}>{winners.loadError}</div> : null}
      {exportError ? <div className={styles.errorText}>{exportError}</div> : null}

      {!brandCampaignId ? (
        <div className={styles.empty}>{t("jwin.winner.selectCampaignHint")}</div>
      ) : null}

      {campaignId && winners.loading ? (
        <div className={styles.empty}>{t("jwin.winner.loading")}</div>
      ) : null}

      {campaignId && !winners.loading && winners.winners.length === 0 && !winners.loadError ? (
        <div className={styles.empty}>{t("jwin.winner.empty")}</div>
      ) : null}

      {winners.winners.length > 0 ? (
        <>
          <JwinWinnerTable
            winners={winners.winners}
            onViewShipping={(winner) => void handleViewShipping(winner)}
            onMarkShipped={(winner) => {
              setShipError(null);
              setShipTarget(winner);
            }}
          />
          {winners.hasMore ? (
            <div className={styles.loadMoreRow}>
              <Button
                variant="secondary"
                onClick={winners.loadMore}
                disabled={winners.loadingMore}
              >
                {winners.loadingMore ? t("jwin.winner.loading") : t("jwin.winner.loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <ShippingDialog
        open={shippingOpen}
        onClose={() => setShippingOpen(false)}
        loading={mutations.shippingLoading}
        error={mutations.shippingError}
        shipping={shipping}
      />

      <MarkShippedDialog
        open={shipTarget !== null}
        winner={shipTarget}
        onClose={() => setShipTarget(null)}
        onConfirm={() => void handleMarkShipped()}
        pending={shipPending}
        error={shipError}
      />
    </div>
  );
}
