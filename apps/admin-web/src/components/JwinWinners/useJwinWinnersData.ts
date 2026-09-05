import { useCallback, useEffect, useState } from "react";
import {
  fetchWinners,
  jwinErrorMessage,
  type AdminWinner,
  type AdminWinnerFilter,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type UseJwinWinnersDataResult = {
  loading: boolean;
  loadingMore: boolean;
  loadError: string | null;
  winners: AdminWinner[];
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
  /**
   * 이행 처리 결과를 목록에 반영한다. 목록 전체를 다시 읽지 않되,
   * 바뀐 값이 활성 필터에 더 이상 맞지 않으면 행을 뺀다 — 남겨두면 화면 목록이
   * 필터·CSV와 어긋난다.
   */
  applyWinnerUpdate: (updated: AdminWinner) => void;
};

/** 서버 필터와 같은 조건을 클라이언트에서도 판정한다 (값 비교뿐이라 규칙이 갈리지 않는다). */
function matchesFilter(winner: AdminWinner, filter: AdminWinnerFilter): boolean {
  if (filter.verification && winner.verification !== filter.verification) return false;
  if (filter.fulfillment && winner.fulfillment !== filter.fulfillment) return false;
  if (filter.prizeType && winner.prizeType !== filter.prizeType) return false;
  return true;
}

/**
 * 당첨자 목록. 필터는 서버가 걸고 커서로 이어 받는다.
 * 필터가 바뀌면 누적분을 버리고 처음부터 다시 읽는다 — 이전 필터 결과가 남으면
 * 화면 목록이 필터와 어긋난다.
 */
export function useJwinWinnersData(
  campaignId: string | null,
  filter: AdminWinnerFilter,
): UseJwinWinnersDataResult {
  const t = useT();
  const [winners, setWinners] = useState<AdminWinner[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 필터 객체는 매 렌더 새로 만들어지므로 값으로 비교되도록 직렬화해 의존성에 쓴다.
  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    if (!campaignId) {
      setWinners([]);
      setNextCursor(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchWinners(campaignId, JSON.parse(filterKey) as AdminWinnerFilter)
      .then((result) => {
        if (cancelled) return;
        setWinners(result.winners);
        setNextCursor(result.nextCursor);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setWinners([]);
        setNextCursor(null);
        setLoadError(jwinErrorMessage(error, t("jwin.winner.loadFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, filterKey, reloadKey, t]);

  const loadMore = useCallback(() => {
    if (!campaignId || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    fetchWinners(campaignId, JSON.parse(filterKey) as AdminWinnerFilter, nextCursor)
      .then((result) => {
        setWinners((current) => [...current, ...result.winners]);
        setNextCursor(result.nextCursor);
      })
      .catch((error: unknown) => {
        setLoadError(jwinErrorMessage(error, t("jwin.winner.loadFailed")));
      })
      .finally(() => setLoadingMore(false));
  }, [campaignId, filterKey, nextCursor, loadingMore, t]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  const applyWinnerUpdate = useCallback(
    (updated: AdminWinner) => {
      const filterValue = JSON.parse(filterKey) as AdminWinnerFilter;
      setWinners((current) =>
        matchesFilter(updated, filterValue)
          ? current.map((winner) => (winner.id === updated.id ? updated : winner))
          : current.filter((winner) => winner.id !== updated.id),
      );
    },
    [filterKey],
  );

  return {
    loading,
    loadingMore,
    loadError,
    winners,
    hasMore: nextCursor !== null,
    loadMore,
    reload,
    applyWinnerUpdate,
  };
}
