import { useEffect, useState } from "react";
import { fetchBrandMetrics, jwinErrorMessage, type AdminBrandMetrics } from "@/domains/jwin";
import { useT } from "@/lib/i18n";

const EMPTY: AdminBrandMetrics = {
  snapshots: [],
  uniqueEntrants: 0,
  totalEntries: 0,
};

export type UseJwinBrandMetricsResult = {
  loading: boolean;
  loadError: string | null;
  data: AdminBrandMetrics;
};

/** 참여 성과 지표 — 통계 화면에서 매번 새로 읽는다. */
export function useJwinBrandMetrics(brandCampaignId: string | null): UseJwinBrandMetricsResult {
  const t = useT();
  const [data, setData] = useState<AdminBrandMetrics>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandCampaignId) {
      setData(EMPTY);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchBrandMetrics(brandCampaignId)
      .then((result) => {
        if (!cancelled) setData(result);
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
  }, [brandCampaignId, t]);

  return { loading, loadError, data };
}
