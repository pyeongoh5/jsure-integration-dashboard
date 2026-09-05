import { useEffect, useState } from "react";
import { fetchCampaignStats, jwinErrorMessage, type AdminCampaignStats } from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type UseJwinCampaignStatsResult = {
  loading: boolean;
  loadError: string | null;
  stats: AdminCampaignStats | null;
};

/**
 * 통계 탭 데이터. 탭을 열 때마다 새로 읽는다 — 게시 실패·재고는 스케줄러가
 * 계속 바꾸는 값이라 캐시를 오래 들고 있으면 운영자가 옛 숫자를 보고 판단하게 된다.
 */
export function useJwinCampaignStats(campaignId: string): UseJwinCampaignStatsResult {
  const t = useT();
  const [stats, setStats] = useState<AdminCampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchCampaignStats(campaignId)
      .then((result) => {
        if (!cancelled) setStats(result);
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

  return { loading, loadError, stats };
}
