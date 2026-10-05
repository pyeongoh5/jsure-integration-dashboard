import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { ScrollTable } from "@/components/composites";
import { FollowerTrendChart, StatsTab } from "@/components/JwinCampaignForm";
import { useJwinBrandMetrics } from "@/components/JwinCampaignForm/useJwinBrandMetrics";
import {
  buildJwinMetricsCsv,
  jwinMetricsCsvFilename,
} from "@/components/JwinCampaigns/buildJwinMetricsCsv";
import { useJwinBrandCampaignsData, useJwinCampaignsData } from "@/components/JwinCampaigns";
import { triggerCsvDownload } from "@/domains/application";
import { fetchCampaignMetricsExport, jwinErrorMessage } from "@/domains/jwin";
import type { AdminMetricSnapshot } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinStats.module.css";

/** 증감 셀 — 전일(직전 스냅샷) 대비 변화량을 색으로 표시 */
function DeltaCell({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null) return <td className={styles.num}>-</td>;
  const delta = previous === null ? null : current - previous;
  return (
    <td className={styles.num}>
      {current.toLocaleString()}
      {delta !== null && delta !== 0 && (
        <span className={delta > 0 ? styles.deltaUp : styles.deltaDown}>
          {" "}
          ({delta > 0 ? "+" : ""}
          {delta.toLocaleString()})
        </span>
      )}
    </td>
  );
}

/**
 * 캠페인 통계 — 캠페인·브랜드를 셀렉트로 고르고,
 * 상단: 팔로워 추이(전폭 라인 차트)
 * 하단: 데일리 테이블(전일 대비 증감 병기) + 운영 현황(응모자·당첨·재고).
 */
export function JwinStats() {
  const t = useT();
  const campaigns = useJwinCampaignsData();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [brandCampaignId, setBrandCampaignId] = useState<string | null>(null);
  const brandCampaigns = useJwinBrandCampaignsData(campaignId);
  const metrics = useJwinBrandMetrics(brandCampaignId);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const campaignRows = campaigns.state.kind === "ready" ? campaigns.rows : [];

  // 첫 시즌·첫 브랜드 자동 선택 — 빈 화면으로 시작하지 않게
  useEffect(() => {
    if (!campaignId && campaignRows.length > 0) {
      setCampaignId(campaignRows[0]?.id ?? null);
    }
  }, [campaignId, campaignRows]);

  useEffect(() => {
    if (!brandCampaignId && brandCampaigns.rows.length > 0) {
      setBrandCampaignId(brandCampaigns.rows[0]?.id ?? null);
    }
  }, [brandCampaignId, brandCampaigns.rows]);

  const selectedCampaignRow = campaignRows.find((campaign) => campaign.id === campaignId);

  const handleExport = async () => {
    if (!campaignId || !selectedCampaignRow) return;
    setExporting(true);
    setExportError(null);
    try {
      const data = await fetchCampaignMetricsExport(campaignId);
      triggerCsvDownload(
        jwinMetricsCsvFilename(selectedCampaignRow.slug, new Date().toISOString().slice(0, 10)),
        buildJwinMetricsCsv(data),
      );
    } catch (error: unknown) {
      setExportError(jwinErrorMessage(error, t("jwin.statsPage.exportFailed")));
    } finally {
      setExporting(false);
    }
  };

  const snapshots = metrics.data.snapshots;
  const previousOf = (index: number): AdminMetricSnapshot | null =>
    index > 0 ? (snapshots[index - 1] ?? null) : null;

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>{t("jwin.statsPage.title")}</h1>

      <div className={styles.filterRow}>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>{t("jwin.statsPage.selectCampaign")}</span>
          <select
            className={styles.select}
            value={campaignId ?? ""}
            onChange={(event) => {
              setCampaignId(event.target.value || null);
              setBrandCampaignId(null);
            }}
          >
            {campaignRows.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} ({campaign.period})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span className={styles.filterLabel}>{t("jwin.statsPage.selectBrand")}</span>
          <select
            className={styles.select}
            value={brandCampaignId ?? ""}
            onChange={(event) => setBrandCampaignId(event.target.value || null)}
            disabled={brandCampaigns.rows.length === 0}
          >
            {brandCampaigns.rows.length === 0 && (
              <option value="">{t("jwin.statsPage.noBrands")}</option>
            )}
            {brandCampaigns.rows.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.brandName}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.exportSlot}>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void handleExport()}
            disabled={exporting || !campaignId}
          >
            <i className="fa-solid fa-download" aria-hidden="true" />{" "}
            {exporting ? t("jwin.statsPage.exporting") : t("jwin.statsPage.exportCsv")}
          </Button>
        </div>
      </div>

      {campaigns.state.kind === "error" && (
        <div className={styles.empty}>{campaigns.state.message}</div>
      )}
      {(metrics.loadError || exportError) && (
        <div className={styles.empty}>{metrics.loadError ?? exportError}</div>
      )}

      {brandCampaignId && (
        <>
          {/* 팔로워 추이 — 가로 전폭 */}
          <div className={styles.card}>
            {/* 데이터가 없어도 어떤 지표인지 제목은 보여준다 */}
            <h2 className={styles.sectionTitle}>{t("jwin.stats.chartFollowers")}</h2>
            {snapshots.length >= 2 ? (
              <FollowerTrendChart snapshots={snapshots} />
            ) : (
              <div className={styles.empty}>{t("jwin.stats.metricsEmpty")}</div>
            )}
          </div>

          {/* 데일리 지표 — 정밀값 + 전일 대비 증감 */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>{t("jwin.statsPage.dailyTitle")}</h2>
            {snapshots.length === 0 ? (
              <div className={styles.empty}>{t("jwin.stats.metricsEmpty")}</div>
            ) : (
              <ScrollTable minWidth={760}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("jwin.stats.metricsDate")}</th>
                      <th className={styles.num}>{t("jwin.stats.metricsFollowers")}</th>
                      <th className={styles.num}>{t("jwin.stats.metricsReposts")}</th>
                      <th className={styles.num}>{t("jwin.stats.metricsLikes")}</th>
                      <th className={styles.num}>{t("jwin.stats.metricsImpressions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snapshot, index) => {
                      const previous = previousOf(index);
                      return (
                        <tr key={`${snapshot.dateJst}-${snapshot.kind}`}>
                          <td>
                            {snapshot.dateJst}
                            {snapshot.kind === "BASELINE" && (
                              <span className={styles.hint}>
                                {" "}
                                ({t("jwin.stats.metricsBaselineTag")})
                              </span>
                            )}
                          </td>
                          <DeltaCell
                            current={snapshot.followerCount}
                            previous={previous?.followerCount ?? null}
                          />
                          <DeltaCell
                            current={snapshot.repostCount}
                            previous={previous?.repostCount ?? null}
                          />
                          <DeltaCell
                            current={snapshot.likeCount}
                            previous={previous?.likeCount ?? null}
                          />
                          <DeltaCell
                            current={snapshot.impressionCount}
                            previous={previous?.impressionCount ?? null}
                          />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollTable>
            )}
          </div>

          {/* 운영 현황·게시 실패 사유·경품 재고 */}
          <div className={styles.card}>
            <StatsTab
              campaignId={brandCampaignId}
              uniqueEntrants={metrics.data.uniqueEntrants}
            />
          </div>
        </>
      )}
    </div>
  );
}
