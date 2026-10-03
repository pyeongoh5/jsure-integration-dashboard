import { useEffect, useState } from "react";
import { fetchBrandMetrics, jwinErrorMessage, type AdminMetricSnapshot } from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type JwinBrandMetricsSummary = {
  /** 첫 게시 직후 팔로워 (기준점). 수집 전이면 null */
  baselineFollowers: number | null;
  /** 가장 최근 스냅샷의 팔로워 */
  latestFollowers: number | null;
  /** 기준점 대비 순증 (기준점·최신 둘 다 있어야 계산) */
  followerDelta: number | null;
  totalReposts: number;
  totalLikes: number;
  totalReplies: number;
};

/** 스냅샷 목록 → 요약. 순수 함수 — 테스트 대상. */
export function summarizeMetrics(snapshots: AdminMetricSnapshot[]): JwinBrandMetricsSummary {
  const baseline = snapshots.find((snapshot) => snapshot.kind === "BASELINE") ?? null;
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const dailies = snapshots.filter((snapshot) => snapshot.kind === "DAILY");
  return {
    baselineFollowers: baseline?.followerCount ?? null,
    latestFollowers: latest?.followerCount ?? null,
    followerDelta:
      baseline && latest ? latest.followerCount - baseline.followerCount : null,
    totalReposts: dailies.reduce((sum, snapshot) => sum + (snapshot.repostCount ?? 0), 0),
    totalLikes: dailies.reduce((sum, snapshot) => sum + (snapshot.likeCount ?? 0), 0),
    totalReplies: dailies.reduce((sum, snapshot) => sum + (snapshot.replyCount ?? 0), 0),
  };
}

export type UseJwinBrandMetricsResult = {
  loading: boolean;
  loadError: string | null;
  snapshots: AdminMetricSnapshot[];
  summary: JwinBrandMetricsSummary;
};

/** 참여 성과 지표 — 통계 탭에서 매번 새로 읽는다. */
export function useJwinBrandMetrics(brandCampaignId: string): UseJwinBrandMetricsResult {
  const t = useT();
  const [snapshots, setSnapshots] = useState<AdminMetricSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchBrandMetrics(brandCampaignId)
      .then((result) => {
        if (!cancelled) setSnapshots(result.snapshots);
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

  return { loading, loadError, snapshots, summary: summarizeMetrics(snapshots) };
}
