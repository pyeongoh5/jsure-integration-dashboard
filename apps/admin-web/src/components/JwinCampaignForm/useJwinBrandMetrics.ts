import { useEffect, useState } from "react";
import { fetchBrandMetrics, jwinErrorMessage, type AdminBrandMetrics } from "@/domains/jwin";
import { useT } from "@/lib/i18n";

const EMPTY: AdminBrandMetrics = {
  snapshots: [],
  entriesByDate: [],
  uniqueEntrants: 0,
  totalEntries: 0,
};

/** 월(0)~일(6) 순서의 요일별 응모 수. 순수 함수 — 도넛 차트 입력. */
export function entriesByWeekday(
  entriesByDate: { dateJst: string; count: number }[],
): number[] {
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of entriesByDate) {
    // dateJst 는 달력 날짜 문자열 — UTC 자정으로 고정해 요일을 구한다 (월=0)
    const utcDay = new Date(`${entry.dateJst}T00:00:00Z`).getUTCDay();
    const mondayFirst = (utcDay + 6) % 7;
    byWeekday[mondayFirst] = (byWeekday[mondayFirst] ?? 0) + entry.count;
  }
  return byWeekday;
}

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
