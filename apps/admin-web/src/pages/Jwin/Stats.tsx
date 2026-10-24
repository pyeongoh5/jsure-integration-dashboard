import { useState } from "react";
import { ScrollTable } from "@/components/composites";
import { FollowerTrendChart, StatsTab } from "@/components/JwinCampaignForm";
import { useJwinBrandMetrics } from "@/components/JwinCampaignForm/useJwinBrandMetrics";
import { useJwinBrandCampaignsData, useJwinCampaignsData } from "@/components/JwinCampaigns";
import { resolveSelectedId } from "@/components/JwinCampaigns/resolveSelectedId";
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
 *
 * 지표 CSV 다운로드 버튼은 요건 재확인까지 화면에서만 내렸다. 서버 라우트
 * (`/admin/campaigns/:id/metrics-export`)·`buildJwinMetricsCsv`·i18n 키는 그대로 있으니
 * 되살릴 때 버튼 JSX 와 핸들러만 다시 붙이면 된다.
 *
 * 상단: 팔로워 추이(전폭 라인 차트)
 * 하단: 데일리 테이블(전일 대비 증감 병기) + 운영 현황(응모자·당첨·재고).
 */
export function JwinStats() {
  const t = useT();
  const campaigns = useJwinCampaignsData();
  const [pickedCampaignId, setPickedCampaignId] = useState<string | null>(null);
  const [pickedBrandCampaignId, setPickedBrandCampaignId] = useState<string | null>(null);

  const campaignRows = campaigns.state.kind === "ready" ? campaigns.rows : [];

  // 조회 키는 목록에서 파생한다 (기본값 = 첫 항목). 선택 상태를 따로 들고 있으면
  // 목록이 바뀌는 사이 다른 시즌의 id 가 남아 "셀렉트는 A, 데이터는 B" 가 된다.
  const campaignId = resolveSelectedId(campaignRows, pickedCampaignId);
  const brandCampaigns = useJwinBrandCampaignsData(campaignId);
  const brandCampaignId = resolveSelectedId(brandCampaigns.rows, pickedBrandCampaignId);
  const metrics = useJwinBrandMetrics(brandCampaignId);

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
              setPickedCampaignId(event.target.value || null);
              setPickedBrandCampaignId(null);
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
            onChange={(event) => setPickedBrandCampaignId(event.target.value || null)}
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

      </div>

      {campaigns.state.kind === "error" && (
        <div className={styles.empty}>{campaigns.state.message}</div>
      )}
      {metrics.loadError && <div className={styles.empty}>{metrics.loadError}</div>}

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
