import { useEffect, useState } from "react";
import { ScrollTable } from "@/components/composites";
import { StatsTab } from "@/components/JwinCampaignForm";
import { useJwinCampaignsData } from "@/components/JwinCampaigns";
import { fetchCampaignStatsSummary, jwinErrorMessage } from "@/domains/jwin";
import type { AdminCampaignStatsSummary } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinStats.module.css";

/**
 * 캠페인 통계 — 시즌을 고르면 참여 브랜드별 성과(응모·당첨·팔로워·포스트 반응)를
 * 한 표로 본다. 행을 누르면 참여 편집의 통계 탭(일자별 상세)으로 간다.
 */
export function JwinStats() {
  const t = useT();
  const campaigns = useJwinCampaignsData();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [selectedBrandCampaignId, setSelectedBrandCampaignId] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminCampaignStatsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const campaignRows = campaigns.state.kind === "ready" ? campaigns.rows : [];

  // 시즌 목록이 오면 첫 시즌을 자동 선택한다 — 빈 화면으로 시작하지 않게
  useEffect(() => {
    if (!campaignId && campaignRows.length > 0) {
      setCampaignId(campaignRows[0]?.id ?? null);
    }
  }, [campaignId, campaignRows]);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchCampaignStatsSummary(campaignId)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(jwinErrorMessage(error, t("jwin.stats.loadFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, t]);

  const delta = (baseline: number | null, latest: number | null) =>
    baseline !== null && latest !== null ? latest - baseline : null;

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>{t("jwin.statsPage.title")}</h1>

      <div className={styles.filterRow}>
        <select
          className={styles.select}
          value={campaignId ?? ""}
          onChange={(event) => {
            setCampaignId(event.target.value || null);
            setSelectedBrandCampaignId(null);
          }}
        >
          {campaignRows.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} ({campaign.period})
            </option>
          ))}
        </select>
      </div>

      {campaigns.state.kind === "error" && (
        <div className={styles.empty}>{campaigns.state.message}</div>
      )}
      {loadError && <div className={styles.empty}>{loadError}</div>}
      {loading && !summary && <div className={styles.empty}>{t("jwin.common.loading")}</div>}

      {summary && summary.brands.length === 0 && (
        <div className={styles.empty}>{t("jwin.statsPage.empty")}</div>
      )}

      {summary && summary.brands.length > 0 && (
        <div className={styles.card}>
          <ScrollTable minWidth={960}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("jwin.statsPage.columns.brand")}</th>
                  <th className={styles.num}>{t("jwin.stats.entries")}</th>
                  <th className={styles.num}>{t("jwin.stats.winConfirmed")}</th>
                  <th className={styles.num}>{t("jwin.stats.metricsBaseline")}</th>
                  <th className={styles.num}>{t("jwin.stats.metricsFollowers")}</th>
                  <th className={styles.num}>{t("jwin.statsPage.columns.followerDelta")}</th>
                  <th className={styles.num}>{t("jwin.stats.metricsReposts")}</th>
                  <th className={styles.num}>{t("jwin.stats.metricsLikes")}</th>
                  <th className={styles.num}>{t("jwin.stats.metricsReplies")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.brands.map((brand) => {
                  const followerDelta = delta(brand.baselineFollowers, brand.latestFollowers);
                  return (
                    <tr
                      key={brand.brandCampaignId}
                      className={
                        brand.brandCampaignId === selectedBrandCampaignId
                          ? `${styles.row} ${styles.rowSelected}`
                          : styles.row
                      }
                      onClick={() => setSelectedBrandCampaignId(brand.brandCampaignId)}
                    >
                      <td>{brand.brandName}</td>
                      <td className={styles.num}>{brand.entries.toLocaleString()}</td>
                      <td className={styles.num}>{brand.winConfirmed.toLocaleString()}</td>
                      <td className={styles.num}>
                        {brand.baselineFollowers?.toLocaleString() ?? t("jwin.common.dash")}
                      </td>
                      <td className={styles.num}>
                        {brand.latestFollowers?.toLocaleString() ?? t("jwin.common.dash")}
                      </td>
                      <td className={styles.num}>
                        {followerDelta === null
                          ? t("jwin.common.dash")
                          : `${followerDelta >= 0 ? "+" : ""}${followerDelta.toLocaleString()}`}
                      </td>
                      <td className={styles.num}>{brand.totalReposts.toLocaleString()}</td>
                      <td className={styles.num}>{brand.totalLikes.toLocaleString()}</td>
                      <td className={styles.num}>{brand.totalReplies.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
          <p className={styles.hint}>{t("jwin.statsPage.rowHint")}</p>
        </div>
      )}

      {/* 선택한 브랜드의 상세 — 운영 카드·게시 실패 사유·일자별 지표·경품 재고 */}
      {selectedBrandCampaignId && (
        <div className={styles.card}>
          <StatsTab campaignId={selectedBrandCampaignId} />
        </div>
      )}
    </div>
  );
}
